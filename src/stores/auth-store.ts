import { create } from "zustand";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Profile } from "../types/database";
import { enqueueMutation } from "../lib/offline-queue";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isDemo: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInDemo: () => void;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePreferredUnit: (unit: "lbs" | "kg") => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isDemo: false,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Get initial session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      set({
        session,
        user: session?.user ?? null,
      });

      if (session?.user) {
        await get().fetchProfile(session.user.id);
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });

        if (session?.user) {
          await get().fetchProfile(session.user.id);
        } else {
          set({ profile: null });
        }
      });
    } catch (err) {
      console.error("Failed to initialize auth:", err);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  fetchProfile: async (userId: string) => {
    if (userId === DEMO_USER_ID || get().isDemo) {
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Notice fetching profile:", error.message);
        // Fallback: create a local profile using auth user metadata
        const currentUser = get().user;
        if (currentUser) {
          set({
            profile: {
              id: userId,
              display_name:
                currentUser.user_metadata?.full_name ||
                currentUser.email?.split("@")[0] ||
                "Lifter",
              preferred_weight_unit: "lbs",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }
        return;
      }

      if (data) {
        set({ profile: data as Profile });
      } else {
        // Fallback if profile doesn't exist yet
        const currentUser = get().user;
        if (currentUser) {
          set({
            profile: {
              id: userId,
              display_name:
                currentUser.user_metadata?.full_name ||
                currentUser.email?.split("@")[0] ||
                "Lifter",
              preferred_weight_unit: "lbs",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.warn("Notice fetching profile:", err);
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      set({ isDemo: false });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      set({ isLoading: false });
    }
  },

  signInDemo: () => {
    const demoUser = {
      id: DEMO_USER_ID,
      email: "guest@minlift.local",
      user_metadata: { full_name: "Guest" },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any;

    set({
      session: {
        access_token: "demo-token",
        refresh_token: "demo-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: demoUser,
      } as any,
      user: demoUser,
      profile: {
        id: DEMO_USER_ID,
        display_name: "Guest",
        preferred_weight_unit: "lbs",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isDemo: true,
      isLoading: false,
    });
  },

  signUp: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim(),
          },
        },
      });

      if (error) {
        return { error };
      }

      // If user was created, also attempt to upsert profile record
      if (data.user) {
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            display_name: displayName.trim(),
            preferred_weight_unit: "lbs",
          });
        } catch {
          // Trigger handles this if direct upsert fails
        }
      }

      set({ isDemo: false });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      set({ isLoading: false });
    }
  },

  updatePreferredUnit: async (unit: "lbs" | "kg") => {
    const { user, isDemo, profile } = get();

    // 1. Optimistic local state update
    if (profile) {
      set({
        profile: {
          ...profile,
          preferred_weight_unit: unit,
          updated_at: new Date().toISOString(),
        },
      });
    }

    if (!user || isDemo || user.id === DEMO_USER_ID) {
      return { success: true };
    }

    // 2. Persist to Supabase
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_weight_unit: unit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        console.warn("Notice updating preferred unit:", error.message);
        await enqueueMutation("UPDATE_PREFERENCES", {
          userId: user.id,
          preferredWeightUnit: unit,
        });
        return { success: true };
      }

      return { success: true };
    } catch (err: any) {
      await enqueueMutation("UPDATE_PREFERENCES", {
        userId: user.id,
        preferredWeightUnit: unit,
      });
      return { success: true };
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      if (!get().isDemo) {
        await supabase.auth.signOut();
      }
      set({ session: null, user: null, profile: null, isDemo: false });
    } catch (err) {
      console.error("Failed to sign out:", err);
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;

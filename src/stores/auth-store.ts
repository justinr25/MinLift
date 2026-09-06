import { create } from "zustand";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Profile } from "../types/database";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
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

      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      set({ isLoading: false });
    }
  },

  signInDemo: () => {
    const demoUser = {
      id: "demo-lifter-1",
      email: "justin@minlift.local",
      user_metadata: { full_name: "Justin" },
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
        id: "demo-lifter-1",
        display_name: "Justin",
        preferred_weight_unit: "lbs",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
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

      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
      set({ session: null, user: null, profile: null });
    } catch (err) {
      console.error("Failed to sign out:", err);
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;

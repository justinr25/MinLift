import { create } from "zustand";
import { Platform } from "react-native";
import {
  getPendingCount,
  processMutationQueue,
} from "../lib/offline-queue";
import { supabase } from "../lib/supabase";

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;

  // Actions
  setOnline: (isOnline: boolean) => void;
  refreshPendingCount: () => Promise<number>;
  syncPendingMutations: () => Promise<{ processed: number; errors: number }>;
  checkConnection: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,

  setOnline: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline) {
      // Auto-flush queue when coming back online
      get().syncPendingMutations();
    }
  },

  refreshPendingCount: async () => {
    const count = await getPendingCount();
    set({ pendingCount: count });
    return count;
  },

  checkConnection: async () => {
    // If running in browser, check navigator.onLine first
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.onLine) {
      set({ isOnline: false });
      return false;
    }

    try {
      // Ping Supabase with a lightweight query
      const { error } = await supabase.from("workout_types").select("id").limit(1);
      const online = !error || error.code !== "PGRST301";
      set({ isOnline: online });
      return online;
    } catch {
      set({ isOnline: false });
      return false;
    }
  },

  syncPendingMutations: async () => {
    if (get().isSyncing) {
      return { processed: 0, errors: 0 };
    }

    set({ isSyncing: true, error: null });

    try {
      const result = await processMutationQueue();
      const remainingCount = await getPendingCount();

      set({
        isSyncing: false,
        pendingCount: remainingCount,
        lastSyncedAt: result.processed > 0 ? new Date().toISOString() : get().lastSyncedAt,
      });

      return result;
    } catch (err: any) {
      console.error("syncPendingMutations exception:", err);
      set({
        isSyncing: false,
        error: err?.message || "Sync failed",
      });
      return { processed: 0, errors: 1 };
    }
  },
}));

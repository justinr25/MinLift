import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useSyncStore } from "../stores/sync-store";

export function useOfflineSync() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    error,
    setOnline,
    refreshPendingCount,
    syncPendingMutations,
    checkConnection,
  } = useSyncStore();

  const handleOnline = useCallback(() => {
    setOnline(true);
    syncPendingMutations();
  }, [setOnline, syncPendingMutations]);

  const handleOffline = useCallback(() => {
    setOnline(false);
  }, [setOnline]);

  useEffect(() => {
    // Initial status check
    refreshPendingCount();
    checkConnection();

    // Browser network listeners
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [handleOnline, handleOffline, refreshPendingCount, checkConnection]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    error,
    syncNow: syncPendingMutations,
    refreshPendingCount,
  };
}

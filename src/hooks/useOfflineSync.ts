import { useEffect, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
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
    }

    // Native AppState listener: refresh & sync when app comes to foreground
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          checkConnection().then((online) => {
            refreshPendingCount();
            if (online) {
              syncPendingMutations();
            }
          });
        }
      }
    );

    return () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      subscription.remove();
    };
  }, [
    handleOnline,
    handleOffline,
    refreshPendingCount,
    checkConnection,
    syncPendingMutations,
  ]);

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

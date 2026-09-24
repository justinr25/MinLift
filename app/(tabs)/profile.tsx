import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore, DEMO_USER_ID } from "../../src/stores/auth-store";
import { CardContainer } from "../../src/components/ui/CardContainer";
import { PrimaryButton } from "../../src/components/ui/PrimaryButton";
import { useOfflineSync } from "../../src/hooks/useOfflineSync";
import { supabase } from "../../src/lib/supabase";

interface WeekVolumeBucket {
  label: string;
  volume: number;
  sessionCount: number;
}

export default function ProfileTabScreen() {
  const router = useRouter();
  const { user, profile, isDemo, isLoading: isAuthLoading, signOut, updatePreferredUnit } =
    useAuthStore();
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  const [isUpdatingUnit, setIsUpdatingUnit] = useState(false);
  const [weeklyBuckets, setWeeklyBuckets] = useState<WeekVolumeBucket[]>([
    { label: "W-4", volume: 0, sessionCount: 0 },
    { label: "W-3", volume: 0, sessionCount: 0 },
    { label: "W-2", volume: 0, sessionCount: 0 },
    { label: "W-1", volume: 0, sessionCount: 0 },
    { label: "This Wk", volume: 0, sessionCount: 0 },
  ]);
  const [totalVolumeAllTime, setTotalVolumeAllTime] = useState(0);
  const [totalSessionsAllTime, setTotalSessionsAllTime] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const preferredUnit = profile?.preferred_weight_unit || "lbs";
  const displayName = isDemo
    ? "Guest Lifter"
    : profile?.display_name || user?.user_metadata?.full_name || "Lifter";

  const memberSince = useMemo(() => {
    if (isDemo) return "Aug 2026";
    const dateStr = profile?.created_at || user?.created_at;
    if (!dateStr) return "2026";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return "2026";
    }
  }, [isDemo, profile?.created_at, user?.created_at]);

  // Fetch 5-week volume & consistency stats
  const fetchVolumeStats = useCallback(async () => {
    if (!user || isDemo || user.id === DEMO_USER_ID) {
      setWeeklyBuckets([
        { label: "W-4", volume: 0, sessionCount: 0 },
        { label: "W-3", volume: 0, sessionCount: 0 },
        { label: "W-2", volume: 0, sessionCount: 0 },
        { label: "W-1", volume: 0, sessionCount: 0 },
        { label: "This Wk", volume: 0, sessionCount: 0 },
      ]);
      setTotalVolumeAllTime(0);
      setTotalSessionsAllTime(0);
      return;
    }

    setIsLoadingStats(true);

    try {
      // 1. Fetch total completed sessions
      const { data: workoutsData } = await supabase
        .from("workouts")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .not("completed_at", "is", null);

      const totalWorkouts = workoutsData?.length || 0;
      setTotalSessionsAllTime(totalWorkouts);

      // 2. Fetch completed sets from the last 35 days (5 weeks)
      const fiveWeeksAgo = new Date();
      fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);
      fiveWeeksAgo.setHours(0, 0, 0, 0);

      const { data: setsData } = await supabase
        .from("workout_sets")
        .select(`
          weight,
          reps,
          is_completed,
          workouts!inner (
            id,
            completed_at,
            user_id,
            deleted_at
          )
        `)
        .eq("is_completed", true)
        .eq("workouts.user_id", user.id)
        .is("workouts.deleted_at", null)
        .not("workouts.completed_at", "is", null)
        .gte("workouts.completed_at", fiveWeeksAgo.toISOString());

      // Prepare 5 weekly buckets: [0: W-4, 1: W-3, 2: W-2, 3: W-1, 4: This Wk]
      const buckets: WeekVolumeBucket[] = [
        { label: "W-4", volume: 0, sessionCount: 0 },
        { label: "W-3", volume: 0, sessionCount: 0 },
        { label: "W-2", volume: 0, sessionCount: 0 },
        { label: "W-1", volume: 0, sessionCount: 0 },
        { label: "This Wk", volume: 0, sessionCount: 0 },
      ];

      const nowTime = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const sessionCountMap: Record<number, Set<string>> = {
        0: new Set(),
        1: new Set(),
        2: new Set(),
        3: new Set(),
        4: new Set(),
      };

      if (setsData) {
        setsData.forEach((s: any) => {
          const w = s.workouts;
          if (!w || !w.completed_at) return;
          const completedMs = new Date(w.completed_at).getTime();
          const diffMs = Math.max(0, nowTime - completedMs);
          const weekIndexFromNow = Math.floor(diffMs / ONE_WEEK_MS); // 0 = This Wk, 1 = W-1, ...
          const bucketIdx = 4 - weekIndexFromNow;

          const setVolume = (Number(s.weight) || 0) * (Number(s.reps) || 0);

          if (bucketIdx >= 0 && bucketIdx < 5) {
            buckets[bucketIdx].volume += setVolume;
            sessionCountMap[bucketIdx].add(w.id);
          }
        });
      }

      for (let i = 0; i < 5; i++) {
        buckets[i].sessionCount = sessionCountMap[i].size;
      }

      const fiveWeekVol = buckets.reduce((acc, b) => acc + b.volume, 0);
      setWeeklyBuckets(buckets);
      setTotalVolumeAllTime(fiveWeekVol);
    } catch (err) {
      console.warn("Notice loading profile volume stats from Supabase, attempting local store fallback:", err);
      // Fallback: estimate stats from cached workout-store sessions
      try {
        const { useWorkoutStore } = await import("../../src/stores/workout-store");
        const localWorkouts = useWorkoutStore.getState().workouts || [];
        setTotalSessionsAllTime(localWorkouts.length);
      } catch (localErr) {
        console.warn("Could not calculate local volume stats:", localErr);
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, [user?.id, isDemo]);

  useFocusEffect(
    useCallback(() => {
      fetchVolumeStats();
    }, [fetchVolumeStats])
  );

  const handleToggleUnit = async () => {
    setIsUpdatingUnit(true);
    const nextUnit = preferredUnit === "lbs" ? "kg" : "lbs";
    await updatePreferredUnit(nextUnit);
    setIsUpdatingUnit(false);
  };

  const handleSyncPress = async () => {
    await syncNow();
    await fetchVolumeStats();
  };

  const handlePromptSignOut = () => {
    let message = "Are you sure you want to sign out of MinLift?";
    if (pendingCount > 0) {
      message = `You have ${pendingCount} unsynced offline mutation${
        pendingCount === 1 ? "" : "s"
      }. Signing out now may result in unsynced workout data being lost. Are you sure you want to sign out?`;
    }

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) {
        signOut().then(() => {
          router.replace("/(auth)/sign-in" as any);
        });
      }
      return;
    }

    Alert.alert("Sign Out", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in" as any);
        },
      },
    ]);
  };

  // Calculate maximum volume for dynamic bar heights
  const maxWeeklyVolume = useMemo(() => {
    return Math.max(...weeklyBuckets.map((b) => b.volume), 0);
  }, [weeklyBuckets]);

  const hasAnyVolume = maxWeeklyVolume > 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Top Header matching Wireframe 11 */}
        <View className="mb-6">
          <Text className="text-[28px] font-bold text-primary tracking-tight">
            Profile
          </Text>
          <Text className="text-[14px] text-secondary mt-0.5">
            Account & preferences
          </Text>
        </View>

        {/* User Card matching Wireframe 11 */}
        <CardContainer className="flex-row items-center p-4 mb-6">
          {/* Avatar Circle */}
          <View className="w-14 h-14 rounded-full bg-surface border border-border-subtle items-center justify-center mr-4">
            <Ionicons name="person" size={26} color="#000000" />
          </View>

          {/* User Info */}
          <View className="flex-1">
            <Text className="text-[18px] font-bold text-primary tracking-tight" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-[13px] text-secondary mt-0.5">
              Lifting since {memberSince}
            </Text>
            {!isDemo && user?.email ? (
              <Text className="text-[12px] text-muted mt-0.5" numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </CardContainer>

        {/* STATS & TRENDS Section matching Wireframe 11 */}
        <View className="mb-6">
          <Text className="text-[12px] font-bold text-muted tracking-wider uppercase mb-2.5 ml-0.5">
            Stats & Trends
          </Text>

          <CardContainer className="p-5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[16px] font-bold text-primary">
                Volume & Consistency Tracking
              </Text>
              {isLoadingStats && <ActivityIndicator size="small" color="#9CA3AF" />}
            </View>

            <Text className="text-[13px] text-secondary leading-5 mb-6">
              Graphical breakdowns of your historical push/pull loads, session frequencies, and strength gains will appear here.
            </Text>

            {/* 5-Bar Volume Preview matching Wireframe 11 */}
            <View className="items-center justify-center pt-2 pb-3">
              <View className="flex-row items-end justify-between w-full px-4 h-[90px] border-b border-border-subtle/60 pb-2">
                {weeklyBuckets.map((bucket, idx) => {
                  let barHeight = 20;
                  let isPeak = false;

                  if (hasAnyVolume) {
                    const ratio = bucket.volume / maxWeeklyVolume;
                    barHeight = Math.max(Math.round(ratio * 75), 12);
                    isPeak = bucket.volume === maxWeeklyVolume && bucket.volume > 0;
                  } else {
                    // Minimal flat baseline bars when 0 logged volume in 5-week window
                    barHeight = 6;
                    isPeak = false;
                  }

                  return (
                    <View key={bucket.label} className="items-center">
                      {/* Bar */}
                      <View
                        style={{ height: barHeight, width: 34 }}
                        className={`rounded-md transition-all ${
                          isPeak
                            ? "bg-primary"
                            : hasAnyVolume
                            ? "bg-[#E5E7EB]"
                            : "bg-border-subtle"
                        }`}
                      />
                      {/* Bucket Label */}
                      <Text
                        className={`text-[11px] font-medium mt-2 ${
                          isPeak ? "text-primary font-bold" : "text-muted"
                        }`}
                      >
                        {bucket.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Volume Summary Stats */}
              <View className="flex-row items-center justify-between w-full px-2 pt-3">
                <View>
                  <Text className="text-[11px] text-muted uppercase font-semibold">
                    5-Wk Volume
                  </Text>
                  <Text className="text-[15px] font-mono font-bold text-primary mt-0.5">
                    {totalVolumeAllTime > 0
                      ? `${totalVolumeAllTime.toLocaleString()} ${preferredUnit}`
                      : `— ${preferredUnit}`}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="text-[11px] text-muted uppercase font-semibold">
                    All-Time Sessions
                  </Text>
                  <Text className="text-[15px] font-mono font-bold text-primary mt-0.5">
                    {totalSessionsAllTime} {totalSessionsAllTime === 1 ? "workout" : "workouts"}
                  </Text>
                </View>
              </View>
            </View>
          </CardContainer>
        </View>

        {/* SETTINGS Section matching Wireframe 11 */}
        <View className="mb-8">
          <Text className="text-[12px] font-bold text-muted tracking-wider uppercase mb-2.5 ml-0.5">
            Settings
          </Text>

          <View className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
            {/* Row 1: Preferred Unit (Lbs / Kg) */}
            <View className="flex-row items-center justify-between p-4 border-b border-border-subtle/80">
              <View className="flex-1 mr-3">
                <Text className="text-[15px] font-semibold text-primary">
                  Preferred Unit ({preferredUnit === "lbs" ? "Lbs" : "Kg"})
                </Text>
                <Text className="text-[12px] text-secondary mt-0.5">
                  Default weight unit for active logging and volume
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggleUnit}
                disabled={isUpdatingUnit}
                className="bg-white border border-border-subtle px-3.5 py-1.5 rounded-lg flex-row items-center"
              >
                {isUpdatingUnit ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text className="text-[13px] font-semibold text-primary">
                    Toggle
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Row 2: Backup & Sync matching Wireframe 11 */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSyncPress}
              disabled={isSyncing}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-1 mr-3">
                <Text className="text-[15px] font-semibold text-primary">
                  Backup & Sync
                </Text>
                <Text className="text-[12px] text-secondary mt-0.5">
                  {isSyncing
                    ? "Syncing mutations to Supabase..."
                    : pendingCount > 0
                    ? `${pendingCount} offline mutations pending`
                    : isOnline
                    ? "Synced with Supabase Cloud"
                    : "Offline mode — mutations cached locally"}
                </Text>
              </View>

              <View className="flex-row items-center">
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#000000" style={{ marginRight: 6 }} />
                ) : pendingCount > 0 ? (
                  <View className="bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full mr-2">
                    <Text className="text-[11px] font-bold text-amber-800">
                      {pendingCount} Pending
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name={isOnline ? "cloud-done" : "cloud-offline"}
                    size={18}
                    color={isOnline ? "#10B981" : "#9CA3AF"}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text className="text-[13px] font-medium text-secondary">
                  {isSyncing ? "Syncing" : isOnline ? "Cloud" : "Offline"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Full-Width Solid Black Sign Out Button matching Wireframe 11 */}
        <View className="mb-4">
          <PrimaryButton
            title="Sign Out"
            variant="primary"
            loading={isAuthLoading}
            onPress={handlePromptSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

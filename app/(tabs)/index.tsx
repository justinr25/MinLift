import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore, DEMO_USER_ID } from "../../src/stores/auth-store";
import { useActiveWorkoutStore } from "../../src/stores/active-workout-store";
import { CardContainer } from "../../src/components/ui/CardContainer";
import { supabase } from "../../src/lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, isDemo } = useAuthStore();
  const isWorkoutActive = useActiveWorkoutStore((s) => s.isActive);
  const activeTypeName = useActiveWorkoutStore((s) => s.workoutTypeName);

  const [lastWorkout, setLastWorkout] = useState<{
    id: string;
    typeName: string;
    locationName: string | null;
    completedAt: string;
    exerciseCount: number;
  } | null>(null);

  const [weeklySessions, setWeeklySessions] = useState<{
    count: number;
    activeDayIndices: number[];
  }>({ count: 0, activeDayIndices: [] });

  const fetchDashboardData = useCallback(async () => {
    if (!user || isDemo || user.id === DEMO_USER_ID) {
      setLastWorkout(null);
      setWeeklySessions({ count: 0, activeDayIndices: [] });
      return;
    }

    try {
      // 1. Fetch most recent completed workout
      const { data: latestData, error: latestError } = await supabase
        .from("workouts")
        .select("id, completed_at, workout_types(name), locations(name), workout_sets(exercise_id)")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestError && latestData) {
        const rawSets = (latestData as any).workout_sets || [];
        const uniqueExercises = new Set(rawSets.map((s: any) => s.exercise_id)).size;

        setLastWorkout({
          id: latestData.id,
          typeName: (latestData as any).workout_types?.name || "Workout",
          locationName: (latestData as any).locations?.name || null,
          completedAt: latestData.completed_at
            ? new Date(latestData.completed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent",
          exerciseCount: uniqueExercises,
        });
      } else {
        setLastWorkout(null);
      }

      // 2. Fetch workouts for the current week (Monday 00:00:00 to now)
      const now = new Date();
      const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
      const distanceToMonday = (currentDay + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);
      monday.setHours(0, 0, 0, 0);

      const { data: weekData, error: weekError } = await supabase
        .from("workouts")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .gte("completed_at", monday.toISOString());

      if (!weekError && weekData) {
        const days = new Set<number>();
        weekData.forEach((w: any) => {
          if (w.completed_at) {
            const d = new Date(w.completed_at);
            const dayIdx = (d.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
            days.add(dayIdx);
          }
        });
        setWeeklySessions({ count: weekData.length, activeDayIndices: Array.from(days) });
      } else {
        setWeeklySessions({ count: 0, activeDayIndices: [] });
      }
    } catch (err) {
      console.warn("Notice loading dashboard data:", err);
      setLastWorkout(null);
      setWeeklySessions({ count: 0, activeDayIndices: [] });
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "Lifter";

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Top Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-[28px] font-bold text-primary tracking-tight">
              MinLift
            </Text>
            <Text className="text-[15px] text-secondary mt-0.5">
              Welcome back, {displayName}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/profile" as any)}
            className="w-11 h-11 rounded-full bg-surface border border-border-subtle items-center justify-center"
          >
            <Ionicons name="person" size={20} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Active Workout Banner (If workout in progress) */}
        {isWorkoutActive && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/workout" as any)}
            className="mb-6"
          >
            <View className="bg-primary rounded-xl p-4 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-3">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <View>
                  <Text className="text-white text-[15px] font-semibold">
                    Workout in Progress: {activeTypeName}
                  </Text>
                  <Text className="text-muted text-[13px]">
                    Tap to resume logging
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* LAST WORKOUT Section */}
        <View className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            Last Workout
          </Text>

          {lastWorkout ? (
            <CardContainer>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[20px] font-bold text-primary">
                  {lastWorkout.typeName}
                </Text>
                <View className="bg-white border border-border-subtle px-2.5 py-1 rounded-full">
                  <Text className="text-[12px] font-medium text-secondary">
                    {lastWorkout.completedAt}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center space-x-4 mt-2">
                <View className="flex-row items-center">
                  <Ionicons name="location-sharp" size={15} color="#6B7280" />
                  <Text className="text-[14px] text-secondary ml-1">
                    {lastWorkout.locationName || "No location specified"}
                  </Text>
                </View>
                <View className="flex-row items-center ml-3">
                  <Ionicons name="barbell-outline" size={15} color="#6B7280" />
                  <Text className="text-[14px] text-secondary ml-1">
                    {lastWorkout.exerciseCount} {lastWorkout.exerciseCount === 1 ? "exercise" : "exercises"} completed
                  </Text>
                </View>
              </View>
            </CardContainer>
          ) : (
            <CardContainer className="py-5">
              <Text className="text-[16px] font-semibold text-primary">
                No Workouts Logged Yet
              </Text>
              <Text className="text-[13px] text-secondary mt-1 leading-5">
                Start a new session below to see your workout summary here.
              </Text>
            </CardContainer>
          )}
        </View>

        {/* WEEKLY ACTIVITY Section */}
        <View className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            Weekly Activity
          </Text>

          <CardContainer>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[15px] font-semibold text-primary">
                This Week
              </Text>
              <Text className="text-[14px] text-secondary">
                {weeklySessions.count} {weeklySessions.count === 1 ? "session" : "sessions"} logged
              </Text>
            </View>

            {/* Day indicator dots: Mon Tue Wed Thu Fri Sat Sun */}
            <View className="flex-row items-center justify-between pt-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => {
                const isLogged = weeklySessions.activeDayIndices.includes(idx);
                return (
                  <View key={idx} className="items-center">
                    <Text className="text-[12px] font-medium text-muted mb-2">
                      {day}
                    </Text>
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        isLogged
                          ? "bg-primary"
                          : "bg-white border border-border-subtle"
                      }`}
                    >
                      {isLogged ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </CardContainer>
        </View>

        {/* QUICK START SHORTCUT */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/(tabs)/workout" as any)}
        >
          <CardContainer className="border-dashed border-[1.5px] border-border-dashed items-center py-6">
            <Ionicons name="add-circle-outline" size={32} color="#000000" />
            <Text className="text-[16px] font-semibold text-primary mt-2">
              Start a New Workout
            </Text>
            <Text className="text-[13px] text-secondary mt-1">
              Go to Workout tab to choose routine
            </Text>
          </CardContainer>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

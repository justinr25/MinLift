import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useWorkoutStore, HistoryWorkoutItem } from "../../../src/stores/workout-store";
import { useAuthStore } from "../../../src/stores/auth-store";

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

export default function HistoryFeedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { workouts, isLoading, fetchWorkouts } = useWorkoutStore();

  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
    }, [user?.id])
  );

  const handleOpenDetail = (workoutId: string) => {
    router.push(`/(tabs)/history/${workoutId}` as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchWorkouts}
            tintColor="#000000"
          />
        }
      >
        {/* Header */}
        <View className="mb-5">
          <Text className="text-[28px] font-bold text-primary tracking-tight">
            History
          </Text>
          <Text className="text-[14px] text-secondary mt-0.5">
            Past completed workout sessions
          </Text>
        </View>

        {/* Loading Spinner for initial load */}
        {isLoading && workouts.length === 0 && (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="small" color="#000000" />
            <Text className="text-[13px] text-secondary mt-3">Loading history...</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && workouts.length === 0 && (
          <View className="py-16 px-6 items-center justify-center bg-surface rounded-2xl border border-border-subtle mt-2">
            <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-3 shadow-sm">
              <Ionicons name="calendar-outline" size={24} color="#6B7280" />
            </View>
            <Text className="text-[17px] font-semibold text-primary text-center">
              No Workouts Logged Yet
            </Text>
            <Text className="text-[14px] text-secondary text-center mt-1 leading-5">
              Complete your first workout in the Workout tab to see your training history.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(tabs)/workout" as any)}
              className="mt-5 bg-primary px-5 py-2.5 rounded-xl"
            >
              <Text className="text-[14px] font-semibold text-white">
                Go to Workout Tab
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Workout Cards matching Wireframe 8 */}
        {workouts.map((workout: HistoryWorkoutItem) => (
          <TouchableOpacity
            key={workout.id}
            activeOpacity={0.7}
            onPress={() => handleOpenDetail(workout.id)}
            className="p-4 mb-3 rounded-2xl bg-surface border border-border-subtle"
          >
            {/* Top Row: Title + Date Badge */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[18px] font-bold text-primary">
                {workout.workoutTypeName}
              </Text>
              <View className="bg-canvas border border-border-subtle px-2.5 py-1 rounded-full">
                <Text className="text-[12px] font-medium text-secondary">
                  {formatDate(workout.startedAt)}
                </Text>
              </View>
            </View>

            {/* Middle Row: Gym Location */}
            <View className="flex-row items-center mb-1.5">
              <Ionicons name="location-outline" size={15} color="#6B7280" />
              <Text className="text-[14px] text-secondary ml-1.5">
                {workout.locationName || "No location specified"}
              </Text>
            </View>

            {/* Bottom Row: Exercise Count */}
            <View className="flex-row items-center">
              <Ionicons name="list-outline" size={15} color="#6B7280" />
              <Text className="text-[13px] text-secondary ml-1.5">
                {workout.exerciseCount} {workout.exerciseCount === 1 ? "exercise" : "exercises"} completed ({workout.totalSets} {workout.totalSets === 1 ? "set" : "sets"})
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

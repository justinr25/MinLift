import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useActiveWorkoutStore } from "../../../src/stores/active-workout-store";
import { useWorkoutTimer } from "../../../src/hooks/useWorkoutTimer";
import { HeroStartButton } from "../../../src/components/ui/HeroStartButton";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { DashedActionCard } from "../../../src/components/ui/DashedActionCard";
import { ExerciseLoggerCard } from "../../../src/components/workout/ExerciseLoggerCard";
import { AddExerciseSheet } from "../../../src/components/workout/AddExerciseSheet";

export default function WorkoutTabScreen() {
  const router = useRouter();
  const {
    isActive,
    workoutTypeName,
    locationName,
    exercises,
    isSaving,
    discardWorkout,
    addExercise,
    removeExercise,
    addSet,
    removeSet,
    updateSet,
    toggleSetComplete,
    finishWorkout,
  } = useActiveWorkoutStore();

  const { formattedTime } = useWorkoutTimer();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const handleStartFlow = () => {
    // Navigate within the Workout tab stack - keeps bottom nav bar visible!
    router.push("/(tabs)/workout/select-location" as any);
  };

  const handlePromptDiscard = () => {
    Alert.alert(
      "Discard Workout",
      "Are you sure you want to discard this workout? Current set progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardWorkout(),
        },
      ]
    );
  };

  const handleFinish = async () => {
    const res = await finishWorkout();
    if (res.success) {
      router.replace("/(tabs)" as any);
    } else {
      Alert.alert("Notice", res.error || "Failed to save workout.");
    }
  };

  // ============================================
  // IDLE STATE: Hero Start Button
  // ============================================
  if (!isActive) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 px-5 pt-4 items-center justify-center">
          <View className="items-center mb-8">
            <HeroStartButton onPress={handleStartFlow} />
            <Text className="text-[15px] font-medium text-secondary mt-4">
              Tap to initiate a new session
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // ACTIVE STATE: Active Workout Logger
  // ============================================
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Active Workout Header */}
      <View className="px-5 py-3 border-b border-border-subtle bg-white flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-[20px] font-bold text-primary tracking-tight">
            {workoutTypeName || "Active Workout"}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Ionicons name="location-sharp" size={14} color="#6B7280" />
            <Text className="text-[13px] text-secondary ml-1">
              {locationName || "No location"}
            </Text>
          </View>
        </View>

        {/* Timer Badge & Options Menu */}
        <View className="flex-row items-center space-x-2">
          {/* Elapsed Timer Pill */}
          <View className="flex-row items-center bg-surface border border-border-subtle px-3 py-1.5 rounded-full">
            <Ionicons name="time-outline" size={14} color="#000000" />
            <Text className="text-[14px] font-mono font-bold text-primary ml-1.5">
              {formattedTime}
            </Text>
          </View>

          {/* Three Dots Menu for Discard */}
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handlePromptDiscard}
            className="w-9 h-9 rounded-full bg-surface border border-border-subtle items-center justify-center ml-2"
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Logger Scroll Area */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Exercise Logger Cards */}
        {exercises.map((exercise) => (
          <ExerciseLoggerCard
            key={exercise.id}
            exercise={exercise}
            onAddSet={addSet}
            onRemoveExercise={removeExercise}
            onUpdateSet={updateSet}
            onToggleSet={toggleSetComplete}
          />
        ))}

        {/* Add Exercise Action */}
        <View className="mt-2 mb-6">
          <DashedActionCard
            label="+ Add Exercise"
            onPress={() => setShowAddSheet(true)}
          />
        </View>
      </ScrollView>

      {/* Sticky Bottom Finish Button */}
      <View className="px-5 py-3 border-t border-border-subtle bg-white">
        <PrimaryButton
          title="Finish Workout"
          loading={isSaving}
          onPress={handleFinish}
        />
      </View>

      {/* Add Exercise Bottom Sheet */}
      <AddExerciseSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelectExercise={addExercise}
      />
    </SafeAreaView>
  );
}

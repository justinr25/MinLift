import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DashedActionCard } from "../../../src/components/ui/DashedActionCard";
import { useActiveWorkoutStore } from "../../../src/stores/active-workout-store";

interface WorkoutTypeItem {
  id: string;
  name: string;
  defaultExercises?: Array<{ id: string; name: string; category: string }>;
}

export default function SelectWorkoutTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationId?: string; locationName?: string }>();
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);

  const [workoutTypes, setWorkoutTypes] = useState<WorkoutTypeItem[]>([
    {
      id: "type-push",
      name: "Push",
      defaultExercises: [
        { id: "ex-bench-press", name: "Barbell Bench Press", category: "Chest" },
        { id: "ex-incline-db-press", name: "Incline Dumbbell Press", category: "Chest" },
        { id: "ex-lateral-raise", name: "Dumbbell Lateral Raise", category: "Shoulders" },
      ],
    },
    {
      id: "type-pull",
      name: "Pull",
      defaultExercises: [
        { id: "ex-barbell-row", name: "Barbell Bent-Over Row", category: "Back" },
        { id: "ex-lat-pulldown", name: "Lat Pulldown", category: "Back" },
        { id: "ex-bicep-curl", name: "Dumbbell Bicep Curl", category: "Arms" },
      ],
    },
    {
      id: "type-legs",
      name: "Legs",
      defaultExercises: [
        { id: "ex-barbell-squat", name: "Barbell Back Squat", category: "Legs" },
        { id: "ex-romanian-deadlift", name: "Romanian Deadlift", category: "Legs" },
        { id: "ex-calf-raise", name: "Standing Calf Raise", category: "Legs" },
      ],
    },
  ]);

  const handleSelectType = (item: WorkoutTypeItem) => {
    // 1. Initialize active workout in Zustand store
    startWorkout({
      workoutTypeId: item.id,
      workoutTypeName: item.name,
      locationId: params.locationId || null,
      locationName: params.locationName || null,
    });

    // 2. Pre-fill starter exercise suggestions for routine
    if (item.defaultExercises && item.defaultExercises.length > 0) {
      item.defaultExercises.forEach((ex) => {
        addExercise(ex);
      });
    }

    // 3. Navigate directly to active workout logger within Workout tab
    router.replace("/(tabs)/workout" as any);
  };

  const handleCreateNewType = (name: string) => {
    if (!name.trim()) return;
    const newType: WorkoutTypeItem = {
      id: `type-${Date.now()}`,
      name: name.trim(),
    };
    setWorkoutTypes((prev) => [...prev, newType]);
    handleSelectType(newType);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Top Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-border-subtle">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>
        <Text className="text-[20px] font-bold text-primary">
          Select Workout Type
        </Text>
      </View>

      {/* Main List */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">
          Workout Types
        </Text>

        {/* Preset Type Cards */}
        {workoutTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            activeOpacity={0.7}
            onPress={() => handleSelectType(type)}
            className="flex-row items-center justify-between p-4 mb-3 bg-surface rounded-2xl border border-border-subtle"
          >
            <Text className="text-[18px] font-semibold text-primary">
              {type.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}

        {/* Dashed Create New Type Card */}
        <View className="mt-1 mb-6">
          <DashedActionCard
            label="+ Create New Type"
            allowInlineInput
            placeholder="e.g. Arms & Core"
            onSubmitInput={handleCreateNewType}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

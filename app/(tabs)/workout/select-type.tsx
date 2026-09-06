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
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { useActiveWorkoutStore } from "../../../src/stores/active-workout-store";

interface WorkoutTypeItem {
  id: string;
  name: string;
}

export default function SelectWorkoutTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationId?: string; locationName?: string }>();
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);

  const [workoutTypes, setWorkoutTypes] = useState<WorkoutTypeItem[]>([
    { id: "type-push", name: "Push" },
    { id: "type-pull", name: "Pull" },
    { id: "type-legs", name: "Legs" },
  ]);

  const [selectedTypeId, setSelectedTypeId] = useState<string>("type-push");

  const handleNext = () => {
    const selected = workoutTypes.find((t) => t.id === selectedTypeId) || workoutTypes[0];
    if (!selected) return;

    // 1. Initialize active workout in Zustand store (with empty exercises)
    startWorkout({
      workoutTypeId: selected.id,
      workoutTypeName: selected.name,
      locationId: params.locationId || null,
      locationName: params.locationName || null,
    });

    // 2. Navigate directly to active workout logger within Workout tab
    router.replace("/(tabs)/workout" as any);
  };

  const handleCreateNewType = (name: string) => {
    if (!name.trim()) return;
    const newType: WorkoutTypeItem = {
      id: `type-${Date.now()}`,
      name: name.trim(),
    };
    setWorkoutTypes((prev) => [...prev, newType]);
    setSelectedTypeId(newType.id);
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
        {workoutTypes.map((type) => {
          const isSelected = selectedTypeId === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.7}
              onPress={() => setSelectedTypeId(type.id)}
              className={`flex-row items-center justify-between p-4 mb-3 rounded-2xl border ${
                isSelected
                  ? "bg-white border-primary border-2 shadow-sm"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <Text className="text-[18px] font-semibold text-primary">
                {type.name}
              </Text>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color="#000000" />
              ) : null}
            </TouchableOpacity>
          );
        })}

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

      {/* Bottom Actions */}
      <View className="px-5 py-4 border-t border-border-subtle bg-white">
        <PrimaryButton
          title="Next"
          onPress={handleNext}
          disabled={!selectedTypeId}
        />
      </View>
    </SafeAreaView>
  );
}

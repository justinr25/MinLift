import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useWorkoutStore, DetailExerciseItem, DetailSetItem } from "../../../src/stores/workout-store";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { DashedActionCard } from "../../../src/components/ui/DashedActionCard";
import { AddExerciseSheet } from "../../../src/components/workout/AddExerciseSheet";

function formatDateSubtitle(isoString: string, location?: string | null): string {
  try {
    const d = new Date(isoString);
    const dateFormatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (location) {
      return `${dateFormatted} at ${location}`;
    }
    return dateFormatted;
  } catch {
    return location || "Completed workout";
  }
}

// Editable Set Row Component with direct tap-to-edit and auto-save
function EditableSetRow({
  set,
  exerciseId,
  onUpdateSet,
  onDeleteSet,
}: {
  set: DetailSetItem;
  exerciseId: string;
  onUpdateSet: (setId: string, reps: number, weight: number) => void;
  onDeleteSet: (setId: string, exerciseId: string) => void;
}) {
  const [reps, setReps] = useState(set.reps);
  const [weight, setWeight] = useState(set.weight);

  useEffect(() => {
    setReps(set.reps);
  }, [set.reps]);

  useEffect(() => {
    setWeight(set.weight);
  }, [set.weight]);

  const handleBlur = () => {
    const numReps = parseInt(reps, 10) || 0;
    const numWeight = parseFloat(weight) || 0;
    if (numReps !== Number(set.reps) || numWeight !== Number(set.weight)) {
      onUpdateSet(set.id, numReps, numWeight);
    }
  };

  return (
    <View className="flex-row items-center py-2 border-b border-border-subtle">
      {/* Set Number */}
      <Text className="w-8 text-center text-[15px] font-bold text-primary">
        {set.setNumber}
      </Text>

      {/* Reps Input */}
      <View className="flex-1 mx-2">
        <View className="h-11 bg-white border border-border-subtle rounded-xl px-2 items-center justify-center">
          <TextInput
            value={reps}
            onChangeText={setReps}
            onBlur={handleBlur}
            keyboardType="numeric"
            className="w-full text-center text-[16px] font-mono font-bold text-primary"
            selectTextOnFocus
          />
        </View>
      </View>

      {/* Weight Input with lbs suffix */}
      <View className="flex-1 mx-2">
        <View className="h-11 bg-white border border-border-subtle rounded-xl px-2 flex-row items-center justify-center">
          <TextInput
            value={weight}
            onChangeText={setWeight}
            onBlur={handleBlur}
            keyboardType="decimal-pad"
            className="flex-1 text-center text-[16px] font-mono font-bold text-primary"
            selectTextOnFocus
          />
          <Text className="text-[12px] font-medium text-muted mr-1">lbs</Text>
        </View>
      </View>

      {/* Delete Set Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onDeleteSet(set.id, exerciseId)}
        className="w-8 h-8 items-center justify-center rounded-full ml-1"
      >
        <Ionicons name="remove-circle-outline" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentDetail,
    isLoading,
    isSaving,
    fetchWorkoutDetail,
    updateSet,
    deleteSet,
    addSetToExercise,
    addExerciseToWorkout,
    deleteExerciseFromWorkout,
    reorderExercises,
    updateWorkoutNotes,
    deleteWorkout,
  } = useWorkoutStore();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [notes, setNotes] = useState(currentDetail?.notes || "");

  useEffect(() => {
    if (id) {
      fetchWorkoutDetail(id);
    }
  }, [id]);

  useEffect(() => {
    setNotes(currentDetail?.notes || "");
  }, [currentDetail?.notes]);

  const handleBlurNotes = () => {
    if (id && notes !== (currentDetail?.notes || "")) {
      updateWorkoutNotes(id, notes);
    }
  };

  const handlePromptDeleteExercise = (ex: DetailExerciseItem) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Remove ${ex.name} and all its sets from this workout?`)) {
        if (id) deleteExerciseFromWorkout(id, ex.id);
      }
      return;
    }
    Alert.alert(
      "Remove Exercise",
      `Remove ${ex.name} and all its sets from this workout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (id) deleteExerciseFromWorkout(id, ex.id);
          },
        },
      ]
    );
  };

  const handleMoveExercise = (index: number, direction: "up" | "down") => {
    if (!currentDetail) return;
    const items = [...currentDetail.exercises];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    reorderExercises(items);
  };

  const handlePromptDeleteWorkout = () => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          "Are you sure you want to delete this workout session? This action cannot be undone."
        )
      ) {
        if (!id) return;
        deleteWorkout(id).then((res) => {
          if (res.success) {
            router.replace("/(tabs)/history" as any);
          } else if (typeof window !== "undefined") {
            window.alert(res.error || "Failed to delete workout.");
          }
        });
      }
      return;
    }
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to delete this workout session? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            const res = await deleteWorkout(id);
            if (res.success) {
              router.replace("/(tabs)/history" as any);
            } else {
              Alert.alert("Notice", res.error || "Failed to delete workout.");
            }
          },
        },
      ]
    );
  };

  if (isLoading && !currentDetail) {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="small" color="#000000" />
        <Text className="text-[13px] text-secondary mt-3">Loading workout...</Text>
      </SafeAreaView>
    );
  }

  if (!currentDetail) {
    return (
      <SafeAreaView className="flex-1 bg-canvas px-5 pt-8 items-center justify-center">
        <Text className="text-[17px] font-semibold text-primary">Workout Not Found</Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/history" as any)}
          className="mt-4 bg-primary px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-semibold text-[14px]">Return to History</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Top Header */}
      <View className="px-5 py-3 border-b border-border-subtle bg-white flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[20px] font-bold text-primary tracking-tight">
            {currentDetail.workoutTypeName}
          </Text>
          <Text className="text-[13px] text-secondary mt-0.5">
            {formatDateSubtitle(currentDetail.startedAt, currentDetail.locationName)}
          </Text>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Exercise Cards matching Wireframe 7 */}
        {currentDetail.exercises.map((ex, index) => (
          <View
            key={ex.id}
            className="mb-4 bg-surface rounded-2xl border border-border-subtle p-4"
          >
            {/* Exercise Card Header */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-[17px] font-bold text-primary">
                  {ex.name}
                </Text>
                <Text className="text-[11px] font-bold text-muted uppercase tracking-wider mt-0.5">
                  {ex.category}
                </Text>
              </View>

              {/* Reorder and Delete Controls */}
              <View className="flex-row items-center space-x-1">
                {index > 0 && (
                  <TouchableOpacity
                    onPress={() => handleMoveExercise(index, "up")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-7 h-7 rounded-full bg-white items-center justify-center border border-border-subtle mr-1"
                  >
                    <Ionicons name="arrow-up" size={14} color="#6B7280" />
                  </TouchableOpacity>
                )}
                {index < currentDetail.exercises.length - 1 && (
                  <TouchableOpacity
                    onPress={() => handleMoveExercise(index, "down")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-7 h-7 rounded-full bg-white items-center justify-center border border-border-subtle mr-1"
                  >
                    <Ionicons name="arrow-down" size={14} color="#6B7280" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handlePromptDeleteExercise(ex)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="w-7 h-7 rounded-full bg-white items-center justify-center border border-border-subtle"
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Set Table Header */}
            <View className="flex-row items-center py-1.5 border-b border-border-subtle">
              <Text className="w-8 text-center text-[11px] font-semibold text-muted uppercase">
                SET
              </Text>
              <Text className="flex-1 text-center text-[11px] font-semibold text-muted uppercase">
                REPS
              </Text>
              <Text className="flex-1 text-center text-[11px] font-semibold text-muted uppercase">
                WEIGHT
              </Text>
              <View className="w-8" />
            </View>

            {/* Set Rows */}
            {ex.sets.map((set) => (
              <EditableSetRow
                key={set.id}
                set={set}
                exerciseId={ex.id}
                onUpdateSet={updateSet}
                onDeleteSet={deleteSet}
              />
            ))}

            {/* Add Set Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (id) addSetToExercise(id, ex.id);
              }}
              className="mt-3 py-2.5 items-center justify-center bg-white border border-border-subtle rounded-xl flex-row"
            >
              <Ionicons name="add" size={16} color="#000000" />
              <Text className="text-[14px] font-semibold text-primary ml-1">
                Add Set
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Workout Notes Card matching Wireframe 7 */}
        <View className="mb-4 bg-surface rounded-2xl border border-border-subtle p-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider ml-1.5">
              Workout Notes
            </Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={handleBlurNotes}
            placeholder="Add form cues, machine settings, or workout notes..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="min-h-[72px] bg-white border border-border-subtle rounded-xl p-3 text-[14px] text-primary"
            textAlignVertical="top"
          />
        </View>

        {/* Add Exercise Action */}
        <View className="mt-1 mb-8">
          <DashedActionCard
            label="Add Exercise"
            onPress={() => setShowAddSheet(true)}
          />
        </View>

        {/* Delete Workout Button matching Wireframe 7 */}
        <PrimaryButton
          title="Delete Workout"
          variant="danger"
          loading={isSaving}
          onPress={handlePromptDeleteWorkout}
        />
      </ScrollView>

      {/* Add Exercise Drawer */}
      <AddExerciseSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelectExercise={(selected) => {
          if (id) addExerciseToWorkout(id, selected);
        }}
      />
    </SafeAreaView>
  );
}

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardContainer } from "../ui/CardContainer";
import { SetRow } from "../ui/SetRow";
import { ActiveExercise, ActiveSet } from "../../stores/active-workout-store";

interface ExerciseLoggerCardProps {
  exercise: ActiveExercise;
  onAddSet: (exerciseId: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onUpdateSet: (
    exerciseId: string,
    setId: string,
    updates: Partial<Omit<ActiveSet, "id" | "setNumber">>
  ) => void;
  onToggleSet: (exerciseId: string, setId: string) => void;
}

export const ExerciseLoggerCard: React.FC<ExerciseLoggerCardProps> = ({
  exercise,
  onAddSet,
  onRemoveExercise,
  onUpdateSet,
  onToggleSet,
}) => {
  return (
    <CardContainer className="mb-4">
      {/* Exercise Title Header */}
      <View className="flex-row items-center justify-between pb-3 border-b border-border-subtle mb-1">
        <View className="flex-1 mr-2">
          <Text className="text-[17px] font-semibold text-primary">
            {exercise.name}
          </Text>
          <Text className="text-[12px] font-medium text-muted uppercase tracking-wider mt-0.5">
            {exercise.category}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => onRemoveExercise(exercise.id)}
          className="w-10 h-10 items-center justify-center rounded-full"
        >
          <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Table Column Headers */}
      <View className="flex-row items-center justify-between py-2 border-b border-border-subtle/60">
        <Text className="w-8 text-center text-[12px] font-semibold text-muted uppercase">
          Set
        </Text>
        <Text className="flex-1 text-center text-[12px] font-semibold text-muted uppercase">
          Reps
        </Text>
        <Text className="flex-1 text-center text-[12px] font-semibold text-muted uppercase">
          Weight
        </Text>
        <Text className="w-[44px] text-center text-[12px] font-semibold text-muted uppercase">
          Done
        </Text>
      </View>

      {/* Set Rows */}
      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          setNumber={set.setNumber}
          reps={set.reps}
          weight={set.weight}
          ghostReps={set.ghostReps}
          ghostWeight={set.ghostWeight}
          isCompleted={set.isCompleted}
          onRepsChange={(reps) => onUpdateSet(exercise.id, set.id, { reps })}
          onWeightChange={(weight) => onUpdateSet(exercise.id, set.id, { weight })}
          onToggleComplete={() => onToggleSet(exercise.id, set.id)}
        />
      ))}

      {/* Add Set Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onAddSet(exercise.id)}
        className="flex-row items-center justify-center py-2.5 mt-2 bg-white rounded-lg border border-border-subtle"
      >
        <Ionicons name="add" size={18} color="#000000" />
        <Text className="text-[14px] font-semibold text-primary ml-1">
          Add Set
        </Text>
      </TouchableOpacity>
    </CardContainer>
  );
};

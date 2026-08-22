import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface SetRowProps {
  setNumber: number;
  reps: number | string | null;
  weight: number | string | null;
  ghostReps?: number | null;
  ghostWeight?: number | null;
  isCompleted: boolean;
  onRepsChange?: (text: string) => void;
  onWeightChange?: (text: string) => void;
  onToggleComplete?: () => void;
  editable?: boolean;
  className?: string;
}

export function SetRow({
  setNumber,
  reps,
  weight,
  ghostReps,
  ghostWeight,
  isCompleted,
  onRepsChange,
  onWeightChange,
  onToggleComplete,
  editable = true,
  className = "",
}: SetRowProps) {
  const repsDisplay = reps !== null && reps !== undefined && reps !== "" ? String(reps) : "";
  const weightDisplay = weight !== null && weight !== undefined && weight !== "" ? String(weight) : "";

  return (
    <View
      className={`flex-row items-center justify-between py-2 border-b border-border-subtle/50 ${
        isCompleted ? "opacity-90" : ""
      } ${className}`}
    >
      {/* Set Number */}
      <View className="w-8 items-center justify-center">
        <Text className="text-[15px] font-semibold text-primary">
          {setNumber}
        </Text>
      </View>

      {/* Reps Input */}
      <View className="flex-1 mx-2">
        {editable ? (
          <TextInput
            value={repsDisplay}
            onChangeText={onRepsChange}
            placeholder={ghostReps !== undefined && ghostReps !== null ? String(ghostReps) : "0"}
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            returnKeyType="done"
            className="h-[44px] bg-canvas rounded-md border border-border-subtle text-center text-[16px] font-mono text-primary px-2"
          />
        ) : (
          <View className="h-[44px] bg-surface rounded-md border border-border-subtle items-center justify-center px-2">
            <Text className="text-[16px] font-mono text-primary">
              {repsDisplay || "-"}
            </Text>
          </View>
        )}
      </View>

      {/* Weight Input */}
      <View className="flex-1 mx-2 relative">
        {editable ? (
          <View className="relative justify-center">
            <TextInput
              value={weightDisplay}
              onChangeText={onWeightChange}
              placeholder={ghostWeight !== undefined && ghostWeight !== null ? String(ghostWeight) : "0"}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              returnKeyType="done"
              className="h-[44px] bg-canvas rounded-md border border-border-subtle text-center text-[16px] font-mono text-primary px-2 pr-8"
            />
            <Text className="absolute right-2 text-[12px] text-muted font-medium pointer-events-none">
              lbs
            </Text>
          </View>
        ) : (
          <View className="h-[44px] bg-surface rounded-md border border-border-subtle items-center justify-center px-2">
            <Text className="text-[16px] font-mono text-primary">
              {weightDisplay ? `${weightDisplay} lbs` : "-"}
            </Text>
          </View>
        )}
      </View>

      {/* Done Checkbox */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggleComplete}
        disabled={!editable && !onToggleComplete}
        className="w-[44px] h-[44px] items-center justify-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View
          className={`w-7 h-7 rounded-sm items-center justify-center border ${
            isCompleted
              ? "bg-primary border-primary"
              : "bg-transparent border-border-dashed"
          }`}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default SetRow;

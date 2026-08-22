import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";

export interface ChipPickerProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  className?: string;
}

export function ChipPicker({
  options,
  selected,
  onSelect,
  className = "",
}: ChipPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={`flex-row py-1 ${className}`}
      contentContainerStyle={{ paddingHorizontal: 2 }}
    >
      {options.map((option) => {
        const isSelected = selected.toLowerCase() === option.toLowerCase();
        return (
          <TouchableOpacity
            key={option}
            activeOpacity={0.7}
            onPress={() => onSelect(option)}
            className={`h-[36px] px-3.5 mr-2 rounded-sm items-center justify-center border ${
              isSelected
                ? "bg-primary border-primary"
                : "bg-surface border-border-subtle"
            }`}
          >
            <Text
              className={`text-[13px] ${
                isSelected
                  ? "text-primary-foreground font-semibold"
                  : "text-secondary font-medium"
              }`}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default ChipPicker;

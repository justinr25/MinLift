import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface DashedActionCardProps extends TouchableOpacityProps {
  label: string;
  placeholder?: string;
  allowInlineInput?: boolean;
  onSubmitInput?: (value: string) => void;
}

export function DashedActionCard({
  label,
  placeholder,
  allowInlineInput = false,
  onSubmitInput,
  onPress,
  className = "",
  ...props
}: DashedActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleCardPress = (e: any) => {
    if (allowInlineInput) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (onPress) {
      onPress(e);
    }
  };

  const handleConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed && onSubmitInput) {
      onSubmitInput(trimmed);
    }
    setInputValue("");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue("");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View
        className={`h-[56px] w-full rounded-lg bg-surface border border-dashed border-border-focus px-3 flex-row items-center justify-between ${className}`}
      >
        <TextInput
          ref={inputRef}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={placeholder || label}
          placeholderTextColor="#9CA3AF"
          className="flex-1 text-[15px] text-primary h-full pr-2"
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
        />
        <View className="flex-row items-center space-x-1">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCancel}
            className="w-10 h-10 items-center justify-center rounded-full"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleConfirm}
            className="w-10 h-10 items-center justify-center rounded-full bg-primary"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handleCardPress}
      className={`h-[56px] w-full rounded-lg bg-surface border border-dashed border-border-dashed flex-row items-center justify-center px-4 ${className}`}
      {...props}
    >
      <Ionicons name="add" size={20} color="#6B7280" style={{ marginRight: 6 }} />
      <Text className="text-[15px] font-medium text-secondary">{label}</Text>
    </TouchableOpacity>
  );
}

export default DashedActionCard;

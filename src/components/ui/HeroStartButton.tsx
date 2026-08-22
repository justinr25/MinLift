import React from "react";
import { View, Text, TouchableOpacity, TouchableOpacityProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface HeroStartButtonProps extends TouchableOpacityProps {
  label?: string;
  subtext?: string;
}

export function HeroStartButton({
  label = "Start",
  subtext = "Tap to initiate a new session",
  disabled = false,
  className = "",
  ...props
}: HeroStartButtonProps) {
  return (
    <View className="items-center justify-center my-6">
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        className={`w-[190px] h-[190px] rounded-full bg-primary items-center justify-center shadow-lg active:scale-95 ${
          disabled ? "opacity-50" : ""
        } ${className}`}
        {...props}
      >
        <Ionicons name="play" size={42} color="#FFFFFF" style={{ marginLeft: 6 }} />
        <Text className="text-primary-foreground text-[20px] font-bold mt-1 tracking-wide">
          {label}
        </Text>
      </TouchableOpacity>
      {subtext ? (
        <Text className="text-secondary text-[13px] text-center mt-4">
          {subtext}
        </Text>
      ) : null}
    </View>
  );
}

export default HeroStartButton;

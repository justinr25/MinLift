import React from "react";
import { View, TouchableOpacity, ViewProps, TouchableOpacityProps } from "react-native";

export interface CardContainerProps extends ViewProps {
  onPress?: TouchableOpacityProps["onPress"];
  activeOpacity?: number;
}

export function CardContainer({
  children,
  className = "",
  onPress,
  activeOpacity = 0.7,
  ...props
}: CardContainerProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        className={`rounded-lg bg-surface border border-border-subtle p-4 ${className}`}
        {...(props as TouchableOpacityProps)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      className={`rounded-lg bg-surface border border-border-subtle p-4 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}

export default CardContainer;

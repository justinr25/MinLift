import React from "react";
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TouchableOpacityProps,
} from "react-native";

export interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function PrimaryButton({
  title,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  className = "",
  ...props
}: PrimaryButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return "bg-danger text-white border-transparent";
      case "secondary":
        return "bg-surface text-primary border-border-subtle";
      case "outline":
        return "bg-transparent text-primary border-border-subtle";
      case "primary":
      default:
        return "bg-primary text-primary-foreground border-transparent";
    }
  };

  const getTextStyles = () => {
    switch (variant) {
      case "danger":
        return "text-white font-semibold";
      case "secondary":
      case "outline":
        return "text-primary font-semibold";
      case "primary":
      default:
        return "text-primary-foreground font-semibold";
    }
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      className={`h-[52px] w-full rounded-md flex-row items-center justify-center border px-4 ${getVariantStyles()} ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : "#000000"}
          size="small"
        />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            className={`text-[17px] text-center ${icon ? "ml-2" : ""} ${getTextStyles()}`}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default PrimaryButton;

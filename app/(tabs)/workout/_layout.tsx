import React from "react";
import { Stack } from "expo-router";

export default function WorkoutStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="select-location" />
      <Stack.Screen name="select-type" />
    </Stack>
  );
}

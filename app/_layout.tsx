import "../global.css";
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments, Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../src/stores/auth-store";

function RootLayoutNav() {
  const { session, isInitialized, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const segmentList = segments as string[];
    const inAuthGroup = segmentList.length > 0 && segmentList[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Redirect unauthenticated user to sign-in
      router.replace("/(auth)/sign-in" as Href);
    } else if (session && inAuthGroup) {
      // Redirect authenticated user to home/tabs
      router.replace("/(tabs)" as Href);
    }
  }, [session, isInitialized, segments]);

  if (!isInitialized) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </SafeAreaProvider>
  );
}

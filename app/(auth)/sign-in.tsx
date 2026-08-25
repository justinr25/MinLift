import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link, Href } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "../../src/components/ui/PrimaryButton";
import { useAuthStore } from "../../src/stores/auth-store";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      setErrorMessage(error.message || "Failed to sign in. Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Icon & Title */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-surface border border-border-subtle items-center justify-center mb-4">
              <MaterialCommunityIcons name="dumbbell" size={32} color="#000000" />
            </View>
            <Text className="text-[28px] font-bold text-primary tracking-tight">
              MinLift
            </Text>
            <Text className="text-[14px] text-secondary mt-1">
              Minimalist Workout & Set Logger
            </Text>
          </View>

          {/* Form */}
          <View className="w-full mb-6">
            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-2">
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@domain.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                className="h-[52px] bg-surface rounded-md border border-border-subtle px-4 text-[15px] text-primary"
              />
            </View>

            {/* Password Field */}
            <View className="mb-2">
              <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-2">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="h-[52px] bg-surface rounded-md border border-border-subtle px-4 text-[15px] text-primary"
              />
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View className="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-md">
                <Text className="text-danger text-[13px] text-center font-medium">
                  {errorMessage}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Sign In Button */}
          <PrimaryButton
            title="Sign In"
            onPress={handleSignIn}
            loading={isLoading}
            className="mb-6"
          />

          {/* Footer Navigation Link */}
          <View className="flex-row items-center justify-center">
            <Text className="text-[14px] text-secondary">
              Don't have an account?{" "}
            </Text>
            <Link href={"/(auth)/sign-up" as Href} asChild>
              <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text className="text-[14px] font-semibold text-primary">
                  Create Account
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

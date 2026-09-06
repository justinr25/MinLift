import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth-store";
import { CardContainer } from "../../src/components/ui/CardContainer";
import { PrimaryButton } from "../../src/components/ui/PrimaryButton";

export default function ProfileTabScreen() {
  const { user, profile, signOut, isLoading } = useAuthStore();
  const [preferredUnit, setPreferredUnit] = useState<"lbs" | "kg">(
    profile?.preferred_weight_unit || "lbs"
  );

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "Lifter";
  const email = user?.email || "No email available";

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View className="mb-6">
          <Text className="text-[28px] font-bold text-primary tracking-tight">
            Profile
          </Text>
          <Text className="text-[15px] text-secondary mt-0.5">
            Account & preferences
          </Text>
        </View>

        {/* User Card */}
        <CardContainer className="flex-row items-center space-x-4 mb-6">
          <View className="w-16 h-16 rounded-full bg-white border border-border-subtle items-center justify-center">
            <Ionicons name="person" size={28} color="#000000" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-[18px] font-bold text-primary">
              {displayName}
            </Text>
            <Text className="text-[14px] text-secondary mt-0.5">
              {email}
            </Text>
            <Text className="text-[12px] text-muted mt-1">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "2026"}
            </Text>
          </View>
        </CardContainer>

        {/* Preferences */}
        <View className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            Preferences
          </Text>

          <CardContainer>
            <View className="flex-row items-center justify-between py-1">
              <View>
                <Text className="text-[15px] font-semibold text-primary">
                  Weight Unit
                </Text>
                <Text className="text-[13px] text-secondary">
                  Used for workout logs and set tracking
                </Text>
              </View>

              {/* Unit Switcher */}
              <View className="flex-row bg-white border border-border-subtle rounded-lg p-0.5">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setPreferredUnit("lbs")}
                  className={`px-3 py-1.5 rounded-md ${
                    preferredUnit === "lbs" ? "bg-primary" : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      preferredUnit === "lbs" ? "text-white" : "text-secondary"
                    }`}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setPreferredUnit("kg")}
                  className={`px-3 py-1.5 rounded-md ${
                    preferredUnit === "kg" ? "bg-primary" : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      preferredUnit === "kg" ? "text-white" : "text-secondary"
                    }`}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </CardContainer>
        </View>

        {/* Sign Out Button */}
        <View className="mt-4 mb-8">
          <PrimaryButton
            title="Sign Out"
            variant="outline"
            loading={isLoading}
            onPress={signOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

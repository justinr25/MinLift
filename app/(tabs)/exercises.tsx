import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardContainer } from "../../src/components/ui/CardContainer";

export default function ExercisesTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-[28px] font-bold text-primary tracking-tight">
            Exercises
          </Text>
          <Text className="text-[15px] text-secondary mt-0.5">
            Catalog & persistent form notes
          </Text>
        </View>

        <CardContainer className="py-8 items-center justify-center">
          <Text className="text-[15px] font-semibold text-primary">
            Exercise Catalog
          </Text>
          <Text className="text-[13px] text-muted mt-1 text-center">
            Your categorized exercise library and machine cues will be managed here.
          </Text>
        </CardContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

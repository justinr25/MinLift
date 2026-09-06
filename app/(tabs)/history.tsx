import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardContainer } from "../../src/components/ui/CardContainer";

export default function HistoryTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-[28px] font-bold text-primary tracking-tight">
            History
          </Text>
          <Text className="text-[15px] text-secondary mt-0.5">
            Your logged workout sessions
          </Text>
        </View>

        <CardContainer className="py-8 items-center justify-center">
          <Text className="text-[15px] font-semibold text-primary">
            Workout History
          </Text>
          <Text className="text-[13px] text-muted mt-1 text-center">
            Completed workouts will appear here in reverse chronological order.
          </Text>
        </CardContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

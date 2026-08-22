import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas justify-center items-center p-6">
      <View className="bg-surface p-6 rounded-lg border border-border-subtle w-full max-w-sm items-center">
        <Text className="text-primary text-3xl font-bold mb-2">MinLift</Text>
        <Text className="text-secondary text-center text-base">
          Minimal workout & weightlifting logger
        </Text>
      </View>
    </SafeAreaView>
  );
}

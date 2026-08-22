import React, { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PrimaryButton,
  HeroStartButton,
  DashedActionCard,
  CardContainer,
  SetRow,
  ChipPicker,
} from "../src/components/ui";

export default function ComponentPlayground() {
  const [selectedCategory, setSelectedCategory] = useState("Chest");
  const [set1Done, setSet1Done] = useState(true);
  const [set2Done, setSet2Done] = useState(false);
  const [reps1, setReps1] = useState("8");
  const [weight1, setWeight1] = useState("145");
  const [reps2, setReps2] = useState("");
  const [weight2, setWeight2] = useState("");
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const categories = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Other"];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-[28px] font-bold text-primary">MinLift</Text>
          <Text className="text-[14px] text-secondary">
            Phase 1.2 — Atomic UI Component Library
          </Text>
        </View>

        {/* 1. HeroStartButton */}
        <CardContainer className="mb-6 items-center">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-2">
            1. Hero Start Button
          </Text>
          <HeroStartButton onPress={() => alert("Start Workout Pressed")} />
        </CardContainer>

        {/* 2. PrimaryButton */}
        <CardContainer className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            2. Primary & Variant Buttons
          </Text>
          <PrimaryButton
            title="Finish Workout"
            className="mb-3"
            onPress={() => alert("Finished")}
          />
          <PrimaryButton
            title="Delete Workout"
            variant="danger"
            className="mb-3"
            onPress={() => alert("Delete")}
          />
          <PrimaryButton
            title="Cancel"
            variant="outline"
            onPress={() => alert("Cancel")}
          />
        </CardContainer>

        {/* 3. DashedActionCard */}
        <CardContainer className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            3. Dashed Action Cards
          </Text>
          <DashedActionCard
            label="+ Add new location..."
            allowInlineInput
            placeholder="e.g. Portage gym"
            onSubmitInput={(val) => setAddedItem(`Location: ${val}`)}
            className="mb-3"
          />
          <DashedActionCard
            label="+ Create New Type"
            allowInlineInput
            placeholder="e.g. Arms & Calves"
            onSubmitInput={(val) => setAddedItem(`Type: ${val}`)}
          />
          {addedItem ? (
            <Text className="text-[13px] text-secondary mt-2 text-center">
              Added: {addedItem}
            </Text>
          ) : null}
        </CardContainer>

        {/* 4. SetRow Table */}
        <CardContainer className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-1">
            4. Set Rows (Barbell Flat Bench)
          </Text>
          {/* Table Header */}
          <View className="flex-row items-center justify-between py-2 border-b border-border-subtle">
            <Text className="w-8 text-center text-[12px] font-semibold text-muted uppercase">
              Set
            </Text>
            <Text className="flex-1 text-center text-[12px] font-semibold text-muted uppercase">
              Reps
            </Text>
            <Text className="flex-1 text-center text-[12px] font-semibold text-muted uppercase">
              Weight
            </Text>
            <Text className="w-[44px] text-center text-[12px] font-semibold text-muted uppercase">
              Done
            </Text>
          </View>

          <SetRow
            setNumber={1}
            reps={reps1}
            weight={weight1}
            isCompleted={set1Done}
            onRepsChange={setReps1}
            onWeightChange={setWeight1}
            onToggleComplete={() => setSet1Done(!set1Done)}
          />
          <SetRow
            setNumber={2}
            reps={reps2}
            weight={weight2}
            ghostReps={5}
            ghostWeight={145}
            isCompleted={set2Done}
            onRepsChange={setReps2}
            onWeightChange={setWeight2}
            onToggleComplete={() => setSet2Done(!set2Done)}
          />
        </CardContainer>

        {/* 5. ChipPicker */}
        <CardContainer className="mb-10">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-3">
            5. Category Chip Picker
          </Text>
          <ChipPicker
            options={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <Text className="text-[13px] text-secondary mt-3">
            Selected: <Text className="font-semibold text-primary">{selectedCategory}</Text>
          </Text>
        </CardContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

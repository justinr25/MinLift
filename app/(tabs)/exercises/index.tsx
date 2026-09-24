import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useExerciseStore, ExerciseItem } from "../../../src/stores/exercise-store";
import { useAuthStore } from "../../../src/stores/auth-store";
import { ChipPicker } from "../../../src/components/ui/ChipPicker";
import { DashedActionCard } from "../../../src/components/ui/DashedActionCard";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";

const CATEGORY_TABS = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Other",
];

const ORDERED_CATEGORIES = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Other",
];

export default function ExercisesCatalogScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    exercises,
    isLoading,
    isSaving,
    fetchExercises,
    createExercise,
  } = useExerciseStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("Chest");
  const [newExerciseNotes, setNewExerciseNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchExercises();
    }, [user?.id])
  );

  // Filter exercises based on search query and category filter
  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        ex.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        ex.category.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesCategory =
        selectedCategory === "All" ||
        ex.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [exercises, searchQuery, selectedCategory]);

  // Group filtered exercises by category
  const groupedSections = useMemo(() => {
    const groups: { category: string; data: ExerciseItem[] }[] = [];

    // Group in preferred ordered sequence
    ORDERED_CATEGORIES.forEach((cat) => {
      const items = filteredExercises.filter(
        (e) => e.category.toLowerCase() === cat.toLowerCase()
      );
      if (items.length > 0) {
        groups.push({ category: cat.toUpperCase(), data: items });
      }
    });

    // Check for any miscellaneous categories not in standard list
    const otherItems = filteredExercises.filter(
      (e) =>
        !ORDERED_CATEGORIES.some(
          (c) => c.toLowerCase() === e.category.toLowerCase()
        )
    );
    if (otherItems.length > 0) {
      groups.push({ category: "OTHER", data: otherItems });
    }

    return groups;
  }, [filteredExercises]);

  const handleOpenDetail = (exerciseId: string) => {
    router.push(`/(tabs)/exercises/${exerciseId}` as any);
  };

  const handleCreateExercise = async () => {
    setCreateError(null);
    if (!newExerciseName.trim()) {
      setCreateError("Please enter an exercise name.");
      return;
    }

    const res = await createExercise({
      name: newExerciseName.trim(),
      category: newExerciseCategory,
      notes: newExerciseNotes.trim() || undefined,
    });

    if (res.success && res.exercise) {
      setShowCreateModal(false);
      setNewExerciseName("");
      setNewExerciseNotes("");
      router.push(`/(tabs)/exercises/${res.exercise.id}` as any);
    } else {
      setCreateError(res.error || "Failed to create exercise.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Top Header */}
      <View className="px-5 pt-4 pb-2 bg-canvas">
        <Text className="text-[28px] font-bold text-primary tracking-tight">
          Exercises
        </Text>
        <Text className="text-[14px] text-secondary mt-0.5">
          Catalog & persistent form cues
        </Text>

        {/* Search Bar matching Wireframe 9 */}
        <View className="mt-4 mb-2 flex-row items-center bg-surface border border-border-subtle rounded-xl px-3.5 h-[48px]">
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2.5 text-[15px] text-primary"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Category Filter Chips */}
        <View className="mt-1">
          <ChipPicker
            options={CATEGORY_TABS}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </View>
      </View>

      {/* Main Exercises List Area */}
      <ScrollView
        className="flex-1 px-5 pt-2"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchExercises}
            tintColor="#000000"
          />
        }
      >
        {/* Loading Indicator for initial load */}
        {isLoading && exercises.length === 0 && (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="small" color="#000000" />
            <Text className="text-[13px] text-secondary mt-3">Loading exercises...</Text>
          </View>
        )}

        {/* Empty State when search has no matches */}
        {filteredExercises.length === 0 && !isLoading && (
          <View className="py-12 px-4 items-center justify-center bg-surface rounded-2xl border border-border-subtle my-3">
            <Ionicons name="search-outline" size={32} color="#9CA3AF" />
            <Text className="text-[16px] font-semibold text-primary mt-2">
              No Exercises Found
            </Text>
            <Text className="text-[13px] text-secondary text-center mt-1">
              {searchQuery
                ? `No exercises match "${searchQuery}". Tap below to create it.`
                : "No exercises in this category yet."}
            </Text>
          </View>
        )}

        {/* Categorized Sections matching Wireframe 9 */}
        {groupedSections.map((section) => (
          <View key={section.category} className="mb-5">
            {/* Section Category Header */}
            <Text className="text-[12px] font-bold text-muted tracking-wider uppercase mb-2.5 ml-0.5">
              {section.category}
            </Text>

            {/* Exercise Cards */}
            {section.data.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                activeOpacity={0.7}
                onPress={() => handleOpenDetail(ex.id)}
                className="bg-surface border border-border-subtle rounded-2xl p-4 mb-2.5 flex-row items-center justify-between"
              >
                {/* Left: Name and Last Performed Subtitle */}
                <View className="flex-1 mr-3">
                  <Text className="text-[16px] font-semibold text-primary">
                    {ex.name}
                  </Text>
                  <Text className="text-[13px] text-secondary mt-0.5">
                    {ex.lastPerformedAt
                      ? `Last: ${ex.lastPerformedAt}`
                      : "Not performed yet"}
                  </Text>
                </View>

                {/* Right: Last Weight Lifted & Navigation Chevron */}
                <View className="flex-row items-center">
                  <Text className="text-[15px] font-mono font-bold text-primary mr-2">
                    {ex.lastWeightLifted !== null && ex.lastWeightLifted !== undefined
                      ? ex.lastWeightLifted === 0
                        ? "BW"
                        : `${ex.lastWeightLifted} lbs`
                      : "—"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Create New Exercise Dashed Card matching Wireframe 9 */}
        <View className="mt-2 mb-8">
          <DashedActionCard
            label="Create New Exercise"
            onPress={() => {
              if (searchQuery.trim()) {
                setNewExerciseName(searchQuery.trim());
              }
              setShowCreateModal(true);
            }}
          />
        </View>
      </ScrollView>

      {/* Create New Exercise Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl border-t border-border-subtle max-h-[88%]">
            <ScrollView
              contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Modal Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-[20px] font-bold text-primary">
                  Create Exercise
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full bg-surface items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* Exercise Name Input */}
              <View className="mb-4">
                <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Exercise Name
                </Text>
                <TextInput
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  placeholder="e.g. Incline Dumbbell Press"
                  placeholderTextColor="#9CA3AF"
                  className="h-[50px] bg-surface rounded-xl border border-border-subtle px-4 text-[15px] text-primary"
                  autoFocus
                />
              </View>

              {/* Muscle Category Picker */}
              <View className="mb-4">
                <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Target Muscle Group
                </Text>
                <ChipPicker
                  options={ORDERED_CATEGORIES}
                  selected={newExerciseCategory}
                  onSelect={setNewExerciseCategory}
                />
              </View>

              {/* Form Cues & Machine Notes Input */}
              <View className="mb-5">
                <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Form Cues / Machine Notes (Optional)
                </Text>
                <TextInput
                  value={newExerciseNotes}
                  onChangeText={setNewExerciseNotes}
                  placeholder="e.g. Seat height 4, elbows tucked 45 degrees, slow eccentric"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  className="min-h-[75px] bg-surface rounded-xl border border-border-subtle p-3 text-[14px] text-primary"
                  textAlignVertical="top"
                />
              </View>

              {/* Error Message */}
              {createError ? (
                <Text className="text-danger text-[13px] font-medium mb-3 text-center">
                  {createError}
                </Text>
              ) : null}

              {/* Create Action Button */}
              <PrimaryButton
                title="Create Exercise"
                loading={isSaving}
                onPress={handleCreateExercise}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

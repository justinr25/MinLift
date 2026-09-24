import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useExerciseStore } from "../../../src/stores/exercise-store";
import { CardContainer } from "../../../src/components/ui/CardContainer";

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentExercise,
    availableTemplates,
    linkedTemplateIds,
    performanceHistory,
    isLoading,
    isSaving,
    fetchExerciseDetail,
    updateExerciseNotes,
    toggleLinkedTemplate,
    archiveExercise,
  } = useExerciseStore();

  const [notes, setNotes] = useState("");
  const [isNotesSaved, setIsNotesSaved] = useState(true);

  useEffect(() => {
    if (id) {
      fetchExerciseDetail(id).then((ex) => {
        if (ex) {
          setNotes(ex.notes || "");
        }
      });
    }
  }, [id]);

  // Sync local notes if external detail loads
  useEffect(() => {
    if (currentExercise && currentExercise.id === id) {
      setNotes(currentExercise.notes || "");
    }
  }, [currentExercise?.notes]);

  const handleNotesChange = (text: string) => {
    setNotes(text);
    setIsNotesSaved(false);
  };

  const handleNotesBlur = async () => {
    if (!id) return;
    if (notes !== (currentExercise?.notes || "")) {
      const res = await updateExerciseNotes(id, notes);
      if (res.success) {
        setIsNotesSaved(true);
      }
    }
  };

  const handleToggleTemplate = async (templateId: string) => {
    if (!id) return;
    await toggleLinkedTemplate(id, templateId);
  };

  const handlePromptArchive = () => {
    if (!currentExercise || !id) return;

    const confirmMessage = `Archive ${currentExercise.name}? It will be hidden from your active workout picker and exercise catalog.`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(confirmMessage)) {
        archiveExercise(id).then((res) => {
          if (res.success) {
            router.replace("/(tabs)/exercises" as any);
          } else {
            alert(res.error || "Failed to archive exercise.");
          }
        });
      }
      return;
    }

    Alert.alert("Archive Exercise", confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          const res = await archiveExercise(id);
          if (res.success) {
            router.replace("/(tabs)/exercises" as any);
          } else {
            Alert.alert("Notice", res.error || "Failed to archive exercise.");
          }
        },
      },
    ]);
  };

  if (isLoading && !currentExercise) {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="small" color="#000000" />
        <Text className="text-[13px] text-secondary mt-3">Loading exercise...</Text>
      </SafeAreaView>
    );
  }

  if (!currentExercise) {
    return (
      <SafeAreaView className="flex-1 bg-canvas px-5 pt-8 items-center justify-center">
        <Text className="text-[17px] font-semibold text-primary">
          Exercise Not Found
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/exercises" as any)}
          className="mt-4 bg-primary px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-semibold text-[14px]">
            Return to Exercises
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const linkedForThisExercise = linkedTemplateIds[id || ""] || [];
  const historyForThisExercise = performanceHistory[id || ""] || [];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Top Header */}
      <View className="px-5 py-3 border-b border-border-subtle bg-white flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>
        <View className="flex-1 mr-2">
          <Text className="text-[20px] font-bold text-primary tracking-tight" numberOfLines={1}>
            {currentExercise.name}
          </Text>
          <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mt-0.5">
            {currentExercise.category}
          </Text>
        </View>
      </View>

      {/* Main Content Area matching Wireframe 10 */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* LINKED WORKOUT TEMPLATES Section */}
        <View className="mb-6">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-2.5">
            Linked Workout Templates
          </Text>

          <View className="flex-row flex-wrap">
            {availableTemplates.map((template) => {
              const isLinked = linkedForThisExercise.includes(template.id);
              return (
                <TouchableOpacity
                  key={template.id}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  onPress={() => handleToggleTemplate(template.id)}
                  className={`px-3.5 py-1.5 mr-2 mb-2 rounded-full border flex-row items-center ${
                    isLinked
                      ? "bg-primary border-primary"
                      : "bg-surface border-border-subtle"
                  }`}
                >
                  {isLinked && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color="#FFFFFF"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    className={`text-[13px] ${
                      isLinked
                        ? "text-white font-semibold"
                        : "text-secondary font-medium"
                    }`}
                  >
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {availableTemplates.length === 0 && (
              <Text className="text-[13px] text-muted italic">
                No templates configured yet.
              </Text>
            )}
          </View>
        </View>

        {/* NOTES Container Box with auto-save */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase">
              Notes
            </Text>
            <Text className="text-[11px] text-muted">
              {isNotesSaved ? "Saved" : "Unsaved edits..."}
            </Text>
          </View>

          <View className="bg-surface rounded-2xl border border-border-subtle p-3.5">
            <TextInput
              value={notes}
              onChangeText={handleNotesChange}
              onBlur={handleNotesBlur}
              placeholder="Keep elbows tucked at roughly 45 degrees. Focus on explosive concentric movement. Touch chest gently at bottom."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="text-[14px] text-primary leading-5 min-h-[90px]"
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* PERFORMANCE HISTORY Section matching Wireframe 10 */}
        <View className="mb-8">
          <Text className="text-[12px] font-semibold text-muted tracking-wider uppercase mb-2.5">
            Performance History
          </Text>

          {historyForThisExercise.length > 0 ? (
            historyForThisExercise.map((session) => (
              <View
                key={session.workoutId}
                className="bg-surface border border-border-subtle rounded-2xl p-4 mb-2.5 flex-row items-center justify-between"
              >
                {/* Left: Date */}
                <Text className="text-[15px] font-semibold text-primary">
                  {session.date}
                </Text>

                {/* Right: Metrics string */}
                <Text className="text-[14px] font-mono font-medium text-secondary">
                  {session.totalSets} {session.totalSets === 1 ? "set" : "sets"} •{" "}
                  {session.maxWeight === 0
                    ? `BW (${session.bestReps} reps)`
                    : `Max ${session.maxWeight} lbs • ${session.bestReps} reps`}
                </Text>
              </View>
            ))
          ) : (
            <CardContainer className="py-6 items-center justify-center">
              <Ionicons name="barbell-outline" size={24} color="#9CA3AF" />
              <Text className="text-[14px] font-semibold text-primary mt-2">
                No Completed Sessions Yet
              </Text>
              <Text className="text-[12px] text-secondary text-center mt-1 px-4">
                Log this exercise in an active workout to build your progression history.
              </Text>
            </CardContainer>
          )}
        </View>

        {/* Archive Exercise Button matching Wireframe 10 */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePromptArchive}
          disabled={isSaving}
          className="items-center justify-center py-4 mb-6"
        >
          <Text className="text-[15px] font-semibold text-danger">
            Archive Exercise
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

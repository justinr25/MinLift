import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ChipPicker } from "../ui/ChipPicker";
import { DashedActionCard } from "../ui/DashedActionCard";

// Starter list of standard exercises
const DEFAULT_EXERCISE_SUGGESTIONS = [
    { id: "ex-bench-press", name: "Barbell Bench Press", category: "Chest" },
    {
        id: "ex-incline-db-press",
        name: "Incline Dumbbell Press",
        category: "Chest",
    },
    { id: "ex-cable-fly", name: "Cable Chest Fly", category: "Chest" },
    {
        id: "ex-overhead-press",
        name: "Overhead Barbell Press",
        category: "Shoulders",
    },
    {
        id: "ex-lateral-raise",
        name: "Dumbbell Lateral Raise",
        category: "Shoulders",
    },
    {
        id: "ex-tricep-pushdown",
        name: "Tricep Rope Pushdown",
        category: "Arms",
    },
    { id: "ex-skullcrusher", name: "EZ-Bar Skullcrusher", category: "Arms" },
    { id: "ex-barbell-row", name: "Barbell Bent-Over Row", category: "Back" },
    { id: "ex-lat-pulldown", name: "Lat Pulldown", category: "Back" },
    { id: "ex-seated-cable-row", name: "Seated Cable Row", category: "Back" },
    { id: "ex-bicep-curl", name: "Dumbbell Bicep Curl", category: "Arms" },
    { id: "ex-hammer-curl", name: "Hammer Curl", category: "Arms" },
    { id: "ex-barbell-squat", name: "Barbell Back Squat", category: "Legs" },
    { id: "ex-romanian-deadlift", name: "Romanian Deadlift", category: "Legs" },
    { id: "ex-leg-press", name: "Leg Press", category: "Legs" },
    { id: "ex-leg-extension", name: "Leg Extension", category: "Legs" },
    { id: "ex-leg-curl", name: "Hamstring Leg Curl", category: "Legs" },
    { id: "ex-calf-raise", name: "Standing Calf Raise", category: "Legs" },
    { id: "ex-hanging-leg-raise", name: "Hanging Leg Raise", category: "Core" },
    { id: "ex-plank", name: "Weighted Plank", category: "Core" },
];

interface AddExerciseSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectExercise: (exercise: {
        id: string;
        name: string;
        category: string;
    }) => void;
}

export const AddExerciseSheet: React.FC<AddExerciseSheetProps> = ({
    visible,
    onClose,
    onSelectExercise,
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [customExercises, setCustomExercises] = useState<
        Array<{ id: string; name: string; category: string }>
    >([]);

    const categories = [
        "All",
        "Chest",
        "Back",
        "Shoulders",
        "Arms",
        "Legs",
        "Core",
    ];

    const allExercises = [...DEFAULT_EXERCISE_SUGGESTIONS, ...customExercises];

    const filteredExercises = allExercises.filter((item) => {
        const matchesCategory =
            selectedCategory === "All" || item.category === selectedCategory;
        const matchesSearch = item.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase().trim());
        return matchesCategory && matchesSearch;
    });

    const handleCreateCustom = (name: string) => {
        if (!name.trim()) return;
        const newEx = {
            id: `custom-${Date.now()}`,
            name: name.trim(),
            category: selectedCategory === "All" ? "Other" : selectedCategory,
        };
        setCustomExercises((prev) => [newEx, ...prev]);
        onSelectExercise(newEx);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-canvas">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1"
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
                        <Text className="text-[18px] font-bold text-primary">
                            Add Exercise
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={onClose}
                            className="w-8 h-8 rounded-full bg-surface items-center justify-center"
                        >
                            <Ionicons name="close" size={20} color="#000000" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View className="px-5 pt-3 pb-2">
                        <View className="flex-row items-center bg-surface border border-border-subtle rounded-xl px-3 h-11">
                            <Ionicons name="search" size={18} color="#9CA3AF" />
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search exercises..."
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-2 text-[15px] text-primary"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                            />
                        </View>
                    </View>

                    {/* Muscle Group Chip Picker */}
                    <View className="py-2">
                        <ChipPicker
                            options={categories}
                            selected={selectedCategory}
                            onSelect={setSelectedCategory}
                        />
                    </View>

                    {/* Exercises List */}
                    <ScrollView
                        className="flex-1 px-5 pt-2"
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Create New Exercise Action */}
                        <View className="mb-4">
                            <DashedActionCard
                                label="Create New Exercise"
                                allowInlineInput
                                placeholder="e.g. Incline Cable Press"
                                onSubmitInput={handleCreateCustom}
                            />
                        </View>

                        <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">
                            Suggestions ({filteredExercises.length})
                        </Text>

                        {filteredExercises.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.7}
                                onPress={() => {
                                    onSelectExercise(item);
                                    onClose();
                                }}
                                className="flex-row items-center justify-between py-3.5 px-4 mb-2 bg-surface rounded-xl border border-border-subtle"
                            >
                                <View className="flex-1 mr-2">
                                    <Text className="text-[16px] font-semibold text-primary">
                                        {item.name}
                                    </Text>
                                    <Text className="text-[12px] text-secondary mt-0.5">
                                        {item.category}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="add-circle-outline"
                                    size={22}
                                    color="#000000"
                                />
                            </TouchableOpacity>
                        ))}

                        {filteredExercises.length === 0 && (
                            <View className="py-8 items-center">
                                <Text className="text-[14px] text-muted">
                                    No matching exercises found.
                                </Text>
                                <Text className="text-[13px] text-secondary mt-1">
                                    Use the dashed button above to create it!
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

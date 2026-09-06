import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DashedActionCard } from "../../../src/components/ui/DashedActionCard";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";

interface LocationItem {
  id: string;
  name: string;
}

export default function SelectLocationScreen() {
  const router = useRouter();

  const [locations, setLocations] = useState<LocationItem[]>([
    { id: "loc-portage", name: "Portage" },
    { id: "loc-tent", name: "Tent" },
    { id: "loc-ncrb", name: "NCRB" },
  ]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("loc-portage");

  const handleAddLocation = (name: string) => {
    if (!name.trim()) return;
    const newLoc = { id: `loc-${Date.now()}`, name: name.trim() };
    setLocations((prev) => [...prev, newLoc]);
    setSelectedLocationId(newLoc.id);
  };

  const handleNext = () => {
    const selected = locations.find((l) => l.id === selectedLocationId);
    router.push({
      pathname: "/(tabs)/workout/select-type" as any,
      params: {
        locationId: selected?.id || "",
        locationName: selected?.name || "",
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* Top Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-border-subtle">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>
        <Text className="text-[20px] font-bold text-primary">
          Select Location
        </Text>
      </View>

      {/* Main List */}
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-3">
          Saved Locations
        </Text>

        {/* Location Cards */}
        {locations.map((loc) => {
          const isSelected = selectedLocationId === loc.id;
          return (
            <TouchableOpacity
              key={loc.id}
              activeOpacity={0.7}
              onPress={() => setSelectedLocationId(loc.id)}
              className={`flex-row items-center justify-between p-4 mb-3 rounded-2xl border ${
                isSelected
                  ? "bg-white border-primary border-2 shadow-sm"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons name="location-sharp" size={20} color="#000000" />
                <Text className="text-[17px] font-semibold text-primary ml-3">
                  {loc.name}
                </Text>
              </View>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color="#000000" />
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* Dashed Add Location Card */}
        <View className="mt-1 mb-6">
          <DashedActionCard
            label="+ Add new location..."
            allowInlineInput
            placeholder="e.g. Downtown Gym"
            onSubmitInput={handleAddLocation}
          />
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="px-5 py-4 border-t border-border-subtle bg-white">
        <PrimaryButton
          title="Next"
          onPress={handleNext}
          disabled={!selectedLocationId}
        />
      </View>
    </SafeAreaView>
  );
}

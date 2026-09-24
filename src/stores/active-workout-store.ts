import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuthStore, DEMO_USER_ID } from "./auth-store";

function getInitialGhostValues(name: string, category?: string): { ghostReps: number; ghostWeight: number } {
  const lowerName = (name || "").toLowerCase();
  const lowerCat = (category || "").toLowerCase();
  const isBodyweight =
    lowerCat === "core" ||
    lowerName.includes("pull-up") ||
    lowerName.includes("chin-up") ||
    lowerName.includes("dip") ||
    lowerName.includes("push-up") ||
    lowerName.includes("plank") ||
    lowerName.includes("bodyweight") ||
    lowerName.includes("hanging leg") ||
    lowerName.includes("crunch");

  if (isBodyweight) {
    return { ghostReps: 10, ghostWeight: 0 };
  }
  return { ghostReps: 8, ghostWeight: 135 };
}

export interface ActiveSet {
  id: string;
  setNumber: number;
  reps: string;
  weight: string;
  ghostReps?: number;
  ghostWeight?: number;
  isCompleted: boolean;
}

export interface ActiveExercise {
  id: string; // exercise_id from db
  name: string;
  category: string;
  sets: ActiveSet[];
}

export interface ActiveWorkoutState {
  isActive: boolean;
  workoutTypeId: string | null;
  workoutTypeName: string;
  locationId: string | null;
  locationName: string | null;
  startTime: number | null; // Timestamp (epoch ms)
  exercises: ActiveExercise[];
  isSaving: boolean;

  // Actions
  startWorkout: (params: {
    workoutTypeId: string;
    workoutTypeName: string;
    locationId?: string | null;
    locationName?: string | null;
  }) => void;
  discardWorkout: () => void;
  addExercise: (exercise: { id: string; name: string; category?: string }) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    updates: Partial<Omit<ActiveSet, "id" | "setNumber">>
  ) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  finishWorkout: () => Promise<{ success: boolean; error?: string }>;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      isActive: false,
      workoutTypeId: null,
      workoutTypeName: "",
      locationId: null,
      locationName: null,
      startTime: null,
      exercises: [],
      isSaving: false,

      startWorkout: ({ workoutTypeId, workoutTypeName, locationId, locationName }) => {
        set({
          isActive: true,
          workoutTypeId,
          workoutTypeName,
          locationId: locationId || null,
          locationName: locationName || null,
          startTime: Date.now(),
          exercises: [],
          isSaving: false,
        });
      },

      discardWorkout: () => {
        set({
          isActive: false,
          workoutTypeId: null,
          workoutTypeName: "",
          locationId: null,
          locationName: null,
          startTime: null,
          exercises: [],
          isSaving: false,
        });
      },

      addExercise: (exercise) => {
        const { exercises } = get();
        // Avoid duplicate exercise cards in same active workout
        if (exercises.some((e) => e.id === exercise.id)) return;

        const ghostDefaults = getInitialGhostValues(exercise.name, exercise.category || "Other");

        const initialSet: ActiveSet = {
          id: `set-${Date.now()}-1`,
          setNumber: 1,
          reps: "",
          weight: "",
          ghostReps: ghostDefaults.ghostReps,
          ghostWeight: ghostDefaults.ghostWeight,
          isCompleted: false,
        };

        set({
          exercises: [
            ...exercises,
            {
              id: exercise.id,
              name: exercise.name,
              category: exercise.category || "Other",
              sets: [initialSet],
            },
          ],
        });
      },

      removeExercise: (exerciseId: string) => {
        set((state) => ({
          exercises: state.exercises.filter((e) => e.id !== exerciseId),
        }));
      },

      addSet: (exerciseId: string) => {
        set((state) => {
          const target = state.exercises.find((e) => e.id === exerciseId);
          if (!target) return state;

          const previousSet = target.sets[target.sets.length - 1];
          const newSetNumber = target.sets.length + 1;
          const ghostDefaults = getInitialGhostValues(target.name, target.category);

          const ghostReps =
            previousSet && previousSet.reps !== "" && !isNaN(Number(previousSet.reps))
              ? Number(previousSet.reps)
              : (previousSet?.ghostReps ?? ghostDefaults.ghostReps);

          const ghostWeight =
            previousSet && previousSet.weight !== "" && !isNaN(Number(previousSet.weight))
              ? Number(previousSet.weight)
              : (previousSet?.ghostWeight ?? ghostDefaults.ghostWeight);

          const newSet: ActiveSet = {
            id: `set-${Date.now()}-${newSetNumber}`,
            setNumber: newSetNumber,
            reps: "",
            weight: previousSet?.weight || "", // Auto-fill weight from previous set
            ghostReps,
            ghostWeight,
            isCompleted: false,
          };

          return {
            exercises: state.exercises.map((e) =>
              e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
            ),
          };
        });
      },

      removeSet: (exerciseId: string, setId: string) => {
        set((state) => ({
          exercises: state.exercises.map((e) => {
            if (e.id !== exerciseId) return e;
            const filtered = e.sets.filter((s) => s.id !== setId);
            // Renumber sets
            const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
            return { ...e, sets: renumbered };
          }),
        }));
      },

      updateSet: (exerciseId, setId, updates) => {
        set((state) => ({
          exercises: state.exercises.map((e) => {
            if (e.id !== exerciseId) return e;
            return {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
            };
          }),
        }));
      },

      toggleSetComplete: (exerciseId, setId) => {
        set((state) => ({
          exercises: state.exercises.map((e) => {
            if (e.id !== exerciseId) return e;
            return {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s;
                const nextCompleted = !s.isCompleted;
                let reps = s.reps;
                let weight = s.weight;
                if (nextCompleted) {
                  if (
                    (reps === "" || reps === null || reps === undefined) &&
                    s.ghostReps !== undefined &&
                    s.ghostReps !== null
                  ) {
                    reps = String(s.ghostReps);
                  }
                  if (
                    (weight === "" || weight === null || weight === undefined) &&
                    s.ghostWeight !== undefined &&
                    s.ghostWeight !== null
                  ) {
                    weight = String(s.ghostWeight);
                  }
                }
                return {
                  ...s,
                  isCompleted: nextCompleted,
                  reps,
                  weight,
                };
              }),
            };
          }),
        }));
      },

      finishWorkout: async () => {
        const state = get();
        const { user, isDemo } = useAuthStore.getState();

        if (!user) {
          return { success: false, error: "User not authenticated" };
        }

        if (isDemo || user.id === DEMO_USER_ID) {
          get().discardWorkout();
          return { success: true };
        }

        set({ isSaving: true });

        try {
          const startedAt = state.startTime
            ? new Date(state.startTime).toISOString()
            : new Date().toISOString();
          const completedAt = new Date().toISOString();

          // 1. Resolve Workout Type UUID
          let workoutTypeId = state.workoutTypeId;
          const isTypeUUID =
            workoutTypeId &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workoutTypeId);

          if (!isTypeUUID) {
            const typeName = state.workoutTypeName?.trim() || "Push";
            // Check if matches existing workout_types
            const { data: matchedType } = await supabase
              .from("workout_types")
              .select("id")
              .ilike("name", typeName)
              .maybeSingle();

            if (matchedType) {
              workoutTypeId = matchedType.id;
            } else {
              // Auto-insert custom workout type to prevent foreign key errors
              const { data: newType, error: newTypeError } = await supabase
                .from("workout_types")
                .insert({
                  user_id: user.id,
                  name: typeName,
                  is_default: false,
                })
                .select("id")
                .single();

              if (newType) {
                workoutTypeId = newType.id;
              } else {
                console.warn("Could not insert custom workout type:", newTypeError?.message);
                // Fallback to any default type
                const { data: defaultType } = await supabase
                  .from("workout_types")
                  .select("id")
                  .limit(1)
                  .maybeSingle();
                if (defaultType) workoutTypeId = defaultType.id;
              }
            }
          }

          // 2. Resolve Location UUID (ensure exists in locations table)
          let locationId = state.locationId;
          const isLocationUUID =
            locationId &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId);

          if (state.locationName && (!locationId || !isLocationUUID)) {
            const { data: existingLoc } = await supabase
              .from("locations")
              .select("id")
              .eq("user_id", user.id)
              .eq("name", state.locationName)
              .maybeSingle();

            if (existingLoc) {
              locationId = existingLoc.id;
            } else {
              const { data: newLoc } = await supabase
                .from("locations")
                .insert({
                  user_id: user.id,
                  name: state.locationName,
                })
                .select("id")
                .single();
              if (newLoc) locationId = newLoc.id;
            }
          }

          // 3. Insert into workouts table
          const { data: workoutData, error: workoutError } = await supabase
            .from("workouts")
            .insert({
              user_id: user.id,
              workout_type_id: workoutTypeId,
              location_id: locationId || null,
              started_at: startedAt,
              completed_at: completedAt,
            })
            .select("id")
            .single();

          if (workoutError || !workoutData) {
            console.error("Error inserting workout:", workoutError?.message);
            set({ isSaving: false });
            // DO NOT DISCARD ON ERROR! Preserves user's in-progress data.
            return {
              success: false,
              error: workoutError?.message || "Failed to save workout record",
            };
          }

          const workoutId = workoutData.id;

          // 4. Ensure each logged exercise exists in exercises table for this user
          const exerciseMap = new Map<string, string>();
          for (const ex of state.exercises) {
            const isUUID =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ex.id);
            if (isUUID) {
              exerciseMap.set(ex.id, ex.id);
            } else {
              const { data: existingEx } = await supabase
                .from("exercises")
                .select("id")
                .eq("user_id", user.id)
                .ilike("name", ex.name.trim())
                .maybeSingle();

              if (existingEx) {
                exerciseMap.set(ex.id, existingEx.id);
              } else {
                const { data: newEx } = await supabase
                  .from("exercises")
                  .insert({
                    user_id: user.id,
                    name: ex.name.trim(),
                    category: ex.category || "Other",
                  })
                  .select("id")
                  .single();
                if (newEx) exerciseMap.set(ex.id, newEx.id);
              }
            }
          }

          // 5. Insert workout sets
          const setsToInsert: any[] = [];
          state.exercises.forEach((ex) => {
            const dbExId = exerciseMap.get(ex.id);
            if (!dbExId) return;

            ex.sets.forEach((s) => {
              const trimmedReps = String(s.reps ?? "").trim();
              const trimmedWeight = String(s.weight ?? "").trim();
              const parsedReps = trimmedReps !== "" ? parseInt(trimmedReps, 10) : NaN;
              const parsedWeight = trimmedWeight !== "" ? parseFloat(trimmedWeight) : NaN;
              const reps = !isNaN(parsedReps) ? parsedReps : (s.ghostReps ?? 0);
              const weight = !isNaN(parsedWeight) ? parsedWeight : (s.ghostWeight ?? 0);

              setsToInsert.push({
                workout_id: workoutId,
                exercise_id: dbExId,
                set_number: s.setNumber,
                reps,
                weight,
                is_completed: s.isCompleted,
              });
            });
          });

          if (setsToInsert.length > 0) {
            const { error: setsError } = await supabase.from("workout_sets").insert(setsToInsert);
            if (setsError) {
              console.error("Error inserting workout sets:", setsError.message);
              set({ isSaving: false });
              return {
                success: false,
                error: setsError.message || "Failed to save workout sets",
              };
            }
          }

          // 6. Only reset active state once database writes succeed!
          get().discardWorkout();
          return { success: true };
        } catch (err: any) {
          console.error("Failed to finish workout:", err);
          set({ isSaving: false });
          return { success: false, error: err?.message || "Failed to finish workout" };
        } finally {
          set({ isSaving: false });
        }
      },
    }),
    {
      name: "minlift-active-workout",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isActive: state.isActive,
        workoutTypeId: state.workoutTypeId,
        workoutTypeName: state.workoutTypeName,
        locationId: state.locationId,
        locationName: state.locationName,
        startTime: state.startTime,
        exercises: state.exercises,
      }),
    }
  )
);

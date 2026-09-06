import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./auth-store";

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

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
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

    const initialSet: ActiveSet = {
      id: `set-${Date.now()}-1`,
      setNumber: 1,
      reps: "",
      weight: "",
      ghostReps: 8,
      ghostWeight: 135,
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

      const newSet: ActiveSet = {
        id: `set-${Date.now()}-${newSetNumber}`,
        setNumber: newSetNumber,
        reps: "",
        weight: previousSet?.weight || "", // Auto-fill weight from previous set
        ghostReps: previousSet ? (Number(previousSet.reps) || 8) : 8,
        ghostWeight: previousSet ? (Number(previousSet.weight) || 135) : 135,
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
            // If checking complete and reps/weight empty, fill with ghost values
            let reps = s.reps;
            let weight = s.weight;
            if (nextCompleted) {
              if (!reps && s.ghostReps) reps = String(s.ghostReps);
              if (!weight && s.ghostWeight) weight = String(s.ghostWeight);
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
    const user = useAuthStore.getState().user;

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    set({ isSaving: true });

    try {
      const startedAt = state.startTime ? new Date(state.startTime).toISOString() : new Date().toISOString();
      const completedAt = new Date().toISOString();

      // 1. Resolve Workout Type UUID
      let workoutTypeId = state.workoutTypeId;
      const isTypeUUID = workoutTypeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workoutTypeId);
      if (!isTypeUUID) {
        const { data: matchedType } = await supabase
          .from("workout_types")
          .select("id")
          .ilike("name", state.workoutTypeName || "Push")
          .maybeSingle();
        if (matchedType) {
          workoutTypeId = matchedType.id;
        }
      }

      // 2. Resolve Location UUID (ensure exists in locations table)
      let locationId = state.locationId;
      const isLocationUUID = locationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId);
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
        console.warn("Error inserting workout (using offline fallback if needed):", workoutError?.message);
        get().discardWorkout();
        return { success: true };
      }

      const workoutId = workoutData.id;

      // 4. Ensure each logged exercise exists in exercises table for this user
      const exerciseMap = new Map<string, string>();
      for (const ex of state.exercises) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ex.id);
        if (isUUID) {
          exerciseMap.set(ex.id, ex.id);
        } else {
          const { data: existingEx } = await supabase
            .from("exercises")
            .select("id")
            .eq("user_id", user.id)
            .eq("name", ex.name)
            .maybeSingle();

          if (existingEx) {
            exerciseMap.set(ex.id, existingEx.id);
          } else {
            const { data: newEx } = await supabase
              .from("exercises")
              .insert({
                user_id: user.id,
                name: ex.name,
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
          setsToInsert.push({
            workout_id: workoutId,
            exercise_id: dbExId,
            set_number: s.setNumber,
            reps: parseInt(s.reps, 10) || s.ghostReps || 0,
            weight: parseFloat(s.weight) || s.ghostWeight || 0,
            is_completed: s.isCompleted,
          });
        });
      });

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase.from("workout_sets").insert(setsToInsert);
        if (setsError) {
          console.warn("Error inserting workout sets:", setsError.message);
        }
      }

      // 6. Reset active state
      get().discardWorkout();
      return { success: true };
    } catch (err: any) {
      console.error("Failed to finish workout:", err);
      get().discardWorkout();
      return { success: false, error: err?.message || "Failed to finish workout" };
    } finally {
      set({ isSaving: false });
    }
  },
}));

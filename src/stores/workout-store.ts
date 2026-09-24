import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore, DEMO_USER_ID } from "./auth-store";

export interface HistoryWorkoutItem {
  id: string;
  startedAt: string;
  completedAt: string | null;
  workoutTypeName: string;
  locationName: string | null;
  exerciseCount: number;
  totalSets: number;
}

export interface DetailSetItem {
  id: string;
  setNumber: number;
  reps: string;
  weight: string;
  isCompleted: boolean;
}

export interface DetailExerciseItem {
  id: string; // exercise_id
  name: string;
  category: string;
  sets: DetailSetItem[];
}

export interface WorkoutDetail {
  id: string;
  startedAt: string;
  completedAt: string | null;
  workoutTypeId: string;
  workoutTypeName: string;
  locationId: string | null;
  locationName: string | null;
  notes: string | null;
  exercises: DetailExerciseItem[];
}

interface WorkoutState {
  workouts: HistoryWorkoutItem[];
  currentDetail: WorkoutDetail | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchWorkouts: () => Promise<void>;
  fetchWorkoutDetail: (workoutId: string) => Promise<WorkoutDetail | null>;
  updateSet: (setId: string, reps: number, weight: number) => Promise<void>;
  deleteSet: (setId: string, exerciseId: string) => Promise<void>;
  addSetToExercise: (
    workoutId: string,
    exerciseId: string,
    reps?: number,
    weight?: number
  ) => Promise<void>;
  addExerciseToWorkout: (
    workoutId: string,
    exercise: { id: string; name: string; category?: string }
  ) => Promise<void>;
  deleteExerciseFromWorkout: (workoutId: string, exerciseId: string) => Promise<void>;
  reorderExercises: (reordered: DetailExerciseItem[]) => void;
  deleteWorkout: (workoutId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  workouts: [],
  currentDetail: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchWorkouts: async () => {
    const { user, isDemo } = useAuthStore.getState();
    if (!user) return;

    if (isDemo || user.id === DEMO_USER_ID) {
      set({ workouts: [], isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from("workouts")
        .select(`
          id,
          started_at,
          completed_at,
          workout_types ( id, name ),
          locations ( id, name ),
          workout_sets (
            id,
            exercise_id
          )
        `)
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false });

      if (error) {
        console.warn("Error fetching workouts from Supabase:", error.message);
        set({ isLoading: false, error: error.message });
        return;
      }

      const formatted: HistoryWorkoutItem[] = (data || []).map((w: any) => {
        const rawSets = w.workout_sets || [];
        const uniqueExerciseIds = new Set(rawSets.map((s: any) => s.exercise_id));
        return {
          id: w.id,
          startedAt: w.started_at,
          completedAt: w.completed_at,
          workoutTypeName: w.workout_types?.name || "Workout",
          locationName: w.locations?.name || null,
          exerciseCount: uniqueExerciseIds.size,
          totalSets: rawSets.length,
        };
      });

      set({ workouts: formatted, isLoading: false });
    } catch (err: any) {
      console.error("fetchWorkouts exception:", err);
      set({ isLoading: false, error: err?.message || "Failed to load workouts" });
    }
  },

  fetchWorkoutDetail: async (workoutId: string) => {
    const { user, isDemo } = useAuthStore.getState();
    if (isDemo || user?.id === DEMO_USER_ID) {
      set({ isLoading: false, error: null });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from("workouts")
        .select(`
          id,
          started_at,
          completed_at,
          notes,
          workout_type_id,
          location_id,
          workout_types ( id, name ),
          locations ( id, name ),
          workout_sets (
            id,
            set_number,
            reps,
            weight,
            is_completed,
            exercises ( id, name, category )
          )
        `)
        .eq("id", workoutId)
        .single();

      if (error || !data) {
        console.warn("Error fetching workout detail:", error?.message);
        set({ isLoading: false, error: error?.message || "Workout not found" });
        return null;
      }

      const rawSets = (data as any).workout_sets || [];
      // Sort sets ascending by set_number
      rawSets.sort((a: any, b: any) => a.set_number - b.set_number);

      // Group sets by exercise
      const exerciseMap = new Map<string, DetailExerciseItem>();

      rawSets.forEach((s: any) => {
        const ex = s.exercises || {
          id: s.exercise_id,
          name: "Unknown Exercise",
          category: "Other",
        };

        if (!exerciseMap.has(ex.id)) {
          exerciseMap.set(ex.id, {
            id: ex.id,
            name: ex.name,
            category: ex.category || "Other",
            sets: [],
          });
        }

        exerciseMap.get(ex.id)!.sets.push({
          id: s.id,
          setNumber: s.set_number,
          reps: String(s.reps ?? ""),
          weight: String(s.weight ?? ""),
          isCompleted: s.is_completed ?? true,
        });
      });

      const detail: WorkoutDetail = {
        id: data.id,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        workoutTypeId: (data as any).workout_type_id,
        workoutTypeName: (data as any).workout_types?.name || "Workout",
        locationId: (data as any).location_id,
        locationName: (data as any).locations?.name || null,
        notes: data.notes,
        exercises: Array.from(exerciseMap.values()),
      };

      set({ currentDetail: detail, isLoading: false });
      return detail;
    } catch (err: any) {
      console.error("fetchWorkoutDetail exception:", err);
      set({ isLoading: false, error: err?.message || "Failed to load detail" });
      return null;
    }
  },

  updateSet: async (setId: string, reps: number, weight: number) => {
    // 1. Optimistically update currentDetail in state
    const { currentDetail } = get();
    if (currentDetail) {
      const updatedExercises = currentDetail.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) =>
          s.id === setId
            ? { ...s, reps: String(reps), weight: String(weight) }
            : s
        ),
      }));
      set({ currentDetail: { ...currentDetail, exercises: updatedExercises } });
    }

    // 2. Persist update to Supabase
    try {
      const { error } = await supabase
        .from("workout_sets")
        .update({ reps, weight })
        .eq("id", setId);

      if (error) {
        console.warn("Error updating set in Supabase:", error.message);
      }
    } catch (err) {
      console.error("updateSet exception:", err);
    }
  },

  deleteSet: async (setId: string, exerciseId: string) => {
    const { currentDetail } = get();
    if (!currentDetail) return;

    // Optimistically remove set and renumber
    const updatedExercises = currentDetail.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const filtered = ex.sets.filter((s) => s.id !== setId);
      return {
        ...ex,
        sets: filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 })),
      };
    });

    set({ currentDetail: { ...currentDetail, exercises: updatedExercises } });

    // Persist delete to Supabase
    try {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", setId);

      if (error) {
        console.warn("Error deleting set in Supabase:", error.message);
      }
    } catch (err) {
      console.error("deleteSet exception:", err);
    }
  },

  addSetToExercise: async (
    workoutId: string,
    exerciseId: string,
    defaultReps?: number,
    defaultWeight?: number
  ) => {
    const { currentDetail } = get();
    if (!currentDetail) return;

    const targetEx = currentDetail.exercises.find((e) => e.id === exerciseId);
    if (!targetEx) return;

    const previousSet = targetEx.sets[targetEx.sets.length - 1];
    const newSetNumber = targetEx.sets.length + 1;
    const reps = defaultReps ?? (previousSet ? Number(previousSet.reps) || 8 : 8);
    const weight = defaultWeight ?? (previousSet ? Number(previousSet.weight) || 135 : 135);

    try {
      const { data, error } = await supabase
        .from("workout_sets")
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: newSetNumber,
          reps,
          weight,
          is_completed: true,
        })
        .select()
        .single();

      if (error || !data) {
        console.warn("Error inserting set in Supabase:", error?.message);
        return;
      }

      const newSet: DetailSetItem = {
        id: data.id,
        setNumber: newSetNumber,
        reps: String(reps),
        weight: String(weight),
        isCompleted: true,
      };

      const updatedExercises = currentDetail.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex
      );

      set({ currentDetail: { ...currentDetail, exercises: updatedExercises } });
    } catch (err) {
      console.error("addSetToExercise exception:", err);
    }
  },

  addExerciseToWorkout: async (
    workoutId: string,
    exercise: { id: string; name: string; category?: string }
  ) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      // Ensure exercise has a valid UUID in Supabase
      let dbExId = exercise.id;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbExId);

      if (!isUUID) {
        const { data: existingEx } = await supabase
          .from("exercises")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", exercise.name)
          .maybeSingle();

        if (existingEx) {
          dbExId = existingEx.id;
        } else {
          const { data: newEx } = await supabase
            .from("exercises")
            .insert({
              user_id: user.id,
              name: exercise.name,
              category: exercise.category || "Other",
            })
            .select("id")
            .single();
          if (newEx) dbExId = newEx.id;
        }
      }

      // Add Set 1 for the new exercise
      const { data: setData, error: setError } = await supabase
        .from("workout_sets")
        .insert({
          workout_id: workoutId,
          exercise_id: dbExId,
          set_number: 1,
          reps: 8,
          weight: 135,
          is_completed: true,
        })
        .select()
        .single();

      if (setError || !setData) {
        console.warn("Error adding exercise set to workout:", setError?.message);
        return;
      }

      // Refresh current workout detail
      await get().fetchWorkoutDetail(workoutId);
    } catch (err) {
      console.error("addExerciseToWorkout exception:", err);
    }
  },

  deleteExerciseFromWorkout: async (workoutId: string, exerciseId: string) => {
    const { currentDetail } = get();
    if (!currentDetail) return;

    // Optimistically update
    const updated = currentDetail.exercises.filter((e) => e.id !== exerciseId);
    set({ currentDetail: { ...currentDetail, exercises: updated } });

    try {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("workout_id", workoutId)
        .eq("exercise_id", exerciseId);

      if (error) {
        console.warn("Error deleting exercise from workout:", error.message);
      }
    } catch (err) {
      console.error("deleteExerciseFromWorkout exception:", err);
    }
  },

  reorderExercises: (reordered: DetailExerciseItem[]) => {
    const { currentDetail } = get();
    if (!currentDetail) return;
    set({ currentDetail: { ...currentDetail, exercises: reordered } });
  },

  deleteWorkout: async (workoutId: string) => {
    set({ isSaving: true });
    try {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);

      if (error) {
        console.warn("Error deleting workout from Supabase:", error.message);
        set({ isSaving: false });
        return { success: false, error: error.message };
      }

      // Remove from feed and clear currentDetail
      const { workouts } = get();
      set({
        workouts: workouts.filter((w) => w.id !== workoutId),
        currentDetail: null,
        isSaving: false,
      });

      return { success: true };
    } catch (err: any) {
      console.error("deleteWorkout exception:", err);
      set({ isSaving: false });
      return { success: false, error: err?.message || "Failed to delete workout" };
    }
  },
}));

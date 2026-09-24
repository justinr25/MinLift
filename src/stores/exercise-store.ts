import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./auth-store";

export interface ExerciseItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  lastPerformedAt: string | null;
  lastWeightLifted: number | null;
  lastReps: number | null;
}

export interface WorkoutTemplateItem {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ExercisePerformanceSession {
  workoutId: string;
  date: string;
  completedAt: string;
  totalSets: number;
  maxWeight: number;
  bestReps: number;
}

export const DEFAULT_EXERCISES: Array<{ name: string; category: string }> = [
  { name: "Barbell Flat Bench Press", category: "Chest" },
  { name: "Incline Dumbbell Press", category: "Chest" },
  { name: "Cable Chest Fly", category: "Chest" },
  { name: "Overhead Barbell Press", category: "Shoulders" },
  { name: "Dumbbell Lateral Raise", category: "Shoulders" },
  { name: "Tricep Rope Pushdown", category: "Arms" },
  { name: "EZ-Bar Skullcrusher", category: "Arms" },
  { name: "Barbell Bent-Over Row", category: "Back" },
  { name: "Lat Pulldown", category: "Back" },
  { name: "Seated Cable Row", category: "Back" },
  { name: "Dumbbell Bicep Curl", category: "Arms" },
  { name: "Hammer Curl", category: "Arms" },
  { name: "Barbell Back Squat", category: "Legs" },
  { name: "Romanian Deadlift", category: "Legs" },
  { name: "Leg Press", category: "Legs" },
  { name: "Leg Extension", category: "Legs" },
  { name: "Hamstring Leg Curl", category: "Legs" },
  { name: "Standing Calf Raise", category: "Legs" },
  { name: "Hanging Leg Raise", category: "Core" },
  { name: "Weighted Plank", category: "Core" },
];

function formatDateDisplay(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recent";
  }
}

interface ExerciseState {
  exercises: ExerciseItem[];
  availableTemplates: WorkoutTemplateItem[];
  linkedTemplateIds: Record<string, string[]>; // exerciseId -> workout_type_ids
  performanceHistory: Record<string, ExercisePerformanceSession[]>; // exerciseId -> sessions
  currentExercise: ExerciseItem | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchExercises: (forceRefresh?: boolean) => Promise<void>;
  fetchExerciseDetail: (exerciseId: string) => Promise<ExerciseItem | null>;
  createExercise: (params: {
    name: string;
    category: string;
    notes?: string;
  }) => Promise<{ success: boolean; exercise?: ExerciseItem; error?: string }>;
  updateExerciseNotes: (
    exerciseId: string,
    notes: string
  ) => Promise<{ success: boolean; error?: string }>;
  toggleLinkedTemplate: (
    exerciseId: string,
    workoutTypeId: string
  ) => Promise<{ success: boolean; linked: boolean; error?: string }>;
  archiveExercise: (exerciseId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set, get) => ({
      exercises: [],
      availableTemplates: [],
      linkedTemplateIds: {},
      performanceHistory: {},
      currentExercise: null,
      isLoading: false,
      isSaving: false,
      error: null,

      fetchExercises: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ isLoading: true, error: null });

        try {
          // 1. Fetch user exercises from Supabase
          let { data: exercisesData, error: exercisesError } = await supabase
            .from("exercises")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_archived", false)
            .order("name", { ascending: true });

          if (exercisesError) {
            console.warn("Notice fetching exercises:", exercisesError.message);
            set({ isLoading: false, error: exercisesError.message });
            return;
          }

          // 2. Auto-seed default exercises if user has 0 exercises and is a valid UUID user
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
          if ((!exercisesData || exercisesData.length === 0) && isUUID) {
            const seedPayload = DEFAULT_EXERCISES.map((e) => ({
              user_id: user.id,
              name: e.name,
              category: e.category,
              is_archived: false,
            }));

            const { data: seeded, error: seedError } = await supabase
              .from("exercises")
              .insert(seedPayload)
              .select("*")
              .order("name", { ascending: true });

            if (!seedError && seeded) {
              exercisesData = seeded;
            }
          }

          // 3. Fallback for offline or demo guest
          if (!exercisesData || exercisesData.length === 0) {
            const currentCached = get().exercises;
            if (currentCached.length > 0) {
              set({ isLoading: false });
              return;
            }
            // Populate starter list for demo lifter
            const mockList: ExerciseItem[] = DEFAULT_EXERCISES.map((e, idx) => ({
              id: `demo-ex-${idx + 1}`,
              userId: user.id,
              name: e.name,
              category: e.category,
              notes: null,
              isArchived: false,
              createdAt: new Date().toISOString(),
              lastPerformedAt: null,
              lastWeightLifted: null,
              lastReps: null,
            }));
            set({ exercises: mockList, isLoading: false });
            return;
          }

          // 4. Fetch latest performance metrics for each exercise
          const exerciseMetricsMap = new Map<
            string,
            { lastDate: string; lastWeight: number; lastReps: number }
          >();

          try {
            const { data: setsData } = await supabase
              .from("workout_sets")
              .select(`
                exercise_id,
                weight,
                reps,
                is_completed,
                workouts!inner (
                  id,
                  completed_at,
                  user_id
                )
              `)
              .eq("is_completed", true)
              .eq("workouts.user_id", user.id)
              .not("workouts.completed_at", "is", null)
              .order("workouts(completed_at)", { ascending: false });

            if (setsData) {
              for (const s of setsData) {
                const w = (s as any).workouts;
                if (!w || !w.completed_at) continue;
                const wNum = Number(s.weight) || 0;
                const rNum = Number(s.reps) || 0;
                const existing = exerciseMetricsMap.get(s.exercise_id);

                if (!existing) {
                  exerciseMetricsMap.set(s.exercise_id, {
                    lastDate: w.completed_at,
                    lastWeight: wNum,
                    lastReps: rNum,
                  });
                } else {
                  const setTime = new Date(w.completed_at).getTime();
                  const existingTime = new Date(existing.lastDate).getTime();

                  if (setTime > existingTime) {
                    exerciseMetricsMap.set(s.exercise_id, {
                      lastDate: w.completed_at,
                      lastWeight: wNum,
                      lastReps: rNum,
                    });
                  } else if (setTime === existingTime) {
                    if (wNum > existing.lastWeight) {
                      existing.lastWeight = wNum;
                      existing.lastReps = rNum;
                    } else if (wNum === existing.lastWeight && rNum > existing.lastReps) {
                      existing.lastReps = rNum;
                    }
                  }
                }
              }
            }
          } catch (metricErr) {
            console.warn("Notice calculating exercise metrics:", metricErr);
          }

          // 5. Transform exercises with real metrics
          const formatted: ExerciseItem[] = exercisesData.map((ex: any) => {
            const metric = exerciseMetricsMap.get(ex.id);
            return {
              id: ex.id,
              userId: ex.user_id,
              name: ex.name,
              category: ex.category || "Other",
              notes: ex.notes || null,
              isArchived: ex.is_archived || false,
              createdAt: ex.created_at,
              lastPerformedAt: metric ? formatDateDisplay(metric.lastDate) : null,
              lastWeightLifted: metric ? metric.lastWeight : null,
              lastReps: metric ? metric.lastReps : null,
            };
          });

          set({ exercises: formatted, isLoading: false });
        } catch (err: any) {
          console.error("fetchExercises exception:", err);
          set({ isLoading: false, error: err?.message || "Failed to load exercises" });
        }
      },

      fetchExerciseDetail: async (exerciseId: string) => {
        const user = useAuthStore.getState().user;
        if (!user) return null;

        set({ isLoading: true, error: null });

        try {
          // 1. Fetch exercise row
          const { data: exData, error: exError } = await supabase
            .from("exercises")
            .select("*")
            .eq("id", exerciseId)
            .maybeSingle();

          if (exError || !exData) {
            // Check local fallback
            const local = get().exercises.find((e) => e.id === exerciseId);
            if (local) {
              set({ currentExercise: local, isLoading: false });
              return local;
            }
            set({ isLoading: false, error: exError?.message || "Exercise not found" });
            return null;
          }

          // 2. Fetch available workout templates (types)
          const { data: templatesData } = await supabase
            .from("workout_types")
            .select("id, name, is_default")
            .order("sort_order", { ascending: true });

          const templates: WorkoutTemplateItem[] = (templatesData || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            isDefault: t.is_default || false,
          }));

          // 3. Fetch linked workout templates for this exercise
          const { data: linkedData } = await supabase
            .from("workout_type_exercises")
            .select("workout_type_id")
            .eq("exercise_id", exerciseId);

          const linkedIds = (linkedData || []).map((l: any) => l.workout_type_id);

          // 4. Fetch performance history for this exercise
          const { data: historySets } = await supabase
            .from("workout_sets")
            .select(`
              id,
              workout_id,
              set_number,
              weight,
              reps,
              is_completed,
              workouts!inner (
                id,
                started_at,
                completed_at,
                user_id
              )
            `)
            .eq("exercise_id", exerciseId)
            .eq("is_completed", true)
            .eq("workouts.user_id", user.id)
            .not("workouts.completed_at", "is", null)
            .order("workouts(completed_at)", { ascending: false });

          // Group by workout_id
          const sessionMap = new Map<string, { completedAt: string; sets: any[] }>();
          if (historySets) {
            for (const s of historySets) {
              const w = (s as any).workouts;
              if (!w || !w.completed_at) continue;
              if (!sessionMap.has(s.workout_id)) {
                sessionMap.set(s.workout_id, {
                  completedAt: w.completed_at,
                  sets: [],
                });
              }
              sessionMap.get(s.workout_id)!.sets.push(s);
            }
          }

          const performanceSessions: ExercisePerformanceSession[] = Array.from(
            sessionMap.entries()
          ).map(([workoutId, session]) => {
            let maxWeight = 0;
            let bestReps = 0;
            for (const s of session.sets) {
              const wNum = Number(s.weight) || 0;
              const rNum = Number(s.reps) || 0;
              if (wNum > maxWeight) {
                maxWeight = wNum;
                bestReps = rNum;
              } else if (wNum === maxWeight && rNum > bestReps) {
                bestReps = rNum;
              }
            }

            return {
              workoutId,
              date: formatDateDisplay(session.completedAt),
              completedAt: session.completedAt,
              totalSets: session.sets.length,
              maxWeight,
              bestReps,
            };
          });

          // 5. Build full detail object
          const detailItem: ExerciseItem = {
            id: exData.id,
            userId: exData.user_id,
            name: exData.name,
            category: exData.category || "Other",
            notes: exData.notes || null,
            isArchived: exData.is_archived || false,
            createdAt: exData.created_at,
            lastPerformedAt: performanceSessions[0]?.date || null,
            lastWeightLifted: performanceSessions[0]?.maxWeight ?? null,
            lastReps: performanceSessions[0]?.bestReps ?? null,
          };

          const currentLinked = { ...get().linkedTemplateIds, [exerciseId]: linkedIds };
          const currentHistory = { ...get().performanceHistory, [exerciseId]: performanceSessions };

          set({
            currentExercise: detailItem,
            availableTemplates: templates,
            linkedTemplateIds: currentLinked,
            performanceHistory: currentHistory,
            isLoading: false,
          });

          return detailItem;
        } catch (err: any) {
          console.error("fetchExerciseDetail exception:", err);
          set({ isLoading: false, error: err?.message || "Failed to load detail" });
          return null;
        }
      },

      createExercise: async ({ name, category, notes }) => {
        const user = useAuthStore.getState().user;
        if (!user) return { success: false, error: "Not authenticated" };

        const trimmedName = name.trim();
        if (!trimmedName) return { success: false, error: "Exercise name is required" };

        set({ isSaving: true });

        try {
          const { data, error } = await supabase
            .from("exercises")
            .insert({
              user_id: user.id,
              name: trimmedName,
              category: category.trim() || "Other",
              notes: notes?.trim() || null,
              is_archived: false,
            })
            .select("*")
            .single();

          if (error || !data) {
            // Local fallback for guest
            const fallbackItem: ExerciseItem = {
              id: `custom-ex-${Date.now()}`,
              userId: user.id,
              name: trimmedName,
              category: category.trim() || "Other",
              notes: notes?.trim() || null,
              isArchived: false,
              createdAt: new Date().toISOString(),
              lastPerformedAt: null,
              lastWeightLifted: null,
              lastReps: null,
            };
            const updated = [fallbackItem, ...get().exercises];
            set({ exercises: updated, isSaving: false });
            return { success: true, exercise: fallbackItem };
          }

          const createdItem: ExerciseItem = {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            category: data.category || "Other",
            notes: data.notes || null,
            isArchived: data.is_archived || false,
            createdAt: data.created_at,
            lastPerformedAt: null,
            lastWeightLifted: null,
            lastReps: null,
          };

          const updated = [createdItem, ...get().exercises];
          set({ exercises: updated, isSaving: false });
          return { success: true, exercise: createdItem };
        } catch (err: any) {
          console.error("createExercise exception:", err);
          set({ isSaving: false });
          return { success: false, error: err?.message || "Failed to create exercise" };
        }
      },

      updateExerciseNotes: async (exerciseId: string, notes: string) => {
        const trimmed = notes.trim();

        // 1. Optimistic update
        const exercises = get().exercises.map((e) =>
          e.id === exerciseId ? { ...e, notes: trimmed || null } : e
        );
        const currentExercise =
          get().currentExercise?.id === exerciseId
            ? { ...get().currentExercise!, notes: trimmed || null }
            : get().currentExercise;

        set({ exercises, currentExercise });

        // 2. Persist to Supabase
        try {
          const { error } = await supabase
            .from("exercises")
            .update({ notes: trimmed || null, updated_at: new Date().toISOString() })
            .eq("id", exerciseId);

          if (error) {
            console.warn("Notice updating exercise notes in Supabase:", error.message);
            return { success: false, error: error.message };
          }
          return { success: true };
        } catch (err: any) {
          console.error("updateExerciseNotes exception:", err);
          return { success: false, error: err?.message || "Failed to save notes" };
        }
      },

      toggleLinkedTemplate: async (exerciseId: string, workoutTypeId: string) => {
        const currentLinked = get().linkedTemplateIds[exerciseId] || [];
        const isLinked = currentLinked.includes(workoutTypeId);

        // 1. Optimistic update
        const nextLinked = isLinked
          ? currentLinked.filter((id) => id !== workoutTypeId)
          : [...currentLinked, workoutTypeId];

        set({
          linkedTemplateIds: {
            ...get().linkedTemplateIds,
            [exerciseId]: nextLinked,
          },
        });

        // 2. Persist to Supabase
        try {
          if (isLinked) {
            const { error } = await supabase
              .from("workout_type_exercises")
              .delete()
              .eq("workout_type_id", workoutTypeId)
              .eq("exercise_id", exerciseId);

            if (error) {
              console.warn("Error unlinking template:", error.message);
              return { success: false, linked: true, error: error.message };
            }
            return { success: true, linked: false };
          } else {
            const { error } = await supabase
              .from("workout_type_exercises")
              .insert({
                workout_type_id: workoutTypeId,
                exercise_id: exerciseId,
              });

            if (error) {
              console.warn("Error linking template:", error.message);
              return { success: false, linked: false, error: error.message };
            }
            return { success: true, linked: true };
          }
        } catch (err: any) {
          console.error("toggleLinkedTemplate exception:", err);
          return { success: false, linked: isLinked, error: err?.message };
        }
      },

      archiveExercise: async (exerciseId: string) => {
        set({ isSaving: true });

        // 1. Optimistically filter from active list
        const updated = get().exercises.filter((e) => e.id !== exerciseId);
        set({ exercises: updated });

        // 2. Persist to Supabase
        try {
          const { error } = await supabase
            .from("exercises")
            .update({ is_archived: true, updated_at: new Date().toISOString() })
            .eq("id", exerciseId);

          set({ isSaving: false });

          if (error) {
            console.warn("Error archiving exercise in Supabase:", error.message);
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (err: any) {
          console.error("archiveExercise exception:", err);
          set({ isSaving: false });
          return { success: false, error: err?.message || "Failed to archive exercise" };
        }
      },
    }),
    {
      name: "minlift-exercise-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        exercises: state.exercises,
        availableTemplates: state.availableTemplates,
        linkedTemplateIds: state.linkedTemplateIds,
      }),
    }
  )
);

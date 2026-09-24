import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export const OFFLINE_QUEUE_STORAGE_KEY = "minlift-offline-mutation-queue";

export type OfflineMutationType =
  | "SYNC_WORKOUT"
  | "UPDATE_SET"
  | "DELETE_SET"
  | "ADD_SET"
  | "UPDATE_WORKOUT_NOTES"
  | "DELETE_WORKOUT"
  | "CREATE_EXERCISE"
  | "UPDATE_EXERCISE_NOTES"
  | "ARCHIVE_EXERCISE"
  | "UPDATE_PREFERENCES";

export interface OfflineMutation {
  id: string;
  type: OfflineMutationType;
  payload: any;
  createdAt: string;
  retryCount: number;
}

/**
 * Retrieve all pending offline mutations from AsyncStorage.
 */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read offline mutation queue:", err);
    return [];
  }
}

/**
 * Enqueue a new mutation to be executed when back online.
 */
export async function enqueueMutation(
  type: OfflineMutationType,
  payload: any
): Promise<OfflineMutation> {
  const newMutation: OfflineMutation = {
    id: `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  try {
    const currentQueue = await getPendingMutations();
    const updatedQueue = [...currentQueue, newMutation];
    await AsyncStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify(updatedQueue)
    );
  } catch (err) {
    console.error("Failed to enqueue offline mutation:", err);
  }

  return newMutation;
}

/**
 * Remove a specific mutation by ID after successful processing.
 */
export async function removeMutation(id: string): Promise<void> {
  try {
    const currentQueue = await getPendingMutations();
    const filtered = currentQueue.filter((m) => m.id !== id);
    await AsyncStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify(filtered)
    );
  } catch (err) {
    console.error("Failed to remove mutation from queue:", err);
  }
}

/**
 * Clear the entire offline queue.
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear offline queue:", err);
  }
}

/**
 * Get the count of pending offline mutations.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getPendingMutations();
  return queue.length;
}

/**
 * Process and flush the entire offline mutation queue against Supabase PostgreSQL.
 * Iterates sequentially to preserve operation order.
 */
export async function processMutationQueue(): Promise<{
  processed: number;
  errors: number;
}> {
  const queue = await getPendingMutations();
  if (queue.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const mutation of queue) {
    let success = false;

    try {
      switch (mutation.type) {
        case "SYNC_WORKOUT": {
          const { workout, sets } = mutation.payload;
          if (workout) {
            // Upsert workout
            const { error: wError } = await supabase.from("workouts").upsert({
              id: workout.id,
              user_id: workout.userId,
              workout_type_id: workout.workoutTypeId,
              location_id: workout.locationId || null,
              started_at: workout.startedAt,
              completed_at: workout.completedAt,
              notes: workout.notes || null,
            });

            if (wError) throw wError;

            // Upsert sets if provided
            if (sets && Array.isArray(sets) && sets.length > 0) {
              const setsPayload = sets.map((s: any) => ({
                id: s.id,
                workout_id: workout.id,
                exercise_id: s.exerciseId,
                set_number: s.setNumber,
                weight: s.weight,
                reps: s.reps,
                is_completed: s.isCompleted,
              }));

              const { error: sError } = await supabase
                .from("workout_sets")
                .upsert(setsPayload);

              if (sError) throw sError;
            }
          }
          success = true;
          break;
        }

        case "UPDATE_SET": {
          const { setId, reps, weight } = mutation.payload;
          const { error } = await supabase
            .from("workout_sets")
            .update({
              reps,
              weight,
            })
            .eq("id", setId);

          if (error) throw error;
          success = true;
          break;
        }

        case "DELETE_SET": {
          const { setId } = mutation.payload;
          const { error } = await supabase
            .from("workout_sets")
            .delete()
            .eq("id", setId);

          if (error) throw error;
          success = true;
          break;
        }

        case "ADD_SET": {
          const { id, workoutId, exerciseId, setNumber, reps, weight, isCompleted } =
            mutation.payload;
          const { error } = await supabase.from("workout_sets").insert({
            ...(id ? { id } : {}),
            workout_id: workoutId,
            exercise_id: exerciseId,
            set_number: setNumber,
            reps,
            weight,
            is_completed: isCompleted ?? false,
          });

          if (error) throw error;
          success = true;
          break;
        }

        case "UPDATE_WORKOUT_NOTES": {
          const { workoutId, notes } = mutation.payload;
          const { error } = await supabase
            .from("workouts")
            .update({
              notes: notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", workoutId);

          if (error) throw error;
          success = true;
          break;
        }

        case "DELETE_WORKOUT": {
          const { workoutId } = mutation.payload;
          const { error } = await supabase
            .from("workouts")
            .delete()
            .eq("id", workoutId);

          if (error) throw error;
          success = true;
          break;
        }

        case "CREATE_EXERCISE": {
          const { id, userId, name, category, notes } = mutation.payload;
          const { error } = await supabase.from("exercises").upsert({
            ...(id ? { id } : {}),
            user_id: userId,
            name,
            category: category || "Other",
            notes: notes || null,
            is_archived: false,
          });

          if (error) throw error;
          success = true;
          break;
        }

        case "UPDATE_EXERCISE_NOTES": {
          const { exerciseId, notes } = mutation.payload;
          const { error } = await supabase
            .from("exercises")
            .update({
              notes: notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", exerciseId);

          if (error) throw error;
          success = true;
          break;
        }

        case "ARCHIVE_EXERCISE": {
          const { exerciseId } = mutation.payload;
          const { error } = await supabase
            .from("exercises")
            .update({
              is_archived: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", exerciseId);

          if (error) throw error;
          success = true;
          break;
        }

        case "UPDATE_PREFERENCES": {
          const { userId, preferredWeightUnit } = mutation.payload;
          const { error } = await supabase
            .from("profiles")
            .update({
              preferred_weight_unit: preferredWeightUnit,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          if (error) throw error;
          success = true;
          break;
        }

        default:
          console.warn("Unknown mutation type encountered:", (mutation as any).type);
          success = true; // Drop unrecognized mutation
          break;
      }
    } catch (err) {
      console.warn(`Error processing offline mutation ${mutation.id} (${mutation.type}):`, err);
      errors++;
    }

    if (success) {
      await removeMutation(mutation.id);
      processed++;
    }
  }

  return { processed, errors };
}

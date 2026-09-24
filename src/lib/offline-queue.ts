import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export const OFFLINE_QUEUE_STORAGE_KEY = "minlift-offline-mutation-queue";
export const DEAD_LETTER_QUEUE_STORAGE_KEY = "minlift-dead-letter-queue";
export const MAX_MUTATION_RETRIES = 3;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a value is a standard RFC-4122 UUID.
 */
export function isValidUUID(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

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

// Queue change subscriber event system
type QueueListener = (count: number) => void;
const queueListeners: Set<QueueListener> = new Set();

export function onQueueChange(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

function notifyQueueChange(count: number): void {
  queueListeners.forEach((fn) => {
    try {
      fn(count);
    } catch (err) {
      console.warn("Queue change listener error:", err);
    }
  });
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
    notifyQueueChange(updatedQueue.length);
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
    notifyQueueChange(filtered.length);
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
    notifyQueueChange(0);
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
 * Retrieve dead-letter mutations that exceeded maximum retries.
 */
export async function getDeadLetterMutations(): Promise<OfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read dead-letter queue:", err);
    return [];
  }
}

/**
 * Clear the dead-letter queue.
 */
export async function clearDeadLetters(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEAD_LETTER_QUEUE_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear dead-letter queue:", err);
  }
}

// In-flight processing mutex
let isProcessingQueue = false;

/**
 * Process and flush the entire offline mutation queue against Supabase PostgreSQL.
 * Iterates sequentially to preserve operation order.
 * Uses atomic single-write persistence to prevent O(N^2) disk operations.
 */
export async function processMutationQueue(): Promise<{
  processed: number;
  errors: number;
}> {
  if (isProcessingQueue) {
    return { processed: 0, errors: 0 };
  }

  isProcessingQueue = true;

  try {
    const queue = await getPendingMutations();
    if (queue.length === 0) {
      return { processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;
    const remainingQueue: OfflineMutation[] = [];
    const deadLetters: OfflineMutation[] = [];

    for (const mutation of queue) {
      let success = false;

      try {
        switch (mutation.type) {
          case "SYNC_WORKOUT": {
            const { workout, sets } = mutation.payload;
            if (workout) {
              const workoutId = isValidUUID(workout.id) ? workout.id : undefined;

              const { data: savedWorkout, error: wError } = await supabase
                .from("workouts")
                .upsert({
                  ...(workoutId ? { id: workoutId } : {}),
                  user_id: workout.userId,
                  workout_type_id: workout.workoutTypeId,
                  location_id: isValidUUID(workout.locationId) ? workout.locationId : null,
                  started_at: workout.startedAt,
                  completed_at: workout.completedAt,
                  notes: workout.notes || null,
                })
                .select("id")
                .single();

              if (wError) throw wError;
              const actualWorkoutId = savedWorkout?.id || workoutId;

              // Upsert sets if provided
              if (sets && Array.isArray(sets) && sets.length > 0 && actualWorkoutId) {
                const setsPayload = sets.map((s: any) => ({
                  ...(isValidUUID(s.id) ? { id: s.id } : {}),
                  workout_id: actualWorkoutId,
                  exercise_id: s.exerciseId,
                  set_number: s.setNumber,
                  weight: s.weight,
                  reps: s.reps,
                  is_completed: s.isCompleted ?? true,
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
            if (!isValidUUID(setId)) {
              console.warn("Dropping UPDATE_SET with non-UUID identifier:", setId);
              success = true; // Drop gracefully
              break;
            }

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
            const { setId, remainingSets } = mutation.payload;
            if (!isValidUUID(setId)) {
              console.warn("Dropping DELETE_SET with non-UUID identifier:", setId);
              success = true;
              break;
            }

            const { error } = await supabase
              .from("workout_sets")
              .delete()
              .eq("id", setId);

            if (error) throw error;

            // Renumber remaining sets if provided to prevent gap regressions
            if (Array.isArray(remainingSets) && remainingSets.length > 0) {
              for (const s of remainingSets) {
                if (isValidUUID(s.id)) {
                  await supabase
                    .from("workout_sets")
                    .update({ set_number: s.setNumber })
                    .eq("id", s.id);
                }
              }
            }

            success = true;
            break;
          }

          case "ADD_SET": {
            const { id, workoutId, exerciseId, setNumber, reps, weight, isCompleted } =
              mutation.payload;

            const validSetId = isValidUUID(id) ? id : undefined;
            const { error } = await supabase.from("workout_sets").insert({
              ...(validSetId ? { id: validSetId } : {}),
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
            if (!isValidUUID(workoutId)) {
              console.warn("Dropping UPDATE_WORKOUT_NOTES with non-UUID id:", workoutId);
              success = true;
              break;
            }

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
            if (!isValidUUID(workoutId)) {
              console.warn("Dropping DELETE_WORKOUT with non-UUID id:", workoutId);
              success = true;
              break;
            }

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
            const validExId = isValidUUID(id) ? id : undefined;

            const { error } = await supabase.from("exercises").upsert({
              ...(validExId ? { id: validExId } : {}),
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
            if (!isValidUUID(exerciseId)) {
              console.warn("Dropping UPDATE_EXERCISE_NOTES with non-UUID id:", exerciseId);
              success = true;
              break;
            }

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
            if (!isValidUUID(exerciseId)) {
              console.warn("Dropping ARCHIVE_EXERCISE with non-UUID id:", exerciseId);
              success = true;
              break;
            }

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
        processed++;
      } else {
        const nextRetry = (mutation.retryCount || 0) + 1;
        if (nextRetry >= MAX_MUTATION_RETRIES) {
          console.error(
            `Poison pill mutation ${mutation.id} (${mutation.type}) exceeded ${MAX_MUTATION_RETRIES} retries. Evicting to DLQ.`
          );
          deadLetters.push({ ...mutation, retryCount: nextRetry });
        } else {
          remainingQueue.push({ ...mutation, retryCount: nextRetry });
        }
      }
    }

    // Atomic single disk write for remaining queue (O(1) storage I/O)
    await AsyncStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify(remainingQueue)
    );
    notifyQueueChange(remainingQueue.length);

    // Save dead letters if any
    if (deadLetters.length > 0) {
      try {
        const rawDlq = await AsyncStorage.getItem(DEAD_LETTER_QUEUE_STORAGE_KEY);
        const existingDlq: OfflineMutation[] = rawDlq ? JSON.parse(rawDlq) : [];
        await AsyncStorage.setItem(
          DEAD_LETTER_QUEUE_STORAGE_KEY,
          JSON.stringify([...existingDlq, ...deadLetters])
        );
      } catch (dlqErr) {
        console.error("Failed to persist dead-letter queue:", dlqErr);
      }
    }

    return { processed, errors };
  } finally {
    isProcessingQueue = false;
  }
}

import { supabase } from "../src/lib/supabase";
import { useAuthStore } from "../src/stores/auth-store";
import {
  enqueueMutation,
  getPendingMutations,
  getPendingCount,
  removeMutation,
  clearQueue,
  processMutationQueue,
  getDeadLetterMutations,
  clearDeadLetters,
  isValidUUID,
} from "../src/lib/offline-queue";
import { useSyncStore } from "../src/stores/sync-store";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, errorMsg?: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    results.push({ name, passed: true, details });
  } else {
    console.error(`  ❌ FAIL: ${name} - ${errorMsg}`);
    results.push({ name, passed: false, error: errorMsg, details });
  }
}

async function runPhase6Audit() {
  console.log("\n=======================================================");
  console.log("   📋 MINLIFT PHASE 6 COMPREHENSIVE AUTOMATED AUDIT");
  console.log("=======================================================\n");

  const testEmail = `phase6_tester_${Date.now()}@minlift.test`;
  const testPassword = "Password123!";
  const testName = "Phase 6 Lifter";

  // -----------------------------------------------------------------
  // 1. AUTH & PROFILE INITIALIZATION
  // -----------------------------------------------------------------
  console.log("[1/7] Setting up Test User & Supabase Auth...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: { data: { full_name: testName } },
  });

  assert(!authError && !!authData.user, "User registration succeeds", authError?.message);
  const userId = authData.user!.id;

  // Poll for profile creation trigger
  let profileCreated = false;
  for (let i = 0; i < 5; i++) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (profile) {
      profileCreated = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(profileCreated, "Postgres trigger auto-creates profile in profiles table");

  // Sync auth state in Zustand store
  useAuthStore.setState({
    user: authData.user,
    session: authData.session,
    profile: {
      id: userId,
      display_name: testName,
      preferred_weight_unit: "lbs",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    isDemo: false,
    isInitialized: true,
  });

  // -----------------------------------------------------------------
  // 2. PREFERRED WEIGHT UNIT PREFERENCES (LIVE SUPABASE UPDATE)
  // -----------------------------------------------------------------
  console.log("\n[2/7] Testing Preferred Weight Unit Toggling & PostgreSQL Sync...");

  // Toggle to 'kg'
  const toggleRes1 = await useAuthStore.getState().updatePreferredUnit("kg");
  assert(toggleRes1.success, "updatePreferredUnit('kg') returns success: true");

  assert(
    useAuthStore.getState().profile?.preferred_weight_unit === "kg",
    "useAuthStore profile reflects 'kg' optimistically"
  );

  // Verify in PostgreSQL table directly
  const { data: dbProfile1, error: pErr1 } = await supabase
    .from("profiles")
    .select("preferred_weight_unit")
    .eq("id", userId)
    .single();

  assert(!pErr1 && dbProfile1?.preferred_weight_unit === "kg", "PostgreSQL profiles table reflects 'kg'");

  // Toggle back to 'lbs'
  const toggleRes2 = await useAuthStore.getState().updatePreferredUnit("lbs");
  assert(toggleRes2.success, "updatePreferredUnit('lbs') returns success: true");

  assert(
    useAuthStore.getState().profile?.preferred_weight_unit === "lbs",
    "useAuthStore profile reflects 'lbs' optimistically"
  );

  const { data: dbProfile2 } = await supabase
    .from("profiles")
    .select("preferred_weight_unit")
    .eq("id", userId)
    .single();

  assert(dbProfile2?.preferred_weight_unit === "lbs", "PostgreSQL profiles table reflects 'lbs'");

  // -----------------------------------------------------------------
  // 3. OFFLINE QUEUE CRUD OPERATIONS
  // -----------------------------------------------------------------
  console.log("\n[3/7] Testing Offline Queue Storage & Mutation Enqueueing...");

  // Clear queue initially
  await clearQueue();
  let count = await getPendingCount();
  assert(count === 0, "Queue initializes empty after clearQueue()");

  // Enqueue test mutations
  const mut1 = await enqueueMutation("UPDATE_SET", {
    setId: "test-set-1",
    reps: 10,
    weight: 225,
  });
  const mut2 = await enqueueMutation("UPDATE_WORKOUT_NOTES", {
    workoutId: "test-w-1",
    notes: "High intensity session",
  });

  const pending = await getPendingMutations();
  assert(pending.length === 2, `Queue contains 2 pending mutations (got ${pending.length})`);
  assert(pending[0].id === mut1.id, "First mutation preserves FIFO queue ordering");
  assert(pending[1].type === "UPDATE_WORKOUT_NOTES", "Second mutation preserves mutation type");

  // Remove one mutation by ID
  await removeMutation(mut1.id);
  const afterRemove = await getPendingMutations();
  assert(afterRemove.length === 1, "removeMutation() successfully removes target item");
  assert(afterRemove[0].id === mut2.id, "Remaining item matches expected ID");

  await clearQueue();
  const clearedCount = await getPendingCount();
  assert(clearedCount === 0, "clearQueue() removes all pending items");

  // -----------------------------------------------------------------
  // 4. OFFLINE MUTATION REPLAY ENGINE AGAINST LIVE SUPABASE
  // -----------------------------------------------------------------
  console.log("\n[4/7] Testing Offline Mutation Replay & Live PostgreSQL Sync...");

  // Seed real entities in PostgreSQL for replay verification
  const { data: workoutTypes } = await supabase
    .from("workout_types")
    .select("id")
    .limit(1);
  const workoutTypeId = workoutTypes![0].id;

  const { data: seededWorkout } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_type_id: workoutTypeId,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date().toISOString(),
      notes: "Original notes",
    })
    .select("id")
    .single();

  assert(!!seededWorkout?.id, "Seed test workout in PostgreSQL");
  const testWorkoutId = seededWorkout!.id;

  // Create an exercise
  const { data: seededExercise } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: `Test Bench ${Date.now()}`,
      category: "Chest",
      is_archived: false,
    })
    .select("id")
    .single();

  assert(!!seededExercise?.id, "Seed test exercise in PostgreSQL");
  const testExId = seededExercise!.id;

  // Insert a set
  const { data: seededSet } = await supabase
    .from("workout_sets")
    .insert({
      workout_id: testWorkoutId,
      exercise_id: testExId,
      set_number: 1,
      weight: 185,
      reps: 8,
      is_completed: true,
    })
    .select("id")
    .single();

  assert(!!seededSet?.id, "Seed test set in PostgreSQL");
  const testSetId = seededSet!.id;

  // Now, simulate 4 offline mutations happening without network:
  // 1. UPDATE_SET (change weight to 225, reps to 12)
  await enqueueMutation("UPDATE_SET", {
    setId: testSetId,
    weight: 225,
    reps: 12,
  });

  // 2. UPDATE_WORKOUT_NOTES
  await enqueueMutation("UPDATE_WORKOUT_NOTES", {
    workoutId: testWorkoutId,
    notes: "Offline workout note replayed!",
  });

  // 3. CREATE_EXERCISE
  const offlineExName = `Offline Hex Press ${Date.now()}`;
  await enqueueMutation("CREATE_EXERCISE", {
    userId,
    name: offlineExName,
    category: "Chest",
    notes: "Tuck elbows, 3s eccentric",
  });

  // 4. UPDATE_PREFERENCES
  await enqueueMutation("UPDATE_PREFERENCES", {
    userId,
    preferredWeightUnit: "kg",
  });

  const queuedCount = await getPendingCount();
  assert(queuedCount === 4, `Queued exactly 4 offline mutations (got ${queuedCount})`);

  // Process the queue!
  const syncResult = await processMutationQueue();
  assert(syncResult.processed === 4, `processMutationQueue() processed all 4 mutations (got ${syncResult.processed})`);
  assert(syncResult.errors === 0, `processMutationQueue() completed with 0 errors (got ${syncResult.errors})`);

  // Verify all 4 changes took effect in PostgreSQL directly!
  // 1. Check set in PostgreSQL
  const { data: verifySet } = await supabase
    .from("workout_sets")
    .select("weight, reps")
    .eq("id", testSetId)
    .single();

  assert(Number(verifySet?.weight) === 225, `Replayed set weight matches 225 lbs (got ${verifySet?.weight})`);
  assert(Number(verifySet?.reps) === 12, `Replayed set reps matches 12 (got ${verifySet?.reps})`);

  // 2. Check workout notes in PostgreSQL
  const { data: verifyWorkout } = await supabase
    .from("workouts")
    .select("notes")
    .eq("id", testWorkoutId)
    .single();

  assert(verifyWorkout?.notes === "Offline workout note replayed!", "Replayed workout notes match in PostgreSQL");

  // 3. Check created exercise in PostgreSQL
  const { data: verifyEx } = await supabase
    .from("exercises")
    .select("id, name, category, notes")
    .eq("user_id", userId)
    .eq("name", offlineExName)
    .maybeSingle();

  assert(!!verifyEx, "Replayed CREATE_EXERCISE row exists in PostgreSQL");
  assert(verifyEx?.notes === "Tuck elbows, 3s eccentric", "Replayed exercise notes match");

  // 4. Check profile unit in PostgreSQL
  const { data: verifyProfile } = await supabase
    .from("profiles")
    .select("preferred_weight_unit")
    .eq("id", userId)
    .single();

  assert(verifyProfile?.preferred_weight_unit === "kg", "Replayed UPDATE_PREFERENCES matches 'kg' in PostgreSQL");

  // Queue should now be empty
  const remainingCount = await getPendingCount();
  assert(remainingCount === 0, "Queue is empty (0 pending) after successful sync");

  // 4b. Test non-UUID client ID sanitization in SYNC_WORKOUT
  console.log("\n[4b] Testing Non-UUID Client ID Sanitization in SYNC_WORKOUT...");
  const nonUuidWorkoutId = `offline-w-${Date.now()}`;
  const nonUuidSetId = `set-${Date.now()}-1`;

  await enqueueMutation("SYNC_WORKOUT", {
    workout: {
      id: nonUuidWorkoutId, // non-UUID client string!
      userId,
      workoutTypeId,
      locationId: null,
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      completedAt: new Date().toISOString(),
      notes: "Workout with non-UUID client IDs",
    },
    sets: [
      {
        id: nonUuidSetId, // non-UUID set string!
        exerciseId: testExId,
        setNumber: 1,
        weight: 175,
        reps: 10,
        isCompleted: true,
      },
    ],
  });

  const syncNonUuidRes = await processMutationQueue();
  assert(syncNonUuidRes.processed === 1, "SYNC_WORKOUT with non-UUID client IDs succeeds without Postgres crash");
  assert(syncNonUuidRes.errors === 0, "Non-UUID IDs omitted and replaced with valid Postgres UUIDs");

  // 4c. Test Poison Pill Eviction to Dead-Letter Queue (DLQ)
  console.log("\n[4c] Testing Poison Pill Eviction to Dead-Letter Queue (DLQ)...");
  await clearDeadLetters();
  // Enqueue an intentionally failing mutation (violates foreign key constraint)
  await enqueueMutation("ADD_SET", {
    workoutId: "00000000-0000-0000-0000-000000000999", // non-existent workout ID
    exerciseId: testExId,
    setNumber: 99,
    reps: 10,
    weight: 100,
    isCompleted: true,
  });

  // Replay 1st time
  const retry1 = await processMutationQueue();
  assert(retry1.errors === 1, "Poison pill fails attempt 1");

  // Replay 2nd time
  const retry2 = await processMutationQueue();
  assert(retry2.errors === 1, "Poison pill fails attempt 2");

  // Replay 3rd time -> should evict to DLQ
  const retry3 = await processMutationQueue();
  assert(retry3.errors === 1, "Poison pill fails attempt 3 (reaches MAX_MUTATION_RETRIES)");

  const queueAfterDlq = await getPendingCount();
  assert(queueAfterDlq === 0, "Queue unblocked: poison pill evicted from pending queue");

  const dlqItems = await getDeadLetterMutations();
  assert(dlqItems.length === 1, "Dead letter queue contains evicted poison pill");
  assert(dlqItems[0].retryCount >= 3, "Dead letter item recorded max retries");
  await clearDeadLetters();

  // -----------------------------------------------------------------
  // 5. USE_SYNC_STORE & CONNECTIVITY LOGIC
  // -----------------------------------------------------------------
  console.log("\n[5/7] Testing useSyncStore State & Connection Methods...");

  // Real-time queue listener check
  await enqueueMutation("UPDATE_WORKOUT_NOTES", {
    workoutId: testWorkoutId,
    notes: "Real-time sync count test",
  });
  assert(
    useSyncStore.getState().pendingCount === 1,
    "useSyncStore.pendingCount automatically updates via onQueueChange event"
  );
  await clearQueue();
  assert(
    useSyncStore.getState().pendingCount === 0,
    "useSyncStore.pendingCount updates to 0 after clearQueue()"
  );

  const isConnected = await useSyncStore.getState().checkConnection();
  assert(typeof isConnected === "boolean", "checkConnection() returns boolean connectivity status");

  const emptySync = await useSyncStore.getState().syncPendingMutations();
  assert(emptySync.processed === 0 && emptySync.errors === 0, "syncPendingMutations on empty queue returns 0/0");

  // -----------------------------------------------------------------
  // 6. VOLUME CALCULATION FOR 5-WEEK BARS
  // -----------------------------------------------------------------
  console.log("\n[6/7] Testing 5-Week Volume Calculation Logic...");

  // Seed sets for volume verification
  const { data: volSet1 } = await supabase.from("workout_sets").insert({
    workout_id: testWorkoutId,
    exercise_id: testExId,
    set_number: 2,
    weight: 200,
    reps: 10,
    is_completed: true,
  });

  const { data: volQuerySets } = await supabase
    .from("workout_sets")
    .select(`
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
    .eq("workouts.user_id", userId)
    .not("workouts.completed_at", "is", null);

  assert((volQuerySets?.length || 0) >= 2, "Volume query retrieves completed sets");

  let totalVol = 0;
  volQuerySets?.forEach((s: any) => {
    totalVol += (Number(s.weight) || 0) * (Number(s.reps) || 0);
  });

  assert(totalVol > 0, `Total calculated volume is greater than 0 (got ${totalVol})`);

  // -----------------------------------------------------------------
  // 7. SIGN OUT ACTION & STATE TEARDOWN
  // -----------------------------------------------------------------
  console.log("\n[7/7] Testing Sign Out & Teardown...");

  await useAuthStore.getState().signOut();
  assert(useAuthStore.getState().user === null, "signOut() clears user state");
  assert(useAuthStore.getState().session === null, "signOut() clears session state");
  assert(useAuthStore.getState().profile === null, "signOut() clears profile state");

  // -----------------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------------
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`   🏁 AUDIT FINISHED: ${passed} PASSED / ${failed} FAILED (Total: ${results.length})`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Audit().catch((err) => {
  console.error("Audit script failed with unhandled error:", err);
  process.exit(1);
});

import { supabase } from "../src/lib/supabase";
import { useActiveWorkoutStore } from "../src/stores/active-workout-store";
import { useAuthStore } from "../src/stores/auth-store";

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

async function runPhase3Audit() {
  console.log("\n=======================================================");
  console.log("   🏋️‍♂️ MINLIFT PHASE 3 COMPREHENSIVE AUTOMATED AUDIT");
  console.log("=======================================================\n");

  const testEmail = `phase3_tester_${Date.now()}@minlift.test`;
  const testPassword = "Password123!";
  const testName = "Phase 3 Lifter";

  // -----------------------------------------------------------------
  // 1. AUTH & PROFILE TRIGGER
  // -----------------------------------------------------------------
  console.log("[1/6] Testing Supabase Auth & Automatic Profile Trigger...");
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
  // 2. LOCATIONS TABLE CRUD & USER PERSISTENCE
  // -----------------------------------------------------------------
  console.log("\n[2/6] Testing Locations Table Persistence & RLS...");
  const { data: newLoc, error: locError } = await supabase
    .from("locations")
    .insert({ user_id: userId, name: "Portage Test Gym" })
    .select("id, name")
    .single();

  assert(!locError && !!newLoc?.id, "Insert location into Supabase succeeds", locError?.message);
  const locationId = newLoc!.id;
  const locationName = newLoc!.name;

  const { data: userLocs } = await supabase
    .from("locations")
    .select("id, name")
    .eq("user_id", userId);
  assert(
    (userLocs || []).some((l) => l.id === locationId),
    "Location is retrievable with correct user_id filter"
  );

  // -----------------------------------------------------------------
  // 3. WORKOUT TYPES (SYSTEM DEFAULTS + CUSTOM TYPES)
  // -----------------------------------------------------------------
  console.log("\n[3/6] Testing Workout Types (Default Seed + Custom)...");
  const { data: defaultTypes } = await supabase
    .from("workout_types")
    .select("id, name, is_default")
    .order("sort_order");

  assert(
    (defaultTypes || []).length >= 3,
    "Default seeded workout types (Push, Pull, Legs) are present",
    undefined,
    defaultTypes
  );

  // -----------------------------------------------------------------
  // 4. ACTIVE WORKOUT STORE: STATE, GHOST DEFAULTS & RENUMBERING
  // -----------------------------------------------------------------
  console.log("\n[4/6] Testing Active Workout Store & Set Management...");
  const store = useActiveWorkoutStore.getState();

  // Reset store
  store.discardWorkout();
  assert(!useActiveWorkoutStore.getState().isActive, "Store initializes in idle state");

  // Start workout
  store.startWorkout({
    workoutTypeId: defaultTypes![0].id,
    workoutTypeName: defaultTypes![0].name,
    locationId,
    locationName,
  });

  assert(useActiveWorkoutStore.getState().isActive, "startWorkout() sets isActive: true");
  assert(
    useActiveWorkoutStore.getState().startTime !== null,
    "startWorkout() records starting timestamp"
  );

  // Add weighted exercise
  useActiveWorkoutStore.getState().addExercise({
    id: "ex-bench",
    name: "Barbell Flat Bench Press",
    category: "Chest",
  });

  let state = useActiveWorkoutStore.getState();
  assert(state.exercises.length === 1, "addExercise adds exercise to active session");
  assert(
    state.exercises[0].sets[0].ghostWeight === 135 && state.exercises[0].sets[0].ghostReps === 8,
    "Weighted exercise gets sensible ghost defaults (135 lbs, 8 reps)"
  );

  // Add bodyweight exercise
  useActiveWorkoutStore.getState().addExercise({
    id: "ex-plank",
    name: "Weighted Plank",
    category: "Core",
  });

  state = useActiveWorkoutStore.getState();
  assert(
    state.exercises[1].sets[0].ghostWeight === 0 && state.exercises[1].sets[0].ghostReps === 10,
    "Bodyweight / Core exercise gets sensible ghost defaults (0 lbs, 10 reps)"
  );

  // Add set to Bench Press
  useActiveWorkoutStore.getState().addSet("ex-bench");
  state = useActiveWorkoutStore.getState();
  assert(state.exercises[0].sets.length === 2, "addSet() creates Set 2");
  assert(state.exercises[0].sets[1].setNumber === 2, "Set 2 has correct setNumber: 2");

  // Enter reps and weights on Bench Press Set 1
  useActiveWorkoutStore.getState().updateSet("ex-bench", state.exercises[0].sets[0].id, {
    reps: "8",
    weight: "145",
  });
  useActiveWorkoutStore.getState().toggleSetComplete("ex-bench", state.exercises[0].sets[0].id);

  // Toggle Set 2 complete without typing (should use ghost values)
  useActiveWorkoutStore.getState().toggleSetComplete("ex-bench", state.exercises[0].sets[1].id);
  state = useActiveWorkoutStore.getState();
  assert(
    state.exercises[0].sets[1].isCompleted && state.exercises[0].sets[1].reps === "8",
    "toggleSetComplete fills ghost reps if empty"
  );

  // Test explicit 0 lbs on Bodyweight Set 1 (Ensure 0 is NOT treated as falsy and overridden!)
  useActiveWorkoutStore.getState().updateSet("ex-plank", state.exercises[1].sets[0].id, {
    reps: "12",
    weight: "0",
  });
  useActiveWorkoutStore.getState().toggleSetComplete("ex-plank", state.exercises[1].sets[0].id);
  state = useActiveWorkoutStore.getState();
  assert(
    state.exercises[1].sets[0].weight === "0",
    "Explicit 0 lbs weight is preserved and not overridden by ghost fallback"
  );

  // Test set deletion with auto-renumbering
  useActiveWorkoutStore.getState().addSet("ex-bench"); // Set 3
  state = useActiveWorkoutStore.getState();
  const set2Id = state.exercises[0].sets[1].id;
  useActiveWorkoutStore.getState().removeSet("ex-bench", set2Id);
  state = useActiveWorkoutStore.getState();
  assert(
    state.exercises[0].sets.length === 2 && state.exercises[0].sets[1].setNumber === 2,
    "removeSet() auto-renumbers remaining sets sequentially"
  );

  // -----------------------------------------------------------------
  // 5. FINISH WORKOUT & DATABASE PERSISTENCE VERIFICATION
  // -----------------------------------------------------------------
  console.log("\n[5/6] Testing finishWorkout() & Live Supabase Persistence...");
  const finishRes = await useActiveWorkoutStore.getState().finishWorkout();
  assert(finishRes.success, "finishWorkout() completes with success: true", finishRes.error);
  assert(!useActiveWorkoutStore.getState().isActive, "Active state resets to idle after successful finish");

  // Verify rows in PostgreSQL
  const { data: savedWorkouts, error: fetchWorkoutError } = await supabase
    .from("workouts")
    .select("id, completed_at, workout_type_id, location_id, workout_sets(*)")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  assert(!fetchWorkoutError && (savedWorkouts || []).length > 0, "Workout record saved in PostgreSQL");
  const latestWorkout = savedWorkouts![0];
  assert(
    latestWorkout.workout_type_id === defaultTypes![0].id,
    "Workout record links to correct workout_type_id"
  );
  assert(
    latestWorkout.location_id === locationId,
    "Workout record links to correct location_id"
  );
  assert(
    (latestWorkout.workout_sets || []).length >= 2,
    "Workout sets saved accurately in workout_sets table",
    undefined,
    latestWorkout.workout_sets
  );

  // Verify 0 lbs set was stored as 0 in PostgreSQL, NOT 135!
  const zeroWeightSet = (latestWorkout.workout_sets || []).find((s: any) => s.reps === 12);
  assert(
    zeroWeightSet && Number(zeroWeightSet.weight) === 0,
    "Bodyweight set saved with exact weight 0 in PostgreSQL (not overridden to 135)"
  );

  // -----------------------------------------------------------------
  // 6. CUSTOM WORKOUT TYPE RESOLUTION & ERROR RESILIENCE (THE CRITICAL FIXES)
  // -----------------------------------------------------------------
  console.log("\n[6/6] Testing Custom Workout Type Auto-Insert & Error Resilience...");

  // Start workout with non-UUID custom type (e.g. from "+ Create New Type" UI)
  useActiveWorkoutStore.getState().startWorkout({
    workoutTypeId: `type-${Date.now()}`,
    workoutTypeName: "Upper Body Hypertrophy",
    locationId,
    locationName,
  });

  useActiveWorkoutStore.getState().addExercise({
    id: "ex-incline",
    name: "Incline Dumbbell Press",
    category: "Chest",
  });
  useActiveWorkoutStore.getState().updateSet("ex-incline", useActiveWorkoutStore.getState().exercises[0].sets[0].id, {
    reps: "10",
    weight: "60",
  });
  useActiveWorkoutStore.getState().toggleSetComplete("ex-incline", useActiveWorkoutStore.getState().exercises[0].sets[0].id);

  // Finish workout with custom type
  const customFinishRes = await useActiveWorkoutStore.getState().finishWorkout();
  assert(
    customFinishRes.success,
    "finishWorkout() with custom unseeded workout type auto-inserts type and succeeds with 0 errors",
    customFinishRes.error
  );

  // Verify custom type was created in workout_types
  const { data: customTypeRow } = await supabase
    .from("workout_types")
    .select("id, name, is_default, user_id")
    .eq("user_id", userId)
    .eq("name", "Upper Body Hypertrophy")
    .maybeSingle();

  assert(!!customTypeRow?.id, "Custom workout type is saved in workout_types table with user_id");

  // Verify error resilience: DOES NOT silently discard data on error!
  useActiveWorkoutStore.getState().startWorkout({
    workoutTypeId: "bad-id",
    workoutTypeName: "Doomed Workout",
  });
  useActiveWorkoutStore.getState().addExercise({
    id: "ex-temp",
    name: "Temporary Exercise",
    category: "Other",
  });
  useActiveWorkoutStore.getState().updateSet("ex-temp", useActiveWorkoutStore.getState().exercises[0].sets[0].id, {
    reps: "5",
    weight: "225",
  });

  // Temporarily sign out to force failure
  useAuthStore.setState({ user: null });
  const failedRes = await useActiveWorkoutStore.getState().finishWorkout();
  assert(!failedRes.success, "finishWorkout() correctly returns success: false when unauthenticated");
  assert(
    useActiveWorkoutStore.getState().isActive,
    "CRITICAL FIX: Active workout is NOT discarded on error (user data preserved!)"
  );
  assert(
    useActiveWorkoutStore.getState().exercises.length === 1,
    "CRITICAL FIX: In-progress exercises remain intact in store"
  );

  // Explicit discard should cleanly reset
  useActiveWorkoutStore.getState().discardWorkout();
  assert(!useActiveWorkoutStore.getState().isActive, "discardWorkout() resets active session cleanly");

  // -----------------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------------
  console.log("\n=======================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`   🏁 AUDIT RESULT: ${passedCount}/${totalCount} TESTS PASSED`);
  if (passedCount === totalCount) {
    console.log("   🎉 ALL PHASE 3 REPAIRS & PERSISTENCE VERIFIED!");
  } else {
    console.log("   ⚠️ SOME TESTS FAILED. CHECK LOG ABOVE.");
  }
  console.log("=======================================================\n");

  process.exit(passedCount === totalCount ? 0 : 1);
}

runPhase3Audit().catch((err) => {
  console.error("Unhandled test runner exception:", err);
  process.exit(1);
});

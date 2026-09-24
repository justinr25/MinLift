import { supabase } from "../src/lib/supabase";
import { useWorkoutStore } from "../src/stores/workout-store";
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

async function runPhase4Audit() {
  console.log("\n=======================================================");
  console.log("   📋 MINLIFT PHASE 4 COMPREHENSIVE AUTOMATED AUDIT");
  console.log("=======================================================\n");

  const testEmail = `phase4_tester_${Date.now()}@minlift.test`;
  const testPassword = "Password123!";
  const testName = "Phase 4 Lifter";

  // -----------------------------------------------------------------
  // 1. AUTH & PROFILE INITIALIZATION
  // -----------------------------------------------------------------
  console.log("[1/7] Testing Supabase Auth & Profile Setup...");
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
  // 2. SEED LOCATION, WORKOUT & SETS IN POSTGRESQL
  // -----------------------------------------------------------------
  console.log("\n[2/7] Seeding Historical Completed Workout & Sets...");
  const { data: newLoc, error: locError } = await supabase
    .from("locations")
    .insert({ user_id: userId, name: "Portage History Gym" })
    .select("id, name")
    .single();

  assert(!locError && !!newLoc?.id, "Insert test gym location succeeds", locError?.message);
  const locationId = newLoc!.id;

  const { data: workoutTypes } = await supabase
    .from("workout_types")
    .select("id, name")
    .order("sort_order");

  assert((workoutTypes || []).length > 0, "Default workout types are available");
  const pushTypeId = workoutTypes![0].id;

  // Create exercises: Bench Press (Chest) and Plank (Core)
  const { data: exBench } = await supabase
    .from("exercises")
    .insert({ user_id: userId, name: "Barbell Flat Bench Press", category: "Chest" })
    .select("id, name, category")
    .single();

  const { data: exPlank } = await supabase
    .from("exercises")
    .insert({ user_id: userId, name: "Weighted Plank", category: "Core" })
    .select("id, name, category")
    .single();

  assert(!!exBench?.id && !!exPlank?.id, "Exercises seeded in PostgreSQL");
  const benchId = exBench!.id;
  const plankId = exPlank!.id;

  const initialNotes = "Initial test workout notes: feel was good, bench felt light.";
  const { data: seededWorkout, error: workoutError } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_type_id: pushTypeId,
      location_id: locationId,
      notes: initialNotes,
      started_at: new Date(Date.now() - 7200000).toISOString(),
      completed_at: new Date(Date.now() - 3600000).toISOString(),
    })
    .select("id")
    .single();

  assert(!workoutError && !!seededWorkout?.id, "Workout record seeded in PostgreSQL", workoutError?.message);
  const workoutId = seededWorkout!.id;

  // Insert sets: Bench Set 1 (8x145), Bench Set 2 (6x145), Plank Set 1 (10x0 lbs bodyweight)
  const { data: seededSets, error: setsError } = await supabase
    .from("workout_sets")
    .insert([
      {
        workout_id: workoutId,
        exercise_id: benchId,
        set_number: 1,
        reps: 8,
        weight: 145,
        is_completed: true,
      },
      {
        workout_id: workoutId,
        exercise_id: benchId,
        set_number: 2,
        reps: 6,
        weight: 145,
        is_completed: true,
      },
      {
        workout_id: workoutId,
        exercise_id: plankId,
        set_number: 1,
        reps: 10,
        weight: 0,
        is_completed: true,
      },
    ])
    .select("id, set_number, reps, weight");

  assert(!setsError && seededSets?.length === 3, "Workout sets seeded in PostgreSQL", setsError?.message);

  // -----------------------------------------------------------------
  // 3. FETCH WORKOUTS (HISTORY FEED) VERIFICATION
  // -----------------------------------------------------------------
  console.log("\n[3/7] Testing fetchWorkouts() History Feed Retrieval...");
  await useWorkoutStore.getState().fetchWorkouts();
  const feedWorkouts = useWorkoutStore.getState().workouts;

  assert(feedWorkouts.length >= 1, "fetchWorkouts() returns completed workouts");
  const feedItem = feedWorkouts.find((w) => w.id === workoutId);
  assert(!!feedItem, "Seeded workout found in history feed");
  assert(feedItem?.workoutTypeName === workoutTypes![0].name, "Feed item has correct workout type name");
  assert(feedItem?.locationName === "Portage History Gym", "Feed item has correct gym location name");
  assert(feedItem?.exerciseCount === 2, "Feed item calculates exact exercise count (2)");
  assert(feedItem?.totalSets === 3, "Feed item calculates exact total sets (3)");

  // -----------------------------------------------------------------
  // 4. FETCH WORKOUT DETAIL VERIFICATION
  // -----------------------------------------------------------------
  console.log("\n[4/7] Testing fetchWorkoutDetail() Retrieval & Grouping...");
  const detail = await useWorkoutStore.getState().fetchWorkoutDetail(workoutId);

  assert(!!detail, "fetchWorkoutDetail() returns non-null detail");
  assert(detail?.id === workoutId, "Detail has correct workout ID");
  assert(detail?.notes === initialNotes, "Detail correctly includes workout notes");
  assert(detail?.exercises.length === 2, "Detail correctly groups sets into 2 exercises");
  const benchDetail = detail?.exercises.find((e) => e.id === benchId);
  assert(benchDetail?.sets.length === 2, "Bench Press has 2 sets grouped");
  assert(benchDetail?.sets[0].setNumber === 1 && benchDetail?.sets[1].setNumber === 2, "Sets ordered ascending by set_number");

  // -----------------------------------------------------------------
  // 5. SET EDITING (DECIMAL WEIGHT & REPS AUTO-SAVE)
  // -----------------------------------------------------------------
  console.log("\n[5/7] Testing Set Editing & Decimal Weight Persistence...");
  const set1Id = benchDetail!.sets[0].id;
  await useWorkoutStore.getState().updateSet(set1Id, 10, 155.5);

  const updatedBenchDetail = useWorkoutStore.getState().currentDetail?.exercises.find((e) => e.id === benchId);
  assert(
    updatedBenchDetail?.sets[0].reps === "10" && updatedBenchDetail?.sets[0].weight === "155.5",
    "updateSet() updates state optimistically with decimal weight (155.5 lbs, 10 reps)"
  );

  // Verify in PostgreSQL directly
  const { data: dbSet1 } = await supabase
    .from("workout_sets")
    .select("reps, weight")
    .eq("id", set1Id)
    .single();

  assert(
    dbSet1?.reps === 10 && Math.abs(Number(dbSet1?.weight) - 155.5) < 0.01,
    "PostgreSQL reflects updated set: reps = 10 and weight = 155.5 lbs"
  );

  // -----------------------------------------------------------------
  // 6. BODYWEIGHT 0 LBS COERCION FIX & SET RENUMBERING SYNC
  // -----------------------------------------------------------------
  console.log("\n[6/7] Testing Bodyweight 0 lbs Fix & Set Renumbering in PostgreSQL...");

  // A. Test Add Set on Bodyweight Exercise (Plank weight is 0)
  await useWorkoutStore.getState().addSetToExercise(workoutId, plankId);
  const plankAfterAdd = useWorkoutStore.getState().currentDetail?.exercises.find((e) => e.id === plankId);
  assert(plankAfterAdd?.sets.length === 2, "addSetToExercise creates Set 2 for Plank");
  assert(
    plankAfterAdd?.sets[1].weight === "0",
    "CRITICAL FIX: addSetToExercise preserves 0 lbs bodyweight (NOT coerced to 135!)"
  );

  // Verify Set 2 in PostgreSQL directly
  const { data: dbPlankSet2 } = await supabase
    .from("workout_sets")
    .select("reps, weight, set_number")
    .eq("workout_id", workoutId)
    .eq("exercise_id", plankId)
    .eq("set_number", 2)
    .maybeSingle();

  assert(
    !!dbPlankSet2 && Number(dbPlankSet2.weight) === 0,
    "PostgreSQL confirms newly added bodyweight set has exact weight 0 (not 135)"
  );

  // B. Test Set Renumbering on Deletion
  // Add Set 3 to Bench Press
  await useWorkoutStore.getState().addSetToExercise(workoutId, benchId, 8, 145);
  let benchSets = useWorkoutStore.getState().currentDetail?.exercises.find((e) => e.id === benchId)?.sets || [];
  assert(benchSets.length === 3, "Bench Press has 3 sets before deletion");

  const set2Id = benchSets[1].id;
  await useWorkoutStore.getState().deleteSet(set2Id, benchId);

  benchSets = useWorkoutStore.getState().currentDetail?.exercises.find((e) => e.id === benchId)?.sets || [];
  assert(
    benchSets.length === 2 && benchSets[0].setNumber === 1 && benchSets[1].setNumber === 2,
    "deleteSet() renumbers remaining sets in Zustand state (1, 2)"
  );

  // Verify PostgreSQL set_number values are also renumbered (NO gaps in DB!)
  const { data: dbBenchSets } = await supabase
    .from("workout_sets")
    .select("id, set_number")
    .eq("workout_id", workoutId)
    .eq("exercise_id", benchId)
    .order("set_number", { ascending: true });

  assert(
    dbBenchSets?.length === 2 &&
      dbBenchSets[0].set_number === 1 &&
      dbBenchSets[1].set_number === 2,
    "CRITICAL FIX: deleteSet() renumbers set_number in PostgreSQL (1 and 2, no gap!)"
  );

  // -----------------------------------------------------------------
  // 7. WORKOUT NOTES EDITING & DELETION CASCADE
  // -----------------------------------------------------------------
  console.log("\n[7/7] Testing Workout Notes Auto-Save & Workout Deletion Cascade...");

  // A. Update Workout Notes
  const updatedNotes = "Updated notes: Added paused reps on bench. Felt explosive.";
  const notesRes = await useWorkoutStore.getState().updateWorkoutNotes(workoutId, updatedNotes);
  assert(notesRes.success, "updateWorkoutNotes() succeeds with success: true", notesRes.error);
  assert(
    useWorkoutStore.getState().currentDetail?.notes === updatedNotes,
    "updateWorkoutNotes() updates notes in Zustand currentDetail"
  );

  const { data: dbWorkoutNotes } = await supabase
    .from("workouts")
    .select("notes")
    .eq("id", workoutId)
    .single();

  assert(
    dbWorkoutNotes?.notes === updatedNotes,
    "PostgreSQL reflects updated notes in workouts table"
  );

  // B. Delete Exercise from Workout
  await useWorkoutStore.getState().deleteExerciseFromWorkout(workoutId, plankId);
  const detailAfterExDel = useWorkoutStore.getState().currentDetail;
  assert(
    !detailAfterExDel?.exercises.some((e) => e.id === plankId),
    "deleteExerciseFromWorkout() removes exercise from state"
  );

  const { data: dbPlankSetsAfterDel } = await supabase
    .from("workout_sets")
    .select("id")
    .eq("workout_id", workoutId)
    .eq("exercise_id", plankId);

  assert((dbPlankSetsAfterDel || []).length === 0, "PostgreSQL confirms all sets for deleted exercise are removed");

  // C. Delete Entire Workout
  const deleteRes = await useWorkoutStore.getState().deleteWorkout(workoutId);
  assert(deleteRes.success, "deleteWorkout() returns success: true", deleteRes.error);
  assert(useWorkoutStore.getState().currentDetail === null, "deleteWorkout() clears currentDetail");
  assert(
    !useWorkoutStore.getState().workouts.some((w) => w.id === workoutId),
    "deleteWorkout() removes workout from workouts feed in Zustand"
  );

  // Verify deletion in PostgreSQL
  const { data: dbWorkoutDeleted } = await supabase
    .from("workouts")
    .select("id")
    .eq("id", workoutId)
    .maybeSingle();

  assert(!dbWorkoutDeleted, "PostgreSQL confirms workout row is deleted");

  const { data: dbSetsOrphaned } = await supabase
    .from("workout_sets")
    .select("id")
    .eq("workout_id", workoutId);

  assert(
    (dbSetsOrphaned || []).length === 0,
    "PostgreSQL confirms all sets cascade-deleted (0 orphaned rows)"
  );

  // -----------------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------------
  console.log("\n=======================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`   🏁 AUDIT RESULT: ${passedCount}/${totalCount} TESTS PASSED`);
  if (passedCount === totalCount) {
    console.log("   🎉 ALL PHASE 4 REPAIRS & PERSISTENCE VERIFIED!");
  } else {
    console.log("   ⚠️ SOME TESTS FAILED. CHECK LOG ABOVE.");
  }
  console.log("=======================================================\n");

  process.exit(passedCount === totalCount ? 0 : 1);
}

runPhase4Audit().catch((err) => {
  console.error("Unhandled test runner exception:", err);
  process.exit(1);
});

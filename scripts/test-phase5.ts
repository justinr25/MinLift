import { supabase } from "../src/lib/supabase";
import { useExerciseStore, DEFAULT_EXERCISES } from "../src/stores/exercise-store";
import { useAuthStore } from "../src/stores/auth-store";
import { useActiveWorkoutStore } from "../src/stores/active-workout-store";

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

async function runPhase5Audit() {
  console.log("\n=======================================================");
  console.log("   📋 MINLIFT PHASE 5 COMPREHENSIVE AUTOMATED AUDIT");
  console.log("=======================================================\n");

  const testEmail = `phase5_tester_${Date.now()}@minlift.test`;
  const testPassword = "Password123!";
  const testName = "Phase 5 Lifter";

  // -----------------------------------------------------------------
  // 1. AUTH & PROFILE SETUP
  // -----------------------------------------------------------------
  console.log("[1/8] Setting up Test User & Supabase Auth...");
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
  // 2. AUTO-SEEDING DEFAULT EXERCISES ON FIRST FETCH
  // -----------------------------------------------------------------
  console.log("\n[2/8] Testing Auto-Seeding of Standard Catalog in PostgreSQL...");
  const store = useExerciseStore.getState();

  // Initially empty
  assert(store.exercises.length === 0, "Store exercises starts empty for new user");

  // Call fetchExercises()
  await useExerciseStore.getState().fetchExercises();
  const seededStoreExercises = useExerciseStore.getState().exercises;

  assert(
    seededStoreExercises.length >= DEFAULT_EXERCISES.length,
    `Store populated with standard exercises (got ${seededStoreExercises.length})`
  );

  // Verify in PostgreSQL table directly
  const { data: dbExercises, error: dbExError } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false);

  assert(!dbExError && !!dbExercises, "Direct DB query for user exercises succeeds", dbExError?.message);
  assert(
    (dbExercises?.length || 0) >= DEFAULT_EXERCISES.length,
    `PostgreSQL has at least 20 exercises seeded for user (got ${dbExercises?.length})`
  );

  const hasBench = dbExercises?.some((e) => e.name.toLowerCase().includes("bench"));
  assert(!!hasBench, "Standard exercise 'Barbell Flat Bench Press' present in DB");

  // -----------------------------------------------------------------
  // 3. CREATE CUSTOM EXERCISE (WITH CATEGORY AND NOTES)
  // -----------------------------------------------------------------
  console.log("\n[3/8] Testing Custom Exercise Creation...");
  const customExName = `Custom Incline Hex Press ${Date.now()}`;
  const customCategory = "Chest";
  const customNotes = "Seat angle 30 degrees, touch dumbbells at peak contraction, slow 3s eccentric.";

  const createRes = await useExerciseStore.getState().createExercise({
    name: customExName,
    category: customCategory,
    notes: customNotes,
  });

  assert(createRes.success && !!createRes.exercise, "createExercise returned success: true");
  const createdExercise = createRes.exercise!;
  assert(createdExercise.name === customExName, "Created exercise name matches input");
  assert(createdExercise.category === customCategory, "Created exercise category matches 'Chest'");
  assert(createdExercise.notes === customNotes, "Created exercise notes matches input");

  // Verify immediately in Zustand exercises array
  const currentExercises = useExerciseStore.getState().exercises;
  assert(
    currentExercises.some((e) => e.id === createdExercise.id),
    "New custom exercise is immediately present in Zustand exercises list"
  );

  // Verify directly in Supabase PostgreSQL
  const { data: dbCustomEx, error: dbCustomError } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", createdExercise.id)
    .single();

  assert(!dbCustomError && !!dbCustomEx, "Custom exercise row exists in PostgreSQL", dbCustomError?.message);
  assert(dbCustomEx?.notes === customNotes, "Custom exercise notes match in PostgreSQL");
  assert(dbCustomEx?.is_archived === false, "Custom exercise has is_archived = false in PostgreSQL");

  // -----------------------------------------------------------------
  // 4. PERSISTENT NOTES UPDATE WITH BLUR AUTO-SAVE
  // -----------------------------------------------------------------
  console.log("\n[4/8] Testing Persistent Notes Update & Auto-Save...");
  const updatedNotes = "UPDATED CUE: Retract scapula firmly, flared elbows 45 deg, explode upward.";
  const updateNotesRes = await useExerciseStore
    .getState()
    .updateExerciseNotes(createdExercise.id, updatedNotes);

  assert(updateNotesRes.success, "updateExerciseNotes returned success: true");

  // Check Zustand state updated
  const storedItem = useExerciseStore
    .getState()
    .exercises.find((e) => e.id === createdExercise.id);
  assert(storedItem?.notes === updatedNotes, "Zustand store reflects updated notes immediately");

  // Query Supabase directly
  const { data: dbNotesCheck } = await supabase
    .from("exercises")
    .select("notes, updated_at")
    .eq("id", createdExercise.id)
    .single();

  assert(dbNotesCheck?.notes === updatedNotes, "Supabase PostgreSQL notes column matches updated notes");

  // -----------------------------------------------------------------
  // 5. LINKED WORKOUT TEMPLATES TOGGLE
  // -----------------------------------------------------------------
  console.log("\n[5/8] Testing Linked Workout Templates (Junction Table)...");

  // Fetch available workout types
  const { data: workoutTypes } = await supabase
    .from("workout_types")
    .select("id, name")
    .order("sort_order");

  assert((workoutTypes || []).length > 0, "Workout types are available in DB");
  const pushType = workoutTypes!.find((t) => t.name.toLowerCase().includes("push")) || workoutTypes![0];

  // Fetch detail first
  await useExerciseStore.getState().fetchExerciseDetail(createdExercise.id);

  // Link template
  const linkRes1 = await useExerciseStore
    .getState()
    .toggleLinkedTemplate(createdExercise.id, pushType.id);

  assert(linkRes1.success && linkRes1.linked === true, "toggleLinkedTemplate links template (linked: true)");

  // Check state
  const linkedIds1 = useExerciseStore.getState().linkedTemplateIds[createdExercise.id] || [];
  assert(linkedIds1.includes(pushType.id), "Store linkedTemplateIds contains push template ID");

  // Check junction table in PostgreSQL
  const { data: junctionRow1 } = await supabase
    .from("workout_type_exercises")
    .select("*")
    .eq("workout_type_id", pushType.id)
    .eq("exercise_id", createdExercise.id)
    .maybeSingle();

  assert(!!junctionRow1, "Row successfully inserted in workout_type_exercises table");

  // Unlink template
  const linkRes2 = await useExerciseStore
    .getState()
    .toggleLinkedTemplate(createdExercise.id, pushType.id);

  assert(linkRes2.success && linkRes2.linked === false, "toggleLinkedTemplate unlinks template (linked: false)");

  const linkedIds2 = useExerciseStore.getState().linkedTemplateIds[createdExercise.id] || [];
  assert(!linkedIds2.includes(pushType.id), "Store linkedTemplateIds no longer contains push template ID");

  // Check junction table deleted in PostgreSQL
  const { data: junctionRow2 } = await supabase
    .from("workout_type_exercises")
    .select("*")
    .eq("workout_type_id", pushType.id)
    .eq("exercise_id", createdExercise.id)
    .maybeSingle();

  assert(!junctionRow2, "Row successfully deleted from workout_type_exercises table");

  // -----------------------------------------------------------------
  // 6. PERFORMANCE HISTORY & METRICS CALCULATION
  // -----------------------------------------------------------------
  console.log("\n[6/8] Testing Performance History Aggregation from Workouts...");

  // Seed a completed workout session with sets for this custom exercise
  const { data: workoutRow } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_type_id: pushType.id,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  assert(!!workoutRow?.id, "Seed completed workout in Supabase");
  const testWorkoutId = workoutRow!.id;

  // Insert completed sets: 70 lbs x 10 reps, 75 lbs x 8 reps, 80 lbs x 6 reps
  const { error: setsInsertError } = await supabase.from("workout_sets").insert([
    {
      workout_id: testWorkoutId,
      exercise_id: createdExercise.id,
      set_number: 1,
      weight: 70,
      reps: 10,
      is_completed: true,
    },
    {
      workout_id: testWorkoutId,
      exercise_id: createdExercise.id,
      set_number: 2,
      weight: 75,
      reps: 8,
      is_completed: true,
    },
    {
      workout_id: testWorkoutId,
      exercise_id: createdExercise.id,
      set_number: 3,
      weight: 80,
      reps: 6,
      is_completed: true,
    },
  ]);

  assert(!setsInsertError, "Insert completed sets for exercise", setsInsertError?.message);

  // Fetch exercise detail to verify aggregated performance history
  const detail = await useExerciseStore.getState().fetchExerciseDetail(createdExercise.id);
  assert(!!detail, "fetchExerciseDetail successfully returns exercise detail");

  const sessions = useExerciseStore.getState().performanceHistory[createdExercise.id] || [];
  assert(sessions.length === 1, `Performance history has exactly 1 session (got ${sessions.length})`);

  if (sessions.length > 0) {
    const s = sessions[0];
    assert(s.totalSets === 3, `Session totalSets matches 3 (got ${s.totalSets})`);
    assert(s.maxWeight === 80, `Session maxWeight matches 80 lbs (got ${s.maxWeight})`);
    assert(s.bestReps === 6, `Session bestReps matches 6 (got ${s.bestReps})`);
  }

  // Also verify fetchExercises calculates metrics on catalog list
  await useExerciseStore.getState().fetchExercises();
  const refreshedCatalogItem = useExerciseStore
    .getState()
    .exercises.find((e) => e.id === createdExercise.id);

  assert(
    refreshedCatalogItem?.lastWeightLifted === 80,
    `Catalog metric lastWeightLifted is 80 (got ${refreshedCatalogItem?.lastWeightLifted})`
  );
  assert(
    refreshedCatalogItem?.lastReps === 6,
    `Catalog metric lastReps is 6 (got ${refreshedCatalogItem?.lastReps})`
  );
  assert(
    !!refreshedCatalogItem?.lastPerformedAt,
    `Catalog metric lastPerformedAt is populated (got ${refreshedCatalogItem?.lastPerformedAt})`
  );

  // -----------------------------------------------------------------
  // 7. ARCHIVING EXERCISE
  // -----------------------------------------------------------------
  console.log("\n[7/8] Testing Exercise Archival (Soft Delete)...");

  const archiveRes = await useExerciseStore.getState().archiveExercise(createdExercise.id);
  assert(archiveRes.success, "archiveExercise returned success: true");

  // Check removed from Zustand active list
  const activeAfterArchive = useExerciseStore.getState().exercises;
  assert(
    !activeAfterArchive.some((e) => e.id === createdExercise.id),
    "Archived exercise immediately removed from active exercises list"
  );

  // Verify in PostgreSQL table
  const { data: dbArchivedEx } = await supabase
    .from("exercises")
    .select("is_archived")
    .eq("id", createdExercise.id)
    .single();

  assert(dbArchivedEx?.is_archived === true, "PostgreSQL row has is_archived = true");

  // Fetching exercises again still excludes archived exercises
  await useExerciseStore.getState().fetchExercises();
  const reFetched = useExerciseStore.getState().exercises;
  assert(
    !reFetched.some((e) => e.id === createdExercise.id),
    "fetchExercises() query excludes archived exercises (.eq('is_archived', false))"
  );

  // -----------------------------------------------------------------
  // 8. ACTIVE WORKOUT & PERSISTENCE INTEGRATION
  // -----------------------------------------------------------------
  console.log("\n[8/8] Testing Active Workout Logger & Local-First Storage Integration...");

  // Verify active-workout-store accepts and preserves exercise notes
  useActiveWorkoutStore.getState().startWorkout({
    workoutTypeId: pushType.id,
    workoutTypeName: pushType.name,
  });

  useActiveWorkoutStore.getState().addExercise({
    id: createdExercise.id,
    name: "Barbell Flat Bench Press",
    category: "Chest",
    notes: "Tuck elbows 45 deg, arch upper back, grip bar with white knuckles.",
  });

  const activeExercises = useActiveWorkoutStore.getState().exercises;
  assert(activeExercises.length === 1, "Active workout has 1 exercise added");
  assert(
    activeExercises[0].notes === "Tuck elbows 45 deg, arch upper back, grip bar with white knuckles.",
    "ActiveExercise preserves persistent notes for display on ExerciseLoggerCard"
  );

  useActiveWorkoutStore.getState().discardWorkout();

  // Verify Zustand persist storage for exercise-store
  const persistedRaw = (global as any).window?.localStorage?.getItem("minlift-exercise-storage");
  assert(!!persistedRaw, "minlift-exercise-storage exists in localStorage cache");
  if (persistedRaw) {
    const parsed = JSON.parse(persistedRaw);
    assert(
      Array.isArray(parsed?.state?.exercises),
      "Persisted exercise storage contains valid exercises array"
    );
  }

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

runPhase5Audit().catch((err) => {
  console.error("Audit script failed with unhandled error:", err);
  process.exit(1);
});

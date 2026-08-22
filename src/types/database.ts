// ============================================
// MinLift Database TypeScript Definitions
// ============================================

export type WeightUnit = "lbs" | "kg";

export interface Profile {
  id: string; // references auth.users(id)
  display_name: string | null;
  preferred_weight_unit: WeightUnit;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WorkoutType {
  id: string;
  user_id: string | null; // null = system default
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  category: string; // 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Other'
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTypeExercise {
  workout_type_id: string;
  exercise_id: string;
  sort_order: number;
}

export interface Workout {
  id: string;
  user_id: string;
  workout_type_id: string;
  location_id: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  is_completed: boolean;
  created_at: string;
}

// ============================================
// Compound UI Types
// ============================================

export interface WorkoutWithDetails extends Workout {
  workout_type?: WorkoutType;
  location?: Location | null;
  sets?: WorkoutSet[];
}

export interface ExerciseWithStats extends Exercise {
  last_performed_at?: string | null;
  last_weight?: number | null;
  last_reps?: number | null;
}

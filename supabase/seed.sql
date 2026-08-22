-- ============================================
-- MinLift Default Seed Data
-- ============================================

-- Default system workout types (user_id = NULL indicates accessible to all users)
INSERT INTO public.workout_types (name, is_default, sort_order) VALUES
  ('Push', true, 1),
  ('Pull', true, 2),
  ('Legs', true, 3);

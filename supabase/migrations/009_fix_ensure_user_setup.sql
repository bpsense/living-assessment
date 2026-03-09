-- 009_fix_ensure_user_setup.sql
-- Fix two issues:
--   1. ensure_user_setup() RPC was hardcoding role='admin' instead of reading
--      the role from user metadata (set during admin invite flow).
--   2. Fix any educator profiles that were incorrectly created with role='admin'
--      because the old trigger/RPC didn't read the metadata role.

-- ============================================================
-- 1. Updated ensure_user_setup RPC — reads role from metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_user_setup()
RETURNS jsonb AS $$
DECLARE
  v_user_id   uuid;
  v_school_id uuid;
  v_role      text;
  v_profile   public.profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Check if profile already exists
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  IF v_profile.id IS NULL THEN
    -- Read role + school from auth metadata (set during invite)
    SELECT
      COALESCE(u.raw_user_meta_data->>'role', 'admin'),
      COALESCE(
        (u.raw_user_meta_data->>'school_id')::uuid,
        (SELECT id FROM public.schools LIMIT 1)
      )
    INTO v_role, v_school_id
    FROM auth.users u
    WHERE u.id = v_user_id;

    IF v_school_id IS NULL THEN
      RETURN jsonb_build_object('error', 'No school configured');
    END IF;

    -- Create profile from auth metadata
    INSERT INTO public.profiles (id, school_id, role, full_name, email, avatar_url)
    SELECT
      v_user_id,
      v_school_id,
      v_role::user_role,
      COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
      ),
      u.email,
      COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
      )
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    -- Re-fetch (in case ON CONFLICT hit)
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- Ensure classroom assignments exist (only for non-invited / self-signup)
  -- Invited educators get classrooms assigned manually by admin.
  IF v_profile.id IS NOT NULL THEN
    PERFORM 1 FROM auth.users u
    WHERE u.id = v_user_id
      AND (u.raw_user_meta_data->>'role') IS NOT NULL;

    IF NOT FOUND THEN
      -- Self-signup: auto-assign to all classrooms (dev convenience)
      INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
      SELECT v_user_id, c.id, c.school_id
      FROM public.classrooms c
      WHERE c.school_id = v_profile.school_id
      ON CONFLICT (educator_id, classroom_id) DO NOTHING;
    END IF;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Re-apply the handle_new_user trigger (from migration 007)
--    in case it wasn't applied previously
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
  v_role      text;
  v_invited   boolean;
BEGIN
  -- Check if role was explicitly passed (admin invite flow)
  v_invited := (new.raw_user_meta_data->>'role') IS NOT NULL;

  -- Role: use metadata value if present, otherwise default to 'admin' (self-signup/dev)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');

  -- School: use metadata value if present, otherwise first school (demo)
  v_school_id := COALESCE(
    (new.raw_user_meta_data->>'school_id')::uuid,
    (SELECT id FROM public.schools LIMIT 1)
  );

  IF v_school_id IS NULL THEN
    RETURN new;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, school_id, role, full_name, email, avatar_url)
  VALUES (
    new.id,
    v_school_id,
    v_role::user_role,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-assign to ALL classrooms only for self-signup users (dev convenience).
  -- Invited educators get classrooms assigned manually by admin.
  IF NOT v_invited THEN
    INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
    SELECT new.id, c.id, c.school_id
    FROM public.classrooms c
    WHERE c.school_id = v_school_id
    ON CONFLICT (educator_id, classroom_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Fix existing educator profiles that were wrongly assigned
--    role='admin' when they should be 'educator'.
--    Detects users whose auth metadata has role='educator' but
--    whose profile has role='admin'.
-- ============================================================
UPDATE public.profiles p
SET role = 'educator'
FROM auth.users u
WHERE p.id = u.id
  AND u.raw_user_meta_data->>'role' = 'educator'
  AND p.role = 'admin';

-- Also ensure the admin-update RLS policy exists (from 007, re-applied for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_admin'
  ) THEN
    CREATE POLICY "profiles_update_admin"
      ON profiles FOR UPDATE
      USING (school_id = auth_school_id() AND auth_role() = 'admin')
      WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');
  END IF;
END $$;

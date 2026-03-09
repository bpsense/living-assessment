-- 006_ensure_user_setup.sql
-- Fix the bootstrap problem: when a user signs in via OAuth for the first time,
-- they need a profile AND classroom assignments to use the app.
--
-- This migration:
--   1. Updates handle_new_user() trigger to also auto-assign classrooms
--   2. Creates ensure_user_setup() RPC callable by any authenticated user
--      as a client-side fallback if the trigger didn't run
--   3. Backfills educator_classrooms for any existing profiles

-- ============================================================
-- 1. Updated trigger: handle_new_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
BEGIN
  v_school_id := (SELECT id FROM public.schools LIMIT 1);

  IF v_school_id IS NULL THEN
    RETURN new;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, school_id, role, full_name, email, avatar_url)
  VALUES (
    new.id,
    v_school_id,
    'admin',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-assign to ALL classrooms in the school (for demo/dev)
  INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
  SELECT new.id, c.id, c.school_id
  FROM public.classrooms c
  WHERE c.school_id = v_school_id
  ON CONFLICT (educator_id, classroom_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Client-side fallback RPC: ensure_user_setup
--    Called by the app when the profile doesn't exist.
--    Creates profile + classroom assignments.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_user_setup()
RETURNS jsonb AS $$
DECLARE
  v_user_id   uuid;
  v_school_id uuid;
  v_profile   public.profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Check if profile already exists
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  IF v_profile.id IS NULL THEN
    -- Find default school
    v_school_id := (SELECT id FROM public.schools LIMIT 1);
    IF v_school_id IS NULL THEN
      RETURN jsonb_build_object('error', 'No school configured');
    END IF;

    -- Create profile from auth metadata
    INSERT INTO public.profiles (id, school_id, role, full_name, email, avatar_url)
    SELECT
      v_user_id,
      v_school_id,
      'admin',
      coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
      ),
      u.email,
      coalesce(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
      )
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    -- Re-fetch (in case ON CONFLICT hit)
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  END IF;

  -- Ensure classroom assignments exist
  IF v_profile.id IS NOT NULL THEN
    INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
    SELECT v_user_id, c.id, c.school_id
    FROM public.classrooms c
    WHERE c.school_id = v_profile.school_id
    ON CONFLICT (educator_id, classroom_id) DO NOTHING;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Backfill: assign existing profiles to all classrooms
-- ============================================================
INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
SELECT p.id, c.id, c.school_id
FROM public.profiles p
CROSS JOIN public.classrooms c
WHERE p.school_id = c.school_id
  AND p.role IN ('admin', 'educator')
ON CONFLICT (educator_id, classroom_id) DO NOTHING;

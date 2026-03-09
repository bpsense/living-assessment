-- 007_invite_educator.sql
-- Enable admin-initiated educator invitations.
--
-- Changes:
--   1. Updates handle_new_user() trigger to read role + school_id from
--      user metadata (set by admin during invite), with sensible defaults.
--   2. Only auto-assigns classrooms for self-signup users (no role in metadata).
--      Invited educators get classrooms assigned manually by admin.
--   3. Adds RLS policy so admins can UPDATE profiles in their school.

-- ============================================================
-- 1. Updated trigger: handle_new_user
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
-- 2. RLS: admins can UPDATE profiles in their school
-- ============================================================
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = 'admin')
  WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');

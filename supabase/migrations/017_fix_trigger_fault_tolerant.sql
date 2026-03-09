-- 017_fix_trigger_fault_tolerant.sql
-- Make handle_new_user trigger fault-tolerant so a trigger error
-- does not prevent user creation in auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
  v_role      text;
  v_invited   boolean;
BEGIN
  -- Wrap in a sub-block so exceptions don't abort the INSERT into auth.users
  BEGIN
    v_invited := (new.raw_user_meta_data->>'role') IS NOT NULL;
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');
    v_school_id := COALESCE(
      (new.raw_user_meta_data->>'school_id')::uuid,
      (SELECT id FROM public.schools LIMIT 1)
    );

    IF v_school_id IS NULL THEN
      RETURN new;
    END IF;

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

    IF NOT v_invited THEN
      INSERT INTO public.educator_classrooms (educator_id, classroom_id, school_id)
      SELECT new.id, c.id, c.school_id
      FROM public.classrooms c
      WHERE c.school_id = v_school_id
      ON CONFLICT (educator_id, classroom_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't crash — the edge function will create the profile manually
    RAISE WARNING 'handle_new_user trigger failed for user %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

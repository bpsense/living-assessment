-- 005_auto_create_profile.sql
-- Auto-create a profile row when a new Supabase Auth user signs up.
-- This enables Google OAuth (and any other provider) to work without
-- manual profile provisioning.
--
-- SETUP REQUIRED — Supabase Dashboard:
--   1. Authentication → Providers → Google → Enable
--   2. Enter your Google OAuth Client ID and Client Secret
--      (from Google Cloud Console → APIs & Services → Credentials)
--   3. Authentication → URL Configuration:
--      - Site URL: http://localhost:5173
--      - Redirect URLs: add http://localhost:5173
--
-- New users are assigned to the first school found (demo "Embark Academy")
-- with the 'admin' role for easy development access.
-- In production, replace this with a proper onboarding flow.

-- ============================================================
-- Trigger function: auto-create profile on auth.users INSERT
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, school_id, role, full_name, email, avatar_url)
  values (
    new.id,
    (select id from public.schools limit 1),
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
  );
  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Trigger: fire after every new auth user
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

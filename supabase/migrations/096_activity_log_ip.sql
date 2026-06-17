-- 096_activity_log_ip.sql
-- Add source-IP capture to login events in the super-admin audit trail.
--
-- auth.sessions already carries the originating IP (inet) and user-agent of each
-- new session. The login trigger (log_login_from_session, migration 094) fires
-- AFTER INSERT ON auth.sessions, so it can read NEW.ip directly — no edge function
-- or client plumbing required. This migration adds the column and teaches the
-- trigger to populate it.
--
-- SCOPE: only login events carry an IP. Data events (insert/update/delete) are
-- written by audit_row_change() from inside ordinary table triggers, which have no
-- visibility into the client connection's IP, so ip_address stays NULL for them.
--
-- BACKFILL: none. auth.sessions only retains live sessions and existing login rows
-- have no retained source IP, so pre-existing activity_log rows keep ip_address NULL.
-- Capture begins at the next login after this migration is applied.
--
-- COMPLIANCE: this supersedes the "No IP/device data is captured" note in migration
-- 094. The audit_log now records source IP for logins — additional cross-tenant PII,
-- readable ONLY by system admins via the unchanged activity_log RLS policy. No new
-- read path is introduced; the column rides the existing is_system_admin() SELECT.

-- ============================================================
-- 1. Column (nullable inet; NULL = unknown / pre-096 / non-login)
-- ============================================================
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS ip_address inet;

COMMENT ON COLUMN public.activity_log.ip_address IS
  'Source IP of a login event (from auth.sessions.ip). NULL for data events and pre-096 logins.';

-- ============================================================
-- 2. Login capture — recreate the trigger function to record NEW.ip
--    (CREATE OR REPLACE preserves the existing trigger binding and grants;
--     the trailing REVOKE is kept to match migration 094 and stay explicit.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_login_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Derive the school from the user's profile (NULL for system admins / no profile)
  SELECT p.school_id INTO v_school_id FROM public.profiles p WHERE p.id = NEW.user_id;

  INSERT INTO public.activity_log (occurred_at, event_type, category, actor_id, school_id, ip_address)
  VALUES (COALESCE(NEW.created_at, now()), 'login', 'auth', NEW.user_id, v_school_id, NEW.ip);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never break authentication. Swallow and continue.
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_login_from_session() FROM public, anon, authenticated;

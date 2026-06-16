-- 094_activity_log.sql
-- Super-admin "Logins & Activity" audit trail.
--
-- One append-only table captures (a) every login (trigger on auth.sessions) and
-- (b) INSERT/UPDATE/DELETE on a curated set of public tables (generic row-audit
-- trigger). All writes occur inside SECURITY DEFINER trigger functions, so RLS is
-- bypassed on write and there is intentionally NO insert/update/delete policy.
-- Reads are system-admin only, matching the existing *_select_system_admin pattern.
--
-- COMPLIANCE: this table aggregates cross-tenant PII (actor identity via join,
-- school association, changed field values) into one place. It is readable ONLY by
-- system admins via is_system_admin() and is consistent with the platform's
-- tenant-isolation model — a school user can never see another school's audit rows.
-- No IP/device data is captured. Treat as forward-only and immutable (no UPDATE or
-- DELETE policy is granted to anyone, including system admins).

-- ============================================================
-- 1. Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- monotonic; cheap keyset paging
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  event_type   text NOT NULL CHECK (event_type IN ('login','insert','update','delete')),
  category     text NOT NULL DEFAULT 'data' CHECK (category IN ('auth','data')),
  actor_id     uuid,        -- auth.uid(); NULL for service-role / edge-function / seed writes
  school_id    uuid,        -- derived; NULL = unresolved / platform-level
  table_name   text,        -- NULL for login events
  record_id    text,        -- text tolerates any PK type; NULL for login
  changed      jsonb,       -- compact diff (see audit_row_change)
  CONSTRAINT activity_log_actor_fk  FOREIGN KEY (actor_id)  REFERENCES auth.users(id)    ON DELETE SET NULL,
  CONSTRAINT activity_log_school_fk FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.activity_log IS
  'Append-only super-admin audit trail: logins (auth.sessions) + curated row changes. Trigger-written; system-admin read only.';

-- ============================================================
-- 2. Indexes (filter by school / actor / type; default sort occurred_at desc)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at ON public.activity_log (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_school      ON public.activity_log (school_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor       ON public.activity_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type  ON public.activity_log (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_table       ON public.activity_log (table_name, occurred_at DESC);

-- ============================================================
-- 3. RLS — system-admin SELECT only; no write policy
--    (every write goes through a SECURITY DEFINER trigger, which bypasses RLS;
--     with RLS on and no permissive write policy, anon/authenticated cannot
--     INSERT/UPDATE/DELETE the log at all)
-- ============================================================
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select_system_admin"
  ON public.activity_log FOR SELECT TO authenticated
  USING (is_system_admin());

-- ============================================================
-- 4. Login capture — trigger on auth.sessions
--    (precedent: on_auth_user_created AFTER INSERT ON auth.users)
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

  INSERT INTO public.activity_log (occurred_at, event_type, category, actor_id, school_id)
  VALUES (COALESCE(NEW.created_at, now()), 'login', 'auth', NEW.user_id, v_school_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never break authentication. Swallow and continue.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_login_from_session();

-- Trigger-only function: never callable from the client (matches migration 092).
REVOKE EXECUTE ON FUNCTION public.log_login_from_session() FROM public, anon, authenticated;

-- NOTE (durability): a future Supabase auth upgrade could recreate auth.sessions and
-- drop this trigger. The DROP/CREATE above is idempotent, so re-running 094 restores it.
-- Documented fallback hook (do NOT enable alongside the above, or logins double-count):
--   AFTER UPDATE OF last_sign_in_at ON auth.users
--   WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)

-- ============================================================
-- 5. Generic row-audit trigger function (attached per-table in section 6)
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_school    uuid;
  v_record_id text;
  v_changed   jsonb;
  v_old       jsonb;
  v_new       jsonb;
  v_key       text;
BEGIN
  -- Bulk-seed / maintenance suppression: a txn may SET LOCAL app.audit_enabled='off'.
  IF current_setting('app.audit_enabled', true) = 'off' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF    TG_OP = 'DELETE' THEN v_old := to_jsonb(OLD); v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW); v_old := NULL;
  ELSE                        v_new := to_jsonb(NEW); v_old := to_jsonb(OLD);
  END IF;

  -- PK is normally "id"; some tables (e.g. system_admins) key on user_id instead.
  v_record_id := COALESCE(v_new->>'id', v_old->>'id', v_new->>'user_id', v_old->>'user_id');
  -- school_id only when the table carries one (null-safe lookup).
  v_school    := NULLIF(COALESCE(v_new->>'school_id', v_old->>'school_id'), '')::uuid;

  IF TG_OP = 'UPDATE' THEN
    v_changed := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key) THEN
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    -- Skip no-ops and updated_at-only changes (most tables have a BEFORE set_updated_at trigger).
    IF v_changed = '{}'::jsonb OR (v_changed - 'updated_at') = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_changed := v_new;   -- full new row
  ELSE
    v_changed := v_old;   -- full old row
  END IF;

  INSERT INTO public.activity_log
    (occurred_at, event_type, category, actor_id, school_id, table_name, record_id, changed)
  VALUES
    (now(), lower(TG_OP), 'data', v_actor, v_school, TG_TABLE_NAME, v_record_id, v_changed);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never break the underlying write.
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM public, anon, authenticated;

-- ============================================================
-- 6. Attach the audit trigger to the curated v1 table set (idempotent)
--    High-signal: privilege / PII / config mutations. Deliberately excludes
--    observations (high volume + seed churn), messaging, surveys, enrollment.
-- ============================================================
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles          AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_students ON public.students;
CREATE TRIGGER audit_students          AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_incident_reports ON public.incident_reports;
CREATE TRIGGER audit_incident_reports  AFTER INSERT OR UPDATE OR DELETE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_classrooms ON public.classrooms;
CREATE TRIGGER audit_classrooms        AFTER INSERT OR UPDATE OR DELETE ON public.classrooms
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_dimensions ON public.dimensions;
CREATE TRIGGER audit_dimensions        AFTER INSERT OR UPDATE OR DELETE ON public.dimensions
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_system_admins ON public.system_admins;
CREATE TRIGGER audit_system_admins     AFTER INSERT OR UPDATE OR DELETE ON public.system_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_department_admins ON public.department_admins;
CREATE TRIGGER audit_department_admins AFTER INSERT OR UPDATE OR DELETE ON public.department_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_role_permissions ON public.role_permissions;
CREATE TRIGGER audit_role_permissions  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

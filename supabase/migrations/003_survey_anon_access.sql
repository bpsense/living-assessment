-- 003_survey_anon_access.sql
-- RLS policies enabling anonymous (token-based) access for the
-- student-facing interest survey flow.
--
-- The flow:
--   1. Authenticated educator creates a student_session (INSERT uses existing policy).
--   2. Educator shares /survey/<token> link — opens on a shared tablet.
--   3. The survey page (no auth) validates the token, reads the student &
--      dimensions, and submits an interest_survey — all via the anon role.

-- ============================================================
-- student_sessions: anon can SELECT by valid (non-expired) token
-- ============================================================
create policy "student_sessions_select_anon_by_token"
  on student_sessions for select
  to anon
  using (expires_at > now());

-- ============================================================
-- students: anon can SELECT students referenced by a valid session
-- ============================================================
create policy "students_select_anon_via_session"
  on students for select
  to anon
  using (
    id in (
      select student_id
      from student_sessions
      where expires_at > now()
    )
  );

-- ============================================================
-- dimensions: anon can SELECT dimensions for schools that have
-- at least one valid session
-- ============================================================
create policy "dimensions_select_anon_via_session"
  on dimensions for select
  to anon
  using (
    school_id in (
      select s.school_id
      from students s
      inner join student_sessions ss on s.id = ss.student_id
      where ss.expires_at > now()
    )
  );

-- ============================================================
-- interest_surveys: anon can INSERT when student_id matches a
-- valid session
-- ============================================================
create policy "interest_surveys_insert_anon_via_session"
  on interest_surveys for insert
  to anon
  with check (
    student_id in (
      select student_id
      from student_sessions
      where expires_at > now()
    )
  );

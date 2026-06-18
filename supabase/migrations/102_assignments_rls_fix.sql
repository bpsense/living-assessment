-- 102_assignments_rls_fix.sql
--
-- Tighten the SELECT policies from 101. The original "school_id = auth_school_id()"
-- read branch was NOT role-gated, so a parent or learner (whose profile carries a
-- school_id) matched it and could read EVERY student's assignments in the school,
-- bypassing the family-visibility filter. Existing student-data policies (002:
-- students_select_educator) gate the school-wide read by auth_role() in
-- ('admin','educator'); this aligns the assignment tables with that pattern.
--
-- Fix: the school-wide read branch becomes staff-only. Parents read their child's
-- rows and learners their own, both gated by COALESCE(sa.visible_to_family,
-- a.visible_to_family) — unchanged. assignment_dimensions / assignment_competencies
-- / assignment_library_gratitude are educator-facing only, so their SELECT is
-- restricted to staff (no family path reads them).
--
-- WRITE ("_write", FOR ALL) policies from 101 already require
-- auth_role() in ('admin','educator') and are left as-is.

-- ---------- assignments ----------
drop policy if exists "assignments_select" on assignments;
create policy "assignments_select" on assignments for select to authenticated
  using (
    is_system_admin()
    or (school_id = auth_school_id() and auth_role() in ('admin','educator'))
    or exists (
      select 1 from student_assignments sa
      where sa.assignment_id = assignments.id
        and coalesce(sa.visible_to_family, assignments.visible_to_family) = true
        and (
          sa.student_id in (select student_id from parent_students where parent_id = auth.uid())
          or sa.student_id = (select student_id from profiles where id = auth.uid())
        )
    )
  );

-- ---------- student_assignments ----------
drop policy if exists "student_assignments_select" on student_assignments;
create policy "student_assignments_select" on student_assignments for select to authenticated
  using (
    is_system_admin()
    or (school_id = auth_school_id() and auth_role() in ('admin','educator'))
    or (
      coalesce(visible_to_family, (select a.visible_to_family from assignments a where a.id = assignment_id)) = true
      and (
        student_id in (select student_id from parent_students where parent_id = auth.uid())
        or student_id = (select student_id from profiles where id = auth.uid())
      )
    )
  );

-- ---------- assignment_observations ----------
drop policy if exists "assignment_observations_select" on assignment_observations;
create policy "assignment_observations_select" on assignment_observations for select to authenticated
  using (
    is_system_admin()
    or (school_id = auth_school_id() and auth_role() in ('admin','educator'))
    or (
      (
        student_id in (select student_id from parent_students where parent_id = auth.uid())
        or student_id = (select student_id from profiles where id = auth.uid())
      )
      and exists (
        select 1 from student_assignments sa
        join assignments a on a.id = sa.assignment_id
        where sa.id = assignment_observations.student_assignment_id
          and coalesce(sa.visible_to_family, a.visible_to_family) = true
      )
    )
  );

-- ---------- assignment_dimensions (staff-only read) ----------
drop policy if exists "assignment_dimensions_select" on assignment_dimensions;
create policy "assignment_dimensions_select" on assignment_dimensions for select to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_competencies (staff-only read) ----------
drop policy if exists "assignment_competencies_select" on assignment_competencies;
create policy "assignment_competencies_select" on assignment_competencies for select to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_library_gratitude (staff-only read) ----------
drop policy if exists "assignment_library_gratitude_select" on assignment_library_gratitude;
create policy "assignment_library_gratitude_select" on assignment_library_gratitude for select to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

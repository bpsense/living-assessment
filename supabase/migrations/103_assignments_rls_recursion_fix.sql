-- 103_assignments_rls_recursion_fix.sql
--
-- Fix infinite recursion between the assignment SELECT policies (102):
--   student_assignments_select read `assignments` (for the template's
--   visible_to_family) → fired assignments_select, which read
--   `student_assignments` (parent/learner branch) → fired student_assignments_select → ∞.
--
-- Same resolution this codebase already uses for cross-table RLS (034/042/054 and
-- the pre-098 learner_visible_assignment_ids): move the cross-table visibility
-- checks into SECURITY DEFINER helpers that bypass RLS, so a policy never triggers
-- the other table's policy. auth.uid() still resolves to the calling user inside a
-- SECURITY DEFINER function, so per-user scoping is preserved.

-- ============================================================
-- Helpers (SECURITY DEFINER → bypass RLS; auth.uid() = caller)
-- ============================================================

-- COALESCE(per-student override, template default) without touching assignments RLS.
create or replace function sa_resolved_visible(p_sa_visible boolean, p_assignment_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(p_sa_visible, (select visible_to_family from assignments where id = p_assignment_id));
$$;

-- Does the calling family user (parent of a student, or the learner) have any
-- family-visible student_assignment for this template?
create or replace function assignment_visible_to_me(p_assignment_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from student_assignments sa
    where sa.assignment_id = p_assignment_id
      and coalesce(sa.visible_to_family, (select visible_to_family from assignments where id = p_assignment_id)) = true
      and (
        sa.student_id in (select student_id from parent_students where parent_id = auth.uid())
        or sa.student_id = (select student_id from profiles where id = auth.uid())
      )
  );
$$;

-- Is this student_assignment family-visible (template ⊕ per-student override)?
create or replace function assignment_observation_visible_to_me(p_student_assignment_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from student_assignments sa
    join assignments a on a.id = sa.assignment_id
    where sa.id = p_student_assignment_id
      and coalesce(sa.visible_to_family, a.visible_to_family) = true
  );
$$;

-- ============================================================
-- Rewrite the three recursive SELECT policies to use the helpers
-- ============================================================

drop policy if exists "assignments_select" on assignments;
create policy "assignments_select" on assignments for select to authenticated
  using (
    is_system_admin()
    or (school_id = auth_school_id() and auth_role() in ('admin','educator'))
    or assignment_visible_to_me(id)
  );

drop policy if exists "student_assignments_select" on student_assignments;
create policy "student_assignments_select" on student_assignments for select to authenticated
  using (
    is_system_admin()
    or (school_id = auth_school_id() and auth_role() in ('admin','educator'))
    or (
      (
        student_id in (select student_id from parent_students where parent_id = auth.uid())
        or student_id = (select student_id from profiles where id = auth.uid())
      )
      and sa_resolved_visible(visible_to_family, assignment_id)
    )
  );

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
      and assignment_observation_visible_to_me(student_assignment_id)
    )
  );

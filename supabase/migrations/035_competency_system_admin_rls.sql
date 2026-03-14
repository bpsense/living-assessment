-- 035_competency_system_admin_rls.sql
-- Add system admin RLS bypass policies for competency tables.
-- These tables were missing system admin policies, causing system admins
-- to only see competency frameworks from their home school.

-- competency_frameworks
create policy "competency_frameworks_select_system_admin"
  on competency_frameworks for select to authenticated
  using (is_system_admin());

create policy "competency_frameworks_manage_system_admin"
  on competency_frameworks for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- competency_domains
create policy "competency_domains_select_system_admin"
  on competency_domains for select to authenticated
  using (is_system_admin());

create policy "competency_domains_manage_system_admin"
  on competency_domains for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- competency_subdomains
create policy "competency_subdomains_select_system_admin"
  on competency_subdomains for select to authenticated
  using (is_system_admin());

create policy "competency_subdomains_manage_system_admin"
  on competency_subdomains for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- competencies
create policy "competencies_select_system_admin"
  on competencies for select to authenticated
  using (is_system_admin());

create policy "competencies_manage_system_admin"
  on competencies for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- Also add system admin policies for assignment-related tables
-- that may also be missing them

-- assignment_competencies
create policy "assignment_competencies_select_system_admin"
  on assignment_competencies for select to authenticated
  using (is_system_admin());

create policy "assignment_competencies_manage_system_admin"
  on assignment_competencies for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- assignment_skills
create policy "assignment_skills_select_system_admin"
  on assignment_skills for select to authenticated
  using (is_system_admin());

create policy "assignment_skills_manage_system_admin"
  on assignment_skills for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- assignments
create policy "assignments_select_system_admin"
  on assignments for select to authenticated
  using (is_system_admin());

create policy "assignments_manage_system_admin"
  on assignments for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- student_assignments
create policy "student_assignments_select_system_admin"
  on student_assignments for select to authenticated
  using (is_system_admin());

create policy "student_assignments_manage_system_admin"
  on student_assignments for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- skills
create policy "skills_select_system_admin"
  on skills for select to authenticated
  using (is_system_admin());

create policy "skills_manage_system_admin"
  on skills for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- skill_competencies
create policy "skill_competencies_select_system_admin"
  on skill_competencies for select to authenticated
  using (is_system_admin());

create policy "skill_competencies_manage_system_admin"
  on skill_competencies for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- assignment_templates
create policy "assignment_templates_select_system_admin"
  on assignment_templates for select to authenticated
  using (is_system_admin());

create policy "assignment_templates_manage_system_admin"
  on assignment_templates for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

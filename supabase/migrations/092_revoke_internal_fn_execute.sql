-- 092_revoke_internal_fn_execute.sql
-- P1 hardening: remove anon/authenticated EXECUTE from SECURITY DEFINER functions
-- that are ONLY invoked internally (by triggers or other definer functions) and are
-- never called from the client (verified: no references in src/ or supabase/functions).
--
-- NOTE: policy-helper definer functions (auth_role, auth_school_id, is_system_admin,
-- get_*_ids, is_department_admin, ...) intentionally KEEP execute — RLS policy
-- expressions are evaluated as the querying role, so that role must be able to call
-- them. None of the functions below appear in any RLS policy, so revoking is safe.

-- Internal provisioning helpers (called by triggers / on school creation)
revoke execute on function public.distribute_global_framework(uuid)        from public, anon, authenticated;
revoke execute on function public.provision_school_global_standards(uuid)   from public, anon, authenticated;
revoke execute on function public.seed_default_competency_framework(uuid)   from public, anon, authenticated;
revoke execute on function public.seed_default_dimensions(uuid)             from public, anon, authenticated;
revoke execute on function public.seed_default_skills(uuid)                 from public, anon, authenticated;

-- Trigger functions (not callable via PostgREST regardless; clears the linter)
revoke execute on function public.enforce_global_template_permission()      from public, anon, authenticated;
revoke execute on function public.handle_new_user()                         from public, anon, authenticated;
revoke execute on function public.on_school_created_provision_standards()   from public, anon, authenticated;
revoke execute on function public.populate_admin_inbox_participants()       from public, anon, authenticated;
revoke execute on function public.snapshot_assignment_standards_on_assign() from public, anon, authenticated;
revoke execute on function public.sync_student_primary_classroom()          from public, anon, authenticated;
revoke execute on function public.track_educator_assignment()               from public, anon, authenticated;
revoke execute on function public.trigger_seed_default_dimensions()         from public, anon, authenticated;
revoke execute on function public.trigger_seed_default_framework()          from public, anon, authenticated;
revoke execute on function public.trigger_seed_default_skills()             from public, anon, authenticated;

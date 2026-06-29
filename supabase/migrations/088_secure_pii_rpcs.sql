-- 088_secure_pii_rpcs.sql
-- Tenant-isolation P0: add authorization guards to two SECURITY DEFINER RPCs that
-- were callable by anon/authenticated via /rest/v1/rpc with NO check on whether the
-- caller may access the target student. Both now authorize against the same access
-- rules used by the students SELECT/write policies, and pin search_path (hardening,
-- addresses function_search_path_mutable for these definer functions).

-- ── compile_student_context ────────────────────────────────────
-- Returns a full PII dossier (identity, DOB, support needs, observations + notes,
-- teacher/parent notes). Previously any signed-in user could pull any student by
-- UUID. Rather than restate the long body, rename it to an internal function,
-- revoke direct RPC access, and expose a guarded wrapper under the original name.

alter function public.compile_student_context(uuid)
  rename to compile_student_context_internal;

-- Not callable directly via PostgREST anymore (only the guarded wrapper, which runs
-- as definer/owner, may call it). Revoke from PUBLIC too, since anon/authenticated
-- inherit PUBLIC's EXECUTE.
revoke execute on function public.compile_student_context_internal(uuid)
  from public, anon, authenticated;

alter function public.compile_student_context_internal(uuid)
  set search_path = public, pg_temp;

create or replace function public.compile_student_context(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_school uuid;
begin
  select school_id into v_school from students where id = p_student_id;
  if v_school is null then
    return json_build_object('error', 'Student not found');
  end if;

  -- Only callers who can see this student may compile their context.
  if not (
    is_system_admin()
    or (auth_role() = 'admin' and auth_school_id() = v_school)
    or (is_department_admin()
        and p_student_id in (select get_department_student_ids(auth.uid())))
    or (auth_role() = 'educator'
        and p_student_id in (select get_educator_student_ids(auth.uid())))
    or (auth_role() = 'parent' and exists (
          select 1 from parent_students ps
          where ps.parent_id = auth.uid() and ps.student_id = p_student_id))
    or (auth_role() = 'learner' and p_student_id = (
          select student_id from profiles where id = auth.uid()))
  ) then
    raise exception 'Not authorized to compile context for student %', p_student_id
      using errcode = '42501';
  end if;

  return public.compile_student_context_internal(p_student_id);
end;
$function$;

-- ── regenerate_family_code ─────────────────────────────────────
-- Rotates a student's family-linking code. Previously any caller could rotate the
-- code of ANY student (account-linking DoS). Restrict to same-school admins, the
-- student's educators, and system admins. Body otherwise unchanged.

create or replace function public.regenerate_family_code(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  new_code text;
  done boolean := false;
  v_school uuid;
begin
  select school_id into v_school from students where id = p_student_id;
  if v_school is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if not (
    is_system_admin()
    or (auth_role() = 'admin' and auth_school_id() = v_school)
    or (auth_role() = 'educator'
        and p_student_id in (select get_educator_student_ids(auth.uid())))
  ) then
    raise exception 'Not authorized to regenerate family code for student %', p_student_id
      using errcode = '42501';
  end if;

  while not done loop
    new_code := generate_family_code();
    begin
      update students set family_code = new_code where id = p_student_id;
      done := true;
    exception when unique_violation then
      done := false;
    end;
  end loop;
  return new_code;
end;
$function$;

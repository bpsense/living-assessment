-- supabase/tests/rls/tenant_isolation_test.sql
--
-- Multi-tenant (school) RLS isolation regression suite.
--
-- Self-contained: builds its own two-school world (schools, users via auth.users
-- + handle_new_user, classrooms, students, an educator assignment), simulates each
-- role by switching the Postgres role to `authenticated` and setting the JWT claims
-- (auth.uid()), asserts the invariants, then ROLLS BACK — so it pollutes nothing and
-- can be run against any environment (a fresh CI database or even prod).
--
-- Assertions RAISE on failure; run with psql -v ON_ERROR_STOP=1 so a failure exits
-- non-zero (CI gate). On success it prints "ALL 7 RLS ISOLATION ASSERTIONS PASSED".
--
-- Covered invariants (each maps to a tenant-isolation guarantee / shipped fix):
--   1. read isolation   — an educator cannot SELECT another school's students
--   2. read access      — an educator CAN see their own assigned student
--   3. sysadmin read     — a system admin sees students across schools
--   4. observations write (regression: the original reported bug) — a system admin
--      CAN insert an observation for a student in another school
--   5. read isolation    — an educator cannot SELECT another school's observation
--   6. write isolation   — an educator CANNOT insert an observation cross-school
--   7. compile guard (P0)— compile_student_context denies a cross-school educator

begin;

-- ----------------------------------------------------------------------------
-- Fixtures (created as the migration/owner role; inserting a school auto-seeds
-- its dimensions via trigger, and auth.users inserts auto-create profiles via
-- handle_new_user from raw_user_meta_data). student_classrooms is created by a
-- trigger from students.classroom_id, so it is intentionally not inserted here.
-- ----------------------------------------------------------------------------
insert into public.schools (id, name, slug) values
  ('a0a0a0a0-0000-4000-8000-0000000000aa', 'RLS Test A', 'zzz-rls-test-a'),
  ('b0b0b0b0-0000-4000-8000-0000000000bb', 'RLS Test B', 'zzz-rls-test-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('0e0e0e0e-0000-4000-8000-0000000000ea', 'edua@zzz.rls',
   '{"role":"educator","school_id":"a0a0a0a0-0000-4000-8000-0000000000aa","full_name":"Edu A"}'::jsonb),
  ('0e0e0e0e-0000-4000-8000-0000000000eb', 'edub@zzz.rls',
   '{"role":"educator","school_id":"b0b0b0b0-0000-4000-8000-0000000000bb","full_name":"Edu B"}'::jsonb),
  ('0e0e0e0e-0000-4000-8000-0000000000a9', 'sys@zzz.rls',
   '{"role":"admin","school_id":"a0a0a0a0-0000-4000-8000-0000000000aa","full_name":"Sys"}'::jsonb);
insert into public.system_admins (user_id) values ('0e0e0e0e-0000-4000-8000-0000000000a9');

insert into public.classrooms (id, school_id, name) values
  ('0c0c0c0c-0000-4000-8000-0000000000ca', 'a0a0a0a0-0000-4000-8000-0000000000aa', 'Class A'),
  ('0c0c0c0c-0000-4000-8000-0000000000cb', 'b0b0b0b0-0000-4000-8000-0000000000bb', 'Class B');

insert into public.students (id, school_id, classroom_id, first_name, last_name) values
  ('0d0d0d0d-0000-4000-8000-0000000000da', 'a0a0a0a0-0000-4000-8000-0000000000aa',
   '0c0c0c0c-0000-4000-8000-0000000000ca', 'Stu', 'A'),
  ('0d0d0d0d-0000-4000-8000-0000000000db', 'b0b0b0b0-0000-4000-8000-0000000000bb',
   '0c0c0c0c-0000-4000-8000-0000000000cb', 'Stu', 'B');

insert into public.educator_classrooms (educator_id, classroom_id, school_id) values
  ('0e0e0e0e-0000-4000-8000-0000000000ea', '0c0c0c0c-0000-4000-8000-0000000000ca',
   'a0a0a0a0-0000-4000-8000-0000000000aa'),
  ('0e0e0e0e-0000-4000-8000-0000000000eb', '0c0c0c0c-0000-4000-8000-0000000000cb',
   'b0b0b0b0-0000-4000-8000-0000000000bb');

select set_config('test.dim_b',
  (select id::text from public.dimensions
   where school_id = 'b0b0b0b0-0000-4000-8000-0000000000bb' limit 1), true);

-- ----------------------------------------------------------------------------
-- Assertions (run as the `authenticated` role; identity = the JWT 'sub' claim)
-- ----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  EDU_A constant uuid := '0e0e0e0e-0000-4000-8000-0000000000ea';
  SYS   constant uuid := '0e0e0e0e-0000-4000-8000-0000000000a9';
  STU_A constant uuid := '0d0d0d0d-0000-4000-8000-0000000000da';
  STU_B constant uuid := '0d0d0d0d-0000-4000-8000-0000000000db';
  SCH_B constant uuid := 'b0b0b0b0-0000-4000-8000-0000000000bb';
  DIM_B constant uuid := current_setting('test.dim_b')::uuid;
  n int;
  ok boolean;
begin
  -- 1. read isolation: educator A cannot see school B's student
  perform set_config('request.jwt.claims', json_build_object('sub', EDU_A)::text, true);
  select count(*) into n from students where id = STU_B;
  if n <> 0 then raise exception 'FAIL 1 (read isolation): educator A sees school B student'; end if;

  -- 2. read access: educator A can see their own assigned student
  select count(*) into n from students where id = STU_A;
  if n <> 1 then raise exception 'FAIL 2 (read access): educator A cannot see own student'; end if;

  -- 3. sysadmin read: system admin sees students across schools
  perform set_config('request.jwt.claims', json_build_object('sub', SYS)::text, true);
  select count(*) into n from students where id in (STU_A, STU_B);
  if n <> 2 then raise exception 'FAIL 3 (sysadmin read): sysadmin cannot see both students (n=%)', n; end if;

  -- 4. observations write regression (the originally reported bug): a system admin
  --    CAN insert an observation for a student in another school
  begin
    insert into observations (school_id, student_id, dimension_id, observer_id, rating)
    values (SCH_B, STU_B, DIM_B, SYS, 3);
  exception when others then
    raise exception 'FAIL 4 (obs sysadmin write regression): %', SQLERRM;
  end;

  -- 5. read isolation: educator A cannot see the school B observation
  perform set_config('request.jwt.claims', json_build_object('sub', EDU_A)::text, true);
  select count(*) into n from observations where student_id = STU_B;
  if n <> 0 then raise exception 'FAIL 5 (read isolation): educator A sees school B observation'; end if;

  -- 6. write isolation: educator A cannot insert an observation cross-school
  ok := false;
  begin
    insert into observations (school_id, student_id, dimension_id, observer_id, rating)
    values (SCH_B, STU_B, DIM_B, EDU_A, 3);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL 6 (write isolation): educator A wrote a cross-school observation'; end if;

  -- 7. compile_student_context guard (P0): denies a cross-school educator
  ok := false;
  begin
    perform public.compile_student_context(STU_B);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL 7 (compile guard): compile_student_context did not deny cross-school educator'; end if;

  raise notice 'ALL 7 RLS ISOLATION ASSERTIONS PASSED';
end $$;

rollback;

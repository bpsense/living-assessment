-- 091_pin_function_search_path.sql
-- P1 hardening: pin a stable search_path on public functions. A SECURITY DEFINER
-- function with a mutable search_path is a privilege-escalation vector; pinning it
-- closes that. `extensions` is included because pgcrypto/uuid helpers (digest, crypt,
-- gen_random_uuid, ...) live in the extensions schema; every body already
-- schema-qualifies auth.* refs, so no auth schema is needed in the path.

-- Fix a regression from 088: these were pinned to (public, pg_temp), but
-- compile_student_context_internal calls digest() (pgcrypto, in `extensions`),
-- which would fail to resolve. Re-pin with extensions included.
alter function public.compile_student_context_internal(uuid) set search_path = public, extensions, pg_temp;
alter function public.compile_student_context(uuid)          set search_path = public, extensions, pg_temp;
alter function public.regenerate_family_code(uuid)           set search_path = public, extensions, pg_temp;

-- Pin every other public function that lacks an explicit search_path.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;

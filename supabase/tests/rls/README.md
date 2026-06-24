# RLS isolation tests

A regression gate for multi-tenant (school) data isolation. It locks in the
guarantees established by the tenant-isolation hardening work (P0/P1) so a future
migration can't silently reopen a cross-school hole.

## What it asserts

`tenant_isolation_test.sql` builds a self-contained two-school world, simulates each
role (by switching to the `authenticated` Postgres role and setting the JWT `sub`
claim — exactly how Supabase identifies a user), asserts the invariants, and rolls
back. Seven checks:

| # | Invariant |
|---|-----------|
| 1 | An educator cannot SELECT another school's students |
| 2 | An educator CAN see their own assigned student |
| 3 | A system admin sees students across schools |
| 4 | A system admin CAN insert an observation cross-school *(the originally reported bug)* |
| 5 | An educator cannot SELECT another school's observation |
| 6 | An educator CANNOT insert an observation cross-school |
| 7 | `compile_student_context` denies a cross-school educator *(P0 PII guard)* |

The test is **transactional and rolls back**, so it leaves nothing behind and is safe
to run against any environment — including production (that's how it was first
validated).

## Run it

Locally against the throwaway stack:

```bash
supabase start                       # applies all migrations to a fresh local DB
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls/tenant_isolation_test.sql
# -> "ALL 7 RLS ISOLATION ASSERTIONS PASSED"
```

Against any other database (e.g. a read-replica), point `psql` at its URL. A failing
assertion `RAISE`s, so with `-v ON_ERROR_STOP=1` the command exits non-zero.

CI runs this automatically on PRs that touch `supabase/migrations/**` or
`supabase/tests/**` (see `.github/workflows/rls-tests.yml`).

## Design notes

- **Self-contained fixtures.** The test creates its own schools/users/students rather
  than relying on seed data, so it's deterministic and needs no `seed.sql`. Inserting a
  school auto-seeds its dimensions (trigger); inserting an `auth.users` row auto-creates
  the profile (`handle_new_user`); `student_classrooms` is created by a trigger from
  `students.classroom_id`.

- **`FORCE ROW LEVEL SECURITY` was evaluated and deliberately NOT enabled.** In this
  project the table owner (`postgres`) and `service_role` both carry the `BYPASSRLS`
  role attribute, so FORCE would change nothing for them, and client roles (`anon`,
  `authenticated`) are already subject to RLS. FORCE would only matter for a
  table-owning role *without* BYPASSRLS — which doesn't exist here. Revisit if a
  non-BYPASSRLS role is ever given table ownership or runs `SECURITY DEFINER` functions.

- **Extend it** by adding assertions to the `DO` block (storage objects, teacher/parent
  notes, student_documents, parent visibility, etc.) following the same
  `set_config('request.jwt.claims', …)` pattern.

# Living Assessment: Code Review

**Date:** 2026-03-06
**Scope:** Full codebase (src/, supabase/migrations/)
**Focus:** Security, correctness, performance, maintainability

---

## Rating Summary

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Security | B | Solid RLS foundation, but viewAsRole bypass and missing storage RLS are concerns |
| Performance | C+ | Heavy client-side data loading with no pagination; N+1 patterns in data hooks |
| Correctness | B | Core logic is sound, but duplicated scoring logic will drift |
| Maintainability | B- | Good structure, but significant code duplication across data hooks |

---

## Critical Issues

### 1. viewAsRole bypasses client-side authorization only (Security)

**File:** `src/lib/auth.ts` (lines 43-47), `src/components/ProtectedRoute.tsx` (line 26)

The `viewAsRole` feature overrides `profile.role` in the frontend, which means ProtectedRoute checks against the *overridden* role. An admin using `viewAsRole='educator'` would be denied access to admin pages. More critically, this is only a client-side mechanism. RLS policies use `auth_role()` which reads directly from the database. The client-side role override creates a confusing mismatch between what the UI shows and what the user can actually do at the data level.

**Risk:** UI shows "Access Denied" to admins testing as educator, but data queries still return admin-scoped data. Confusing UX and potential for misunderstanding what a role actually sees.

**Fix:** ProtectedRoute should check `actualRole` (the raw database role) for route gating, and only use `profile.role` (which includes viewAsRole) for dashboard/UI rendering decisions.

### 2. No pagination on Supabase queries (Performance)

**Files:** All data hooks in `src/lib/`

Every data hook fetches ALL rows with `.select('*')` and no `.range()` or `.limit()`. For a school with hundreds of students and thousands of observations, these queries will:
- Hit Supabase's default 1000-row limit silently (truncating results without error)
- Transfer increasingly large payloads over the wire
- Cause slow page loads as the school scales

**Affected queries (examples):**
- `educator-data.ts:149` fetches ALL observations for ALL educators
- `dashboard-data.ts:167` fetches ALL observations for ALL students in an educator's classrooms
- `classroom-data.ts:163` fetches ALL observations + surveys for ALL students in a classroom
- `report-data.ts:326` fetches ALL observations for a student

**Fix:** Add `.limit()` or `.range()` to large-table queries. For observations especially, consider time-windowed fetches (e.g., last 12 months) instead of unbounded selects.

### 3. No RLS policies on newer tables (Security)

**File:** `supabase/migrations/002_rls_policies.sql` vs later migrations (013, 014, etc.)

The initial RLS migration covers the core tables, but several tables added in later migrations appear to be missing RLS policies:
- `student_contacts` (migration 013)
- `teacher_notes` (migration 013)
- `student_documents` (migration 014)
- `teacher_note_folders` (migration 013 or later)
- `teacher_note_files` (migration 013 or later)
- `school_documents` (migration 012)
- `learning_suggestions` (migration 011)
- `attendance_records` (if exists)

Without explicit RLS policies and `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, these tables are either wide open (if RLS is not enabled) or completely locked (if RLS is enabled with no policies). Either state is wrong.

**Fix:** Add RLS policies for all newer tables matching the pattern established in 002_rls_policies.sql. Each needs school_id scoping and appropriate role checks.

---

## Important Issues

### 4. Duplicated buildDimensionScores logic (Maintainability)

**Files:** `src/lib/student-data.ts`, `src/lib/classroom-data.ts`, `src/lib/dashboard-data.ts`, `src/lib/report-data.ts`

The competency scoring algorithm (current-month-average with carry-forward fallback) is implemented independently in four files. The `classroom-data.ts` and `dashboard-data.ts` versions are identical copies. The `report-data.ts` version adds period-based scoring but duplicates the base logic.

**Risk:** Any bug fix or scoring model change needs to be applied in four places. They will drift.

**Fix:** Extract a single `buildDimensionScores()` utility into a shared module. The report-data version can extend it with period support.

### 5. Educator invite uses client-side signUp (Security/Architecture)

**File:** `src/lib/educator-data.ts` (lines 443-504)

The `inviteEducator` function calls `supabase.auth.signUp()` from the browser with a random password, then immediately calls `resetPasswordForEmail`. This approach:
- Relies on the `handle_new_user` trigger to set `role='educator'` from `raw_user_meta_data`, which means anyone who can call signUp with `{role: 'admin'}` in metadata could escalate privileges if the trigger blindly trusts it
- Creates a user visible in the auth.users table even if the email bounces
- The random password (`crypto.randomUUID()`) is never used but creates an active auth credential

**Fix:** Move educator invitation to a Supabase Edge Function or database RPC that uses the service_role key. The function should validate the caller is an admin and use `supabase.auth.admin.createUser()` with `email_confirm: true`.

### 6. No error boundaries (Correctness/UX)

**File:** `src/App.tsx`

The app has no React Error Boundaries. Any uncaught error in a component will crash the entire application with a white screen. Given this is used by educators mid-observation, a crash could mean lost work.

**Fix:** Add an ErrorBoundary component wrapping the main routes. Display a friendly "something went wrong" message with a reload button.

### 7. Unhandled errors in CRUD callbacks bubble to React (Correctness)

**Files:** `src/lib/sis-data.ts` (lines 85, 99, 115, etc.)

The `addContact`, `updateContact`, `deleteContact`, `addNote`, etc. callbacks throw errors but have no try/catch. The calling components would need to wrap every call in try/catch, and if they don't, the error propagates as an unhandled promise rejection.

**Example:** `addContact` (line 85): `if (insertError) throw insertError`

**Fix:** Either handle errors within the callbacks (set error state) or document and enforce that callers must wrap in try/catch. The teacher notes `addNote` is particularly problematic since it makes two sequential API calls and throws on the first without cleaning up.

### 8. Supabase anon key in .env.local appears to be a placeholder (Low risk)

**File:** `.env.local`

The key `sb_publishable_V1Pl0YNlsH4ISSv9Ufr5Rw_ySsCv8lA` doesn't match standard Supabase anon key format (typically `eyJ...`). If this is a real project key, it's fine for a publishable anon key. If it's placeholder, the app won't connect.

Also: `.env.local` is not in `.gitignore`. Verify it's excluded from version control.

---

## Minor Issues

### 9. CSV date parser ambiguity (Correctness)

**File:** `src/lib/csv-import.ts` (lines 229-255)

The date parser tries `MM/DD/YYYY` then `DD-MM-YYYY` but can't distinguish `01/02/2024` (Jan 2 in US, Feb 1 internationally). For an international school product, this will cause data errors.

**Fix:** Show a date format preview during CSV import so users can confirm the parsed dates are correct. Alternatively, add a date format selector to the import wizard.

### 10. No file size or type validation on uploads (Security)

**Files:** `src/lib/sis-data.ts`, `src/lib/school-data.ts`

Document uploads (`uploadDocument`, `uploadFile`) pass files directly to Supabase Storage without checking file size or MIME type. A user could upload a 500MB video or an executable.

**Fix:** Add client-side validation (max file size, allowed MIME types) before uploading.

### 11. Unused import (Maintainability)

**File:** `src/lib/educator-data.ts` (line 9)

`import { createClient } from '@supabase/supabase-js'` is used within `inviteEducator()` but creates a redundant second client. If the invite flow moves server-side, this import becomes dead code.

### 12. No loading state for background refetches in classroom view (UX)

**File:** `src/lib/classroom-data.ts`

Unlike `student-data.ts` which distinguishes initial load from background refetch (line 233), the classroom hook always sets `setLoading(true)` on every fetch, causing a full-page spinner on refetch.

---

## Positive Observations

- **Clean type system.** Manual TypeScript types are well-structured and thorough. Insert/Update types properly omit server-generated fields.
- **Solid auth architecture.** The auth provider pattern with context, the password recovery flow, and the session cleanup on sign-out are well-implemented.
- **Thoughtful RLS design.** The core RLS policies properly scope by school_id and role. The pattern of `auth_school_id()` and `auth_role()` helper functions is clean.
- **Good cancellation patterns.** All data hooks properly handle `cancelled` flags to prevent state updates on unmounted components.
- **Smart scoring model.** The competency scoring (current-month average with carry-forward) and zone classification logic are well-designed for the educational use case.
- **Timeline smoothing algorithm.** The forward-looking smoothing in `living-data.ts` is a nice touch for visualization.

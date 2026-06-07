# Claude Code Prompt: Living Assessment Fixes

Use this prompt with Claude Code to address the issues identified in CODE_REVIEW.md. Work through each task sequentially. After each task, verify your changes compile with `npx tsc --noEmit`.

---

## Task 1: Fix viewAsRole Authorization Bypass

**Files:** `src/lib/auth.ts`, `src/components/ProtectedRoute.tsx`

The `viewAsRole` feature overrides `profile.role` globally, which means `ProtectedRoute` checks the overridden role instead of the actual database role. An admin using `viewAsRole='educator'` gets locked out of admin routes, while RLS still returns admin-scoped data.

**Changes needed:**

1. In `src/lib/auth.ts`, expose `actualRole` alongside `profile` in the auth context. The `actualRole` should always reflect the raw database role, never the `viewAsRole` override. Add it to the `AuthContextType` interface and the provider value.

2. In `src/components/ProtectedRoute.tsx`, change the role check from `profile?.role` to the new `actualRole` value. Route gating must always use the real role. The `viewAsRole` override should only affect dashboard rendering and UI display, not access control.

3. Verify that admin routes remain accessible when `viewAsRole` is set to 'educator' or 'parent'.

---

## Task 2: Extract Shared Scoring Utility

**Files:** `src/lib/student-data.ts`, `src/lib/classroom-data.ts`, `src/lib/dashboard-data.ts`, `src/lib/report-data.ts`

The competency scoring algorithm (current-month average with carry-forward fallback) is duplicated across four files. Extract it into a shared module.

**Changes needed:**

1. Create `src/lib/scoring.ts` with the following exports:
   - `computeCompetencyScores(observations, dimensions, referenceDate?)` — the base algorithm from `student-data.ts`
   - `computeCompetencyForPeriod(observations, dimensions, period)` — the period-based variant from `report-data.ts`
   - `extractInterestScores(surveys, dimensions, periodEnd?)` — also duplicated, consolidate here
   - `classifyZones(dimensionScores)` — the zone classification logic from `student-data.ts`
   - `buildDimensionScores(observations, dimensions, surveys)` — the composite builder used in classroom and dashboard data

2. Refactor all four files to import from `scoring.ts` instead of using local implementations. The `student-data.ts` version is the canonical reference for the base algorithm. The `report-data.ts` version extends it with period selection.

3. Export the `DimensionScore` type from `scoring.ts` (currently in `student-data.ts`). Update all imports.

4. Run `npx tsc --noEmit` to verify no type errors.

---

## Task 3: Add Error Boundaries

**Files:** `src/App.tsx`, new file `src/components/ErrorBoundary.tsx`

No React Error Boundaries exist. Any uncaught error crashes the entire app with a white screen.

**Changes needed:**

1. Create `src/components/ErrorBoundary.tsx` as a class component (Error Boundaries require class components in React). It should:
   - Catch errors via `componentDidCatch`
   - Display a user-friendly message: "Something went wrong. Please reload the page."
   - Include a "Reload" button that calls `window.location.reload()`
   - Style it centered on the page using existing Tailwind utility classes
   - Log the error to console for debugging

2. In `src/App.tsx`, wrap the main `<Routes>` block with `<ErrorBoundary>`. Place it inside the providers (AuthProvider, ToastProvider) but outside the routes.

---

## Task 4: Add Pagination to Supabase Queries

**Files:** All data hooks in `src/lib/`

Every data hook fetches ALL rows with `.select('*')` and no `.range()` or `.limit()`. This will silently truncate at Supabase's 1000-row default limit and cause performance issues at scale.

**Changes needed:**

For observation queries specifically (the highest-volume table), add time-windowed fetching:

1. In `src/lib/student-data.ts` (the `useStudentProfile` hook), add a 12-month lookback window to the observations query:
   ```
   .gte('observed_at', twelveMonthsAgo.toISOString())
   ```
   where `twelveMonthsAgo` is `new Date()` minus 12 months.

2. In `src/lib/classroom-data.ts`, apply the same 12-month window to the observations fetch.

3. In `src/lib/dashboard-data.ts`:
   - Educator dashboard: add 12-month window to observations query
   - Admin dashboard: add `.limit(5000)` as a safety cap on the all-observations query, plus a 12-month window

4. In `src/lib/report-data.ts`, keep the full observation fetch (reports need historical data) but add `.limit(10000)` as a safety cap.

5. In `src/lib/educator-data.ts`, add `.limit(1000)` to the educators list query.

Do NOT add pagination UI at this stage. The goal is to prevent unbounded queries from hitting silent truncation or transferring excessive data.

---

## Task 5: Add RLS Policies for Newer Tables

**File:** Create `supabase/migrations/016_missing_rls_policies.sql` (or the next available migration number)

Several tables added after migration 002 are missing RLS policies.

**Changes needed:**

Create a new migration that adds RLS policies for these tables, following the same pattern as `002_rls_policies.sql`:

```sql
-- student_contacts: scoped to school, educators and admins can read/write
ALTER TABLE student_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_contacts_select" ON student_contacts
  FOR SELECT USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "student_contacts_insert" ON student_contacts
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "student_contacts_update" ON student_contacts
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "student_contacts_delete" ON student_contacts
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_role() = 'admin'
  );
```

Apply the same pattern for:
- `teacher_notes` (educator who created + admins can read/write)
- `teacher_note_folders` (educator who created + admins)
- `teacher_note_files` (educator who created + admins)
- `student_documents` (educators and admins in the school)
- `school_documents` (all roles in the school can read, admins can write)
- `learning_suggestions` (educators and admins in the school)

For `teacher_notes` and `teacher_note_folders`, add an additional check: the creating educator should always be able to read/write their own records (`created_by = auth.uid()` OR admin).

Check which tables already have RLS enabled by examining migration files 011-014. Only add `ENABLE ROW LEVEL SECURITY` for tables that don't have it yet.

---

## Task 6: Move Educator Invite Server-Side

**Files:** `src/lib/educator-data.ts`, new file `supabase/functions/invite-educator/index.ts`

The `inviteEducator` function uses client-side `signUp` with a random password, which creates security risks (role escalation via metadata, unused credentials).

**Changes needed:**

1. Create a Supabase Edge Function at `supabase/functions/invite-educator/index.ts`:
   - Accept `{ email, full_name, school_id }` in the request body
   - Validate the caller is an admin (check the JWT's school_id and role from the profiles table)
   - Use `supabase.auth.admin.createUser()` with `email_confirm: false` and `user_metadata: { role: 'educator', school_id, full_name }`
   - Send a password reset email via `supabase.auth.admin.generateLink({ type: 'recovery', email })`
   - Return the new user's profile ID

2. In `src/lib/educator-data.ts`:
   - Replace the `inviteEducator` function body with a call to `supabase.functions.invoke('invite-educator', { body: { email, full_name, school_id } })`
   - Remove the `createClient` import (line 9) and the redundant Supabase client creation
   - Keep the same function signature so callers don't need to change

---

## Task 7: Add Error Handling to SIS CRUD Callbacks

**File:** `src/lib/sis-data.ts`

The CRUD callbacks (`addContact`, `updateContact`, `deleteContact`, `addNote`, etc.) throw errors without try/catch. Callers get unhandled promise rejections.

**Changes needed:**

1. For each callback that currently does `if (error) throw error`, wrap the operation in try/catch and return a result object instead:

   ```typescript
   const addContact = useCallback(async (contact: StudentContactInsert): Promise<{ success: boolean; error?: string }> => {
     try {
       const { error: insertError } = await supabase.from('student_contacts').insert(contact)
       if (insertError) return { success: false, error: insertError.message }
       await refetch()
       return { success: true }
     } catch (err) {
       return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
     }
   }, [refetch])
   ```

2. Apply this pattern to all CRUD callbacks in the file: `addContact`, `updateContact`, `deleteContact`, `addNote`, `updateNote`, `deleteNote`, `uploadDocument`, `deleteDocument`, `addNoteFile`, `deleteNoteFile`.

3. For `addNote` specifically, which makes two sequential API calls (insert note, then optionally insert file), ensure the second failure doesn't leave an orphaned note. Either delete the note on file-insert failure, or return a partial success indicator.

4. Update the return types in the hook interfaces to reflect the new `{ success, error }` pattern.

---

## Task 8: Add File Upload Validation

**Files:** `src/lib/sis-data.ts`, `src/lib/school-data.ts`

Document uploads pass files directly to Supabase Storage without validation.

**Changes needed:**

1. Create a utility `src/lib/upload-validation.ts`:

   ```typescript
   const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
   const ALLOWED_MIME_TYPES = [
     'application/pdf',
     'image/jpeg',
     'image/png',
     'image/gif',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/plain',
     'text/csv',
   ]

   export function validateFile(file: File): { valid: boolean; error?: string } {
     if (file.size > MAX_FILE_SIZE) {
       return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` }
     }
     if (!ALLOWED_MIME_TYPES.includes(file.type)) {
       return { valid: false, error: `File type "${file.type}" is not allowed.` }
     }
     return { valid: true }
   }
   ```

2. Import and call `validateFile()` before every Supabase Storage upload in `sis-data.ts` and `school-data.ts`. Return the validation error instead of proceeding with the upload.

---

## Task 9: Add Date Format Preview to CSV Import

**File:** `src/lib/csv-import.ts`, and whichever component renders the CSV import wizard

The date parser can't distinguish `01/02/2024` as Jan 2 (US) vs Feb 1 (international).

**Changes needed:**

1. In `src/lib/csv-import.ts`, add a `detectDateFormat` function that:
   - Scans the first 5 non-empty date values in the mapped column
   - If any value has day > 12, the format is unambiguous (e.g., `25/01/2024` must be DD/MM/YYYY)
   - If all values are ambiguous (both parts <= 12), return `'ambiguous'`

2. Export a `previewDates` function that takes the first 3-5 date values and returns them parsed in both MM/DD/YYYY and DD/MM/YYYY interpretations, so the import wizard can show a preview.

3. Add an optional `dateFormat: 'mdy' | 'dmy'` parameter to `validateRow` and `transformRowToStudentInsert` that forces the interpretation when the format is ambiguous.

The UI component changes (adding a date format selector to the wizard) can be handled separately.

---

## Verification

After completing all tasks, run:

```bash
npx tsc --noEmit
```

Confirm zero type errors. If the project has tests, run them as well.

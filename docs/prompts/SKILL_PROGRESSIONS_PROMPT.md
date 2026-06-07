# Claude Code Prompt: Skill Progressions and Discrete Skill Assignments

Use this prompt with Claude Code to build the skill progressions system. This adds structured, grade-banded, assessable skill progressions alongside the PBL project template system. Both assignment types feed the same competency scoring engine that powers dimension averages, zone classification, and reports.

**Prerequisites:** The PBL template expansion (ASSIGNMENT_TEMPLATE_PROMPT.md Tasks 1-3) must be completed first. This prompt assumes migration 046 exists.

---

## What This System Does

Today, skills are lightweight tags: name, category, min/max grade. They are not assessed. Only competencies are scored.

This expansion transforms skills into a structured progression system where:

1. Each skill has grade-level expectations (what mastery looks like at each grade)
2. Educators can assign discrete skills to a class or individual learners
3. Skills are assessed on the same 1-4 scale as competencies
4. Skill scores map to competencies, which roll up into dimension averages
5. A pre-populated library defaults to Common Core (Math + ELA) and CASEL, but schools can add their own or upload alternative frameworks
6. The library is organized by grade, with the ability to see what's above (extension) and below (remediation) the learner's current level

---

## Critical Scoring Rule: Above-Grade Exclusion

When a skill assigned is aligned to a grade level ABOVE the learner's current grade:

- **If scored 3 or 4 (top two levels):** Include in the dimension average. The learner has demonstrated meaningful mastery of above-grade material.
- **If scored 1 or 2:** Exclude from the dimension average. The learner is stretching but hasn't reached proficiency. Including a low score on above-grade material would penalize them for attempting harder work.

When a skill is at or below the learner's grade level, the score always counts regardless of value.

This rule must be implemented in `src/lib/scoring.ts` inside `computeCompetencyBasedScores()`.

---

## Data Model

### Migration: `supabase/migrations/050_skill_progressions.sql`

```sql
-- ============================================================
-- Skill Progressions: grade-banded expectations for each skill
-- ============================================================

-- Add progression support to existing skills table
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS is_assessable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_framework text DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS source_standard_code text,
  ADD COLUMN IF NOT EXISTS progression_domain text,
  ADD COLUMN IF NOT EXISTS progression_strand text;

-- Skill progression steps: one row per skill per grade level
CREATE TABLE IF NOT EXISTS skill_progression_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_level text NOT NULL,                    -- uses same values as GRADE_TO_STEP keys: 'K', '1', '2', ... '10', 'E1'-'E6'
  expectation_description text NOT NULL,        -- what mastery looks like at this grade
  example_tasks text,                           -- concrete examples of what a student would do
  prerequisite_step_id uuid REFERENCES skill_progression_steps(id),  -- links to the prior grade's step
  competency_ids uuid[] DEFAULT '{}',           -- which competencies this step maps to
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(skill_id, school_id, grade_level)
);

-- Enable RLS
ALTER TABLE skill_progression_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_steps_select" ON skill_progression_steps
  FOR SELECT USING (school_id = auth_school_id());

CREATE POLICY "skill_steps_insert" ON skill_progression_steps
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_steps_update" ON skill_progression_steps
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_steps_delete" ON skill_progression_steps
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_role() = 'admin'
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skill_steps_skill ON skill_progression_steps(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_steps_grade ON skill_progression_steps(grade_level);
CREATE INDEX IF NOT EXISTS idx_skill_steps_school ON skill_progression_steps(school_id);

-- ============================================================
-- Skill Assignments: assigning a specific skill step to learners
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  assigned_step_id uuid NOT NULL REFERENCES skill_progression_steps(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  assignment_type text NOT NULL DEFAULT 'class',
  title text,                                    -- optional override title
  instructions text,                             -- educator instructions for the learner
  due_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_skill_assignment_type CHECK (assignment_type IN ('class', 'individual')),
  CONSTRAINT valid_skill_assignment_status CHECK (status IN ('draft', 'active', 'completed', 'archived'))
);

-- Student-level records for skill assignments
CREATE TABLE IF NOT EXISTS student_skill_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_assignment_id uuid NOT NULL REFERENCES skill_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- The step this specific student is working on (may differ from the class-level assigned_step_id)
  student_step_id uuid NOT NULL REFERENCES skill_progression_steps(id),
  status text NOT NULL DEFAULT 'assigned',
  score numeric(3,2),                            -- 1-4 scale with 1/3 increments, same as ObservationRating
  scored_by uuid REFERENCES profiles(id),
  scored_at timestamptz,
  notes text,                                    -- qualitative feedback
  is_above_grade boolean DEFAULT false,          -- flag: is this step above the student's grade level?
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_ssa_status CHECK (status IN ('assigned', 'in_progress', 'submitted', 'graded')),
  CONSTRAINT valid_ssa_score CHECK (score IS NULL OR (score >= 0.33 AND score <= 4))
);

-- RLS for skill_assignments
ALTER TABLE skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_assignments_select" ON skill_assignments
  FOR SELECT USING (school_id = auth_school_id());

CREATE POLICY "skill_assignments_insert" ON skill_assignments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_assignments_update" ON skill_assignments
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_assignments_delete" ON skill_assignments
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

-- RLS for student_skill_assignments
ALTER TABLE student_skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssa_select" ON student_skill_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
  );

CREATE POLICY "ssa_insert" ON student_skill_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "ssa_update" ON student_skill_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "ssa_delete" ON student_skill_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() = 'admin'
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skill_assign_school ON skill_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_skill_assign_classroom ON skill_assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_skill_assign_skill ON skill_assignments(skill_id);
CREATE INDEX IF NOT EXISTS idx_ssa_assignment ON student_skill_assignments(skill_assignment_id);
CREATE INDEX IF NOT EXISTS idx_ssa_student ON student_skill_assignments(student_id);

-- ============================================================
-- Bridge: skill scores -> competency_scores
-- ============================================================

-- When a skill assignment is graded, write competency_scores for each
-- competency mapped to the assigned step. This keeps a single scoring pipe.
-- The source column uses a Postgres ENUM type `competency_score_source`.
-- Add the new 'skill_assessment' value to the enum.

ALTER TYPE competency_score_source ADD VALUE IF NOT EXISTS 'skill_assessment';

-- Add columns to competency_scores for skill-based scoring
ALTER TABLE competency_scores
  ADD COLUMN IF NOT EXISTS student_skill_assignment_id uuid REFERENCES student_skill_assignments(id);

-- Add above_grade flag to competency_scores so the aggregation can filter
ALTER TABLE competency_scores
  ADD COLUMN IF NOT EXISTS is_above_grade boolean DEFAULT false;

COMMENT ON TABLE skill_progression_steps IS 'Grade-level expectations for each assessable skill, forming a K-10 progression ladder';
COMMENT ON TABLE skill_assignments IS 'Discrete skill assignments to classes or individual students';
COMMENT ON TABLE student_skill_assignments IS 'Per-student records for skill assignments with scores and feedback';
```

### TypeScript Types

Add to `src/types/database.ts`:

```typescript
// ============================================================
// Skill Progressions
// ============================================================

export interface SkillProgressionStep {
  id: string
  skill_id: string
  school_id: string
  grade_level: string                    // 'K', '1', '2', ... '10', 'E1'-'E6'
  expectation_description: string
  example_tasks: string | null
  prerequisite_step_id: string | null
  competency_ids: string[]
  created_at: string
  updated_at: string
}

export type SkillProgressionStepInsert = Omit<SkillProgressionStep, 'id' | 'created_at' | 'updated_at'>
export type SkillProgressionStepUpdate = Partial<Omit<SkillProgressionStep, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export interface SkillWithProgression extends Skill {
  steps: SkillProgressionStep[]
  is_assessable: boolean
  source_framework: string
  source_standard_code: string | null
  progression_domain: string | null
  progression_strand: string | null
}

// ============================================================
// Skill Assignments
// ============================================================

export type SkillAssignmentStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface SkillAssignment {
  id: string
  school_id: string
  classroom_id: string | null
  skill_id: string
  assigned_step_id: string
  assigned_by: string
  assignment_type: AssignmentType          // reuse: 'class' | 'individual'
  title: string | null
  instructions: string | null
  due_date: string | null
  status: SkillAssignmentStatus
  created_at: string
  updated_at: string
}

export type SkillAssignmentInsert = Omit<SkillAssignment, 'id' | 'created_at' | 'updated_at'>
export type SkillAssignmentUpdate = Partial<Omit<SkillAssignment, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export type StudentSkillAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'graded'

export interface StudentSkillAssignment {
  id: string
  skill_assignment_id: string
  student_id: string
  student_step_id: string                  // may differ from class-level step (differentiation)
  status: StudentSkillAssignmentStatus
  score: number | null                     // 1-4 scale
  scored_by: string | null
  scored_at: string | null
  notes: string | null
  is_above_grade: boolean
  created_at: string
  updated_at: string
}

export type StudentSkillAssignmentInsert = Omit<StudentSkillAssignment, 'id' | 'created_at' | 'updated_at'>

// ============================================================
// Extended types for UI
// ============================================================

export interface SkillAssignmentWithDetails extends SkillAssignment {
  skill: Skill
  assigned_step: SkillProgressionStep
  student_assignments: StudentSkillAssignmentWithStudent[]
  assignor_name: string
}

export interface StudentSkillAssignmentWithStudent extends StudentSkillAssignment {
  student: Pick<Student, 'id' | 'first_name' | 'last_name' | 'grade_level'>
  step: SkillProgressionStep
}

// Grade zone indicator for UI
export type GradeZone = 'remediation' | 'current' | 'extension'
```

Update the existing `Skill` interface to include the new columns:

```typescript
export interface Skill {
  id: string
  school_id: string
  name: string
  description: string | null
  category: string | null
  min_grade: string | null
  max_grade: string | null
  is_default: boolean
  created_by: string | null
  is_assessable: boolean                    // NEW
  source_framework: string                  // NEW: 'ccss_math', 'ccss_ela', 'casel', 'custom'
  source_standard_code: string | null       // NEW: e.g., 'CCSS.Math.3.NBT'
  progression_domain: string | null         // NEW: e.g., 'Number & Operations in Base Ten'
  progression_strand: string | null         // NEW: e.g., 'Place Value'
  created_at: string
  updated_at: string
}
```

Update `CompetencyScoreRow` (the actual row type at ~line 849 in database.ts) to include the new columns:

```typescript
export interface CompetencyScoreRow {
  id: string
  student_assignment_id: string | null
  student_skill_assignment_id: string | null   // NEW
  competency_id: string
  student_id: string
  school_id: string
  score: number
  source: CompetencyScoreSource
  notes: string | null
  is_above_grade: boolean                      // NEW
  scored_at: string
  created_at: string
}
```

Update the `CompetencyScoreSource` type to include the new source:

```typescript
export type CompetencyScoreSource = 'teacher' | 'ai_inferred' | 'observation' | 'skill_assessment'
```

Update `CompetencyScoreInsert` similarly to include `student_skill_assignment_id?: string | null` and `is_above_grade?: boolean`.

---

## Implementation Tasks

Work through these sequentially. After each task, verify with `npx tsc --noEmit`.

### Task 1: Database Migration

Create `supabase/migrations/050_skill_progressions.sql` with the full SQL above.

Verify:
- Existing skills table rows survive (all new columns have defaults)
- Existing competency_scores rows survive (new columns nullable or defaulted)
- The `valid_score_source` constraint is dropped and recreated cleanly

### Task 2: TypeScript Types

Update `src/types/database.ts`:
- Add all new types listed above
- Update existing `Skill` interface with new columns
- Update existing `CompetencyScore` with new columns
- Ensure `CompetencyScoreSource` type is updated to include `'skill_assessment'`

### Task 3: Skill Progression Data Layer

Create `src/lib/skill-progression-data.ts`:

```typescript
// Core fetch functions

// Fetch a single skill with all its progression steps, ordered by grade ordinal
fetchSkillWithProgression(skillId: string, schoolId: string): Promise<SkillWithProgression>

// Fetch all assessable skills for a school, grouped by domain/strand
fetchAssessableSkills(schoolId: string, filters?: {
  domain?: string
  strand?: string
  sourceFramework?: string
  search?: string
}): Promise<SkillWithProgression[]>

// Fetch skills filtered to a specific grade level, showing:
// - "current" skills (matching grade)
// - "below" skills (remediation, 1-2 grades below)
// - "above" skills (extension, 1-2 grades above)
// Return all three groups with a GradeZone label
fetchSkillsForGrade(
  schoolId: string,
  gradeLevel: string,
  options?: { domain?: string; includeRange?: number }  // includeRange: how many grades above/below, default 2
): Promise<{ zone: GradeZone; step: SkillProgressionStep; skill: Skill }[]>

// Get the step for a specific skill at a specific grade
getStepForGrade(skillId: string, schoolId: string, gradeLevel: string): Promise<SkillProgressionStep | null>

// Get the full progression ladder for a skill (all grades)
getProgressionLadder(skillId: string, schoolId: string): Promise<SkillProgressionStep[]>

// CRUD for custom skill progressions
createSkillWithProgression(skill: SkillInsert, steps: SkillProgressionStepInsert[]): Promise<string>
updateProgressionStep(stepId: string, data: SkillProgressionStepUpdate): Promise<void>
addProgressionStep(data: SkillProgressionStepInsert): Promise<string>
deleteProgressionStep(stepId: string): Promise<void>
```

**Grade ordinal utility:** Reuse the existing `gradeToOrdinal` from `skills-data.ts` (lines 23-33). It already maps grades correctly:

```typescript
// Already exists in skills-data.ts:
export function gradeToOrdinal(grade: string | null): number {
  if (grade === null) return -1
  const map: Record<string, number> = {
    '0': 0, '1y': 1, '2y': 2, '3y': 3, '4y': 4, '5y': 5,
    'Pre-K': 3, 'TK': 4, 'K': 5,
    '1': 6, '2': 7, '3': 8, '4': 9, '5': 10,
    '6': 11, '7': 12, '8': 13, '9': 14, '10': 15,
  }
  return map[grade] ?? -1
}
```

Add a new helper alongside it (or in a shared `grade-utils.ts` if preferred):

```typescript
export function isAboveGrade(stepGrade: string, studentGrade: string): boolean {
  return gradeToOrdinal(stepGrade) > gradeToOrdinal(studentGrade)
}

export function getGradeZone(stepGrade: string, studentGrade: string): GradeZone {
  const stepOrd = gradeToOrdinal(stepGrade)
  const studentOrd = gradeToOrdinal(studentGrade)
  if (stepOrd < studentOrd) return 'remediation'
  if (stepOrd > studentOrd) return 'extension'
  return 'current'
}
```

Note: The `skill_progression_steps.grade_level` values must use the same grade strings as `GRADE_TO_STEP` keys and the `gradeToOrdinal` map. For CCSS standards, map the JSON `grade` field ('K', '1', '2', etc.) directly. For CASEL grade bands, map to the upper boundary grade of each band (e.g., 'PreK_K' -> 'K', '3_5' -> '5').

### Task 4: Skill Assignment Data Layer

Create `src/lib/skill-assignment-data.ts`:

```typescript
// Create a skill assignment (class or individual)
createSkillAssignment(data: SkillAssignmentInsert, studentIds: string[]): Promise<string>
// - Creates the skill_assignment row
// - Creates student_skill_assignments for each student
// - For each student, determines if the assigned step is above their grade level
//   by comparing the step's grade_level to the student's grade_level
// - Sets is_above_grade accordingly on each student_skill_assignment
// - If assignment_type is 'class', use assigned_step_id as default student_step_id
//   but allow per-student override (for differentiation)

// Differentiate: change a specific student's step to a different grade level
differentiateStudentStep(
  studentSkillAssignmentId: string,
  newStepId: string,
  studentGradeLevel: string
): Promise<void>
// - Updates student_step_id
// - Recalculates is_above_grade based on the new step vs student grade

// Grade a student's skill assignment
gradeSkillAssignment(
  studentSkillAssignmentId: string,
  score: number,
  notes: string | null,
  scoredBy: string
): Promise<{ success: boolean; error?: string }>
// - Updates student_skill_assignments with score, scored_by, scored_at, status='graded', notes
// - Fetches the step's competency_ids
// - For EACH mapped competency, inserts a row into competency_scores:
//   {
//     student_skill_assignment_id: id,
//     competency_id: compId,
//     score: score,
//     source: 'skill_assessment',
//     is_above_grade: student_skill_assignment.is_above_grade,
//     scored_at: now
//   }
// - This bridges skill scores into the single competency scoring pipe

// Fetch skill assignments for a classroom
fetchSkillAssignments(
  schoolId: string,
  classroomId: string,
  filters?: { status?: SkillAssignmentStatus; skillId?: string }
): Promise<SkillAssignmentWithDetails[]>

// Fetch a single skill assignment with all student records
fetchSkillAssignment(assignmentId: string): Promise<SkillAssignmentWithDetails>

// Fetch all skill assignments for a student
fetchStudentSkillAssignments(
  studentId: string,
  filters?: { status?: StudentSkillAssignmentStatus }
): Promise<StudentSkillAssignmentWithStudent[]>

// Update skill assignment status
updateSkillAssignment(id: string, data: SkillAssignmentUpdate): Promise<void>
completeSkillAssignment(id: string): Promise<void>  // sets status to 'completed'
```

### Task 5: Scoring Integration (The Above-Grade Exclusion Rule)

Modify `src/lib/scoring.ts`, specifically the `computeCompetencyBasedScores()` function.

**Current behavior** (lines ~176-189): For each competency mapped to a dimension, it checks if the step descriptor exists and adds the score to the breakdown.

**New behavior:** After fetching `scoreRow`, check `is_above_grade`:

```typescript
// Inside the per-competency loop in computeCompetencyBasedScores():

const descriptor = comp.step_descriptors[stepKey]
if (!descriptor || descriptor === 'N/A') continue

const scoreRow = bestScoreByComp.get(mapping.competency_id)
if (!scoreRow) continue

// NEW: Above-grade exclusion rule
// If this score came from an above-grade skill assignment and the score is below 3,
// exclude it from the dimension average.
if (scoreRow.is_above_grade && Number(scoreRow.score) < 3) {
  continue
}

breakdown.push({
  competency_id: comp.id,
  competency_code: comp.code,
  competency_name: comp.name,
  score: Number(scoreRow.score),
  source: scoreRow.source,
})
```

**To make this work**, the `CompetencyScoreRow` type used in this function needs to include `is_above_grade`. Update the query in `student-data.ts` (or wherever competency_scores are fetched for `computeCompetencyBasedScores`) to include the `is_above_grade` column.

Update the `CompetencyBreakdown` type to include the flag:

```typescript
export interface CompetencyBreakdown {
  competency_id: string
  competency_code: string
  competency_name: string
  score: number
  source: CompetencyScoreSource
  is_above_grade?: boolean               // NEW: for reporting transparency
}
```

**Also update `buildDimensionScores()`** to pass through the flag so reports can show which scores were from above-grade work (useful for parent reports showing "your child is working on extension material").

### Task 6: Default Skill Library Population

Create `src/lib/seed-skill-progressions.ts`:

This file parses the existing standards JSON files and generates skill progression data. It will be called by an admin action ("Populate Default Skills Library").

**Source files:**
- `/standards/files5/ccss_math.json` (262 standards, K-8, individual grades)
- `/standards/files5/ccss_ela.json` (471 standards, grade bands)
- `/standards/files5/casel.json` (40 standards with built-in progressions)

**Approach:**

1. **CCSS Math:** Group standards by `standard_number` across grades. Each group becomes an assessable skill with one progression step per grade.
   - Skill name derived from the description pattern (e.g., "Number & Operations in Base Ten")
   - `progression_domain` from the grade-level category
   - `progression_strand` from the standard cluster
   - `source_framework` = 'ccss_math'
   - `source_standard_code` = the CCSS code prefix (e.g., 'CCSS.Math.3.NBT')
   - Each grade's description becomes the `expectation_description` for that step

2. **CCSS ELA:** Group by `strand` + `standard_number` across grade bands.
   - Same pattern as math but using grade bands as step levels
   - `progression_domain` = strand name (e.g., 'Reading Literature')
   - `source_framework` = 'ccss_ela'

3. **CASEL:** Already structured as progressions. Each standard becomes a skill.
   - `grade_band_progressions` values become step descriptions
   - Map CASEL grade bands to grade levels: PreK_K → 'K', K_2 → '2', 3_5 → '5', 6_8 → '8', 9_12 → '10'
   - `progression_domain` = competency name
   - `source_framework` = 'casel'

4. **Competency mapping:** For each progression step, attempt to auto-map to existing competencies in the school's framework by matching domain/subdomain names. Store as `competency_ids` on the step. If no match found, leave empty (educator can map later).

**Function signatures:**

```typescript
// Parse standards JSON into skill + step objects ready for insert
export function parseCCSSMath(jsonData: any, schoolId: string): {
  skills: SkillInsert[]
  steps: Map<string, SkillProgressionStepInsert[]>  // keyed by temp skill identifier
}

export function parseCCSSELA(jsonData: any, schoolId: string): {
  skills: SkillInsert[]
  steps: Map<string, SkillProgressionStepInsert[]>
}

export function parseCASEL(jsonData: any, schoolId: string): {
  skills: SkillInsert[]
  steps: Map<string, SkillProgressionStepInsert[]>
}

// Main seeding function: admin calls this
export async function seedDefaultSkillProgressions(
  schoolId: string,
  frameworks: ('ccss_math' | 'ccss_ela' | 'casel')[]
): Promise<{ skillsCreated: number; stepsCreated: number }>
// - Fetches the JSON files via import or fetch
// - Parses with the above functions
// - Inserts skills with is_assessable=true, is_default=true
// - Inserts all progression steps
// - Returns counts for confirmation UI

// For schools that want to upload their own framework
export async function importCustomProgression(
  schoolId: string,
  data: {
    skill_name: string
    category: string
    domain?: string
    strand?: string
    steps: { grade_level: string; expectation: string; examples?: string }[]
  }[]
): Promise<{ skillsCreated: number; stepsCreated: number }>
```

**Important:** The JSON files are already in the repo at `/standards/files5/`. Import them directly. Do not fetch from external URLs. The parsing functions should handle the exact JSON structures documented in those files.

### Task 7: Skill Browser UI

Create `src/components/skills/SkillBrowser.tsx`:

This is the primary UI for educators to browse and select skills for assignment.

**Layout:**

```
+--------------------------------------------------+
| [Search: ___________]  [Framework: All v]         |
| [Domain filter: All v] [Grade: Auto-detect v]     |
+--------------------------------------------------+
|                                                    |
| REMEDIATION (Grade 2)            ← collapsed       |
| > Addition within 100                               |
| > Subtraction within 100                            |
|                                                    |
| CURRENT GRADE (Grade 3)          ← expanded        |
| ▼ Number & Operations in Base Ten                   |
|   ● Add/subtract within 1000         [Assign →]   |
|     "Fluently add and subtract within              |
|      1000 using strategies and algorithms"          |
|   ● Multiply one-digit numbers       [Assign →]   |
|     "Multiply one-digit whole numbers..."           |
| ▼ Operations & Algebraic Thinking                   |
|   ● Interpret products of whole...    [Assign →]   |
|                                                    |
| EXTENSION (Grade 4)              ← collapsed       |
| > Multi-digit addition with standard algorithm     |
| > Multiply multi-digit numbers                     |
|                                                    |
+--------------------------------------------------+
| [+ Create Custom Skill]                            |
+--------------------------------------------------+
```

**Key behaviors:**
- Auto-detect grade from student context (if assigning to individual) or classroom grade_level
- Grade zones (remediation / current / extension) are calculated using `gradeToOrdinal`
- Current grade section is expanded by default; remediation and extension are collapsed
- Clicking "Assign" opens the skill assignment flow
- Skills are grouped by `progression_domain`, then listed alphabetically
- Each skill card shows: name, expectation_description for the selected grade, example_tasks if available
- Clicking a skill expands to show the full progression ladder (all grades) with the current grade highlighted
- Search filters across skill names and expectation descriptions
- Framework filter: All, Common Core Math, Common Core ELA, CASEL, Custom
- "Create Custom Skill" opens a form to define a new skill with progression steps

**Progression Ladder Expansion:**

When a skill card is clicked/expanded, show the full ladder:

```
Addition & Subtraction
├─ K:  Add/subtract within 10                    [below grade]
├─ 1:  Add/subtract within 20                    [below grade]
├─ 2:  Add/subtract within 100                   [below grade]
├─ 3:  Add/subtract within 1000                  ← CURRENT ●
├─ 4:  Multi-digit using standard algorithm       [above grade]
└─ 5:  Multi-digit with decimals                  [above grade]
```

Educator can assign from any step on the ladder. Steps above the student's grade get the `is_above_grade` flag. Steps below get tagged as remediation (for reporting, not for scoring exclusion).

### Task 8: Skill Assignment Flow

Create `src/components/skills/SkillAssignmentFlow.tsx`:

This is the assignment creation flow triggered from the Skill Browser.

**Steps:**

1. **Skill & Level Selection** (pre-filled from browser)
   - Show selected skill name and step
   - Show the expectation description
   - Allow changing the step (grade level) here

2. **Student Selection**
   - Toggle: Class-wide or Individual
   - If class: select classroom, all students get the same step by default
   - If individual: select specific students
   - For each student, show their grade level and whether this step is at/above/below their grade
   - Allow per-student step override (differentiation): an educator can assign "multiply fractions" to the class but move two students down to "multiply whole numbers"

3. **Details**
   - Title override (optional, defaults to skill name + step description)
   - Instructions (textarea)
   - Due date (date picker)

4. **Confirm & Assign**
   - Summary of what's being assigned, to whom, at what level
   - Show any above-grade or below-grade flags
   - Create button

### Task 9: Skill Grading UI

Create `src/components/skills/SkillGrading.tsx`:

Modeled on the existing `AssignmentGrading.tsx` pattern but simpler (one skill, one score per student).

**Layout:**

```
+--------------------------------------------------+
| Skill: Addition & Subtraction within 1000         |
| Step: Grade 3                                      |
| "Fluently add and subtract within 1000..."         |
| Classroom: 3A  |  Due: March 20                   |
+--------------------------------------------------+
|                                                    |
| Student         | Level      | Score  | Notes     |
| ─────────────── | ────────── | ────── | ──────── |
| Emma T.         | Grade 3    | [1-4]  | [___]    |
| Liam K.         | Grade 3    | [1-4]  | [___]    |
| Sophia R.       | Grade 4 ↑  | [1-4]  | [___]    |
| Noah M.         | Grade 2 ↓  | [1-4]  | [___]    |
|                                                    |
+--------------------------------------------------+
| [Save Grades]                                      |
+--------------------------------------------------+
```

**Key behaviors:**
- Show the step each student is working on (may differ from class default)
- Visual indicator for above-grade (↑ arrow, subtle highlight) and below-grade (↓ arrow)
- Score input: 1-4 with 1/3 increments (reuse existing rating input component)
- Notes: per-student qualitative feedback
- On save: calls `gradeSkillAssignment()` for each student, which writes competency_scores with the `is_above_grade` flag and `source='skill_assessment'`
- Show step descriptor as reference for what "4" means at this level
- Batch save with error handling (same `{ success, error }` pattern as Task 7 in CODE_REVIEW prompt)

### Task 10: Integrate Into Assignments Page

Update `src/pages/Assignments.tsx`:

1. Add a new tab or section: "Skills" alongside existing "Active" and "Library" views
2. The Skills section shows:
   - Active skill assignments for the educator's classrooms
   - Quick-assign button that opens the SkillBrowser
   - Each skill assignment card shows: skill name, step level, student count, due date, grading progress (X of Y graded)
3. Clicking a skill assignment card navigates to the SkillGrading view

### Task 11: Integrate Into Student Profile

Update the student profile view to show skill assignment history:

1. In the student's profile page, add a "Skills" section showing:
   - Active skill assignments with their status
   - Completed skill assignments with scores
   - Skill progression ladder for skills the student has been assigned, showing their highest score at each step
2. Group by domain for readability
3. Show above-grade work with a distinct visual marker

### Task 12: Admin Skill Library Management

Create `src/pages/admin/SkillLibrary.tsx`:

Admin page for managing the school's skill library:

1. **Populate Library** button: triggers `seedDefaultSkillProgressions` with framework selection (checkboxes for CCSS Math, CCSS ELA, CASEL)
2. Browse all skills with progression steps
3. Edit skill metadata (name, category, domain, strand)
4. Edit progression steps (expectation descriptions, example tasks)
5. Map progression steps to competencies (competency picker, same as assignment creation)
6. Create custom skills with custom progressions
7. Import custom progressions (JSON upload matching the `importCustomProgression` schema)
8. Bulk enable/disable assessable flag

---

## Architecture Notes

### How Both Assignment Types Feed the Same Pipe

```
PBL Project Assignment
  └─ graded per competency
     └─ competency_scores (source='teacher')
        └─ computeCompetencyBasedScores()
           └─ dimension average

Discrete Skill Assignment
  └─ graded per skill (single 1-4 score)
     └─ step.competency_ids mapped
        └─ competency_scores (source='skill_assessment', is_above_grade=T/F)
           └─ computeCompetencyBasedScores()
              └─ dimension average (with above-grade exclusion applied)

Both → buildDimensionScores() → DimensionScore[] → animation, reports, zones
```

### The `student_step_id` Differentiation Pattern

When a class-wide skill assignment is created (e.g., "multiplication of fractions, Grade 5"):
- All students default to the class step (`assigned_step_id`)
- The educator can differentiate individual students to a different step
- Each `student_skill_assignment` tracks its own `student_step_id`
- The `is_above_grade` flag is calculated per student based on THEIR grade vs THEIR assigned step

This means a Grade 5 class could have:
- Most students on Grade 5 step (current)
- Two students on Grade 4 step (remediation, is_above_grade=false)
- One student on Grade 6 step (extension, is_above_grade=true)

### Framework Flexibility

The `source_framework` field on skills supports:
- `'ccss_math'` - Common Core Math (default)
- `'ccss_ela'` - Common Core ELA (default)
- `'casel'` - CASEL SEL (default)
- `'custom'` - school-created
- Any string - schools can upload their own frameworks and tag them

Schools are never locked into Common Core. The defaults are a starting point. Schools can:
1. Use only the defaults
2. Add custom skills alongside defaults
3. Delete defaults and use only custom
4. Upload an entirely different framework via `importCustomProgression`

---

## Verification

After completing all tasks:

```bash
npx tsc --noEmit
```

Confirm zero type errors.

Manually verify:
1. Seeding CCSS Math creates skills with correct grade-level steps
2. Assigning a skill to a class creates student_skill_assignments for all students
3. Differentiating a student's step correctly updates is_above_grade
4. Grading a skill writes competency_scores with correct source and is_above_grade flag
5. An above-grade score of 2 is excluded from dimension average
6. An above-grade score of 3 is included in dimension average
7. At-grade and below-grade scores always count
8. The Skill Browser correctly groups skills into remediation/current/extension zones
9. Student profile shows skill assignment history with progression context
10. Admin can seed the default library and manage custom skills

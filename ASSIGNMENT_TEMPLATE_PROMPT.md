# Claude Code Prompt: Assignment Template System for Project-Based Learning

Use this prompt with Claude Code to build out the assignment template feature as the foundational element for a competency-based, project-based learning (PBL) curriculum engine serving elementary and middle school learners (ages 5-14).

---

## Context

The Amoeba Project ("Living Assessment") is a competency-based assessment tool. It currently has:

- A competency framework (domains > subdomains > competencies, each with step descriptors per grade band)
- Skills (taggable, school-defined)
- Assignments (linked to competencies, skills, classrooms, students)
- A thin assignment template model (`assignment_templates` table with `template_data` JSON blob)
- Student profiles with observation history, interest surveys, and learner columns
- Grading via per-competency numeric ratings (1-4 scale with 1/3 increments)

The current `AssignmentTemplate` type stores only: title, description, assignment_type, competency_ids, skill_ids, is_shared, and an empty `template_data: Record<string, unknown>`.

**Goal:** Transform this thin template into a rich, structured PBL project template system that educators can use to design, share, and deploy deep experiential learning projects.

---

## Pedagogical Framework

The template system is grounded in three intersecting frameworks. All design decisions should reflect these principles.

### 1. Gold Standard PBL (PBLWorks)

Every template must structurally support the seven essential project design elements:

| Element | What It Means | How the Template Captures It |
|---|---|---|
| **Challenging Problem or Question** | A meaningful problem to solve or question to answer at the appropriate challenge level | `driving_question` field: open-ended, non-Googleable question |
| **Sustained Inquiry** | Iterative process of asking questions, finding resources, applying information, asking deeper questions | `phases` array with structured milestones and checkpoints |
| **Authenticity** | Real-world context, tasks, tools, quality standards, or personal relevance | `authenticity_hook` field describing the real-world connection; `final_product` with audience specification |
| **Student Voice & Choice** | Students make decisions about how they work and what they create | `choice_points` array identifying where learner agency is built in |
| **Reflection** | Students reflect on what and how they are learning | `reflection_prompts` per phase; self-assessment built into grading |
| **Critique & Revision** | Students give, receive, and apply feedback to improve their work | `critique_protocol` field; revision expectations per phase |
| **Public Product** | Students make their work public by explaining, displaying, or presenting it | `final_product` with presentation_format and audience fields |

### 2. Understanding by Design (Backwards Design)

Templates are structured in three stages that align to UbD:

- **Stage 1 (Desired Results):** Competency targets, essential understandings, driving question
- **Stage 2 (Evidence):** Assessment criteria, rubric dimensions, what "mastery" looks like per competency
- **Stage 3 (Learning Plan):** Phases, activities, scaffolds, resources

### 3. Webb's Depth of Knowledge

Each template declares its target DOK level(s), which informs the type of cognitive work expected:

| DOK Level | Label | Example in Template Context |
|---|---|---|
| 1 | Recall | Identify, define, list (foundational knowledge steps) |
| 2 | Skill/Concept | Compare, organize, classify (guided exploration steps) |
| 3 | Strategic Thinking | Design, investigate, justify, formulate (core PBL work) |
| 4 | Extended Thinking | Synthesize across sources, create original work, connect to novel contexts (capstone-level) |

Most PBL templates should target DOK 3-4 as the primary cognitive demand, with DOK 1-2 tasks embedded as scaffolding within phases.

---

## Data Model

### Migration: Expand `assignment_templates`

Create a new migration file (next available number after 045). This migration restructures the template system.

**Do NOT drop or rename the existing `assignment_templates` table.** Instead, add new columns and backfill the `template_data` blob into the structured fields where possible.

```sql
-- New columns on assignment_templates
ALTER TABLE assignment_templates
  ADD COLUMN IF NOT EXISTS grade_band text DEFAULT 'elementary',
  ADD COLUMN IF NOT EXISTS subject_area text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_duration_days integer,
  ADD COLUMN IF NOT EXISTS driving_question text,
  ADD COLUMN IF NOT EXISTS essential_understandings text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS authenticity_hook text,
  ADD COLUMN IF NOT EXISTS final_product jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dok_level integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS phases jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS choice_points jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS critique_protocol text,
  ADD COLUMN IF NOT EXISTS scaffolding_notes text,
  ADD COLUMN IF NOT EXISTS differentiation jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS materials_and_resources jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES assignment_templates(id),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Add check constraints
ALTER TABLE assignment_templates
  ADD CONSTRAINT valid_grade_band CHECK (grade_band IN ('early_elementary', 'elementary', 'upper_elementary', 'middle_school', 'mixed')),
  ADD CONSTRAINT valid_dok CHECK (dok_level BETWEEN 1 AND 4),
  ADD CONSTRAINT valid_template_status CHECK (status IN ('draft', 'published', 'archived'));

-- Index for browsing/filtering
CREATE INDEX IF NOT EXISTS idx_templates_grade_band ON assignment_templates(grade_band);
CREATE INDEX IF NOT EXISTS idx_templates_status ON assignment_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON assignment_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_templates_subject ON assignment_templates USING gin(subject_area);
```

### TypeScript Type Updates

Update `src/types/database.ts`. Replace the existing `AssignmentTemplate` interface:

```typescript
// ============================================================
// Assignment Templates (PBL Project Templates)
// ============================================================

export type GradeBand = 'early_elementary' | 'elementary' | 'upper_elementary' | 'middle_school' | 'mixed'
export type TemplateStatus = 'draft' | 'published' | 'archived'
export type DOKLevel = 1 | 2 | 3 | 4

export interface ProjectPhase {
  id: string                          // client-generated UUID
  title: string                       // e.g., "Launch & Wonder", "Deep Dive", "Create & Refine", "Present & Reflect"
  description: string
  duration_days: number
  dok_level: DOKLevel                 // primary DOK for this phase
  activities: PhaseActivity[]
  reflection_prompts: string[]        // end-of-phase reflection questions
  checkpoint: PhaseCheckpoint | null  // formative assessment at end of phase
}

export interface PhaseActivity {
  id: string
  title: string
  description: string
  activity_type: 'investigation' | 'creation' | 'collaboration' | 'reflection' | 'presentation' | 'skill_building' | 'field_work'
  is_required: boolean
  estimated_minutes: number
  resources: string[]                 // links, book titles, material names
  educator_notes: string              // implementation guidance
}

export interface PhaseCheckpoint {
  title: string
  description: string
  assessment_type: 'self_assessment' | 'peer_review' | 'educator_check' | 'portfolio_entry' | 'group_critique'
  competency_ids: string[]            // which competencies this checkpoint touches
  criteria: string[]                  // what success looks like at this checkpoint
}

export interface FinalProduct {
  description: string                 // what learners will create
  format_options: string[]            // e.g., ["presentation", "documentary", "physical_model", "website", "report"]
  audience: string                    // who will see/experience the final product
  presentation_format: string         // how it will be shared (gallery walk, panel, community event, digital portfolio)
  quality_criteria: string[]          // rubric-aligned expectations
}

export interface ChoicePoint {
  phase_id: string                    // which phase this choice lives in
  description: string                 // what the learner gets to decide
  choice_type: 'topic_selection' | 'research_method' | 'product_format' | 'collaboration_structure' | 'presentation_style'
  options: string[]                   // suggested options (not exhaustive; learners can propose their own)
}

export interface DifferentiationGuide {
  extending: string                   // guidance for learners who need more challenge
  supporting: string                  // guidance for learners who need more scaffolding
  ell_accommodations: string          // for English language learners
  accessibility_notes: string         // physical, sensory, cognitive accommodations
}

export interface TemplateResource {
  title: string
  type: 'link' | 'book' | 'material' | 'tool' | 'printable' | 'video'
  url: string | null
  notes: string
}

export interface AssignmentTemplate {
  id: string
  school_id: string
  created_by: string | null
  title: string
  description: string | null
  assignment_type: AssignmentType
  competency_ids: string[]
  skill_ids: string[]
  is_shared: boolean
  template_data: Record<string, unknown>    // legacy; retain for backwards compat

  // --- PBL-specific fields ---
  grade_band: GradeBand
  subject_area: string[]
  estimated_duration_days: number | null
  driving_question: string | null
  essential_understandings: string[]
  authenticity_hook: string | null
  final_product: FinalProduct | null
  dok_level: DOKLevel
  phases: ProjectPhase[]
  choice_points: ChoicePoint[]
  critique_protocol: string | null
  scaffolding_notes: string | null
  differentiation: DifferentiationGuide | null
  materials_and_resources: TemplateResource[]
  tags: string[]
  version: number
  parent_template_id: string | null
  status: TemplateStatus

  created_at: string
  updated_at: string
}
```

Update `AssignmentTemplateInsert` and `AssignmentTemplateUpdate` accordingly (same Omit patterns, all new fields optional in Insert except those with DB defaults).

---

## Implementation Tasks

Work through these sequentially. After each task, verify with `npx tsc --noEmit`.

### Task 1: Database Migration

Create `supabase/migrations/046_pbl_template_expansion.sql` with the schema changes above.

Requirements:
- All new columns must be nullable or have defaults so existing rows survive
- Do not drop existing columns
- Add the check constraints and indexes listed above
- Add a comment on the table: `COMMENT ON TABLE assignment_templates IS 'PBL project templates with Gold Standard design elements'`

### Task 2: Update TypeScript Types

In `src/types/database.ts`:
- Add all new type definitions (GradeBand, TemplateStatus, DOKLevel, ProjectPhase, PhaseActivity, PhaseCheckpoint, FinalProduct, ChoicePoint, DifferentiationGuide, TemplateResource)
- Replace the existing `AssignmentTemplate` interface with the expanded version
- Update `AssignmentTemplateInsert` and `AssignmentTemplateUpdate`
- Ensure all new JSONB fields use proper typed interfaces (not `any` or `unknown`)

### Task 3: Update Data Layer

In `src/lib/assignment-template-data.ts`:

1. Update `fetchTemplates` to include the new fields in the response mapping. Ensure JSONB fields are parsed with proper defaults:
   - `phases` defaults to `[]`
   - `choice_points` defaults to `[]`
   - `materials_and_resources` defaults to `[]`
   - `essential_understandings` defaults to `[]`
   - `tags` defaults to `[]`
   - `final_product` defaults to `null`
   - `differentiation` defaults to `null`

2. Update `createTemplateFromAssignment` to populate the new fields from the source assignment context where possible (carry over competency_ids, skill_ids, assignment_type; set sensible defaults for everything else).

3. Add new functions:
   - `duplicateTemplate(templateId, schoolId, createdBy)` - creates a copy with `parent_template_id` set and version incremented
   - `publishTemplate(templateId)` - sets status to 'published'
   - `archiveTemplate(templateId)` - sets status to 'archived'
   - `fetchTemplatesByTag(schoolId, tag)` - filtered fetch
   - `fetchPublishedTemplates(schoolId)` - returns only published templates for the library view

4. Add filter support to `fetchTemplates`:
   - `gradeBand?: GradeBand`
   - `subjectArea?: string`
   - `dokLevel?: DOKLevel`
   - `tags?: string[]`
   - `status?: TemplateStatus`

### Task 4: Template Builder UI - Form Structure

Create `src/components/assignment/TemplateBuilder.tsx` as a multi-step form for creating/editing templates.

The builder should have these steps (tabs or wizard pages):

**Step 1: Overview**
- Title (required)
- Description (textarea)
- Grade band (select: early_elementary, elementary, upper_elementary, middle_school, mixed)
- Subject areas (multi-select tags: Math, Science, ELA, Social Studies, Art, Music, PE, World Languages, Technology, Interdisciplinary)
- Estimated duration (number input, in days)
- Tags (free-form tag input)
- Assignment type (individual / class)

**Step 2: Design Foundations (Backwards Design Stage 1)**
- Driving Question (textarea with helper text: "An open-ended, non-Googleable question that frames the entire project. Start with 'How might we...', 'Why does...', 'What would happen if...'")
- Essential Understandings (list input: what students should deeply understand by the end)
- Competency Selection (reuse existing `fetchCompetencyTree` browser from assignment creation)
- Skill Selection (reuse existing skill picker)
- DOK Level (select 1-4, with label descriptions)
- Authenticity Hook (textarea: "What real-world problem, audience, or context makes this project matter?")

**Step 3: Project Phases**
- Dynamic list of phases. Each phase is an expandable card with:
  - Title, description, duration_days, dok_level
  - Activities (nested dynamic list): title, description, activity_type, is_required, estimated_minutes, resources, educator_notes
  - Reflection prompts (list of strings)
  - Checkpoint (optional toggle): title, description, assessment_type, competency_ids (from selected competencies), criteria
- Provide a "Quick Start" button that pre-populates a 4-phase structure:
  1. "Launch & Wonder" (DOK 1-2, 2-3 days) - entry event, driving question introduction, initial inquiry
  2. "Investigate & Discover" (DOK 2-3, 5-7 days) - research, data gathering, expert interviews, field work
  3. "Create & Refine" (DOK 3-4, 5-7 days) - building the product, critique sessions, revision cycles
  4. "Present & Reflect" (DOK 3-4, 2-3 days) - public presentation, self-assessment, celebration

**Step 4: Student Agency & Differentiation**
- Choice Points (dynamic list): phase_id (select from phases), description, choice_type, options
- Critique Protocol (textarea: describe the peer feedback process)
- Differentiation Guide:
  - Extending (textarea)
  - Supporting (textarea)
  - ELL Accommodations (textarea)
  - Accessibility Notes (textarea)
- Scaffolding Notes (textarea: general guidance for educators on supporting all learners)

**Step 5: Final Product & Resources**
- Final Product:
  - Description
  - Format options (multi-select tags)
  - Audience
  - Presentation format
  - Quality criteria (list of strings)
- Materials & Resources (dynamic list): title, type, url, notes

**Step 6: Review & Publish**
- Read-only summary of all entered data
- Gold Standard PBL completeness checker: show which of the 7 elements are addressed and which are missing/weak
- Status selector (draft / published)
- Save button

UI conventions:
- Use existing design system (Tailwind classes matching the rest of the app: `bg-bg-card`, `text-text`, `border-bg-muted`, `rounded-xl`, `text-sm`, etc.)
- Use `lucide-react` for icons
- Use `clsx` for conditional classes
- Each step should be saveable independently (auto-save or explicit save)
- Mobile-responsive

### Task 5: Template Library Enhancement

Update `src/components/assignment/AssignmentLibrarySection.tsx` to:

1. Add filter bar: grade band, subject area, DOK level, tags, search
2. Display templates as cards showing:
   - Title, grade band badge, subject area chips, DOK level indicator
   - Driving question (truncated)
   - Phase count and estimated duration
   - Competency count and skill count
   - Status badge (draft/published/archived)
   - Creator name
3. Card actions: View, Edit, Duplicate, Archive, Delete
4. "View" expands into a read-only detailed view of the full template
5. "Use Template" button that creates a new assignment pre-populated from the template

### Task 6: Template-to-Assignment Flow

When an educator clicks "Use Template" on a library item:

1. Create a new assignment using `createAssignment` with the template's competency_ids, skill_ids, and assignment_type
2. Store the `template_id` on the assignment (add `template_id uuid REFERENCES assignment_templates(id)` column to the `assignments` table in the migration)
3. Open the assignment in edit mode with all template data pre-filled
4. The phase structure should be stored on the assignment's `template_data` field (or a new `project_data` JSONB column on `assignments`) so that once deployed, the project phases become the student's roadmap
5. The driving question, phases, and checkpoints should be visible in the student/learner view of the assignment

### Task 7: PBL Completeness Validator

Create `src/lib/pbl-validator.ts`:

```typescript
export interface PBLValidationResult {
  score: number               // 0-100
  elements: {
    challenging_problem: ValidationItem
    sustained_inquiry: ValidationItem
    authenticity: ValidationItem
    student_voice_choice: ValidationItem
    reflection: ValidationItem
    critique_revision: ValidationItem
    public_product: ValidationItem
  }
  suggestions: string[]
}

export interface ValidationItem {
  present: boolean
  strength: 'missing' | 'weak' | 'adequate' | 'strong'
  feedback: string
}
```

Validation logic:
- **Challenging Problem**: `driving_question` is non-empty and > 10 words. "Strong" if it starts with an open-ended stem (How, Why, What if, In what ways).
- **Sustained Inquiry**: `phases.length >= 3` and at least one phase has DOK >= 3. "Strong" if total duration >= 5 days and phases include investigation-type activities.
- **Authenticity**: `authenticity_hook` is non-empty. "Strong" if `final_product.audience` is specified and is not just "teacher" or "class".
- **Student Voice & Choice**: `choice_points.length >= 1`. "Strong" if choices span multiple phases and include product format choice.
- **Reflection**: At least 2 phases have non-empty `reflection_prompts`. "Strong" if reflection is in every phase.
- **Critique & Revision**: `critique_protocol` is non-empty OR at least one checkpoint has `assessment_type` of 'peer_review' or 'group_critique'. "Strong" if both.
- **Public Product**: `final_product` is non-null with description and audience. "Strong" if `presentation_format` includes external audience.

Display this as a visual "PBL Health" indicator in the template builder's Review step.

### Task 8: Seed Templates

Create `src/lib/seed-templates.ts` with 3-4 example templates that demonstrate the system's full capabilities. These should be insertable via an admin action.

Example templates:

**1. "Our Community Water Story" (Elementary, Science + ELA, DOK 3)**
- Driving question: "How does water travel through our community, and what can we do to protect it?"
- Phases: Launch (water walk), Investigate (testing, interviews), Create (awareness campaign), Present (community showcase)
- Authenticity: local water authority partnership
- Final product: multimedia presentation + action proposal to city council

**2. "Design a Fair Economy" (Middle School, Math + Social Studies, DOK 4)**
- Driving question: "If you could redesign the economy of a small country, how would you balance fairness and prosperity?"
- Phases: Launch (economic simulation game), Research (case studies), Design (economic model), Present (UN-style summit)
- Authenticity: connects to current events, policy trade-offs
- Final product: economic policy brief + simulation

**3. "The Story of Us" (Upper Elementary, ELA + Social Studies + Art, DOK 3)**
- Driving question: "How do the stories of our families and cultures shape who we are as a community?"
- Phases: Launch (story circle), Collect (family interviews), Create (narrative + art piece), Share (community gallery)
- Authenticity: personal and cultural, families as audience
- Final product: mixed-media gallery exhibition

**4. "Mission to Mars: Engineering Our Future" (Middle School, Science + Math + Technology, DOK 4)**
- Driving question: "What would it take to design a sustainable human habitat on Mars?"
- Phases: Launch (mission briefing), Research (constraints analysis), Engineer (habitat design), Present (mission review board)
- Authenticity: connects to real space engineering challenges
- Final product: scale model + engineering report presented to a panel

Each seed template must be a complete `AssignmentTemplateInsert` object that fully populates ALL fields. Specifically, each seed must include:
- 3-4 fully defined `ProjectPhase` objects, each with 2-3 `PhaseActivity` items, 2-3 `reflection_prompts`, and a `PhaseCheckpoint`
- 2-3 `ChoicePoint` items spanning different phases
- A complete `DifferentiationGuide` (all four fields populated)
- A complete `FinalProduct` with quality_criteria
- 3-5 `TemplateResource` items
- 2-3 `essential_understandings`
- Realistic `estimated_duration_days` matching the sum of phase durations
- Appropriate `competency_ids` and `skill_ids` (use placeholder UUIDs with comments noting they need to be mapped to the school's actual framework at insert time)

These serve as both demonstration data and educator inspiration. They should be thorough enough that an educator could deploy one immediately without modification.

---

## Architecture Notes

- All JSONB fields (phases, choice_points, final_product, differentiation, materials_and_resources) are stored in Postgres as jsonb. Parse/validate on the client side using the TypeScript interfaces.
- The `parent_template_id` + `version` fields enable template versioning. When an educator duplicates and modifies a published template, the new version links back to the original.
- The `status` workflow is: draft -> published -> archived. Only published templates appear in the library by default.
- Future: AI-assisted template generation (given a driving question, auto-suggest phases, activities, and competency mappings). The structured data model enables this. Not in scope for this build.
- Future: Template marketplace across schools (using `is_shared` flag). Not in scope for this build.

---

## Verification

After completing all tasks:

```bash
npx tsc --noEmit
```

Confirm zero type errors.

Manually verify:
1. Creating a template via the builder saves all fields correctly to Supabase
2. The PBL completeness validator correctly scores a fully-populated template vs. a minimal one
3. "Use Template" creates an assignment with the correct competency and skill links
4. Library filtering by grade band, subject, DOK, and tags works
5. Seed templates load and display correctly in the library

---

## Design Principles to Maintain Throughout

1. **The project IS the curriculum.** Templates are not worksheets. They are the unit of instruction. Every template should represent 1-4 weeks of meaningful, connected learning.

2. **Competency-first, not content-first.** The driving question and phases serve the competency targets. Content knowledge is acquired in service of the project, not the other way around.

3. **Agency is structural, not decorative.** Choice points must appear at meaningful junctures (what to investigate, how to present, who to collaborate with), not just "pick your font."

4. **Assessment is continuous, not terminal.** Checkpoints at each phase, reflection throughout, critique built into the process. The final product is one piece of evidence among many.

5. **Authenticity means audience.** If the only audience is the teacher, the project lacks authenticity. Templates should push toward community, family, expert, or public audiences.

6. **Scaffolding preserves rigor.** Differentiation means providing different pathways to the same high-bar outcome, not lowering expectations. Supporting scaffolds should be removable as learners grow.

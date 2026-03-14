# Amoeba: Assessment Philosophy & Competency Architecture

> The conceptual foundation for Amoeba — a competency-based assessment tool that captures what a learner can do, in what context, with what level of support, and translates that into language meaningful to educators, parents, and external schools.

---

## What Amoeba Is (and Is Not)

Amoeba is not a gradebook. It is not a standards-tracking checklist. It is a system that captures the full picture of a learner — tracking *how* a student grows across multiple dimensions over time through a living visualization that breathes and shifts as new evidence arrives.

Behind that visualization sits a carefully layered conceptual model. Each layer answers a different question:

| Layer | Question it answers | Who defines it | Example |
|-------|---------------------|----------------|---------|
| **School Profile** | *What is the institutional context for learning?* | School leadership | Pedagogical approach, curriculum emphasis, assessment culture |
| **Standards** | *What should students know at this level?* | Government / accrediting body | Common Core, NGSS, IB PYP |
| **Competency Framework** | *What can students actually do?* | School (adapted from standards) | "Demonstrates number sense through estimation and comparison" |
| **Dimensions** | *What kind of learner is this student becoming?* | School (holistic, cross-cutting) | Mathematical Thinking, Social-Emotional Learning |
| **Skills** | *What specific abilities does this task develop?* | Teacher (per assignment/project) | "Data visualization", "Collaborative writing" |
| **Assignments & Evidence** | *What is the student doing to demonstrate learning?* | Teacher + student + parent | Projects, observations, artifacts, parent-reported evidence |
| **Learner Profile** | *Who is this student as a whole person?* | The data itself (synthesized) | The amoeba + interest map + narrative + context |

---

## Core Entities

Amoeba has six primary entities that interact to produce its outputs. Understanding the distinctions and relationships between them is essential.

### 1. School Profile

The School Profile defines the institutional context in which learning happens. Different schools operate with different pedagogical philosophies, curriculum emphases, and cultural contexts. The School Profile captures these so the system can contextualize assessment without flattening differences.

**What it contains:**

- **Pedagogical approach:** Project-based, Socratic, Montessori-influenced, inquiry-driven, etc. This is not decorative metadata. It determines what types of evidence the system expects to see and how competency is demonstrated.
- **Curriculum emphasis and scope:** Which domains does this school prioritize? A location in Japan may weight cross-cultural communication differently than one in Uruguay. The School Profile declares these emphases.
- **Age/stage range served:** The developmental range the school addresses (currently through middle school).
- **Assessment culture:** How does this school gather evidence? Primarily through observation? Portfolio review? Structured assessments? Peer evaluation? This shapes what data the system expects.
- **Staffing and role definitions:** Who are the observers? ECDs, subject specialists, adventure crew leads? The system needs to know who generates competency evidence and what authority their observations carry.
- **Standards alignment preferences:** Which external frameworks does this school want to map to? Common Core, IB, Cambridge, national standards of the host country? This is a school-level setting, not a per-student one.

**Architectural role:** The School Profile is a *configuration layer*, not a content layer. It should be set once (with periodic updates) and it shapes how the rest of the system behaves. Think of it as the "environment variables" for a given school instance.

**Key design principle:** The School Profile should never constrain what can be assessed. It contextualizes and prioritizes, but the underlying competency framework remains universal across all schools. A student transferring between locations should have a continuous learner profile even if the school profiles differ.

**Current implementation:** `schools` table with `school_context` (mission, values, pedagogical approach, assessment philosophy), `school_documents`, and `school_profile_visibility` for family-facing controls.

---

### 2. Standards (External Reference Layer)

**What they are:** Externally authored reference documents describing what students should know and be able to do at each grade band. They are the *input specification* — what society and the discipline expect.

**How we use them:** Standards live in `global_standards_frameworks` and `standards_frameworks`. Schools can adopt, fork, or ignore them. They provide a common language when talking to parents, accreditors, or transfer schools — but they are never the thing we *score against* directly. Standards are reference material, not the rubric.

**Key distinction:** Standards describe *content expectations*. They say "students will understand fractions" but don't say how to *observe* that understanding or what *doing* it looks like across developmental stages.

**What makes our framework different from standards like Common Core or IB:**

1. **Content-agnostic:** Our framework describes *capabilities*, not specific content. "Analyze a primary source for perspective and bias" is a capability. "Analyze the US Constitution" is content. We specify capabilities; content is location-adaptive.
2. **Not grade-pegged:** Progression is developmental, allowing students to be at different levels in different strands without the stigma of "being behind."
3. **Includes dispositional dimensions:** Agency, curiosity, resilience, empathy. These are real competencies, not soft add-ons.
4. **Process skills are first-class citizens:** Critical thinking, collaboration, communication, and metacognition are assessed as standalone competencies, not just embedded in content areas.

---

### 3. Competency Framework (Internal to the School)

The competency framework is the structural map of what the school considers meaningful learning. It defines the domains, strands, progression levels, and proficiency descriptors against which learner evidence is evaluated.

**Architecture of the framework:**

```
Framework (e.g., "Our School's Core Competencies")
  Domain (e.g., "Literacy & Communication")
    Subdomain / Strand (e.g., "Written Expression")
      Competency (e.g., "Produces multi-paragraph texts with central ideas and supporting details")
        step_descriptors: {
          "E4": "Dictates or draws to convey a message...",
          "3": "Given a familiar topic and graphic organizer, produces multi-paragraph text...",
          "7": "Independently composes structured arguments with evidence and counterarguments..."
        }
```

**Domains** are the top-level categories:
- Literacy & Communication (receptive and expressive, across modalities and languages)
- Mathematical & Quantitative Reasoning
- Scientific & Systems Thinking
- Social & Historical Understanding
- Creative Expression & Design
- Physical Development & Wellbeing
- Personal & Interpersonal Development (agency, collaboration, self-regulation, empathy)

**Strands / Subdomains** run vertically within each domain — the specific threads of capability that progress from simple to complex.

**Progression Levels** define developmental stages, NOT grade levels. Internally, the system uses developmental continuum language:
- **Emerging:** Developing foundational understanding with significant scaffolding
- **Developing:** Applying understanding in familiar contexts with moderate support
- **Proficient / Achieving:** Demonstrating consistent capability across varied contexts with minimal support
- **Extending / Mastery:** Transferring understanding to novel contexts, self-directing, and teaching others

These describe a continuum of cognitive complexity and learner independence, not age or grade.

**Proficiency Descriptors** (step descriptors) are the atomic unit. Each answers: "What does it look like when a learner is at [level] in [strand]?"

Descriptor format: *"Given [context/scaffolding level], the learner can [observable action] with [quality/complexity indicator]."*

**How we use them:** Competencies are the *rubric rows* on assignments. When a teacher grades a project, they rate the student on each linked competency. These scores flow (via AI-generated mappings) into dimension-level scores for the amoeba.

**Key distinction:** Competencies are *school-owned and teacher-facing*. They bridge the gap between abstract standards ("understand fractions") and observable classroom behavior ("uses visual models to compare fractions with unlike denominators"). They are what teachers grade against.

**Current implementation:** `competency_frameworks` → `competency_domains` → `competency_subdomains` → `competencies` (with `step_descriptors` JSONB). Grade steps map via `GRADE_TO_STEP`: E1-E6 for early years, 1-10 for grades.

---

### 4. Dimensions (The Amoeba Axes)

**What they are:** The 6-10 holistic learning axes that define the school's portrait of a well-rounded learner. They are cross-cutting — spanning multiple content areas and traditional subject boundaries.

**Examples:**
- Mathematical Thinking
- Language & Literacy
- Social-Emotional Learning
- Creative Expression
- Scientific Inquiry
- Critical Thinking & Problem Solving
- Communication & Collaboration
- Self-Direction & Executive Function

**How we use them:** Dimensions are the *axes of the amoeba*. Every observation, every competency score, every survey response ultimately maps to one or more dimensions. They are the visualization layer — the thing families see, the thing that makes growth visible.

**Key distinction:** Dimensions are *school-defined and family-facing*. They don't describe specific skills; they describe *kinds of growth*. A single project might touch 3-4 dimensions. A single competency might map to 1-2 dimensions. Dimensions answer: "What areas of this child's development are flourishing, and which need more nourishment?"

**How scores flow in (dual-channel architecture):**
```
Direct observations ──────────────────────────→ Dimension score
Competency scores ──→ AI mapping (confidence) ──→ Dimension score
                                                    ↓
                                          Blended average → Amoeba
```

When both channels have data for a dimension, they are averaged equally. When only one channel has data, that channel alone drives the score. This ensures backward compatibility — schools using only observations continue to work exactly as before.

**Current implementation:** `dimensions` table (per school), `observations` for direct ratings, `competency_dimension_mappings` for the AI-generated bridge from competencies to dimensions.

---

### 5. Skills (Proposed)

**What they are:** Granular, teacher-selected abilities that a specific assignment or project develops. Skills sit *below* competencies in specificity — they're the tactical building blocks.

**Examples:**
- "Data visualization with charts"
- "Persuasive paragraph writing"
- "Collaborative brainstorming"
- "Measuring with standard units"
- "Self-reflection journaling"

**How they differ from competencies:**

| | Competency | Skill |
|---|---|---|
| **Granularity** | Broad capability | Specific ability |
| **Scope** | School-wide, framework-level | Per-assignment, teacher-selected |
| **Scoring** | Rated on a rubric (1-4 scale) | Tagged, not individually scored |
| **Developmental staging** | Has step descriptors by grade | Same skill applies across grades |
| **Lifespan** | Persists across years | Lives within an assignment context |
| **Purpose** | Assessment & reporting | Planning & differentiation |

**Why skills matter:** When a teacher creates an assignment, they currently link it to competencies from the framework. But competencies are broad — "Applies mathematical reasoning to real-world problems" could mean dozens of things. Skills let the teacher be specific about *which* mathematical reasoning: "unit conversion," "estimation," "graphing data."

**Proposed data model:**
```
skills (library)
  id, school_id, name, description, category
  suggested_competency_ids (which competencies this skill typically supports)

assignment_skills (junction)
  assignment_id, skill_id

-- Skills are tagged, not scored. They help with:
-- 1. Assignment planning ("What skills does this project develop?")
-- 2. Portfolio tagging ("Show me all work involving data visualization")
-- 3. AI suggestions ("This student hasn't practiced estimation recently")
-- 4. Parent communication ("This week we're focusing on collaborative writing")
```

**Key distinction:** Skills are *teacher-authored and planning-facing*. They help teachers design rich assignments and help the system make intelligent suggestions. They are NOT another thing to grade — that's what competencies are for.

---

### 6. Assignments & Evidence (The Evidence Layer)

"Assignment" is a broad term in Amoeba that encompasses all evidence-generating activities:

- **Structured tasks:** A specific project, writing piece, investigation, or performance task assigned to a student or group.
- **Observations:** An educator's documented observation of a student demonstrating (or struggling with) a competency in a naturalistic context.
- **Artifacts:** Student work products (writing samples, project outputs, presentations, creative works) that serve as evidence.
- **Self and peer assessments:** Student reflections and peer feedback (age-appropriate, likely for older cohorts).
- **Parent-reported evidence:** Observations from the parent context input system (e.g., "She's been independently researching marine biology at home and presenting findings to family").

**How assignments connect to the framework:**

Each assignment or observation is tagged with one or more competencies from the framework. This is the critical linkage. When an educator creates an assignment, they indicate which strands and levels the task is designed to elicit evidence for. When they observe or evaluate, they indicate which descriptors the student demonstrated.

**Design considerations:**

- **Multi-strand assignments are the norm:** A project-based learning task will almost always generate evidence across multiple strands (writing, collaboration, research, subject knowledge). The system supports tagging a single assignment to multiple competencies.
- **Evidence strength varies:** A formal portfolio piece is stronger evidence than a casual observation. The system should capture evidence type/weight, even if the initial version treats all evidence equally.
- **Frequency matters:** A single observation is an anecdote. Repeated observations across contexts establish a pattern. The learner profile reflects accumulation and consistency, not just recency.
- **Educator attribution:** Different observers may have different perspectives and different levels of familiarity with a student. The system captures who observed what.

**Structure in our system:**
```
Assignment
  title, description, type (individual/class), due_date
  linked competencies (what it assesses)
  linked skills (what it develops) ← proposed

  StudentAssignment (per student)
    status (assigned → in_progress → submitted → graded)
    qualitative_feedback (teacher narrative)
    CompetencyScores (teacher ratings per competency)
    AI-inferred scores (suggested ratings from narrative)
```

**Current implementation:** `assignments` → `assignment_competencies` (junction), `student_assignments` → `competency_scores`. Observations can optionally link to assignments via `assignment_id`.

---

### 7. Learner Profile (The Emergent Portrait)

The Learner Profile is the living, evolving representation of an individual student. It is the central data object in Amoeba and the thing that every other entity feeds into or reads from.

**What it contains:**

- **Competency state:** Current position on each strand within the competency framework. Not a single score, but a multi-dimensional snapshot.
- **Interest and engagement signals:** What topics, contexts, and modalities energize this learner? From educator observation, parent input, and self-report.
- **Learning style and support indicators:** How does this learner best acquire understanding? What scaffolding do they need? Do they thrive in collaborative settings or independent work?
- **Social-emotional markers:** Collaboration patterns, self-regulation, resilience, empathy indicators. Observed, not tested.
- **Contextual factors:** Parent-provided context (home environment, family dynamics, languages spoken, travel transitions, health considerations).
- **Evidence log:** A timestamped record of all observations, artifacts, and assessments that have contributed to the current profile state.

**What it is NOT:**
- It is not a report card. It is the data layer underneath a report card.
- It is not a single number or percentile. It is multi-dimensional.
- It is not static. It updates continuously as new evidence enters the system.

**Visualization components:**
- **Amoeba blob:** Radial visualization of dimension scores (competency + interest)
- **Timeline:** Monthly snapshots showing growth over time with forward-looking smoothing
- **Interest map:** Student self-reported interests per dimension
- **Narrative notes:** Teacher observations, parent observations
- **Zone classification:** Sweet spots (high competency + high interest), growth zones, etc.

**Key design principle:** The Learner Profile must be separable from any single competency framework or standards set. It captures the student's reality. The translation to Common Core or IB language happens at the export/reporting layer, not in the profile itself.

**Current implementation:** Computed (not stored) from `observations`, `competency_scores`, `interest_surveys`, `teacher_notes`, `parent_notes`. The `buildDimensionScores()` and `buildSnapshots()` functions synthesize the profile in real-time.

---

## The Standards Overlay: Mapping to External Frameworks

This is the feature that makes Amoeba useful beyond the school network. Parents need to generate reports that translate their child's learner profile into language that an admissions office, a public school, or a traditional private school can understand.

### How the mapping works

The internal competency framework is the source of truth. External standards (Common Core, IB, Cambridge, etc.) are overlay lenses applied at the reporting layer.

**Step 1: Descriptor-level alignment**

Each proficiency descriptor is mapped to one or more external standards descriptors. This is a many-to-many relationship. This mapping is created once per framework version and maintained centrally — not something educators or parents do.

**Step 2: Level translation**

Internal progression levels (Emerging/Developing/Proficient/Extending) translate to grade-level equivalences for frameworks that use grades. This is inherently imprecise but necessary.

The translation logic:
- Map each strand + level combination to an approximate grade-level range
- Express this as a **range**, not a point: "Performing within the Grade 3-4 range" rather than "At Grade 3 level"
- Always present the internal descriptor alongside the translation so the receiving school sees the actual evidence, not just the grade approximation

**Step 3: Coverage analysis**

Not every external standard will have an internal equivalent, and vice versa. The report transparently shows:
- Which external standards are well-evidenced
- Which are partially covered (capability exists but demonstrated in a different context)
- Which are not addressed (e.g., US-specific content knowledge standards intentionally not covered)

This transparency is a feature, not a bug. It lets the receiving school understand exactly what they're getting and what gaps might need assessment.

### Report output format

The parent-facing export includes:
1. **Narrative summary:** Human-readable overview of strengths, growth areas, and learning profile
2. **Competency snapshot:** Visual/tabular representation of current levels across all strands
3. **Standards overlay:** Selected external framework mapped against the learner's profile, with grade-range equivalences and coverage indicators
4. **Evidence highlights:** Selected examples of work, observations, and artifacts substantiating competency claims
5. **Educator commentary:** Qualitative notes adding texture beyond the data

**Current implementation:** `global_standards_frameworks` and `standards_frameworks` tables exist. The reporting/export layer is a future build phase.

---

## How the Layers Connect

```
┌──────────────────────────┐
│     SCHOOL PROFILE       │  ← Configuration layer
│  (pedagogy, culture,     │
│   standards preferences) │
└────────────┬─────────────┘
             │ contextualizes
┌────────────▼─────────────┐
│      STANDARDS           │  ← External reference
│  (Common Core, IB, etc.) │
└────────────┬─────────────┘
             │ inform (overlay, not source of truth)
┌────────────▼─────────────┐
│   COMPETENCY FRAMEWORK   │  ← School's rubric (internal truth)
│  (domains / strands /    │
│   competencies with      │
│   step descriptors)      │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│   ASSIGNMENTS /          │  ← Teacher creates
│   PROJECTS               │
│  (linked to competencies │────────────┐
│   + skills)              │            │
└────────────┬─────────────┘            │
             │                          │
   Students graded              Direct observations
   on competencies              (quick dimension ratings)
             │                          │
┌────────────▼─────────────┐            │
│   COMPETENCY SCORES      │            │
│  (per student,           │            │
│   per competency)        │            │
└────────────┬─────────────┘            │
             │ AI mapping               │
┌────────────▼─────────────┐            │
│   DIMENSION SCORES       │◄───────────┘
│  (blended average)       │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│   LEARNER PROFILE        │  ← Emergent portrait
│  (amoeba + timeline +    │
│   interests + context +  │
│   narrative + evidence)  │
└────────────┬─────────────┘
             │ overlay at export time
┌────────────▼─────────────┐
│   STANDARDS REPORTS      │  ← Translation for external schools
│  (grade-range mapping,   │
│   coverage analysis)     │
└──────────────────────────┘
```

---

## Data Integrity Rules

1. **Evidence should link to at least one competency or dimension.** Unlinked evidence is noise. (Observations currently link to dimensions directly; assignment-based evidence links through competencies.)
2. **Competency descriptors must be unique per strand + level combination.** No duplicates within a framework.
3. **Alignment maps are versioned.** When Common Core or IB updates, old mappings must be preserved for historical reports.
4. **Learner profiles are append-only for evidence.** Historical evidence is never deleted, only superseded by newer observations. The profile state is computed from the evidence log, not stored as a mutable field.
5. **School profiles do not constrain the competency framework.** All schools can share the same framework; the school profile only affects prioritization, emphasis, and which external overlays are available.
6. **A student transferring between locations should have a continuous learner profile** even if the school profiles differ. The competency framework is the portable spine.

---

## Philosophical Guardrails

These principles guide every design and implementation decision:

1. **The learner profile is richer than the competency framework.** The framework is one lens on the student. The profile includes interests, context, style, and disposition. Never reduce the profile to just competency scores.

2. **Precision over false specificity.** "Working within the Grade 3-4 range" is honest. "At Grade 3.7 level" is false precision that implies a measurement accuracy the system doesn't have.

3. **The internal framework is the source of truth.** External standards are translation targets, never the internal operating system. Design decisions should never be made to accommodate a quirk of Common Core at the expense of the internal framework's integrity.

4. **Evidence-based, not assessment-based.** The system tracks what students demonstrably can do, gathered from multiple sources in authentic contexts. It does not rely on tests or standardized assessments as the primary evidence mechanism.

5. **Transparency in translation.** Every standards overlay report makes clear what is directly evidenced, what is inferred, and what is not covered. Never overstate alignment.

6. **Context is not optional.** A competency score without context (who observed it, in what setting, with what support) is incomplete. The system always preserves and surfaces context alongside data.

7. **Parents are contributors, not just consumers.** The parent context input system treats parents as valuable sources of evidence about their child, not just recipients of reports.

8. **Portability is a product feature.** The ability to export a credible, standards-aligned report is not an afterthought. It is a core value proposition for families who may transition between schools.

9. **Teachers grade competencies, not dimensions.** Dimensions are computed, not directly assessed (except through quick observations). This keeps the rubric actionable and the portrait holistic.

10. **Skills are for planning, competencies are for assessment.** Don't make teachers score 30 micro-skills. Let them *tag* skills for planning and *rate* competencies for assessment.

11. **The amoeba is the output, not the input.** Nobody directly manipulates the amoeba. It reflects the accumulated evidence, smoothed over time.

12. **Two channels, one portrait.** Quick observations (direct dimension ratings) and structured assignments (competency-to-dimension mapping) both feed the same amoeba. Schools can use either or both.

13. **AI assists, humans decide.** AI maps competencies to dimensions (with confidence scores) and suggests ratings from narrative feedback. Teachers always have final say.

14. **Grade-aware, not grade-limited.** Step descriptors ensure competencies are developmentally appropriate, but the system never prevents a teacher from observing growth beyond the expected level.

---

## Universal Competency Patterns

These patterns hold true across virtually all competency and standards frameworks. They are safe to build into Amoeba's architecture as foundational assumptions.

**Cognitive progression is directional.** Every framework assumes learners move from concrete to abstract, simple to compound, supported to independent. This sequence does not reverse. The system assumes forward progression as the default, with explicit mechanisms for noting regression or inconsistency.

**Domains decompose into strands.** Every framework uses this pattern. The specific strand names vary but the structural principle is universal. The data model supports arbitrary strand depth (strands within strands) even if the initial version uses only one level.

**Proficiency is described through observable action.** The "can do" statement pattern (context + action + quality indicator) appears in every major framework. This is the atomic unit of competency description and the atomic unit of the data model.

**Process skills are cross-cutting.** Communication, collaboration, critical thinking, and metacognition appear in every modern framework. Build them as first-class domains, even though some external frameworks treat them as implied.

**Assessment evidence is multi-source.** No serious framework assumes a single assessment type. The evidence model is designed for heterogeneous inputs from day one.

---

## Build Sequence

### Completed (Prompts 1-13)
- Competency framework schema (domains, subdomains, competencies with step descriptors)
- Framework upload/management (XLSX/CSV parsing, admin UI)
- Assignment CRUD with competency linking
- Per-student grading UI with rubric-based scoring
- AI edge functions (competency-to-dimension mapping, score inference from narrative)
- Scoring engine rewrite (dual-channel blending)
- Data flow update (student profile hook fetches competency data)
- Observation enhancement (optional assignment linking)
- Default framework seeding (Common Core on school creation)

### Next Phases
- **Skills library:** Curated + teacher-authored skill tags for assignment planning
- **Standards overlay & export:** Alignment maps, grade-range translation, coverage analysis, parent-facing report generation
- **AI-powered recommendations:** Personalized learning suggestions based on profile + interests + gaps
- **Evidence strength & triangulation:** Weight different evidence types, require multi-source confirmation for level changes

---

## Glossary

| Term | Definition | Data table |
|------|-----------|------------|
| **School Profile** | Configuration defining a school's pedagogical context and priorities | `schools`, `school_context` |
| **Standard** | External reference expectation (e.g., CC.MATH.4.NF.1) | `standards`, `global_standards` |
| **Domain** | Top-level competency category (e.g., Literacy, Mathematical Reasoning) | `competency_domains` |
| **Strand / Subdomain** | Vertical thread within a domain (e.g., Written Expression) | `competency_subdomains` |
| **Competency** | Demonstrable capability with grade-specific descriptors | `competencies` |
| **Step Descriptor** | Grade/age-appropriate description of what a competency looks like | JSONB in `competencies` |
| **Progression Level** | Developmental stage (Emerging → Developing → Proficient → Extending) | Encoded in step descriptors |
| **Dimension** | Holistic learning axis (amoeba spoke) | `dimensions` |
| **Skill** | Specific ability a task develops (proposed) | `skills` (proposed) |
| **Observation** | Quick teacher rating on a dimension (1-4) | `observations` |
| **Assignment** | Learning activity linked to competencies | `assignments` |
| **Competency Score** | Student rating on a specific competency (0-4 scale) | `competency_scores` |
| **Dimension Score** | Blended competency + observation score | Computed (not stored) |
| **Learner Profile** | Full student portrait (amoeba + timeline + context) | Computed (not stored) |
| **AI Mapping** | Cached competency-to-dimension relationship with confidence | `competency_dimension_mappings` |
| **Standards Overlay** | Translation layer projecting internal data onto external frameworks | Future: `alignment_maps` |
| **Evidence Record** | Any documented observation, artifact, or assessment | `observations`, `student_assignments` |
| **ECD** | Early Childhood Director / educator who generates observations | `profiles` with educator role |
| **Parent Context Input** | Parent-provided observations enriching the learner profile | `parent_notes` |

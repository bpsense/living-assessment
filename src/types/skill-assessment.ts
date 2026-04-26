// skill-assessment.ts — V2 skill assignment + assessment types.
//
// Lives separately from src/types/database.ts so the V1 names
// (`SkillAssignment`, `StudentSkillAssignment`) used by the legacy grading UI
// keep working unchanged. The V2 types here match the unified pipeline
// introduced in migration 066.
//
// Pair `import { type StudentSkillAssignment } from '../types/skill-assessment'`
// with `import { type StudentSkillAssignment as LegacyStudentSkillAssignment }`
// from database.ts only when a single file genuinely needs both.

/** Source of a per-student skill record. */
export type StudentSkillAssignmentSource = 'project' | 'standalone'

/** Lifecycle of a per-student skill record. */
export type StudentSkillAssignmentStatus = 'active' | 'completed' | 'dropped'

/**
 * The four V2 assessment levels, absolute to the skill (not grade-relative).
 * Stored as a lowercase text enum on `skill_assessments.level`.
 */
export type AssessmentLevel = 'emerging' | 'developing' | 'achieving' | 'exceeding'

export const ASSESSMENT_LEVELS: readonly AssessmentLevel[] = [
  'emerging',
  'developing',
  'achieving',
  'exceeding',
] as const

/** Numeric ordinal used for "max", "mode tiebreak", "growth" comparisons. */
export const ASSESSMENT_LEVEL_RANK: Record<AssessmentLevel, number> = {
  emerging: 1,
  developing: 2,
  achieving: 3,
  exceeding: 4,
}

export interface StudentSkillAssignment {
  id: string
  student_id: string
  skill_id: string
  assigned_by: string
  assigned_at: string
  source: StudentSkillAssignmentSource
  /** Set when source = 'project'; the originating assignments.id. */
  source_assignment_id: string | null
  status: StudentSkillAssignmentStatus
  created_at: string
  updated_at: string
}

export type StudentSkillAssignmentInsert = Omit<
  StudentSkillAssignment,
  'id' | 'assigned_at' | 'created_at' | 'updated_at'
> & {
  id?: string
  assigned_at?: string
  status?: StudentSkillAssignmentStatus
  source_assignment_id?: string | null
}

export type StudentSkillAssignmentUpdate = Partial<
  Pick<StudentSkillAssignment, 'status'>
>

export interface SkillAssessment {
  id: string
  student_id: string
  skill_id: string
  assessed_by: string
  level: AssessmentLevel
  notes: string | null
  assessed_at: string
  /** Set when the assessment was recorded against a specific assignment row. */
  student_skill_assignment_id: string | null
  created_at: string
}

export type SkillAssessmentInsert = Omit<
  SkillAssessment,
  'id' | 'assessed_at' | 'created_at'
> & {
  id?: string
  assessed_at?: string
  notes?: string | null
  student_skill_assignment_id?: string | null
}

/**
 * standards-assignment-data.ts
 *
 * Shared assessment-level primitives (emerging / developing / achieving / mastery)
 * used by the Competency Snapshot. The standards / assignment-grading functions
 * that previously lived here were removed when standards were deprecated; the
 * level scale + the level-assessment shape remain as the snapshot's level model.
 */

export const ASSESSMENT_LEVELS = ['emerging', 'developing', 'achieving', 'mastery'] as const
export type AssessmentLevel = (typeof ASSESSMENT_LEVELS)[number]

/** Numeric score (1–4) for amoeba / dimension rollup. */
export const LEVEL_SCORE: Record<AssessmentLevel, number> = {
  emerging: 1,
  developing: 2,
  achieving: 3,
  mastery: 4,
}

/**
 * A single level assessment at a point in time. Field names retain their
 * original shape; the competency snapshot maps observations into this shape
 * (standard_id carries the competency id).
 */
export interface StandardAssessment {
  id: string
  student_assignment_id: string
  student_id: string
  school_id: string
  standard_id: string
  level: AssessmentLevel
  notes: string | null
  assessor_id: string
  assessed_at: string
  created_at: string
  /** Age step this was assessed against (observations spine). May differ from
   *  the learner's standard age for stretch/remedial. Optional; legacy rows omit it. */
  assessed_age?: number | null
}

export function formatLevel(level: AssessmentLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

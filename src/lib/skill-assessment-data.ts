// skill-assessment-data.ts
//
// V2 skill assessment helpers. The `skill_assessments` table is append-only;
// "current level" for a student+skill is derived from the latest row.

import { supabase } from './supabase'
import type {
  AssessmentLevel,
  SkillAssessment,
  SkillAssessmentInsert,
} from '../types/skill-assessment'
import { ASSESSMENT_LEVELS } from '../types/skill-assessment'

// ============================================================
// Recording
// ============================================================

export interface RecordAssessmentInput {
  studentId: string
  skillId: string
  assessedBy: string
  level: AssessmentLevel
  notes?: string | null
  /** Optional link back to the active student_skill_assignment row. */
  studentSkillAssignmentId?: string | null
}

/** Append a single assessment row. Returns the inserted row. */
export async function recordAssessment(
  input: RecordAssessmentInput
): Promise<SkillAssessment> {
  const insert: SkillAssessmentInsert = {
    student_id: input.studentId,
    skill_id: input.skillId,
    assessed_by: input.assessedBy,
    level: input.level,
    notes: input.notes ?? null,
    student_skill_assignment_id: input.studentSkillAssignmentId ?? null,
  }
  const { data, error } = await supabase
    .from('skill_assessments')
    .insert(insert)
    .select('*')
    .single()
  if (error || !data) throw new Error(`Failed to record assessment: ${error?.message}`)
  return data as SkillAssessment
}

/**
 * Append a batch of assessments in a single round-trip. Use when a "Quick
 * Assess" UI submits multiple skill levels at once.
 */
export async function recordAssessments(
  inputs: RecordAssessmentInput[]
): Promise<SkillAssessment[]> {
  if (inputs.length === 0) return []
  const rows: SkillAssessmentInsert[] = inputs.map((i) => ({
    student_id: i.studentId,
    skill_id: i.skillId,
    assessed_by: i.assessedBy,
    level: i.level,
    notes: i.notes ?? null,
    student_skill_assignment_id: i.studentSkillAssignmentId ?? null,
  }))
  const { data, error } = await supabase
    .from('skill_assessments')
    .insert(rows)
    .select('*')
  if (error) throw error
  return (data ?? []) as SkillAssessment[]
}

// ============================================================
// History
// ============================================================

/** Full assessment history for a student, newest first. */
export async function getAssessmentHistory(
  studentId: string,
  options: { skillId?: string; limit?: number } = {}
): Promise<SkillAssessment[]> {
  let q = supabase
    .from('skill_assessments')
    .select('*')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false })

  if (options.skillId) q = q.eq('skill_id', options.skillId)
  if (options.limit) q = q.limit(options.limit)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SkillAssessment[]
}

/**
 * Latest assessment per skill for a student. Returns a Map keyed by skill_id.
 * Skills without any assessment are absent from the map.
 */
export async function getLatestAssessmentsByStudent(
  studentId: string
): Promise<Map<string, SkillAssessment>> {
  // Pull the full history once, then walk it. The set is bounded (one
  // student's assessments) and the index `(student_id, skill_id, assessed_at desc)`
  // makes the read cheap.
  const history = await getAssessmentHistory(studentId)
  const latest = new Map<string, SkillAssessment>()
  for (const a of history) {
    if (!latest.has(a.skill_id)) latest.set(a.skill_id, a)
  }
  return latest
}

// ============================================================
// Convenience
// ============================================================

/** Pretty-print a level for UI ("Emerging" not "emerging"). */
export function formatLevel(level: AssessmentLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

/** Type guard. */
export function isAssessmentLevel(value: unknown): value is AssessmentLevel {
  return typeof value === 'string' && (ASSESSMENT_LEVELS as readonly string[]).includes(value)
}

// Re-export so callers don't need a second import path.
export { ASSESSMENT_LEVELS, ASSESSMENT_LEVEL_RANK } from '../types/skill-assessment'
export type { AssessmentLevel, SkillAssessment } from '../types/skill-assessment'

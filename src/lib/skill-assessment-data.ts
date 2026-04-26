// skill-assessment-data.ts
//
// V2 skill assessment helpers. The `skill_assessments` table is append-only;
// "current level" for a student+skill is derived from the latest row.
//
// Domain-level aggregation: take the **mode** (most common level) of the
// latest assessment per skill in that domain, with ties broken toward the
// higher level. This produces the per-domain assessment level the amoeba
// uses (Phase 5 will wire it in).

import { supabase } from './supabase'
import type {
  AssessmentLevel,
  SkillAssessment,
  SkillAssessmentInsert,
} from '../types/skill-assessment'
import { ASSESSMENT_LEVEL_RANK, ASSESSMENT_LEVELS } from '../types/skill-assessment'

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
// Domain-level aggregation
// ============================================================

export interface DomainAssessment {
  domainId: string
  /** The mode level. Null when no skills in that domain have assessments. */
  level: AssessmentLevel | null
  /** Counts feeding the mode, useful for UI ("3 achieving / 1 developing"). */
  counts: Record<AssessmentLevel, number>
  /** Skills considered (those in this domain that have at least one assessment). */
  assessedSkillCount: number
}

/**
 * Aggregate latest assessments to the domain level for a student.
 *
 * Algorithm:
 *   1. Pull every skill (with `domain_id`) the student has any assessment for.
 *   2. Take the latest assessment per skill (delegates to
 *      getLatestAssessmentsByStudent).
 *   3. For each domain, count assessments by level.
 *   4. The domain's level is the **mode**; ties break toward the higher level
 *      (so "2 emerging / 2 developing" → developing).
 *
 * Returns one entry per domain that has at least one assessed skill. Domains
 * with no assessed skills are intentionally absent — callers (e.g. the amoeba)
 * decide how to render "no data".
 */
export async function aggregateAssessmentsByDomain(
  studentId: string
): Promise<DomainAssessment[]> {
  const latest = await getLatestAssessmentsByStudent(studentId)
  if (latest.size === 0) return []

  const skillIds = [...latest.keys()]
  const { data: skills, error } = await supabase
    .from('skills')
    .select('id, domain_id')
    .in('id', skillIds)
  if (error) throw error

  // Group by domain.
  const buckets = new Map<string, AssessmentLevel[]>()
  for (const s of (skills ?? []) as { id: string; domain_id: string | null }[]) {
    if (!s.domain_id) continue
    const a = latest.get(s.id)
    if (!a) continue
    const arr = buckets.get(s.domain_id) ?? []
    arr.push(a.level)
    buckets.set(s.domain_id, arr)
  }

  const out: DomainAssessment[] = []
  for (const [domainId, levels] of buckets) {
    const counts: Record<AssessmentLevel, number> = {
      emerging: 0, developing: 0, achieving: 0, exceeding: 0,
    }
    for (const lvl of levels) counts[lvl]++

    let bestLevel: AssessmentLevel | null = null
    let bestCount = -1
    for (const lvl of ASSESSMENT_LEVELS) {
      const c = counts[lvl]
      if (c === 0) continue
      // Tie-break toward the higher rank (later in ASSESSMENT_LEVELS).
      if (
        c > bestCount ||
        (c === bestCount && bestLevel !== null && ASSESSMENT_LEVEL_RANK[lvl] > ASSESSMENT_LEVEL_RANK[bestLevel])
      ) {
        bestCount = c
        bestLevel = lvl
      }
    }

    out.push({
      domainId,
      level: bestLevel,
      counts,
      assessedSkillCount: levels.length,
    })
  }

  return out
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

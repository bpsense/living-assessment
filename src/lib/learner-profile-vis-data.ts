// learner-profile-vis-data.ts
//
// Phase 5 — data preparation for the V2 expanding-canvas amoeba.
//
// Concepts:
//   * Each Learner Profile domain is one axis of the amoeba.
//   * For a given snapshot date, the *canvas* on each axis = the count of
//     skills tagged to that domain whose age_band brackets the student's
//     age on that date (skills with no age band are always included).
//   * The *contour* on each axis = the sum of latest-assessment level ranks
//     across the same skills. A skill that has never been assessed
//     contributes 0; an Exceeding (rank 4) contributes 4. The maximum
//     possible contour value on an axis equals canvas_skills × 4.
//
// Timeline playback recomputes both the canvas (age changes) and the contour
// (only assessments dated ≤ snapshot date count) at each step. The canvas
// expands as the student ages; contour values remain absolute.

import { fetchLearnerProfileDomainsForSchool, fetchSkills } from './skills-data'
import { getAssessmentHistory } from './skill-assessment-data'
import { supabase } from './supabase'
import type { LearnerProfileDomain } from '../types/learner-profile'
import type { Skill } from '../types/database'
import type { SkillAssessment } from '../types/skill-assessment'
import { ASSESSMENT_LEVEL_RANK } from '../types/skill-assessment'

// ============================================================
// Public types
// ============================================================

export interface DomainCanvasState {
  domainId: string
  /** Number of age-appropriate skills in this domain at the snapshot date. */
  canvasSkills: number
  /** Sum of latest-assessment level ranks across those skills. 0–canvasSkills*4. */
  contourScore: number
  /** How many of the age-appropriate skills have at least one assessment by the snapshot date. */
  assessedSkillCount: number
}

export interface VisualizationSnapshot {
  /** ISO date — first of the month for monthly buckets, or 'now' for live. */
  date: string
  /** Student's integer age in years on this date, or null if DOB unknown. */
  ageYears: number | null
  /** One entry per domain, in the LP domain sort order. */
  domains: DomainCanvasState[]
}

export interface VisualizationDataset {
  domains: LearnerProfileDomain[]
  /** All skills loaded for the school (own + baseline). */
  skills: Skill[]
  /** All of the student's assessments, newest first. */
  assessments: SkillAssessment[]
  /** Student DOB; null = age can't be derived (treat as adult). */
  birthDate: string | null
}

// ============================================================
// Data loading
// ============================================================

/**
 * Load every input the visualization needs. Cheap to memoize against
 * `studentId` + `schoolId` — the underlying queries are bounded by school
 * (skills) and student (assessments).
 */
export async function loadVisualizationDataset(args: {
  studentId: string
  schoolId: string
}): Promise<VisualizationDataset> {
  const { studentId, schoolId } = args

  const [domains, skills, assessments, student] = await Promise.all([
    fetchLearnerProfileDomainsForSchool(schoolId),
    fetchSkills(schoolId),
    getAssessmentHistory(studentId),
    supabase
      .from('students')
      .select('date_of_birth')
      .eq('id', studentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error
        return (data?.date_of_birth as string | null) ?? null
      }),
  ])

  return {
    domains: [...domains].sort((a, b) => a.sort_order - b.sort_order),
    skills,
    assessments,
    birthDate: student,
  }
}

// ============================================================
// Snapshot computation
// ============================================================

/**
 * Compute one snapshot of the amoeba state at the given date. Use `new Date()`
 * for the live "current" view.
 */
export function computeSnapshot(
  dataset: VisualizationDataset,
  at: Date
): VisualizationSnapshot {
  const ageYears = dataset.birthDate ? ageOn(dataset.birthDate, at) : null
  const cutoff = at.getTime()

  // Latest assessment per (skill_id) on or before `at`. assessments are
  // newest-first per skill_id ordering inside the array? They're newest-first
  // overall — so we walk and keep the first hit per skill_id with assessed_at
  // ≤ cutoff.
  const latestBySkill = new Map<string, SkillAssessment>()
  for (const a of dataset.assessments) {
    if (new Date(a.assessed_at).getTime() > cutoff) continue
    if (latestBySkill.has(a.skill_id)) continue
    latestBySkill.set(a.skill_id, a)
  }

  // Bucket skills by domain, applying the age filter.
  const byDomain = new Map<string, Skill[]>()
  for (const s of dataset.skills) {
    if (!s.domain_id) continue
    if (!skillIsAgeAppropriate(s, ageYears)) continue
    const arr = byDomain.get(s.domain_id) ?? []
    arr.push(s)
    byDomain.set(s.domain_id, arr)
  }

  const domainStates: DomainCanvasState[] = dataset.domains.map((d) => {
    const ageAppropriate = byDomain.get(d.id) ?? []
    let contourScore = 0
    let assessedCount = 0
    for (const skill of ageAppropriate) {
      const a = latestBySkill.get(skill.id)
      if (!a) continue
      contourScore += ASSESSMENT_LEVEL_RANK[a.level]
      assessedCount++
    }
    return {
      domainId: d.id,
      canvasSkills: ageAppropriate.length,
      contourScore,
      assessedSkillCount: assessedCount,
    }
  })

  return {
    date: at.toISOString().slice(0, 10),
    ageYears,
    domains: domainStates,
  }
}

/**
 * Build the full month-by-month timeline of snapshots from the student's
 * earliest assessment (or 12 months ago, whichever is earlier) up to `endDate`
 * (defaults to today). Each month is the 1st of the month.
 *
 * Months without DOB still produce snapshots; their canvases include all
 * skills with null age bands, but skills with explicit bands are excluded.
 */
export function computeTimeline(
  dataset: VisualizationDataset,
  endDate: Date = new Date()
): VisualizationSnapshot[] {
  const earliest = earliestRelevantDate(dataset, endDate)
  const snapshots: VisualizationSnapshot[] = []
  const cursor = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1))
  const stop = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
  // Inclusive of `stop` month.
  while (cursor.getTime() <= stop.getTime()) {
    snapshots.push(computeSnapshot(dataset, cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return snapshots
}

// ============================================================
// Internals
// ============================================================

function earliestRelevantDate(dataset: VisualizationDataset, endDate: Date): Date {
  const fallback = new Date(endDate)
  fallback.setUTCFullYear(fallback.getUTCFullYear() - 1)

  if (dataset.assessments.length === 0) return fallback

  // assessments are newest-first; walk to find earliest.
  let earliest = new Date(dataset.assessments[0].assessed_at)
  for (const a of dataset.assessments) {
    const t = new Date(a.assessed_at)
    if (t.getTime() < earliest.getTime()) earliest = t
  }
  // Don't start *after* the fallback, so the timeline always shows at least
  // a year of context even for a student whose only assessments are recent.
  return earliest.getTime() < fallback.getTime() ? earliest : fallback
}

/** Integer age (floored) on a given date. */
export function ageOn(birthDateIso: string, at: Date): number {
  const dob = new Date(birthDateIso)
  let years = at.getUTCFullYear() - dob.getUTCFullYear()
  const mDiff = at.getUTCMonth() - dob.getUTCMonth()
  if (mDiff < 0 || (mDiff === 0 && at.getUTCDate() < dob.getUTCDate())) years--
  return Math.max(years, 0)
}

function skillIsAgeAppropriate(skill: Skill, age: number | null): boolean {
  // Skills with no age band are always in scope.
  if (skill.age_band_start === null && skill.age_band_end === null) return true
  // Without DOB we can't filter by age; include only the bandless ones (above).
  if (age === null) return false
  const start = skill.age_band_start ?? Number.NEGATIVE_INFINITY
  const end = skill.age_band_end ?? Number.POSITIVE_INFINITY
  return age >= start && age <= end
}

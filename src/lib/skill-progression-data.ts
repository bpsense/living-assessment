/**
 * skill-progression-data.ts
 * Data layer for the skill progressions system. Fetches skills with
 * grade-banded expectation steps and provides grade-zone utilities.
 */

import { supabase } from './supabase'
import { gradeToOrdinal } from './skills-data'
import type {
  Skill,
  SkillInsert,
  SkillWithProgression,
  SkillProgressionStep,
  SkillProgressionStepInsert,
  SkillProgressionStepUpdate,
  GradeZone,
} from '../types/database'

// ============================================================
// Grade-zone helpers
// ============================================================

/** Returns true if the step's grade is above the student's grade. */
export function isAboveGrade(stepGrade: string, studentGrade: string): boolean {
  return gradeToOrdinal(stepGrade) > gradeToOrdinal(studentGrade)
}

/** Classifies a step relative to a student's grade. */
export function getGradeZone(stepGrade: string, studentGrade: string): GradeZone {
  const stepOrd = gradeToOrdinal(stepGrade)
  const studentOrd = gradeToOrdinal(studentGrade)
  if (stepOrd < studentOrd) return 'remediation'
  if (stepOrd > studentOrd) return 'extension'
  return 'current'
}

// ============================================================
// Fetch: single skill with progression
// ============================================================

/** Fetch a single skill with all its progression steps, ordered by grade ordinal. */
export async function fetchSkillWithProgression(
  skillId: string,
  schoolId: string
): Promise<SkillWithProgression> {
  const [skillRes, stepsRes] = await Promise.all([
    supabase
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .single(),
    supabase
      .from('skill_progression_steps')
      .select('*')
      .eq('skill_id', skillId)
      .eq('school_id', schoolId)
      .order('grade_level'),
  ])

  if (skillRes.error || !skillRes.data) {
    throw new Error(`Failed to fetch skill: ${skillRes.error?.message ?? 'Not found'}`)
  }

  const steps = (stepsRes.data ?? []) as SkillProgressionStep[]
  steps.sort((a, b) => gradeToOrdinal(a.grade_level) - gradeToOrdinal(b.grade_level))

  return {
    ...skillRes.data as Skill,
    steps,
  }
}

// ============================================================
// Fetch: all assessable skills with steps
// ============================================================

/** Fetch all assessable skills for a school, optionally filtered. */
export async function fetchAssessableSkills(
  schoolId: string,
  filters?: {
    domain?: string
    strand?: string
    sourceFramework?: string
    search?: string
  }
): Promise<SkillWithProgression[]> {
  // Fetch skills
  let skillQuery = supabase
    .from('skills')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_assessable', true)
    .order('progression_domain')
    .order('progression_strand')
    .order('name')

  if (filters?.sourceFramework) {
    skillQuery = skillQuery.eq('source_framework', filters.sourceFramework)
  }
  if (filters?.domain) {
    skillQuery = skillQuery.eq('progression_domain', filters.domain)
  }
  if (filters?.strand) {
    skillQuery = skillQuery.eq('progression_strand', filters.strand)
  }

  const { data: skillData, error: skillErr } = await skillQuery
  if (skillErr) throw new Error(`Failed to fetch skills: ${skillErr.message}`)

  let skills = (skillData ?? []) as Skill[]

  // Client-side search (small dataset)
  if (filters?.search) {
    const lower = filters.search.toLowerCase()
    skills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        (s.description ?? '').toLowerCase().includes(lower) ||
        (s.progression_domain ?? '').toLowerCase().includes(lower) ||
        (s.progression_strand ?? '').toLowerCase().includes(lower)
    )
  }

  if (skills.length === 0) return []

  // Fetch all steps for these skills
  const skillIds = skills.map((s) => s.id)
  const { data: stepData, error: stepErr } = await supabase
    .from('skill_progression_steps')
    .select('*')
    .eq('school_id', schoolId)
    .in('skill_id', skillIds)
    .order('grade_level')

  if (stepErr) throw new Error(`Failed to fetch steps: ${stepErr.message}`)

  const stepsBySkill = new Map<string, SkillProgressionStep[]>()
  for (const step of (stepData ?? []) as SkillProgressionStep[]) {
    if (!stepsBySkill.has(step.skill_id)) stepsBySkill.set(step.skill_id, [])
    stepsBySkill.get(step.skill_id)!.push(step)
  }

  // Sort each skill's steps by grade ordinal
  for (const steps of stepsBySkill.values()) {
    steps.sort((a, b) => gradeToOrdinal(a.grade_level) - gradeToOrdinal(b.grade_level))
  }

  return skills.map((s) => ({
    ...s,
    steps: stepsBySkill.get(s.id) ?? [],
  }))
}

// ============================================================
// Fetch: skills for a specific grade (with zones)
// ============================================================

/**
 * Fetch skills filtered to a specific grade level, returning each step with
 * a GradeZone label (remediation / current / extension).
 */
export async function fetchSkillsForGrade(
  schoolId: string,
  gradeLevel: string,
  options?: { domain?: string; includeRange?: number }
): Promise<{ zone: GradeZone; step: SkillProgressionStep; skill: Skill }[]> {
  const range = options?.includeRange ?? 2
  const studentOrd = gradeToOrdinal(gradeLevel)
  if (studentOrd < 0) return []

  const skills = await fetchAssessableSkills(schoolId, {
    domain: options?.domain,
  })

  const results: { zone: GradeZone; step: SkillProgressionStep; skill: Skill }[] = []

  for (const skill of skills) {
    for (const step of skill.steps) {
      const stepOrd = gradeToOrdinal(step.grade_level)
      if (stepOrd < 0) continue

      const diff = stepOrd - studentOrd
      if (diff < -range || diff > range) continue

      results.push({
        zone: getGradeZone(step.grade_level, gradeLevel),
        step,
        skill,
      })
    }
  }

  // Sort: current first, then remediation descending, then extension ascending
  results.sort((a, b) => {
    const zoneOrder: Record<GradeZone, number> = { current: 0, remediation: 1, extension: 2 }
    const zo = zoneOrder[a.zone] - zoneOrder[b.zone]
    if (zo !== 0) return zo
    return gradeToOrdinal(a.step.grade_level) - gradeToOrdinal(b.step.grade_level)
  })

  return results
}

// ============================================================
// Single-step lookups
// ============================================================

/** Get the step for a specific skill at a specific grade. */
export async function getStepForGrade(
  skillId: string,
  schoolId: string,
  gradeLevel: string
): Promise<SkillProgressionStep | null> {
  const { data, error } = await supabase
    .from('skill_progression_steps')
    .select('*')
    .eq('skill_id', skillId)
    .eq('school_id', schoolId)
    .eq('grade_level', gradeLevel)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch step: ${error.message}`)
  return data as SkillProgressionStep | null
}

/** Get the full progression ladder for a skill (all grades, ordered). */
export async function getProgressionLadder(
  skillId: string,
  schoolId: string
): Promise<SkillProgressionStep[]> {
  const { data, error } = await supabase
    .from('skill_progression_steps')
    .select('*')
    .eq('skill_id', skillId)
    .eq('school_id', schoolId)
    .order('grade_level')

  if (error) throw new Error(`Failed to fetch ladder: ${error.message}`)

  const steps = (data ?? []) as SkillProgressionStep[]
  steps.sort((a, b) => gradeToOrdinal(a.grade_level) - gradeToOrdinal(b.grade_level))
  return steps
}

// ============================================================
// CRUD for custom skill progressions
// ============================================================

/**
 * Create a new skill with progression steps.
 * Returns the created skill ID.
 */
export async function createSkillWithProgression(
  skill: SkillInsert,
  steps: Omit<SkillProgressionStepInsert, 'skill_id'>[]
): Promise<string> {
  const { data: skillRow, error: skillErr } = await supabase
    .from('skills')
    .insert({ ...skill, is_assessable: true })
    .select('id')
    .single()

  if (skillErr || !skillRow) {
    throw new Error(`Failed to create skill: ${skillErr?.message}`)
  }

  const skillId = skillRow.id

  if (steps.length > 0) {
    const stepsWithSkill = steps.map((s) => ({
      ...s,
      skill_id: skillId,
    }))

    const { error: stepErr } = await supabase
      .from('skill_progression_steps')
      .insert(stepsWithSkill)

    if (stepErr) {
      throw new Error(`Failed to create progression steps: ${stepErr.message}`)
    }
  }

  return skillId
}

/** Update a single progression step. */
export async function updateProgressionStep(
  stepId: string,
  data: SkillProgressionStepUpdate
): Promise<void> {
  const { error } = await supabase
    .from('skill_progression_steps')
    .update(data)
    .eq('id', stepId)

  if (error) throw new Error(`Failed to update step: ${error.message}`)
}

/** Add a new progression step to an existing skill. */
export async function addProgressionStep(
  data: SkillProgressionStepInsert
): Promise<string> {
  const { data: row, error } = await supabase
    .from('skill_progression_steps')
    .insert(data)
    .select('id')
    .single()

  if (error || !row) throw new Error(`Failed to add step: ${error?.message}`)
  return row.id
}

/** Delete a progression step. */
export async function deleteProgressionStep(stepId: string): Promise<void> {
  const { error } = await supabase
    .from('skill_progression_steps')
    .delete()
    .eq('id', stepId)

  if (error) throw new Error(`Failed to delete step: ${error.message}`)
}

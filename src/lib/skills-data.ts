/**
 * skills-data.ts
 * CRUD and query operations for the Skills Library.
 * Skills are lightweight, school-scoped planning tags — tagged on assignments
 * but never individually scored (competencies handle assessment).
 */

import { supabase } from './supabase'
import type { Skill, SkillInsert, SkillUpdate, Dimension } from '../types/database'

// ============================================================
// Composite types
// ============================================================

export interface SkillWithCompetencies extends Skill {
  competencies: { id: string; code: string; name: string }[]
}

// ============================================================
// Grade ordering utility
// ============================================================

/** Converts a grade string to a numeric ordinal for comparison. */
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

/** Grade label options for dropdowns (human-readable order). */
export const GRADE_OPTIONS = [
  'Pre-K', 'TK', 'K',
  '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10',
] as const

/** Common age-band presets for skill forms. */
export const AGE_BAND_PRESETS = [
  { label: 'Ages 3–5 (Early Childhood)', min: 'Pre-K', max: 'K' },
  { label: 'Ages 5–7 (Lower Elementary)', min: 'K', max: '2' },
  { label: 'Ages 7–9 (Upper Elementary)', min: '2', max: '4' },
  { label: 'Ages 9–11 (Middle Elementary)', min: '4', max: '6' },
  { label: 'Ages 11–13 (Middle School)', min: '6', max: '8' },
  { label: 'Ages 13–15 (Early High School)', min: '8', max: '10' },
  { label: 'Ages 15–18 (Upper High School)', min: '10', max: '10' },
] as const

// ============================================================
// Fetch skills
// ============================================================

/**
 * Fetch all skills for a school, with linked competency codes.
 * Supports optional search and category filtering.
 */
export async function fetchSkills(
  schoolId: string,
  filters?: { search?: string; category?: string }
): Promise<SkillWithCompetencies[]> {
  const { data, error } = await supabase
    .from('skills')
    .select(`
      *,
      skill_competencies(competency_id, competencies:competencies(id, code, name))
    `)
    .eq('school_id', schoolId)
    .order('category')
    .order('name')

  if (error) throw error

  let skills = (data || []).map((s: any) => ({
    ...s,
    competencies: (s.skill_competencies || [])
      .map((sc: any) => sc.competencies)
      .filter(Boolean),
  })) as SkillWithCompetencies[]

  // Client-side filtering (skill count is small, dozens not thousands)
  if (filters?.search) {
    const lower = filters.search.toLowerCase()
    skills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        (s.description || '').toLowerCase().includes(lower) ||
        (s.category || '').toLowerCase().includes(lower)
    )
  }
  if (filters?.category) {
    skills = skills.filter((s) => s.category === filters.category)
  }

  return skills
}

/**
 * Fetch skills that are linked to any of the given competencies.
 * Used for auto-suggesting skills when a teacher selects competencies
 * on the assignment creation form.
 */
export async function fetchSkillsByCompetencies(
  schoolId: string,
  competencyIds: string[]
): Promise<Skill[]> {
  if (competencyIds.length === 0) return []

  const { data, error } = await supabase
    .from('skill_competencies')
    .select('skill_id, skills!inner(*)')
    .in('competency_id', competencyIds)

  if (error) throw error

  // Deduplicate by skill ID and filter by school
  const seen = new Set<string>()
  const skills: Skill[] = []
  for (const row of data || []) {
    const skill = (row as any).skills as Skill
    if (skill.school_id === schoolId && !seen.has(skill.id)) {
      seen.add(skill.id)
      skills.push(skill)
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Filter skills to those appropriate for a given grade level.
 * Skills with null min/max grade are always included.
 */
export function filterSkillsByGrade(
  skills: SkillWithCompetencies[],
  gradeLevel: string | null
): SkillWithCompetencies[] {
  if (!gradeLevel) return skills
  const ord = gradeToOrdinal(gradeLevel)
  if (ord < 0) return skills

  return skills.filter((s) => {
    const minOrd = gradeToOrdinal(s.min_grade)
    const maxOrd = gradeToOrdinal(s.max_grade)
    if (minOrd >= 0 && ord < minOrd) return false
    if (maxOrd >= 0 && ord > maxOrd) return false
    return true
  })
}

/**
 * Fetch active learner-profile dimensions for a school.
 * Used to populate the "Domain" dropdown on skill forms.
 */
export async function fetchDimensions(schoolId: string): Promise<Dimension[]> {
  const { data, error } = await supabase
    .from('dimensions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')

  if (error) throw error
  return (data || []) as Dimension[]
}

/**
 * Fetch distinct progression_domain values for a school's skills.
 * These are the freeform domain strings already in use.
 */
export async function fetchSkillDomains(schoolId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('progression_domain')
    .eq('school_id', schoolId)
    .not('progression_domain', 'is', null)
    .order('progression_domain')

  if (error) throw error

  return [...new Set((data || []).map((d: any) => d.progression_domain as string))]
}

/**
 * Fetch distinct skill categories for a school (for filter dropdowns).
 */
export async function fetchSkillCategories(schoolId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('category')
    .eq('school_id', schoolId)
    .not('category', 'is', null)
    .order('category')

  if (error) throw error

  const categories = [...new Set((data || []).map((d: any) => d.category as string))]
  return categories
}

// ============================================================
// CRUD
// ============================================================

/**
 * Create a new skill with optional competency links.
 */
export async function createSkill(
  data: SkillInsert,
  competencyIds?: string[]
): Promise<string> {
  const { data: skill, error } = await supabase
    .from('skills')
    .insert(data)
    .select('id')
    .single()

  if (error || !skill) throw new Error(`Failed to create skill: ${error?.message}`)

  const skillId = skill.id

  if (competencyIds && competencyIds.length > 0) {
    const { error: linkErr } = await supabase
      .from('skill_competencies')
      .insert(competencyIds.map((cid) => ({ skill_id: skillId, competency_id: cid })))

    if (linkErr) throw new Error(`Failed to link competencies: ${linkErr.message}`)
  }

  return skillId
}

/**
 * Update a skill and optionally replace its competency links.
 * If competencyIds is provided, existing links are replaced entirely.
 */
export async function updateSkill(
  id: string,
  data: SkillUpdate,
  competencyIds?: string[]
): Promise<void> {
  const { error } = await supabase
    .from('skills')
    .update(data)
    .eq('id', id)

  if (error) throw error

  if (competencyIds !== undefined) {
    // Delete existing links and re-insert
    await supabase
      .from('skill_competencies')
      .delete()
      .eq('skill_id', id)

    if (competencyIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('skill_competencies')
        .insert(competencyIds.map((cid) => ({ skill_id: id, competency_id: cid })))

      if (linkErr) throw new Error(`Failed to link competencies: ${linkErr.message}`)
    }
  }
}

/**
 * Delete a skill (and its competency links via cascade).
 */
export async function deleteSkill(id: string): Promise<void> {
  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id)

  if (error) throw error
}

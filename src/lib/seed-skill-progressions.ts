/**
 * seed-skill-progressions.ts
 * Parses existing standards JSON files (CCSS Math, CCSS ELA, CASEL) into
 * assessable skills with grade-banded progression steps.
 * Called by an admin action ("Populate Default Skills Library").
 */

import { supabase } from './supabase'
import type {
  SkillInsert,
  SkillProgressionStepInsert,
} from '../types/database'

// ============================================================
// Types for parsed JSON structures
// ============================================================

interface CCSSMathStandard {
  id: string
  grade: string
  grade_label: string
  standard_number: string
  description: string
  critical_areas_summary: string
  code: string
}

interface CCSSELAStandard {
  id: string
  grade: string
  grade_label: string
  strand: string
  standard_number: string
  description: string
  code: string
}

interface CASELStandard {
  id: string
  competency: string
  competency_definition: string
  description: string
  grade_band_progressions: Record<string, string>
  code: string
}

interface ParsedFramework {
  skills: SkillInsert[]
  /** Keyed by the skill index (stringified) to its progression steps */
  steps: Map<string, Omit<SkillProgressionStepInsert, 'skill_id'>[]>
}

// ============================================================
// CASEL grade band → grade_level mapping
// ============================================================

const CASEL_BAND_TO_GRADE: Record<string, string> = {
  PreK_K: 'K',
  K_2: '2',
  '3_5': '5',
  '6_8': '8',
  '9_12': '10',
}

// ============================================================
// Pretty strand names
// ============================================================

const ELA_STRAND_LABELS: Record<string, string> = {
  Reading_Literature: 'Reading Literature',
  Reading_Informational: 'Reading Informational Text',
  Reading_Foundational: 'Reading Foundational Skills',
  Writing: 'Writing',
  Speaking_Listening: 'Speaking & Listening',
  Language: 'Language',
}

// ============================================================
// Parsers
// ============================================================

/**
 * Parse CCSS Math JSON into skills + steps.
 * Groups standards by standard_number across grades. Each group becomes
 * one assessable skill. Duplicate entries within the same grade+number
 * are concatenated into a single description.
 */
export function parseCCSSMath(
  jsonData: { standards: CCSSMathStandard[] },
  schoolId: string
): ParsedFramework {
  // Group by standard_number, then by grade
  const groups = new Map<string, Map<string, string[]>>()

  for (const std of jsonData.standards) {
    if (!groups.has(std.standard_number)) {
      groups.set(std.standard_number, new Map())
    }
    const gradeMap = groups.get(std.standard_number)!
    if (!gradeMap.has(std.grade)) {
      gradeMap.set(std.grade, [])
    }
    // Collect all descriptions for this grade+number (handles duplicates)
    gradeMap.get(std.grade)!.push(std.description)
  }

  const skills: SkillInsert[] = []
  const steps = new Map<string, Omit<SkillProgressionStepInsert, 'skill_id'>[]>()

  let idx = 0
  for (const [stdNum, gradeMap] of groups) {
    // Build a representative skill name from the first non-empty description
    const allDescs = [...gradeMap.values()].flat()
    const firstDesc = allDescs[0] ?? `Math Standard ${stdNum}`

    // Determine min/max grades
    const grades = [...gradeMap.keys()]
    const minGrade = grades.includes('K') ? 'K' : grades.sort((a, b) => Number(a) - Number(b))[0]
    const maxGrade = grades.filter((g) => g !== 'K').sort((a, b) => Number(b) - Number(a))[0] ?? 'K'

    const skill: SkillInsert = {
      school_id: schoolId,
      name: `Math Standard ${stdNum}: ${truncate(firstDesc, 80)}`,
      description: firstDesc,
      category: 'Mathematics',
      min_grade: minGrade,
      max_grade: maxGrade,
      is_default: true,
      is_assessable: true,
      source_framework: 'ccss_math',
      source_standard_code: `CCSS.Math.${stdNum}`,
      progression_domain: 'Mathematics',
      progression_strand: `Standard ${stdNum}`,
    }

    skills.push(skill)

    // Build steps for each grade
    const skillSteps: Omit<SkillProgressionStepInsert, 'skill_id'>[] = []
    for (const [grade, descriptions] of gradeMap) {
      // Deduplicate and join descriptions
      const unique = [...new Set(descriptions)]
      const combined = unique.join(' • ')

      skillSteps.push({
        school_id: schoolId,
        grade_level: grade,
        expectation_description: combined,
        example_tasks: null,
        prerequisite_step_id: null,
        competency_ids: [],
      })
    }

    steps.set(String(idx), skillSteps)
    idx++
  }

  return { skills, steps }
}

/**
 * Parse CCSS ELA JSON into skills + steps.
 * Groups standards by strand + standard_number across grades.
 */
export function parseCCSSELA(
  jsonData: { standards: CCSSELAStandard[] },
  schoolId: string
): ParsedFramework {
  // Group by strand+standard_number, then by grade
  const groups = new Map<string, { strand: string; descriptions: Map<string, string[]> }>()

  for (const std of jsonData.standards) {
    const key = `${std.strand}.${std.standard_number}`
    if (!groups.has(key)) {
      groups.set(key, { strand: std.strand, descriptions: new Map() })
    }
    const group = groups.get(key)!
    if (!group.descriptions.has(std.grade)) {
      group.descriptions.set(std.grade, [])
    }
    group.descriptions.get(std.grade)!.push(std.description)
  }

  const skills: SkillInsert[] = []
  const steps = new Map<string, Omit<SkillProgressionStepInsert, 'skill_id'>[]>()

  let idx = 0
  for (const [key, group] of groups) {
    const [strand, stdNum] = key.split('.')
    const strandLabel = ELA_STRAND_LABELS[strand] ?? strand.replace(/_/g, ' ')

    // Build skill name from longest description at any grade
    const allDescs = [...group.descriptions.values()].flat()
    const longest = allDescs.reduce((a, b) => (b.length > a.length ? b : a), '')

    const grades = [...group.descriptions.keys()]
    const gradeNums = grades.filter((g) => g !== 'K').map(Number).filter((n) => !isNaN(n))
    const minGrade = grades.includes('K') ? 'K' : String(Math.min(...gradeNums))
    const maxGrade = gradeNums.length > 0 ? String(Math.max(...gradeNums)) : 'K'

    const skill: SkillInsert = {
      school_id: schoolId,
      name: `${strandLabel} ${stdNum}: ${truncate(longest, 60)}`,
      description: longest,
      category: 'English Language Arts',
      min_grade: minGrade,
      max_grade: maxGrade,
      is_default: true,
      is_assessable: true,
      source_framework: 'ccss_ela',
      source_standard_code: `CCSS.ELA.${strand}.${stdNum}`,
      progression_domain: strandLabel,
      progression_strand: `Standard ${stdNum}`,
    }

    skills.push(skill)

    const skillSteps: Omit<SkillProgressionStepInsert, 'skill_id'>[] = []
    for (const [grade, descriptions] of group.descriptions) {
      const unique = [...new Set(descriptions)]
      // Keep longest description as the primary expectation
      const best = unique.reduce((a, b) => (b.length > a.length ? b : a), '')

      skillSteps.push({
        school_id: schoolId,
        grade_level: grade,
        expectation_description: best,
        example_tasks: null,
        prerequisite_step_id: null,
        competency_ids: [],
      })
    }

    steps.set(String(idx), skillSteps)
    idx++
  }

  return { skills, steps }
}

/**
 * Parse CASEL SEL JSON into skills + steps.
 * Each standard becomes a skill. Grade bands map to grade levels.
 */
export function parseCASEL(
  jsonData: { standards: CASELStandard[] },
  schoolId: string
): ParsedFramework {
  const skills: SkillInsert[] = []
  const steps = new Map<string, Omit<SkillProgressionStepInsert, 'skill_id'>[]>()

  let idx = 0
  for (const std of jsonData.standards) {
    const skill: SkillInsert = {
      school_id: schoolId,
      name: std.description,
      description: std.competency_definition,
      category: 'Social-Emotional Learning',
      min_grade: 'K',
      max_grade: '10',
      is_default: true,
      is_assessable: true,
      source_framework: 'casel',
      source_standard_code: std.code,
      progression_domain: std.competency.replace(/_/g, ' '),
      progression_strand: null,
    }

    skills.push(skill)

    const skillSteps: Omit<SkillProgressionStepInsert, 'skill_id'>[] = []
    for (const [band, description] of Object.entries(std.grade_band_progressions)) {
      const gradeLevel = CASEL_BAND_TO_GRADE[band]
      if (!gradeLevel) continue

      skillSteps.push({
        school_id: schoolId,
        grade_level: gradeLevel,
        expectation_description: description,
        example_tasks: null,
        prerequisite_step_id: null,
        competency_ids: [],
      })
    }

    steps.set(String(idx), skillSteps)
    idx++
  }

  return { skills, steps }
}

// ============================================================
// Main seeding function
// ============================================================

/**
 * Seed default skill progressions for a school.
 * Fetches the JSON standards files from /standards/ and inserts skills
 * with progression steps. Skips skills that already exist (by source_standard_code).
 */
export async function seedDefaultSkillProgressions(
  schoolId: string,
  frameworks: ('ccss_math' | 'ccss_ela' | 'casel')[]
): Promise<{ skillsCreated: number; stepsCreated: number }> {
  let totalSkills = 0
  let totalSteps = 0

  // Fetch existing skills for this school to avoid duplicates
  const { data: existingSkills } = await supabase
    .from('skills')
    .select('source_standard_code')
    .eq('school_id', schoolId)
    .eq('is_default', true)
    .not('source_standard_code', 'is', null)

  const existingCodes = new Set(
    (existingSkills ?? []).map((s: { source_standard_code: string | null }) => s.source_standard_code)
  )

  for (const fw of frameworks) {
    const parsed = await fetchAndParse(fw, schoolId)
    if (!parsed) continue

    // Insert skills one by one so we can get back their IDs for steps
    for (let i = 0; i < parsed.skills.length; i++) {
      const skill = parsed.skills[i]
      const stepsForSkill = parsed.steps.get(String(i)) ?? []

      // Skip if this standard code already exists
      if (skill.source_standard_code && existingCodes.has(skill.source_standard_code)) {
        continue
      }

      // Insert skill
      const { data: row, error } = await supabase
        .from('skills')
        .insert(skill)
        .select('id')
        .single()

      if (error || !row) {
        console.error(`Failed to insert skill "${skill.name}":`, error?.message)
        continue
      }

      totalSkills++

      // Insert steps
      if (stepsForSkill.length > 0) {
        const stepsWithSkillId: SkillProgressionStepInsert[] = stepsForSkill.map((s) => ({
          ...s,
          skill_id: row.id,
        }))

        const { error: stepErr } = await supabase
          .from('skill_progression_steps')
          .insert(stepsWithSkillId)

        if (stepErr) {
          console.error(`Failed to insert steps for "${skill.name}":`, stepErr.message)
        } else {
          totalSteps += stepsWithSkillId.length
        }
      }
    }
  }

  return { skillsCreated: totalSkills, stepsCreated: totalSteps }
}

// ============================================================
// Custom progression import
// ============================================================

/**
 * Import custom skill progressions from a structured input.
 * Schools can define their own frameworks with this function.
 */
export async function importCustomProgression(
  schoolId: string,
  data: {
    skill_name: string
    category: string
    domain?: string
    strand?: string
    steps: { grade_level: string; expectation: string; examples?: string }[]
  }[]
): Promise<{ skillsCreated: number; stepsCreated: number }> {
  let totalSkills = 0
  let totalSteps = 0

  for (const item of data) {
    const skill: SkillInsert = {
      school_id: schoolId,
      name: item.skill_name,
      description: null,
      category: item.category,
      is_default: false,
      is_assessable: true,
      source_framework: 'custom',
      progression_domain: item.domain ?? null,
      progression_strand: item.strand ?? null,
    }

    const { data: row, error } = await supabase
      .from('skills')
      .insert(skill)
      .select('id')
      .single()

    if (error || !row) {
      console.error(`Failed to import skill "${item.skill_name}":`, error?.message)
      continue
    }

    totalSkills++

    if (item.steps.length > 0) {
      const steps: SkillProgressionStepInsert[] = item.steps.map((s) => ({
        skill_id: row.id,
        school_id: schoolId,
        grade_level: s.grade_level,
        expectation_description: s.expectation,
        example_tasks: s.examples ?? null,
        prerequisite_step_id: null,
        competency_ids: [],
      }))

      const { error: stepErr } = await supabase
        .from('skill_progression_steps')
        .insert(steps)

      if (stepErr) {
        console.error(`Failed to import steps for "${item.skill_name}":`, stepErr.message)
      } else {
        totalSteps += steps.length
      }
    }
  }

  return { skillsCreated: totalSkills, stepsCreated: totalSteps }
}

// ============================================================
// Internal helpers
// ============================================================

async function fetchAndParse(
  framework: 'ccss_math' | 'ccss_ela' | 'casel',
  schoolId: string
): Promise<ParsedFramework | null> {
  const fileMap: Record<string, string> = {
    ccss_math: '/standards/ccss_math.json',
    ccss_ela: '/standards/ccss_ela.json',
    casel: '/standards/casel.json',
  }

  const url = fileMap[framework]
  if (!url) return null

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()

    switch (framework) {
      case 'ccss_math':
        return parseCCSSMath(json, schoolId)
      case 'ccss_ela':
        return parseCCSSELA(json, schoolId)
      case 'casel':
        return parseCASEL(json, schoolId)
      default:
        return null
    }
  } catch (err) {
    console.error(`Failed to fetch ${framework} standards:`, err)
    return null
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

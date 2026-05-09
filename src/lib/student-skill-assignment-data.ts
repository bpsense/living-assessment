// student-skill-assignment-data.ts
//
// V2 per-student skill assignment helpers. A row in `student_skill_assignments`
// represents "this student is currently working on this skill" — created
// either via a project (`source = 'project'`) or directly from a student
// profile (`source = 'standalone'`).
//
// The matching assessment helpers live in skill-assessment-data.ts.

import { supabase } from './supabase'
import type {
  StudentSkillAssignment,
  StudentSkillAssignmentInsert,
  StudentSkillAssignmentSource,
  StudentSkillAssignmentStatus,
} from '../types/skill-assessment'
import type { Skill } from '../types/database'

// ============================================================
// Composite types
// ============================================================

export interface StudentSkillAssignmentWithSkill extends StudentSkillAssignment {
  skill: Skill
}

// ============================================================
// Standalone assignment
// ============================================================

/**
 * Assign one or more skills to a student outside the context of a project.
 * Idempotent on (student_id, skill_id, status='active'): existing active
 * standalone assignments are returned as-is; only new pairs are inserted.
 */
export async function assignSkillsStandalone(
  studentId: string,
  skillIds: string[],
  assignedBy: string
): Promise<StudentSkillAssignment[]> {
  if (skillIds.length === 0) return []

  const { data: existing, error: existingErr } = await supabase
    .from('student_skill_assignments')
    .select('*')
    .eq('student_id', studentId)
    .eq('source', 'standalone')
    .in('skill_id', skillIds)
    .eq('status', 'active')

  if (existingErr) throw existingErr

  const existingBySkill = new Map<string, StudentSkillAssignment>()
  for (const r of (existing ?? []) as StudentSkillAssignment[]) {
    existingBySkill.set(r.skill_id, r)
  }

  const toInsert: StudentSkillAssignmentInsert[] = skillIds
    .filter((id) => !existingBySkill.has(id))
    .map((id) => ({
      student_id: studentId,
      skill_id: id,
      assigned_by: assignedBy,
      source: 'standalone' as StudentSkillAssignmentSource,
      source_assignment_id: null,
      status: 'active',
    }))

  let inserted: StudentSkillAssignment[] = []
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('student_skill_assignments')
      .insert(toInsert)
      .select('*')
    if (error) throw error
    inserted = (data ?? []) as StudentSkillAssignment[]
  }

  return [...existingBySkill.values(), ...inserted]
}

// ============================================================
// Project-driven auto-assignment
// ============================================================

/**
 * For a freshly assigned project, create one student_skill_assignment per
 * (student × skill tagged on the project). Skipped pairs:
 *   * a row with the same (student, skill, source_assignment_id) already
 *     exists (the partial unique index would reject it anyway).
 * Returns the list of newly inserted rows.
 */
export async function assignProjectSkillsToStudents(args: {
  projectId: string
  studentIds: string[]
  assignedBy: string
}): Promise<StudentSkillAssignment[]> {
  const { projectId, studentIds, assignedBy } = args
  if (studentIds.length === 0) return []

  // Resolve the skills tagged to this project.
  const { data: links, error: linkErr } = await supabase
    .from('assignment_skills')
    .select('skill_id')
    .eq('assignment_id', projectId)
  if (linkErr) throw linkErr

  const skillIds = [...new Set((links ?? []).map((r: { skill_id: string }) => r.skill_id))]
  if (skillIds.length === 0) return []

  // Find any existing project-sourced rows for this same project, so we don't
  // re-insert and trip the unique index.
  const { data: existing, error: existingErr } = await supabase
    .from('student_skill_assignments')
    .select('student_id, skill_id')
    .eq('source_assignment_id', projectId)
    .in('student_id', studentIds)
    .in('skill_id', skillIds)
  if (existingErr) throw existingErr

  const seen = new Set<string>()
  for (const r of (existing ?? []) as { student_id: string; skill_id: string }[]) {
    seen.add(`${r.student_id}|${r.skill_id}`)
  }

  const toInsert: StudentSkillAssignmentInsert[] = []
  for (const studentId of studentIds) {
    for (const skillId of skillIds) {
      if (seen.has(`${studentId}|${skillId}`)) continue
      toInsert.push({
        student_id: studentId,
        skill_id: skillId,
        assigned_by: assignedBy,
        source: 'project',
        source_assignment_id: projectId,
        status: 'active',
      })
    }
  }

  if (toInsert.length === 0) return []

  const { data, error } = await supabase
    .from('student_skill_assignments')
    .insert(toInsert)
    .select('*')
  if (error) throw error
  return (data ?? []) as StudentSkillAssignment[]
}

// ============================================================
// Listing
// ============================================================

export interface StudentSkillAssignmentFilters {
  /** Inclusive age window — filters skills whose age band overlaps. */
  ageBandStart?: number
  ageBandEnd?: number
  /** Default: only 'active'. Pass 'all' to include completed/dropped. */
  status?: StudentSkillAssignmentStatus | 'all'
  /** Filter to project-sourced or standalone-sourced rows. */
  source?: StudentSkillAssignmentSource
}

/**
 * Fetch a student's skill assignments, joined with the skill row.
 * Age-band filter applies client-side.
 */
export async function getAssignmentsForStudent(
  studentId: string,
  filters: StudentSkillAssignmentFilters = {}
): Promise<StudentSkillAssignmentWithSkill[]> {
  let q = supabase
    .from('student_skill_assignments')
    .select('*, skill:skills(*)')
    .eq('student_id', studentId)
    .order('assigned_at', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  } else if (!filters.status) {
    q = q.eq('status', 'active')
  }
  if (filters.source) {
    q = q.eq('source', filters.source)
  }

  const { data, error } = await q
  if (error) throw error

  type Row = StudentSkillAssignment & { skill: Skill | null }
  const rows = ((data ?? []) as Row[]).filter((r): r is Row & { skill: Skill } => !!r.skill)

  let filtered = rows
  // Age-band overlap filter.
  if (filters.ageBandStart !== undefined || filters.ageBandEnd !== undefined) {
    const start = filters.ageBandStart
    const end = filters.ageBandEnd
    filtered = filtered.filter((r) => ageBandOverlaps(r.skill, start, end))
  }

  return filtered.map((r) => ({
    ...r,
    skill: r.skill,
  }))
}

// ============================================================
// Status updates
// ============================================================

export async function setAssignmentStatus(
  id: string,
  status: StudentSkillAssignmentStatus
): Promise<void> {
  const { error } = await supabase
    .from('student_skill_assignments')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
// Helpers
// ============================================================

function ageBandOverlaps(
  skill: Pick<Skill, 'age_band_start' | 'age_band_end'>,
  start: number | undefined,
  end: number | undefined
): boolean {
  if (skill.age_band_start === null && skill.age_band_end === null) return true
  if (start === undefined && end === undefined) return true
  const skillStart = skill.age_band_start ?? Number.NEGATIVE_INFINITY
  const skillEnd = skill.age_band_end ?? Number.POSITIVE_INFINITY
  const filterStart = start ?? Number.NEGATIVE_INFINITY
  const filterEnd = end ?? Number.POSITIVE_INFINITY
  return skillStart <= filterEnd && skillEnd >= filterStart
}

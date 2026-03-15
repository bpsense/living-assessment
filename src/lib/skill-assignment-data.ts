/**
 * skill-assignment-data.ts
 * Data layer for discrete skill assignments. Handles creating, grading,
 * differentiating, and querying skill assignments and student records.
 * Grades bridge into the competency scoring pipe via competency_scores.
 */

import { supabase } from './supabase'
import { isAboveGrade } from './skill-progression-data'
import type {
  SkillAssignmentInsert,
  SkillAssignmentUpdate,
  SkillAssignmentStatus,
  SkillAssignmentWithDetails,
  StudentSkillAssignmentInsert,
  StudentSkillAssignmentStatus,
  StudentSkillAssignmentWithStudent,
  SkillProgressionStep,
  Skill,
  CompetencyScoreInsert,
} from '../types/database'

// ============================================================
// Create
// ============================================================

/**
 * Create a skill assignment (class or individual) and generate
 * student_skill_assignment rows for each student.
 *
 * For each student, determines if the assigned step is above their
 * grade level and sets is_above_grade accordingly.
 */
export async function createSkillAssignment(
  data: SkillAssignmentInsert,
  studentIds: string[]
): Promise<string> {
  // 1. Create the skill_assignment row
  const { data: row, error } = await supabase
    .from('skill_assignments')
    .insert(data)
    .select('id')
    .single()

  if (error || !row) {
    throw new Error(`Failed to create skill assignment: ${error?.message}`)
  }

  const assignmentId = row.id

  if (studentIds.length === 0) return assignmentId

  // 2. Fetch the assigned step's grade_level
  const { data: stepData, error: stepErr } = await supabase
    .from('skill_progression_steps')
    .select('grade_level')
    .eq('id', data.assigned_step_id)
    .single()

  if (stepErr || !stepData) {
    throw new Error(`Failed to fetch step: ${stepErr?.message}`)
  }

  const stepGrade = stepData.grade_level

  // 3. Fetch student grade levels
  const { data: students, error: stuErr } = await supabase
    .from('students')
    .select('id, grade_level')
    .in('id', studentIds)

  if (stuErr) {
    throw new Error(`Failed to fetch students: ${stuErr.message}`)
  }

  // 4. Build student_skill_assignment rows
  const ssaRows: StudentSkillAssignmentInsert[] = (students ?? []).map((s) => ({
    skill_assignment_id: assignmentId,
    student_id: s.id,
    student_step_id: data.assigned_step_id,
    status: 'assigned' as const,
    score: null,
    scored_by: null,
    scored_at: null,
    notes: null,
    is_above_grade: isAboveGrade(stepGrade, s.grade_level ?? ''),
  }))

  const { error: ssaErr } = await supabase
    .from('student_skill_assignments')
    .insert(ssaRows)

  if (ssaErr) {
    throw new Error(`Failed to create student assignments: ${ssaErr.message}`)
  }

  return assignmentId
}

// ============================================================
// Differentiate
// ============================================================

/**
 * Change a specific student's step to a different grade level.
 * Recalculates is_above_grade based on the new step.
 */
export async function differentiateStudentStep(
  studentSkillAssignmentId: string,
  newStepId: string,
  studentGradeLevel: string
): Promise<void> {
  // Fetch the new step's grade_level
  const { data: stepData, error: stepErr } = await supabase
    .from('skill_progression_steps')
    .select('grade_level')
    .eq('id', newStepId)
    .single()

  if (stepErr || !stepData) {
    throw new Error(`Failed to fetch step: ${stepErr?.message}`)
  }

  const { error } = await supabase
    .from('student_skill_assignments')
    .update({
      student_step_id: newStepId,
      is_above_grade: isAboveGrade(stepData.grade_level, studentGradeLevel),
    })
    .eq('id', studentSkillAssignmentId)

  if (error) {
    throw new Error(`Failed to differentiate step: ${error.message}`)
  }
}

// ============================================================
// Grade
// ============================================================

/**
 * Grade a student's skill assignment.
 * - Updates the student_skill_assignment with score, notes, status
 * - For each competency mapped to the step, inserts a competency_score
 *   with source='skill_assessment' and the is_above_grade flag
 */
export async function gradeSkillAssignment(
  studentSkillAssignmentId: string,
  score: number,
  notes: string | null,
  scoredBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch the student_skill_assignment with its step's competency_ids
    const { data: ssa, error: ssaErr } = await supabase
      .from('student_skill_assignments')
      .select('*, step:skill_progression_steps!student_skill_assignments_student_step_id_fkey(*), parent:skill_assignments!student_skill_assignments_skill_assignment_id_fkey(school_id)')
      .eq('id', studentSkillAssignmentId)
      .single()

    if (ssaErr || !ssa) {
      return { success: false, error: `Assignment not found: ${ssaErr?.message}` }
    }

    const now = new Date().toISOString()

    // 2. Update student_skill_assignment
    const { error: updateErr } = await supabase
      .from('student_skill_assignments')
      .update({
        score,
        scored_by: scoredBy,
        scored_at: now,
        status: 'graded' as const,
        notes,
      })
      .eq('id', studentSkillAssignmentId)

    if (updateErr) {
      return { success: false, error: `Failed to save score: ${updateErr.message}` }
    }

    // 3. Bridge into competency_scores for each mapped competency
    const step = (ssa as any).step as SkillProgressionStep | null
    const parent = (ssa as any).parent as { school_id: string } | null
    const competencyIds: string[] = step?.competency_ids ?? []
    const schoolId = parent?.school_id

    if (competencyIds.length > 0 && schoolId) {
      const scoreRows: CompetencyScoreInsert[] = competencyIds.map((compId) => ({
        student_skill_assignment_id: studentSkillAssignmentId,
        student_assignment_id: null,
        competency_id: compId,
        student_id: ssa.student_id,
        school_id: schoolId,
        score,
        source: 'skill_assessment' as const,
        is_above_grade: ssa.is_above_grade ?? false,
        notes,
        scored_at: now,
      }))

      const { error: scoreErr } = await supabase
        .from('competency_scores')
        .insert(scoreRows)

      if (scoreErr) {
        // Score was saved but bridge failed — log but don't fail
        console.error('Failed to bridge competency scores:', scoreErr.message)
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// Fetch: classroom skill assignments
// ============================================================

/** Fetch skill assignments for a classroom with full details. */
export async function fetchSkillAssignments(
  schoolId: string,
  classroomId: string,
  filters?: { status?: SkillAssignmentStatus; skillId?: string }
): Promise<SkillAssignmentWithDetails[]> {
  let query = supabase
    .from('skill_assignments')
    .select(`
      *,
      skill:skills(*),
      assigned_step:skill_progression_steps!skill_assignments_assigned_step_id_fkey(*),
      assignor:profiles!skill_assignments_assigned_by_fkey(full_name),
      student_assignments:student_skill_assignments(
        *,
        student:students!student_skill_assignments_student_id_fkey(id, first_name, last_name, grade_level),
        step:skill_progression_steps!student_skill_assignments_student_step_id_fkey(*)
      )
    `)
    .eq('school_id', schoolId)
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.skillId) {
    query = query.eq('skill_id', filters.skillId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch skill assignments: ${error.message}`)

  return (data ?? []).map(mapSkillAssignment)
}

/** Fetch a single skill assignment with all student records. */
export async function fetchSkillAssignment(
  assignmentId: string
): Promise<SkillAssignmentWithDetails> {
  const { data, error } = await supabase
    .from('skill_assignments')
    .select(`
      *,
      skill:skills(*),
      assigned_step:skill_progression_steps!skill_assignments_assigned_step_id_fkey(*),
      assignor:profiles!skill_assignments_assigned_by_fkey(full_name),
      student_assignments:student_skill_assignments(
        *,
        student:students!student_skill_assignments_student_id_fkey(id, first_name, last_name, grade_level),
        step:skill_progression_steps!student_skill_assignments_student_step_id_fkey(*)
      )
    `)
    .eq('id', assignmentId)
    .single()

  if (error || !data) {
    throw new Error(`Skill assignment not found: ${error?.message}`)
  }

  return mapSkillAssignment(data)
}

// ============================================================
// Fetch: student skill assignments
// ============================================================

/** Fetch all skill assignments for a specific student. */
export async function fetchStudentSkillAssignments(
  studentId: string,
  filters?: { status?: StudentSkillAssignmentStatus }
): Promise<StudentSkillAssignmentWithStudent[]> {
  let query = supabase
    .from('student_skill_assignments')
    .select(`
      *,
      student:students!student_skill_assignments_student_id_fkey(id, first_name, last_name, grade_level),
      step:skill_progression_steps!student_skill_assignments_student_step_id_fkey(*)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch student skills: ${error.message}`)

  return (data ?? []).map((row: any) => ({
    ...row,
    student: row.student,
    step: row.step,
  }))
}

// ============================================================
// Update / status transitions
// ============================================================

/** Update a skill assignment. */
export async function updateSkillAssignment(
  id: string,
  data: SkillAssignmentUpdate
): Promise<void> {
  const { error } = await supabase
    .from('skill_assignments')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(`Failed to update skill assignment: ${error.message}`)
}

/** Mark a skill assignment as completed. */
export async function completeSkillAssignment(id: string): Promise<void> {
  return updateSkillAssignment(id, { status: 'completed' })
}

// ============================================================
// Helpers
// ============================================================

function mapSkillAssignment(row: any): SkillAssignmentWithDetails {
  return {
    ...row,
    skill: row.skill as Skill,
    assigned_step: row.assigned_step as SkillProgressionStep,
    assignor_name: row.assignor?.full_name ?? 'Unknown',
    student_assignments: (row.student_assignments ?? []).map((sa: any) => ({
      ...sa,
      student: sa.student,
      step: sa.step,
    })) as StudentSkillAssignmentWithStudent[],
  }
}

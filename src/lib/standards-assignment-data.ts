/**
 * standards-assignment-data.ts
 *
 * Data layer for the standards-driven assignment refactor.
 *
 * Vehicles ("assignments") carry standards (Boundless framework) and per-
 * (student × standard) competency-level assessments. Snapshot-on-assign:
 * each student's set of standards is copied at assign time, so personalizing
 * one student doesn't affect others, and parent edits don't propagate.
 *
 * Append-only assessments: every recorded rating is a new row. The latest
 * row per (student, standard) is "current"; the full series powers the
 * amoeba's monthly timeline.
 */
import { supabase } from './supabase'
import type {
  Assignment,
  AssignmentInsert,
  AssignmentStatus,
  AssignmentType,
  StudentAssignment,
  StudentAssignmentStatus,
  Standard,
  Student,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export const ASSESSMENT_LEVELS = ['emerging', 'developing', 'achieving', 'mastery'] as const
export type AssessmentLevel = (typeof ASSESSMENT_LEVELS)[number]

/** Numeric score (1–4) for amoeba/dimension rollup. */
export const LEVEL_SCORE: Record<AssessmentLevel, number> = {
  emerging: 1,
  developing: 2,
  achieving: 3,
  mastery: 4,
}

export interface AssignmentStandardLink {
  id: string
  assignment_id: string
  standard_id: string
  created_at: string
}

export interface StudentAssignmentStandardLink {
  id: string
  student_assignment_id: string
  standard_id: string
  created_at: string
}

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
}

export interface StandardAssessmentInsert {
  student_assignment_id: string
  student_id: string
  school_id: string
  standard_id: string
  level: AssessmentLevel
  notes?: string | null
  assessor_id: string
  assessed_at?: string
}

/** A student's view of an assigned project: parent fields + their own snapshot. */
export interface StudentAssignmentView {
  student_assignment_id: string
  assignment_id: string
  student_id: string
  status: StudentAssignmentStatus
  title: string                 // personalized_title ?? parent.title
  description: string | null    // personalized_description ?? parent.description
  due_date: string | null
  assignment_status: AssignmentStatus
  assignment_type: AssignmentType
  classroom_id: string | null
  teacher_id: string
  school_id: string
  /** Whether this student's snapshot diverges from the parent's standards. */
  is_personalized: boolean
  /** The student's snapshot of standards for this assignment. */
  standards: Standard[]
}

// ============================================================
// Create / Assign
// ============================================================

/**
 * Create an assignment, link standards, assign students.
 * The DB trigger `trg_snapshot_assignment_standards` populates
 * `student_assignment_standards` with a copy of the parent set when
 * each `student_assignments` row is inserted.
 */
export async function createStandardsAssignment(args: {
  assignment: AssignmentInsert
  standardIds: string[]
  studentIds: string[]
}): Promise<string> {
  const { assignment, standardIds, studentIds } = args

  const { data: created, error: aErr } = await supabase
    .from('assignments')
    .insert(assignment)
    .select('id')
    .single()
  if (aErr || !created) throw new Error(`Failed to create assignment: ${aErr?.message}`)
  const assignmentId = created.id

  if (standardIds.length > 0) {
    const { error } = await supabase
      .from('assignment_standards')
      .insert(standardIds.map((standard_id) => ({ assignment_id: assignmentId, standard_id })))
    if (error) throw new Error(`Failed to link standards: ${error.message}`)
  }

  if (studentIds.length > 0) {
    const { error } = await supabase
      .from('student_assignments')
      .insert(studentIds.map((student_id) => ({ assignment_id: assignmentId, student_id })))
    if (error) throw new Error(`Failed to assign students: ${error.message}`)
  }

  return assignmentId
}

/** Mark the parent assignment complete — drops it from "Assigned to Me" for all students. */
export async function completeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId)
  if (error) throw error
}

// ============================================================
// Personalization (edit a student's snapshot)
// ============================================================

export async function personalizeText(
  studentAssignmentId: string,
  fields: { title?: string | null; description?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (fields.title !== undefined) update.personalized_title = fields.title
  if (fields.description !== undefined) update.personalized_description = fields.description
  if (Object.keys(update).length === 0) return

  const { error } = await supabase
    .from('student_assignments')
    .update(update)
    .eq('id', studentAssignmentId)
  if (error) throw error
}

export async function addStandardsToStudent(
  studentAssignmentId: string,
  standardIds: string[]
): Promise<void> {
  if (standardIds.length === 0) return
  const { error } = await supabase
    .from('student_assignment_standards')
    .insert(standardIds.map((standard_id) => ({ student_assignment_id: studentAssignmentId, standard_id })))
  if (error) throw error
}

export async function removeStandardsFromStudent(
  studentAssignmentId: string,
  standardIds: string[]
): Promise<void> {
  if (standardIds.length === 0) return
  const { error } = await supabase
    .from('student_assignment_standards')
    .delete()
    .eq('student_assignment_id', studentAssignmentId)
    .in('standard_id', standardIds)
  if (error) throw error
}

// ============================================================
// Read paths
// ============================================================

interface StudentAssignmentRow extends StudentAssignment {
  personalized_title: string | null
  personalized_description: string | null
  assignment: Assignment & { school_id: string }
  student_assignment_standards: { standard: Standard }[]
}

/** Active assignments for a single student (for "Assigned to Me"). */
export async function getActiveAssignmentsForStudent(
  studentId: string
): Promise<StudentAssignmentView[]> {
  const { data, error } = await supabase
    .from('student_assignments')
    .select(
      `id, assignment_id, student_id, status, personalized_title, personalized_description,
       assignment:assignment_id (
         id, school_id, classroom_id, teacher_id, title, description, due_date,
         assignment_type, status
       ),
       student_assignment_standards (
         standard:standard_id ( id, framework_id, school_id, code, description, grade_level,
                                parent_id, display_order, created_at, updated_at )
       )`
    )
    .eq('student_id', studentId)
    .neq('status', 'graded')
    .returns<StudentAssignmentRow[]>()

  if (error) throw error
  return (data ?? [])
    .filter((row) => row.assignment.status === 'active')
    .map(toStudentAssignmentView)
}

/** Active assignments for a classroom — for the educator's classroom view panel. */
export async function getActiveAssignmentsForClassroom(
  classroomId: string
): Promise<Array<Assignment & { student_count: number; standards_count: number }>> {
  const { data, error } = await supabase
    .from('assignments')
    .select(
      `id, school_id, classroom_id, teacher_id, title, description, due_date,
       assignment_type, status, template_id, project_data, created_at, updated_at,
       assignment_standards(count),
       student_assignments(count)`
    )
    .eq('classroom_id', classroomId)
    .eq('status', 'active')

  if (error) throw error
  return (data ?? []).map((a) => ({
    ...(a as unknown as Assignment),
    student_count: (a.student_assignments?.[0]?.count as number | undefined) ?? 0,
    standards_count: (a.assignment_standards?.[0]?.count as number | undefined) ?? 0,
  }))
}

/** Per-student rosters for an assignment, with their snapshot of standards. */
export async function getStudentRosterForAssignment(
  assignmentId: string
): Promise<
  Array<{
    student_assignment_id: string
    student: Student
    is_personalized: boolean
    standards: Standard[]
  }>
> {
  const { data, error } = await supabase
    .from('student_assignments')
    .select(
      `id,
       personalized_title, personalized_description,
       student:student_id ( id, school_id, first_name, last_name, grade_level, date_of_birth,
                            avatar_url, student_number, status, created_at, updated_at ),
       student_assignment_standards (
         standard:standard_id ( id, framework_id, school_id, code, description, grade_level,
                                parent_id, display_order, created_at, updated_at )
       )`
    )
    .eq('assignment_id', assignmentId)

  if (error) throw error

  // Determine per-student personalization by comparing standards to parent.
  const { data: parentStdRows, error: psErr } = await supabase
    .from('assignment_standards')
    .select('standard_id')
    .eq('assignment_id', assignmentId)
  if (psErr) throw psErr
  const parentSet = new Set((parentStdRows ?? []).map((r) => r.standard_id))

  return (data ?? []).map((row) => {
    const studentRow = row as unknown as {
      id: string
      personalized_title: string | null
      personalized_description: string | null
      student: Student
      student_assignment_standards: { standard: Standard }[]
    }
    const studentStandards = studentRow.student_assignment_standards.map((s) => s.standard)
    const studentSet = new Set(studentStandards.map((s) => s.id))
    const standardsDiverge =
      studentSet.size !== parentSet.size ||
      [...studentSet].some((id) => !parentSet.has(id))
    const textPersonalized =
      studentRow.personalized_title !== null || studentRow.personalized_description !== null
    return {
      student_assignment_id: studentRow.id,
      student: studentRow.student,
      is_personalized: standardsDiverge || textPersonalized,
      standards: studentStandards,
    }
  })
}

// ============================================================
// Quick Observations (ad-hoc, snapshot-driven)
// ============================================================

/**
 * Returns the student_assignment_id to attach a quick (ad-hoc) observation to.
 * Finds-or-creates a per-student "Quick Observations" parent assignment,
 * ensures the student is enrolled, and ensures the standard exists in the
 * student's snapshot. Idempotent.
 *
 * The marker is `assignments.project_data.quick_observations = true`.
 */
export async function findOrCreateQuickObsStudentAssignment(args: {
  studentId: string
  schoolId: string
  educatorId: string
  standardId: string
}): Promise<string> {
  const { studentId, schoolId, educatorId, standardId } = args

  // 1. Find an existing student_assignment whose parent assignment is the
  //    quick-obs marker. We pull candidates by student + school, then filter
  //    by the parent's project_data flag client-side (project_data is JSONB).
  const { data: existingSARows, error: saErr } = await supabase
    .from('student_assignments')
    .select(
      'id, assignment:assignments!inner(id, school_id, project_data, status)'
    )
    .eq('student_id', studentId)
  if (saErr) throw saErr

  type Row = {
    id: string
    assignment: {
      id: string
      school_id: string
      project_data: Record<string, unknown> | null
      status: string
    }
  }
  const rows = (existingSARows ?? []) as unknown as Row[]
  const existing = rows.find(
    (r) =>
      r.assignment.school_id === schoolId &&
      (r.assignment.project_data as { quick_observations?: boolean } | null)
        ?.quick_observations === true
  )

  let studentAssignmentId: string
  if (existing) {
    studentAssignmentId = existing.id
  } else {
    // Create the parent assignment + student row in sequence. The DB trigger
    // snapshots assignment_standards into student_assignment_standards on
    // insert — for quick-obs the parent set stays empty and we manage the
    // student's snapshot directly below.
    const { data: created, error: aErr } = await supabase
      .from('assignments')
      .insert({
        school_id: schoolId,
        teacher_id: educatorId,
        classroom_id: null,
        title: 'Quick Observations',
        description: 'Ad-hoc observations recorded outside an assignment.',
        assignment_type: 'individual',
        status: 'active',
        project_data: { quick_observations: true },
      })
      .select('id')
      .single()
    if (aErr || !created) throw new Error(`Failed to create quick-obs assignment: ${aErr?.message}`)

    const { data: saCreated, error: saInsErr } = await supabase
      .from('student_assignments')
      .insert({ assignment_id: created.id, student_id: studentId })
      .select('id')
      .single()
    if (saInsErr || !saCreated)
      throw new Error(`Failed to assign student to quick-obs: ${saInsErr?.message}`)
    studentAssignmentId = saCreated.id
  }

  // 2. Ensure the standard is on the student's snapshot for this assignment.
  const { data: standardRows, error: standardErr } = await supabase
    .from('student_assignment_standards')
    .select('id')
    .eq('student_assignment_id', studentAssignmentId)
    .eq('standard_id', standardId)
    .limit(1)
  if (standardErr) throw standardErr
  if ((standardRows ?? []).length === 0) {
    const { error: insErr } = await supabase
      .from('student_assignment_standards')
      .insert({ student_assignment_id: studentAssignmentId, standard_id: standardId })
    if (insErr) throw insErr
  }

  return studentAssignmentId
}

// ============================================================
// Assessments (append-only)
// ============================================================

export async function recordStandardAssessments(
  rows: StandardAssessmentInsert[]
): Promise<StandardAssessment[]> {
  if (rows.length === 0) return []
  const { data, error } = await supabase
    .from('assignment_standard_assessments')
    .insert(rows)
    .select('*')
    .returns<StandardAssessment[]>()
  if (error) throw error
  return data ?? []
}

/** Latest assessment per (student × standard) — drives "current" amoeba state. */
export async function getLatestAssessmentsByStudent(
  studentId: string
): Promise<Map<string, StandardAssessment>> {
  // Pull the full series ordered desc, fold to first-seen-per-standard.
  const { data, error } = await supabase
    .from('assignment_standard_assessments')
    .select('*')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false })
    .returns<StandardAssessment[]>()
  if (error) throw error

  const out = new Map<string, StandardAssessment>()
  for (const row of data ?? []) {
    if (!out.has(row.standard_id)) out.set(row.standard_id, row)
  }
  return out
}

// ============================================================
// Helpers
// ============================================================

function toStudentAssignmentView(row: StudentAssignmentRow): StudentAssignmentView {
  return {
    student_assignment_id: row.id,
    assignment_id: row.assignment_id,
    student_id: row.student_id,
    status: row.status,
    title: row.personalized_title ?? row.assignment.title,
    description: row.personalized_description ?? row.assignment.description,
    due_date: row.assignment.due_date,
    assignment_status: row.assignment.status,
    assignment_type: row.assignment.assignment_type,
    classroom_id: row.assignment.classroom_id,
    teacher_id: row.assignment.teacher_id,
    school_id: row.assignment.school_id,
    is_personalized:
      row.personalized_title !== null || row.personalized_description !== null,
    standards: row.student_assignment_standards.map((s) => s.standard),
  }
}

export function formatLevel(level: AssessmentLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

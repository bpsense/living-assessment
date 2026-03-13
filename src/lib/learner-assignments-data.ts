import { supabase } from './supabase'
import type {
  LearnerColumn,
  StudentAssignment,
  StudentAssignmentStatus,
  Assignment,
  AssignmentCompetency,
  AssignmentSkill,
  Competency,
  Skill,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface LearnerAssignment extends StudentAssignment {
  assignment: Assignment & {
    assignment_competencies: (AssignmentCompetency & { competency: Competency })[]
    assignment_skills: (AssignmentSkill & { skill: Skill })[]
  }
}

export type KanbanColumn = LearnerColumn | 'complete'

export interface KanbanGroup {
  column: KanbanColumn
  label: string
  items: LearnerAssignment[]
}

// ============================================================
// Column metadata
// ============================================================

export const KANBAN_COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: 'on_deck', label: 'On Deck' },
  { key: 'researching', label: 'Researching' },
  { key: 'actively_exploring', label: 'Actively Exploring' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'complete', label: 'Complete' },
]

// ============================================================
// Fetch Operations
// ============================================================

/**
 * Fetch all assignments for a learner with full details needed for kanban cards.
 */
export async function fetchLearnerAssignments(studentId: string): Promise<LearnerAssignment[]> {
  const { data, error } = await supabase
    .from('student_assignments')
    .select(`
      *,
      assignment:assignments(
        *,
        assignment_competencies(*, competency:competencies(*)),
        assignment_skills(*, skill:skills(*))
      )
    `)
    .eq('student_id', studentId)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('[fetchLearnerAssignments] query failed:', error.message)
    throw error
  }

  return (data || []).map((row: any) => ({
    ...row,
    assignment: {
      ...row.assignment,
      assignment_competencies: row.assignment?.assignment_competencies || [],
      assignment_skills: row.assignment?.assignment_skills || [],
    },
  }))
}

// ============================================================
// Kanban Grouping (pure function)
// ============================================================

/**
 * Groups assignments into kanban columns.
 * "Complete" = submitted_at AND graded_at both set (regardless of learner_column).
 * All others grouped by their learner_column value.
 */
export function getKanbanGroups(assignments: LearnerAssignment[]): KanbanGroup[] {
  const groups: Record<KanbanColumn, LearnerAssignment[]> = {
    on_deck: [],
    researching: [],
    actively_exploring: [],
    blocked: [],
    complete: [],
  }

  for (const a of assignments) {
    if (a.submitted_at && a.graded_at) {
      groups.complete.push(a)
    } else {
      groups[a.learner_column].push(a)
    }
  }

  return KANBAN_COLUMNS.map(({ key, label }) => ({
    column: key,
    label,
    items: groups[key],
  }))
}

// ============================================================
// Mutations
// ============================================================

/**
 * Move an assignment to a different kanban column.
 * If moving out of 'on_deck' and status is still 'assigned', auto-set to 'in_progress'.
 */
export async function updateLearnerColumn(
  studentAssignmentId: string,
  newColumn: LearnerColumn,
  currentStatus: StudentAssignmentStatus
): Promise<void> {
  const updates: Record<string, unknown> = {
    learner_column: newColumn,
  }

  // Auto-transition from assigned → in_progress when learner starts working
  if (newColumn !== 'on_deck' && currentStatus === 'assigned') {
    updates.status = 'in_progress'
  }

  const { error } = await supabase
    .from('student_assignments')
    .update(updates)
    .eq('id', studentAssignmentId)

  if (error) {
    console.error('[updateLearnerColumn] update failed:', error.message)
    throw error
  }
}

/**
 * Submit an assignment (learner action).
 * Sets submitted_at and status to 'submitted'.
 * The card stays in its current kanban column and gets a "Submitted" badge.
 * It moves to "Complete" only when the educator also sets graded_at.
 */
export async function submitAssignment(studentAssignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('student_assignments')
    .update({
      status: 'submitted' as StudentAssignmentStatus,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', studentAssignmentId)

  if (error) {
    console.error('[submitAssignment] update failed:', error.message)
    throw error
  }
}

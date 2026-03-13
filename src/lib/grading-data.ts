import { supabase } from './supabase'
import {
  GRADE_TO_STEP,
  type CompetencyScoreRow,
  type CompetencyScoreInsert,
  type StudentAssignmentUpdate,
  type Competency,
} from '../types/database'

export { GRADE_TO_STEP } from '../types/database'

// ============================================================
// Grade step resolution
// ============================================================

/**
 * Get the step key for a student based on their grade_level.
 * Returns the step key (e.g. "3" for Grade 3, "E6" for Kindergarten).
 */
export function getStudentStep(gradeLevel: string | null): string {
  if (!gradeLevel) return '1' // default
  if (GRADE_TO_STEP[gradeLevel]) return GRADE_TO_STEP[gradeLevel]
  // Try numeric
  const num = parseInt(gradeLevel, 10)
  if (!isNaN(num) && num >= 0 && num <= 10) return String(num)
  return '1'
}

/**
 * Get the step descriptor for a competency at a specific grade level.
 */
export function getStepDescriptor(
  competency: Competency,
  gradeLevel: string | null
): string | null {
  const step = getStudentStep(gradeLevel)
  return competency.step_descriptors[step] || null
}

// ============================================================
// Grading operations
// ============================================================

export interface GradingPayload {
  studentAssignmentId: string
  studentId: string
  schoolId: string
  scores: { competencyId: string; score: number; notes?: string }[]
  qualitativeFeedback: string
  gradedBy: string
}

/**
 * Save grading scores for a student assignment.
 * Creates competency_scores and updates the student_assignment status.
 */
export async function saveGrading(payload: GradingPayload): Promise<void> {
  const now = new Date().toISOString()

  // 1. Upsert competency scores
  const scoreInserts: CompetencyScoreInsert[] = payload.scores.map((s) => ({
    student_assignment_id: payload.studentAssignmentId,
    competency_id: s.competencyId,
    student_id: payload.studentId,
    school_id: payload.schoolId,
    score: s.score,
    source: 'teacher' as const,
    notes: s.notes || null,
    scored_at: now,
  }))

  if (scoreInserts.length > 0) {
    // Delete existing teacher scores for this student_assignment to allow re-grading
    await supabase
      .from('competency_scores')
      .delete()
      .eq('student_assignment_id', payload.studentAssignmentId)
      .eq('source', 'teacher')

    const { error: scoreErr } = await supabase
      .from('competency_scores')
      .insert(scoreInserts)

    if (scoreErr) throw new Error(`Failed to save scores: ${scoreErr.message}`)
  }

  // 2. Update student_assignment
  const update: StudentAssignmentUpdate = {
    status: 'graded',
    graded_at: now,
    graded_by: payload.gradedBy,
    qualitative_feedback: payload.qualitativeFeedback || null,
  }

  const { error: saErr } = await supabase
    .from('student_assignments')
    .update(update)
    .eq('id', payload.studentAssignmentId)

  if (saErr) throw new Error(`Failed to update assignment status: ${saErr.message}`)
}

/**
 * Fetch existing competency scores for a student assignment.
 */
export async function fetchExistingScores(
  studentAssignmentId: string
): Promise<CompetencyScoreRow[]> {
  const { data, error } = await supabase
    .from('competency_scores')
    .select('*')
    .eq('student_assignment_id', studentAssignmentId)
    .order('scored_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Accept an AI-inferred score by saving it as a competency_score.
 */
export async function acceptAiScore(
  studentAssignmentId: string,
  competencyId: string,
  studentId: string,
  schoolId: string,
  score: number
): Promise<void> {
  const { error } = await supabase
    .from('competency_scores')
    .insert({
      student_assignment_id: studentAssignmentId,
      competency_id: competencyId,
      student_id: studentId,
      school_id: schoolId,
      score,
      source: 'ai_inferred',
      scored_at: new Date().toISOString(),
    })

  if (error) throw error
}

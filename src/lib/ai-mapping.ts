import { supabase } from './supabase'

/**
 * Trigger AI mapping of competencies to dimensions for a school.
 * Calls the edge function which uses Claude to determine mappings.
 * Runs automatically after framework upload; can also be triggered manually.
 */
export async function triggerCompetencyMapping(schoolId: string): Promise<{
  mapped: number
  error?: string
}> {
  const { data, error } = await supabase.functions.invoke('map-competencies-to-dimensions', {
    body: { school_id: schoolId },
  })

  if (error) {
    console.error('Competency mapping failed:', error)
    return { mapped: 0, error: error.message }
  }

  return data as { mapped: number; error?: string }
}

/**
 * Trigger AI inference of competency scores from qualitative feedback.
 * Called after a teacher provides qualitative feedback on a student assignment.
 */
export async function triggerScoreInference(studentAssignmentId: string): Promise<{
  inferred: { competency_id: string; suggested_score: number; reasoning: string }[]
  error?: string
}> {
  const { data, error } = await supabase.functions.invoke('infer-competency-scores', {
    body: { student_assignment_id: studentAssignmentId },
  })

  if (error) {
    console.error('Score inference failed:', error)
    return { inferred: [], error: error.message }
  }

  return data as {
    inferred: { competency_id: string; suggested_score: number; reasoning: string }[]
    error?: string
  }
}

/**
 * Fetch existing competency-dimension mappings for a school.
 */
export async function fetchMappings(schoolId: string) {
  const { data, error } = await supabase
    .from('competency_dimension_mappings')
    .select('*')
    .eq('school_id', schoolId)

  if (error) throw error
  return data || []
}

// ============================================================
// Translation Engine: AI mapping of skills → standards
// ============================================================

export interface TranslationAIResult {
  mappings: {
    source_id: string
    source_type: 'competency_score' | 'skill_assessment'
    standard_id: string
    confidence: number
    level_in_standard: string
    reasoning: string
  }[]
  error?: string
}

/**
 * Trigger AI translation of a student's skill assessments to a target
 * standards framework. Calls the translate-skills-to-standards edge function.
 */
export async function triggerTranslation(params: {
  studentId: string
  schoolId: string
  targetFrameworkId: string
}): Promise<TranslationAIResult> {
  const { data, error } = await supabase.functions.invoke('translate-skills-to-standards', {
    body: {
      student_id: params.studentId,
      school_id: params.schoolId,
      target_framework_id: params.targetFrameworkId,
    },
  })

  if (error) {
    console.error('Translation failed:', error)
    return { mappings: [], error: error.message }
  }

  return data as TranslationAIResult
}

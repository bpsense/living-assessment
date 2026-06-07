import { supabase } from './supabase'

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

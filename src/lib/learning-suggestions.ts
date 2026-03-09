import { useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { LearningSuggestion, EducatorAction, SchoolContext } from '../types/database'
import type { DimensionScore } from './student-data'
import { classifyZones } from './student-data'
import { compileAndFetchContext } from './context-document'

// ============================================================
// Types
// ============================================================

interface SuggestionsState {
  suggestions: LearningSuggestion[]
  suggestionRowId: string | null
  educatorActions: Record<string, EducatorAction>
  loading: boolean
  error: string | null
  cached: boolean
}

export interface UseLearningGuideReturn extends SuggestionsState {
  /** Call the Edge Function to generate (or fetch cached) suggestions */
  generate: () => Promise<void>
  /** Mark a suggestion as dismissed */
  dismissSuggestion: (suggestionId: string) => Promise<void>
  /** Mark a suggestion as saved */
  saveSuggestion: (suggestionId: string) => Promise<void>
  /** Mark a suggestion as shared with parent */
  shareSuggestion: (suggestionId: string) => Promise<void>
}

const INITIAL_STATE: SuggestionsState = {
  suggestions: [],
  suggestionRowId: null,
  educatorActions: {},
  loading: false,
  error: null,
  cached: false,
}

// ============================================================
// Hook
// ============================================================

export function useLearningGuide(
  studentId: string | undefined,
  schoolId: string | undefined,
  studentName: string | undefined,
  gradeLevel: string | null | undefined,
  dimensionScores: DimensionScore[]
): UseLearningGuideReturn {
  const [state, setState] = useState<SuggestionsState>(INITIAL_STATE)

  // ── Generate suggestions ─────────────────────────────────

  const generate = useCallback(async () => {
    if (!studentId || !schoolId || !studentName) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // Build zone payload from existing dimension scores
      const zones = classifyZones(dimensionScores).map((z) => {
        const score = dimensionScores.find(
          (s) => s.dimension_id === z.dimension_id
        )
        return {
          dimension_id: z.dimension_id,
          dimension_name: z.dimension_name,
          zone: z.zone,
          competency: score?.competency ?? 0,
          interest: score?.interest ?? 0,
        }
      })

      if (zones.length === 0) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            'No dimension data available yet. Record some observations and run an interest survey first.',
        }))
        return
      }

      // Compile the full student context document (observations, notes, parent input, etc.)
      let studentContext: string | null = null
      try {
        const ctx = await compileAndFetchContext(studentId)
        studentContext = ctx.markdown
      } catch {
        // Non-critical — continue without student context
      }

      // Fetch school context (pedagogical orientation) to enrich AI prompt
      let schoolContext: SchoolContext | undefined
      try {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('settings')
          .eq('id', schoolId)
          .single()
        if (schoolData?.settings) {
          const s = schoolData.settings as SchoolContext
          // Only include if at least one field is filled
          const hasContent = Object.values(s).some(
            (v) => typeof v === 'string' && v.trim().length > 0
          )
          if (hasContent) schoolContext = s
        }
      } catch {
        // Non-critical — continue without school context
      }

      const { data, error } = await supabase.functions.invoke(
        'learning-suggestions',
        {
          body: {
            student_id: studentId,
            school_id: schoolId,
            student_name: studentName,
            grade_level: gradeLevel ?? null,
            zones,
            school_context: schoolContext ?? null,
            student_context: studentContext,
          },
        }
      )

      if (error) throw error

      setState({
        suggestions: data.suggestions ?? [],
        suggestionRowId: data.suggestion_id ?? null,
        educatorActions: data.educator_actions ?? {},
        loading: false,
        error: null,
        cached: data.cached ?? false,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error ? err.message : 'Failed to generate suggestions',
      }))
    }
  }, [studentId, schoolId, studentName, gradeLevel, dimensionScores])

  // ── Educator actions (dismiss / save / share) ────────────

  const updateAction = useCallback(
    async (
      suggestionId: string,
      actionKey: 'dismissed' | 'saved' | 'shared_with_parent'
    ) => {
      if (!state.suggestionRowId) return

      const previous = state.educatorActions
      const newActions: Record<string, EducatorAction> = {
        ...previous,
        [suggestionId]: {
          ...previous[suggestionId],
          [actionKey]: true,
        },
      }

      // Optimistic update
      setState((prev) => ({ ...prev, educatorActions: newActions }))

      const { error } = await supabase
        .from('learning_suggestions')
        .update({ educator_actions: newActions })
        .eq('id', state.suggestionRowId)

      if (error) {
        console.error('Failed to update suggestion action:', error.message)
        // Revert
        setState((prev) => ({ ...prev, educatorActions: previous }))
      }
    },
    [state.suggestionRowId, state.educatorActions]
  )

  return {
    ...state,
    generate,
    dismissSuggestion: (id) => updateAction(id, 'dismissed'),
    saveSuggestion: (id) => updateAction(id, 'saved'),
    shareSuggestion: (id) => updateAction(id, 'shared_with_parent'),
  }
}

/**
 * family-support.ts
 * Hook for generating and managing AI-powered family support suggestions.
 * Follows the same pattern as learning-suggestions.ts but focused on
 * actionable home activities for families.
 */

import { useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { FamilySuggestion, EducatorNote, SchoolContext } from '../types/database'
import type { DimensionScore } from './student-data'
import { classifyZones } from './student-data'
import { compileAndFetchContext } from './context-document'

// ============================================================
// Types
// ============================================================

interface FamilySupportState {
  suggestions: FamilySuggestion[]
  suggestionRowId: string | null
  educatorNotes: Record<string, EducatorNote>
  loading: boolean
  generating: boolean
  error: string | null
  cached: boolean
}

export interface UseFamilySupportReturn extends FamilySupportState {
  /** Call the Edge Function to generate (or fetch cached) suggestions */
  generate: () => Promise<void>
  /** Add or update an educator note on a suggestion */
  addEducatorNote: (suggestionId: string, note: string, authorId: string, authorName: string) => Promise<void>
  /** Remove an educator note from a suggestion */
  removeEducatorNote: (suggestionId: string) => Promise<void>
}

const INITIAL_STATE: FamilySupportState = {
  suggestions: [],
  suggestionRowId: null,
  educatorNotes: {},
  loading: false,
  generating: false,
  error: null,
  cached: false,
}

// ============================================================
// Hook
// ============================================================

export function useFamilySupport(
  studentId: string | undefined,
  schoolId: string | undefined,
  studentName: string | undefined,
  gradeLevel: string | null | undefined,
  dimensionScores: DimensionScore[]
): UseFamilySupportReturn {
  const [state, setState] = useState<FamilySupportState>(INITIAL_STATE)

  // ── Generate suggestions ─────────────────────────────────

  const generate = useCallback(async () => {
    if (!studentId || !schoolId || !studentName) return

    setState((prev) => ({ ...prev, loading: true, generating: true, error: null }))

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
          generating: false,
          error:
            'No learning data available yet. The educator will need to record some observations first.',
        }))
        return
      }

      // Compile the full student context document
      let studentContext: string | null = null
      try {
        const ctx = await compileAndFetchContext(studentId)
        studentContext = ctx.markdown
      } catch {
        // Non-critical — continue without student context
      }

      // Fetch school context to enrich AI prompt
      let schoolContext: SchoolContext | undefined
      try {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('settings')
          .eq('id', schoolId)
          .single()
        if (schoolData?.settings) {
          const s = schoolData.settings as SchoolContext
          const hasContent = Object.values(s).some(
            (v) => typeof v === 'string' && v.trim().length > 0
          )
          if (hasContent) schoolContext = s
        }
      } catch {
        // Non-critical — continue without school context
      }

      const { data, error } = await supabase.functions.invoke(
        'family-support',
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

      if (error) {
        // supabase-js wraps non-2xx responses in FunctionsHttpError with a
        // generic message. The actual error from the Edge Function is in the
        // response body accessible via error.context.
        let detail: string | undefined
        try {
          // error.context is the parsed response body (JSON) from the Edge Function
          const ctx = (error as { context?: { error?: string } }).context
          detail = ctx?.error
        } catch {
          // ignore — fall through to generic message
        }
        throw new Error(detail || error.message || 'Failed to generate suggestions')
      }

      setState({
        suggestions: data.suggestions ?? [],
        suggestionRowId: data.suggestion_id ?? null,
        educatorNotes: data.educator_notes ?? {},
        loading: false,
        generating: false,
        error: null,
        cached: data.cached ?? false,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        generating: false,
        error:
          err instanceof Error ? err.message : 'Failed to generate suggestions',
      }))
    }
  }, [studentId, schoolId, studentName, gradeLevel, dimensionScores])

  // ── Educator notes (add / remove) ────────────────────────

  const addEducatorNote = useCallback(
    async (suggestionId: string, note: string, authorId: string, authorName: string) => {
      if (!state.suggestionRowId) return

      const previous = state.educatorNotes
      const newNotes: Record<string, EducatorNote> = {
        ...previous,
        [suggestionId]: {
          note,
          author_id: authorId,
          author_name: authorName,
          updated_at: new Date().toISOString(),
        },
      }

      // Optimistic update
      setState((prev) => ({ ...prev, educatorNotes: newNotes }))

      const { error } = await supabase
        .from('family_support_suggestions')
        .update({ educator_notes: newNotes })
        .eq('id', state.suggestionRowId)

      if (error) {
        console.error('Failed to save educator note:', error.message)
        // Revert
        setState((prev) => ({ ...prev, educatorNotes: previous }))
      }
    },
    [state.suggestionRowId, state.educatorNotes]
  )

  const removeEducatorNote = useCallback(
    async (suggestionId: string) => {
      if (!state.suggestionRowId) return

      const previous = state.educatorNotes
      const newNotes = { ...previous }
      delete newNotes[suggestionId]

      // Optimistic update
      setState((prev) => ({ ...prev, educatorNotes: newNotes }))

      const { error } = await supabase
        .from('family_support_suggestions')
        .update({ educator_notes: newNotes })
        .eq('id', state.suggestionRowId)

      if (error) {
        console.error('Failed to remove educator note:', error.message)
        // Revert
        setState((prev) => ({ ...prev, educatorNotes: previous }))
      }
    },
    [state.suggestionRowId, state.educatorNotes]
  )

  return {
    ...state,
    generate,
    addEducatorNote,
    removeEducatorNote,
  }
}

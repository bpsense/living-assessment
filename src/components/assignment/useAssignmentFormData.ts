/**
 * useAssignmentFormData.ts
 *
 * Fetches the school's active dimensions + their competencies (the assessment
 * spine) for the assignment forms' multi-selects and the library filters.
 * Competencies with no dimension_id (unplaced) are omitted.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Dimension, Competency } from '../../types/database'

export interface AssignmentFormData {
  dimensions: Dimension[]
  /** dimension_id → competencies (ordered), for filtering the competency picker. */
  competenciesByDimension: Map<string, Competency[]>
  loading: boolean
  error: string | null
}

export function useAssignmentFormData(schoolId: string | undefined): AssignmentFormData {
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [competenciesByDimension, setCompetenciesByDimension] = useState<Map<string, Competency[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        const [dimsRes, compsRes] = await Promise.all([
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('competencies')
            .select('*')
            .eq('school_id', schoolId)
            .not('dimension_id', 'is', null)
            .order('display_order')
            .order('name'),
        ])
        if (cancelled) return
        if (dimsRes.error) throw dimsRes.error
        if (compsRes.error) throw compsRes.error

        const byDim = new Map<string, Competency[]>()
        for (const c of (compsRes.data ?? []) as Competency[]) {
          if (!c.dimension_id) continue
          byDim.set(c.dimension_id, [...(byDim.get(c.dimension_id) ?? []), c])
        }
        setDimensions((dimsRes.data ?? []) as Dimension[])
        setCompetenciesByDimension(byDim)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dimensions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [schoolId])

  return { dimensions, competenciesByDimension, loading, error }
}

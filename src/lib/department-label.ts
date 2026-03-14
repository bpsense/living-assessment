import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useActiveSchoolId } from './school-context'

export interface DepartmentLabel {
  singular: string
  plural: string
  loading: boolean
}

const DEPT_LABEL_CHANGED = 'department-label-changed'

/** Notify all useDepartmentLabel() hooks to re-fetch. */
export function notifyDepartmentLabelChanged() {
  window.dispatchEvent(new Event(DEPT_LABEL_CHANGED))
}

/**
 * Returns the school's chosen terminology for departments ("Department" or "Location").
 * Reads from `schools.settings.department_label`, defaults to "Department".
 */
export function useDepartmentLabel(): DepartmentLabel {
  const schoolId = useActiveSchoolId()
  const [label, setLabel] = useState<'Department' | 'Location'>('Department')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  const fetchLabel = useCallback(() => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    let cancelled = false

    supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const settings = (data?.settings ?? {}) as Record<string, unknown>
        const stored = settings.department_label as string | undefined
        setLabel(stored === 'Location' ? 'Location' : 'Department')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [schoolId, revision])

  useEffect(() => fetchLabel(), [fetchLabel])

  // Re-fetch when another component changes the label
  useEffect(() => {
    const handler = () => setRevision((r) => r + 1)
    window.addEventListener(DEPT_LABEL_CHANGED, handler)
    return () => window.removeEventListener(DEPT_LABEL_CHANGED, handler)
  }, [])

  return {
    singular: label,
    plural: label === 'Location' ? 'Locations' : 'Departments',
    loading,
  }
}

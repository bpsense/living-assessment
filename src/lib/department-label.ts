import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useActiveSchoolId } from './school-context'

export interface DepartmentLabel {
  singular: string
  plural: string
  loading: boolean
}

/**
 * Returns the school's chosen terminology for departments ("Department" or "Location").
 * Reads from `schools.settings.department_label`, defaults to "Department".
 */
export function useDepartmentLabel(): DepartmentLabel {
  const schoolId = useActiveSchoolId()
  const [label, setLabel] = useState<'Department' | 'Location'>('Department')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [schoolId])

  return {
    singular: label,
    plural: label === 'Location' ? 'Locations' : 'Departments',
    loading,
  }
}

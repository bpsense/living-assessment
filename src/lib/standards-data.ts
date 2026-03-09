/**
 * standards-data.ts
 * Data hook for admin standards management — view, upload, delete frameworks.
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from './supabase'
import type { StandardsFramework, Standard } from '../types/database'
import type { StandardsFrameworkWithStandards } from './school-data'

// ============================================================
// Upload types
// ============================================================

export interface StandardUploadNode {
  code: string
  description: string
  grade_level?: string | null
  display_order?: number
  children?: StandardUploadNode[]
}

export interface StandardsUploadPayload {
  framework: {
    name: string
    description?: string | null
    version?: string | null
  }
  standards: StandardUploadNode[]
}

// ============================================================
// Validation
// ============================================================

export function validateUploadPayload(data: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid JSON structure'] }
  }

  const obj = data as Record<string, unknown>

  // Framework validation
  if (!obj.framework || typeof obj.framework !== 'object') {
    errors.push('Missing "framework" object')
  } else {
    const fw = obj.framework as Record<string, unknown>
    if (!fw.name || typeof fw.name !== 'string' || !fw.name.trim()) {
      errors.push('framework.name is required and must be a non-empty string')
    }
  }

  // Standards validation
  if (!Array.isArray(obj.standards)) {
    errors.push('Missing "standards" array')
  } else {
    function validateNodes(nodes: unknown[], path: string) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (!node || typeof node !== 'object') {
          errors.push(`${path}[${i}] must be an object`)
          continue
        }
        const n = node as Record<string, unknown>
        if (!n.code || typeof n.code !== 'string') {
          errors.push(`${path}[${i}].code is required`)
        }
        if (!n.description || typeof n.description !== 'string') {
          errors.push(`${path}[${i}].description is required`)
        }
        if (n.children && Array.isArray(n.children)) {
          validateNodes(n.children, `${path}[${i}].children`)
        }
        // Cap error count to avoid flooding UI
        if (errors.length >= 20) return
      }
    }
    validateNodes(obj.standards as unknown[], 'standards')
    if ((obj.standards as unknown[]).length === 0) {
      errors.push('At least one standard is required')
    }
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================
// Helpers
// ============================================================

/** Count total standards recursively */
export function countStandards(nodes: StandardUploadNode[]): number {
  return nodes.reduce(
    (acc, n) => acc + 1 + countStandards(n.children ?? []),
    0
  )
}

/** Flatten nested tree into flat rows for DB insert */
function flattenStandards(
  nodes: StandardUploadNode[],
  frameworkId: string,
  schoolId: string,
  parentId: string | null
): {
  id: string
  framework_id: string
  school_id: string
  code: string
  description: string
  grade_level: string | null
  parent_id: string | null
  display_order: number
}[] {
  const result: typeof flattenStandards extends (
    ...args: unknown[]
  ) => infer R
    ? R
    : never = []

  for (const node of nodes) {
    const id = crypto.randomUUID()
    result.push({
      id,
      framework_id: frameworkId,
      school_id: schoolId,
      code: node.code,
      description: node.description,
      grade_level: node.grade_level ?? null,
      parent_id: parentId,
      display_order: node.display_order ?? 0,
    })
    if (node.children && node.children.length > 0) {
      result.push(
        ...flattenStandards(node.children, frameworkId, schoolId, id)
      )
    }
  }

  return result
}

// ============================================================
// Hook state
// ============================================================

interface StandardsManagerState {
  frameworks: StandardsFrameworkWithStandards[]
  loading: boolean
  error: string | null
}

export interface UseStandardsManagerReturn extends StandardsManagerState {
  /** Reload frameworks + standards from the database */
  reload: () => Promise<void>
  /** Upload a new framework from a JSON payload */
  uploadFramework: (payload: StandardsUploadPayload) => Promise<string>
  /** Delete a framework by id (cascade deletes standards + dimension_standards) */
  deleteFramework: (frameworkId: string) => Promise<void>
}

// ============================================================
// Hook
// ============================================================

export function useStandardsManager(
  schoolId: string | undefined
): UseStandardsManagerReturn {
  const [state, setState] = useState<StandardsManagerState>({
    frameworks: [],
    loading: true,
    error: null,
  })

  // ── Load ─────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!schoolId) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const [fwRes, stdRes] = await Promise.all([
        supabase
          .from('standards_frameworks')
          .select('*')
          .eq('school_id', schoolId)
          .order('name'),
        supabase
          .from('standards')
          .select('*')
          .eq('school_id', schoolId)
          .order('display_order'),
      ])

      if (fwRes.error) throw new Error(fwRes.error.message)

      const allStandards = (stdRes.data as Standard[]) ?? []
      const rawFrameworks = (fwRes.data as StandardsFramework[]) ?? []
      const frameworks: StandardsFrameworkWithStandards[] = rawFrameworks.map(
        (fw) => ({
          ...fw,
          standards: allStandards.filter((s) => s.framework_id === fw.id),
        })
      )

      setState({ frameworks, loading: false, error: null })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error ? err.message : 'Failed to load standards',
      }))
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  // ── Upload ──────────────────────────────────────────────

  const uploadFramework = useCallback(
    async (payload: StandardsUploadPayload): Promise<string> => {
      if (!schoolId) throw new Error('No school')

      // 1. Insert framework
      const { data: fw, error: fwErr } = await supabase
        .from('standards_frameworks')
        .insert({
          school_id: schoolId,
          name: payload.framework.name.trim(),
          description: payload.framework.description?.trim() || null,
          version: payload.framework.version?.trim() || null,
        })
        .select('id')
        .single()

      if (fwErr) throw new Error(fwErr.message)
      const frameworkId = fw.id as string

      // 2. Flatten and insert standards
      if (payload.standards.length > 0) {
        const inserts = flattenStandards(
          payload.standards,
          frameworkId,
          schoolId,
          null
        )

        const { error: stdErr } = await supabase
          .from('standards')
          .insert(inserts)

        if (stdErr) {
          // Roll back framework on failure
          await supabase
            .from('standards_frameworks')
            .delete()
            .eq('id', frameworkId)
          throw new Error(stdErr.message)
        }
      }

      // 3. Refresh
      await load()
      return frameworkId
    },
    [schoolId, load]
  )

  // ── Delete ──────────────────────────────────────────────

  const deleteFramework = useCallback(
    async (frameworkId: string) => {
      const { error } = await supabase
        .from('standards_frameworks')
        .delete()
        .eq('id', frameworkId)

      if (error) throw new Error(error.message)
      await load()
    },
    [load]
  )

  return {
    ...state,
    reload: load,
    uploadFramework,
    deleteFramework,
  }
}

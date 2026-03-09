/**
 * context-document.ts
 * Data hook for the compiled student context document.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { StudentContextDocument } from '../types/database'

// ============================================================
// Hook return type
// ============================================================

export interface UseStudentContextReturn {
  document: StudentContextDocument | null
  loading: boolean
  error: string | null
  compile: () => Promise<void>
  isCompiling: boolean
}

// ============================================================
// Hook
// ============================================================

export function useStudentContext(
  studentId: string | undefined
): UseStudentContextReturn {
  const [document, setDocument] = useState<StudentContextDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)

  // Fetch existing compiled document
  useEffect(() => {
    if (!studentId) {
      setDocument(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('student_context_documents')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle()

        if (cancelled) return
        if (fetchError) throw fetchError

        setDocument((data as StudentContextDocument) ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load context document')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studentId])

  // Compile / recompile the context document
  const compile = useCallback(async () => {
    if (!studentId) return

    setIsCompiling(true)
    setError(null)

    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'compile_student_context',
        { p_student_id: studentId }
      )

      if (rpcError) throw rpcError
      if (rpcResult?.error) throw new Error(rpcResult.error)

      // Fetch the freshly compiled document
      const { data: freshDoc, error: fetchError } = await supabase
        .from('student_context_documents')
        .select('*')
        .eq('student_id', studentId)
        .single()

      if (fetchError) throw fetchError
      setDocument((freshDoc as StudentContextDocument) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compile context')
    } finally {
      setIsCompiling(false)
    }
  }, [studentId])

  return { document, loading, error, compile, isCompiling }
}

/**
 * Compile the student context and return the markdown.
 * Used by the learning-suggestions hook to build the AI prompt.
 */
export async function compileAndFetchContext(
  studentId: string
): Promise<{ markdown: string | null; contentHash: string | null }> {
  // Compile fresh
  const { error: rpcError } = await supabase.rpc('compile_student_context', {
    p_student_id: studentId,
  })

  if (rpcError) {
    console.error('Context compilation failed:', rpcError.message)
    return { markdown: null, contentHash: null }
  }

  // Fetch compiled doc
  const { data } = await supabase
    .from('student_context_documents')
    .select('markdown, content_hash')
    .eq('student_id', studentId)
    .single()

  return {
    markdown: (data as { markdown: string; content_hash: string } | null)?.markdown ?? null,
    contentHash: (data as { markdown: string; content_hash: string } | null)?.content_hash ?? null,
  }
}

/**
 * parent-notes.ts
 * Data hook for parent-contributed notes about their child.
 * Mirrors useTeacherNotes in sis-data.ts.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  ParentNote,
  ParentNoteWithAuthor,
  ParentNoteType,
  ParentNoteUpdate,
  Profile,
} from '../types/database'

// ============================================================
// Hook return type
// ============================================================

interface UseParentNotesReturn {
  notes: ParentNoteWithAuthor[]
  loading: boolean
  error: string | null
  addNote: (data: {
    content: string
    note_type: ParentNoteType
    school_id: string
    author_id: string
  }) => Promise<void>
  updateNote: (id: string, data: ParentNoteUpdate) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  refetch: () => void
}

// ============================================================
// Hook
// ============================================================

export function useParentNotes(studentId: string | undefined): UseParentNotesReturn {
  const [notes, setNotes] = useState<ParentNoteWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) {
      setNotes([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        // Fetch notes
        const { data: notesData, error: notesError } = await supabase
          .from('parent_notes')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (notesError) throw notesError

        const rawNotes = (notesData as ParentNote[]) ?? []

        // Fetch unique author profiles
        const authorIds = [...new Set(rawNotes.map((n) => n.author_id))]
        let profileMap = new Map<string, string>()

        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', authorIds)

          if (cancelled) return
          profileMap = new Map(
            ((profiles as Pick<Profile, 'id' | 'full_name'>[]) ?? []).map((p) => [p.id, p.full_name])
          )
        }

        // Merge
        const merged: ParentNoteWithAuthor[] = rawNotes.map((n) => ({
          ...n,
          author_name: profileMap.get(n.author_id) ?? 'Unknown',
        }))

        if (!cancelled) setNotes(merged)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load notes')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studentId, fetchCount])

  const addNote = useCallback(
    async (data: {
      content: string
      note_type: ParentNoteType
      school_id: string
      author_id: string
    }) => {
      if (!studentId) return
      setError(null)

      const { data: inserted, error: insertError } = await supabase
        .from('parent_notes')
        .insert({
          student_id: studentId,
          school_id: data.school_id,
          author_id: data.author_id,
          content: data.content,
          note_type: data.note_type,
        })
        .select('*')
        .single()

      if (insertError) throw insertError

      // Get author name
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.author_id)
        .single()

      const noteWithAuthor: ParentNoteWithAuthor = {
        ...(inserted as ParentNote),
        author_name: (authorProfile as { full_name: string } | null)?.full_name ?? 'Unknown',
      }

      setNotes((prev) => [noteWithAuthor, ...prev])
    },
    [studentId]
  )

  const updateNote = useCallback(
    async (id: string, data: ParentNoteUpdate) => {
      setError(null)
      const { error: updateError } = await supabase
        .from('parent_notes')
        .update(data)
        .eq('id', id)

      if (updateError) throw updateError
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? ({ ...n, ...data } as ParentNoteWithAuthor) : n))
      )
    },
    []
  )

  const deleteNote = useCallback(
    async (id: string) => {
      setError(null)
      const { error: deleteError } = await supabase
        .from('parent_notes')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setNotes((prev) => prev.filter((n) => n.id !== id))
    },
    []
  )

  return { notes, loading, error, addNote, updateNote, deleteNote, refetch }
}

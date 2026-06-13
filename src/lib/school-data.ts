import { useState, useCallback, useEffect } from 'react'
import { supabase } from './supabase'
import type {
  School,
  SchoolContext,
  SchoolDocument,
  Dimension,
  SchoolProfileSectionKey,
  SchoolProfileVisibility,
} from '../types/database'
import { DEFAULT_PROFILE_VISIBILITY } from '../types/database'

// ============================================================
// Types
// ============================================================

interface SchoolProfileState {
  school: School | null
  documents: SchoolDocument[]
  dimensions: Dimension[]
  loading: boolean
  saving: boolean
  error: string | null
  saveSuccess: boolean
}

export interface UseSchoolProfileReturn extends SchoolProfileState {
  /** Update the school's pedagogical context fields (stored in settings JSONB) */
  updateSchoolContext: (context: SchoolContext) => Promise<void>
  /** Upload a document to Supabase Storage + insert metadata row */
  uploadDocument: (file: File, description: string) => Promise<void>
  /** Delete a document from storage + remove metadata row */
  deleteDocument: (doc: SchoolDocument) => Promise<void>
  /** Update a document's description */
  updateDocumentDescription: (docId: string, description: string) => Promise<void>
}

const INITIAL_STATE: SchoolProfileState = {
  school: null,
  documents: [],
  dimensions: [],
  loading: true,
  saving: false,
  error: null,
  saveSuccess: false,
}

// ============================================================
// Hook
// ============================================================

export function useSchoolProfile(schoolId: string | undefined): UseSchoolProfileReturn {
  const [state, setState] = useState<SchoolProfileState>(INITIAL_STATE)

  // ── Load school + documents ────────────────────────────────

  const load = useCallback(async () => {
    if (!schoolId) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const [schoolRes, docsRes, dimsRes] = await Promise.all([
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase
          .from('school_documents')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('dimensions')
          .select('*')
          .eq('school_id', schoolId)
          .order('display_order'),
      ])

      if (schoolRes.error) throw schoolRes.error

      setState({
        school: schoolRes.data as School,
        documents: (docsRes.data as SchoolDocument[]) ?? [],
        dimensions: (dimsRes.data as Dimension[]) ?? [],
        loading: false,
        saving: false,
        error: docsRes.error ? 'Could not load documents' : null,
        saveSuccess: false,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load school profile',
      }))
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  // ── Update pedagogical context (settings JSONB) ────────────

  const updateSchoolContext = useCallback(
    async (context: SchoolContext) => {
      if (!schoolId || !state.school) return

      setState((prev) => ({ ...prev, saving: true, error: null, saveSuccess: false }))

      try {
        // Merge new context into existing settings
        const updatedSettings = {
          ...state.school.settings,
          ...context,
        }

        const { error } = await supabase
          .from('schools')
          .update({ settings: updatedSettings })
          .eq('id', schoolId)

        if (error) throw error

        setState((prev) => ({
          ...prev,
          school: prev.school
            ? { ...prev.school, settings: updatedSettings }
            : null,
          saving: false,
          saveSuccess: true,
        }))

        // Clear success indicator after 2s
        setTimeout(() => {
          setState((prev) => ({ ...prev, saveSuccess: false }))
        }, 2000)
      } catch (err) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: err instanceof Error ? err.message : 'Failed to save',
        }))
      }
    },
    [schoolId, state.school]
  )

  // ── Upload document ────────────────────────────────────────

  const uploadDocument = useCallback(
    async (file: File, description: string) => {
      if (!schoolId) return

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // Upload to Supabase Storage
        const filePath = `${schoolId}/${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('school-documents')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Insert metadata row
        const { data: inserted, error: insertError } = await supabase
          .from('school_documents')
          .insert({
            school_id: schoolId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            description: description || null,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .select('*')
          .single()

        if (insertError) throw insertError

        setState((prev) => ({
          ...prev,
          documents: [inserted as SchoolDocument, ...prev.documents],
          saving: false,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: err instanceof Error ? err.message : 'Failed to upload document',
        }))
      }
    },
    [schoolId]
  )

  // ── Delete document ────────────────────────────────────────

  const deleteDocument = useCallback(
    async (doc: SchoolDocument) => {
      setState((prev) => ({ ...prev, error: null }))

      try {
        // Remove from storage
        const { error: storageError } = await supabase.storage
          .from('school-documents')
          .remove([doc.file_path])

        if (storageError) {
          console.warn('Storage delete failed (may already be removed):', storageError.message)
        }

        // Remove metadata row
        const { error: dbError } = await supabase
          .from('school_documents')
          .delete()
          .eq('id', doc.id)

        if (dbError) throw dbError

        setState((prev) => ({
          ...prev,
          documents: prev.documents.filter((d) => d.id !== doc.id),
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to delete document',
        }))
      }
    },
    []
  )

  // ── Update document description ────────────────────────────

  const updateDocumentDescription = useCallback(
    async (docId: string, description: string) => {
      const { error } = await supabase
        .from('school_documents')
        .update({ description: description || null })
        .eq('id', docId)

      if (error) {
        console.error('Failed to update document description:', error.message)
        return
      }

      setState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, description: description || null } : d
        ),
      }))
    },
    []
  )

  return {
    ...state,
    updateSchoolContext,
    uploadDocument,
    deleteDocument,
    updateDocumentDescription,
  }
}

// ============================================================
// School profile section visibility hooks
// ============================================================

/**
 * Read the profile_visibility settings from the school's settings JSONB.
 * Returns defaults (all true) if nothing is stored yet.
 */
export function useSchoolProfileVisibility(schoolId: string | undefined) {
  const [visibility, setVisibility] = useState<SchoolProfileVisibility>(DEFAULT_PROFILE_VISIBILITY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId) return

    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('schools')
        .select('settings')
        .eq('id', schoolId)
        .single()

      if (cancelled) return

      if (!error && data) {
        const settings = (data.settings ?? {}) as Record<string, unknown>
        const stored = (settings.profile_visibility ?? {}) as Partial<SchoolProfileVisibility>
        setVisibility({ ...DEFAULT_PROFILE_VISIBILITY, ...stored })
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [schoolId])

  return { visibility, loading }
}

/**
 * Toggle a single profile section's visibility for families.
 * Merges the new value into `settings.profile_visibility` JSONB.
 */
export async function updateSchoolProfileVisibility(
  schoolId: string,
  section: SchoolProfileSectionKey,
  visible: boolean
): Promise<{ error: string | null }> {
  try {
    // Read current settings first to avoid overwriting other keys
    const { data: current, error: readErr } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single()

    if (readErr) return { error: readErr.message }

    const settings = ((current?.settings ?? {}) as Record<string, unknown>)
    const existing = (settings.profile_visibility ?? {}) as Partial<SchoolProfileVisibility>

    const updatedSettings = {
      ...settings,
      profile_visibility: {
        ...DEFAULT_PROFILE_VISIBILITY,
        ...existing,
        [section]: visible,
      },
    }

    const { error } = await supabase
      .from('schools')
      .update({ settings: updatedSettings })
      .eq('id', schoolId)

    return { error: error?.message ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update visibility' }
  }
}

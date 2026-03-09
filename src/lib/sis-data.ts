import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  StudentContact,
  StudentContactInsert,
  StudentContactUpdate,
  TeacherNote,
  TeacherNoteWithAuthor,
  TeacherNoteUpdate,
  NoteType,
  Profile,
  StudentDocument,
  TeacherNoteFolder,
  TeacherNoteFile,
} from '../types/database'

// ============================================================
// useStudentContacts — CRUD for emergency / parent / guardian contacts
// ============================================================

interface UseStudentContactsReturn {
  contacts: StudentContact[]
  loading: boolean
  error: string | null
  addContact: (data: StudentContactInsert) => Promise<void>
  updateContact: (id: string, data: StudentContactUpdate) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  refetch: () => void
}

export function useStudentContacts(studentId: string | undefined): UseStudentContactsReturn {
  const [contacts, setContacts] = useState<StudentContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) {
      setContacts([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('student_contacts')
          .select('*')
          .eq('student_id', studentId)
          .order('is_primary', { ascending: false })
          .order('full_name')

        if (cancelled) return
        if (fetchError) throw fetchError
        setContacts((data as StudentContact[]) ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contacts')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studentId, fetchCount])

  const addContact = useCallback(
    async (data: StudentContactInsert) => {
      setError(null)
      const { data: inserted, error: insertError } = await supabase
        .from('student_contacts')
        .insert(data)
        .select('*')
        .single()

      if (insertError) throw insertError
      setContacts((prev) => [...prev, inserted as StudentContact])
    },
    []
  )

  const updateContact = useCallback(
    async (id: string, data: StudentContactUpdate) => {
      setError(null)
      const { error: updateError } = await supabase
        .from('student_contacts')
        .update(data)
        .eq('id', id)

      if (updateError) throw updateError
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } as StudentContact : c))
      )
    },
    []
  )

  const deleteContact = useCallback(
    async (id: string) => {
      setError(null)
      const { error: deleteError } = await supabase
        .from('student_contacts')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setContacts((prev) => prev.filter((c) => c.id !== id))
    },
    []
  )

  return { contacts, loading, error, addContact, updateContact, deleteContact, refetch }
}

// ============================================================
// useTeacherNotes — CRUD for teacher notes with author info
// ============================================================

interface UseTeacherNotesReturn {
  notes: TeacherNoteWithAuthor[]
  loading: boolean
  error: string | null
  addNote: (data: { content: string; note_type: NoteType; is_confidential: boolean; school_id: string; author_id: string }) => Promise<void>
  updateNote: (id: string, data: TeacherNoteUpdate) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  refetch: () => void
}

export function useTeacherNotes(studentId: string | undefined): UseTeacherNotesReturn {
  const [notes, setNotes] = useState<TeacherNoteWithAuthor[]>([])
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
          .from('teacher_notes')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (notesError) throw notesError

        const rawNotes = (notesData as TeacherNote[]) ?? []

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
        const merged: TeacherNoteWithAuthor[] = rawNotes.map((n) => ({
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
    async (data: { content: string; note_type: NoteType; is_confidential: boolean; school_id: string; author_id: string }) => {
      if (!studentId) return
      setError(null)

      const { data: inserted, error: insertError } = await supabase
        .from('teacher_notes')
        .insert({
          student_id: studentId,
          school_id: data.school_id,
          author_id: data.author_id,
          content: data.content,
          note_type: data.note_type,
          is_confidential: data.is_confidential,
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

      const noteWithAuthor: TeacherNoteWithAuthor = {
        ...(inserted as TeacherNote),
        author_name: (authorProfile as { full_name: string } | null)?.full_name ?? 'Unknown',
      }

      setNotes((prev) => [noteWithAuthor, ...prev])
    },
    [studentId]
  )

  const updateNote = useCallback(
    async (id: string, data: TeacherNoteUpdate) => {
      setError(null)
      const { error: updateError } = await supabase
        .from('teacher_notes')
        .update(data)
        .eq('id', id)

      if (updateError) throw updateError
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...data } as TeacherNoteWithAuthor : n))
      )
    },
    []
  )

  const deleteNote = useCallback(
    async (id: string) => {
      setError(null)
      const { error: deleteError } = await supabase
        .from('teacher_notes')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setNotes((prev) => prev.filter((n) => n.id !== id))
    },
    []
  )

  return { notes, loading, error, addNote, updateNote, deleteNote, refetch }
}

// ============================================================
// useStudentDocuments — CRUD for student profile documents
// ============================================================

interface UseStudentDocumentsReturn {
  documents: StudentDocument[]
  loading: boolean
  error: string | null
  uploadDocument: (file: File, description: string) => Promise<void>
  updateDescription: (id: string, description: string) => Promise<void>
  deleteDocument: (doc: StudentDocument) => Promise<void>
  downloadDocument: (doc: StudentDocument) => Promise<void>
  refetch: () => void
}

export function useStudentDocuments(studentId: string | undefined): UseStudentDocumentsReturn {
  const [documents, setDocuments] = useState<StudentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) {
      setDocuments([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('student_documents')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (fetchError) throw fetchError
        setDocuments((data as StudentDocument[]) ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load documents')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studentId, fetchCount])

  const uploadDocument = useCallback(
    async (file: File, description: string) => {
      if (!studentId) return

      // Get school_id from the student record
      const { data: studentRow } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', studentId)
        .single()

      if (!studentRow) throw new Error('Student not found')

      const filePath = `students/${studentId}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('school-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: inserted, error: insertError } = await supabase
        .from('student_documents')
        .insert({
          student_id: studentId,
          school_id: (studentRow as { school_id: string }).school_id,
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
      setDocuments((prev) => [inserted as StudentDocument, ...prev])
    },
    [studentId]
  )

  const updateDescription = useCallback(async (id: string, description: string) => {
    const { error: updateError } = await supabase
      .from('student_documents')
      .update({ description: description || null })
      .eq('id', id)

    if (updateError) throw updateError
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, description: description || null } : d))
    )
  }, [])

  const deleteDocument = useCallback(async (doc: StudentDocument) => {
    // Remove from storage
    const { error: storageError } = await supabase.storage
      .from('school-documents')
      .remove([doc.file_path])

    if (storageError) {
      console.warn('Storage delete failed:', storageError.message)
    }

    // Remove metadata row
    const { error: dbError } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', doc.id)

    if (dbError) throw dbError
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }, [])

  const downloadDocument = useCallback(async (doc: StudentDocument) => {
    const { data, error: signError } = await supabase.storage
      .from('school-documents')
      .createSignedUrl(doc.file_path, 60)

    if (signError || !data?.signedUrl) throw signError ?? new Error('Could not create download link')
    window.open(data.signedUrl, '_blank')
  }, [])

  return { documents, loading, error, uploadDocument, updateDescription, deleteDocument, downloadDocument, refetch }
}

// ============================================================
// useTeacherNoteFiles — folders + files for teacher-note file manager
// ============================================================

interface UseTeacherNoteFilesReturn {
  folders: TeacherNoteFolder[]
  files: TeacherNoteFile[]
  loading: boolean
  error: string | null
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (folder: TeacherNoteFolder) => Promise<void>
  uploadFile: (file: File, folderId?: string | null) => Promise<void>
  deleteFile: (file: TeacherNoteFile) => Promise<void>
  downloadFile: (file: TeacherNoteFile) => Promise<void>
  refetch: () => void
}

export function useTeacherNoteFiles(studentId: string | undefined): UseTeacherNoteFilesReturn {
  const [folders, setFolders] = useState<TeacherNoteFolder[]>([])
  const [files, setFiles] = useState<TeacherNoteFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) {
      setFolders([])
      setFiles([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [foldersRes, filesRes] = await Promise.all([
          supabase
            .from('teacher_note_folders')
            .select('*')
            .eq('student_id', studentId)
            .order('name'),
          supabase
            .from('teacher_note_files')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false }),
        ])

        if (cancelled) return
        if (foldersRes.error) throw foldersRes.error
        if (filesRes.error) throw filesRes.error

        setFolders((foldersRes.data as TeacherNoteFolder[]) ?? [])
        setFiles((filesRes.data as TeacherNoteFile[]) ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load files')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studentId, fetchCount])

  const createFolder = useCallback(
    async (name: string) => {
      if (!studentId) return

      const { data: studentRow } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', studentId)
        .single()

      if (!studentRow) throw new Error('Student not found')

      const { data: inserted, error: insertError } = await supabase
        .from('teacher_note_folders')
        .insert({
          student_id: studentId,
          school_id: (studentRow as { school_id: string }).school_id,
          name,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      setFolders((prev) => [...prev, inserted as TeacherNoteFolder].sort((a, b) => a.name.localeCompare(b.name)))
    },
    [studentId]
  )

  const renameFolder = useCallback(async (id: string, name: string) => {
    const { error: updateError } = await supabase
      .from('teacher_note_folders')
      .update({ name })
      .eq('id', id)

    if (updateError) throw updateError
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f)).sort((a, b) => a.name.localeCompare(b.name))
    )
  }, [])

  const deleteFolder = useCallback(
    async (folder: TeacherNoteFolder) => {
      // Remove storage files for all files in this folder
      const folderFiles = files.filter((f) => f.folder_id === folder.id)
      if (folderFiles.length > 0) {
        const paths = folderFiles.map((f) => f.file_path)
        await supabase.storage.from('school-documents').remove(paths)
      }

      // DB cascade deletes the teacher_note_files rows
      const { error: dbError } = await supabase
        .from('teacher_note_folders')
        .delete()
        .eq('id', folder.id)

      if (dbError) throw dbError
      setFolders((prev) => prev.filter((f) => f.id !== folder.id))
      setFiles((prev) => prev.filter((f) => f.folder_id !== folder.id))
    },
    [files]
  )

  const uploadFile = useCallback(
    async (file: File, folderId?: string | null) => {
      if (!studentId) return

      const { data: studentRow } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', studentId)
        .single()

      if (!studentRow) throw new Error('Student not found')

      const filePath = `notes/${studentId}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('school-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: inserted, error: insertError } = await supabase
        .from('teacher_note_files')
        .insert({
          folder_id: folderId ?? null,
          student_id: studentId,
          school_id: (studentRow as { school_id: string }).school_id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      setFiles((prev) => [inserted as TeacherNoteFile, ...prev])
    },
    [studentId]
  )

  const deleteFile = useCallback(async (file: TeacherNoteFile) => {
    await supabase.storage.from('school-documents').remove([file.file_path])

    const { error: dbError } = await supabase
      .from('teacher_note_files')
      .delete()
      .eq('id', file.id)

    if (dbError) throw dbError
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
  }, [])

  const downloadFile = useCallback(async (file: TeacherNoteFile) => {
    const { data, error: signError } = await supabase.storage
      .from('school-documents')
      .createSignedUrl(file.file_path, 60)

    if (signError || !data?.signedUrl) throw signError ?? new Error('Could not create download link')
    window.open(data.signedUrl, '_blank')
  }, [])

  return {
    folders, files, loading, error,
    createFolder, renameFolder, deleteFolder,
    uploadFile, deleteFile, downloadFile,
    refetch,
  }
}

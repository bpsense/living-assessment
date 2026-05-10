/**
 * AssignProjectModal.tsx
 *
 * Single entry-point modal for creating a standards-driven assignment.
 * Used by: global FAB, learner profile "Assign new", classroom view.
 *
 * Pre-targeted modes:
 *   - prefilledStudent: opens with assignment_type='individual' and the
 *     student locked in. Used from a learner's profile.
 *   - prefilledClassroom: opens with the classroom locked in; user chooses
 *     class-wide or a subset of students.
 *   - neither: full chooser (school admin/teacher picks classroom + scope).
 */
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Paperclip, Trash2, X } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { supabase } from '../../lib/supabase'
import { createStandardsAssignment } from '../../lib/standards-assignment-data'
import { uploadAssignmentAttachments, MAX_UPLOAD_BYTES } from '../../lib/assignment-files'
import StandardsPicker from '../standards/StandardsPicker'
import type { Classroom, Student } from '../../types/database'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (assignmentId: string) => void
  prefilledStudent?: { id: string; first_name: string; last_name: string }
  prefilledClassroom?: { id: string; name: string }
}

export default function AssignProjectModal({
  open,
  onClose,
  onCreated,
  prefilledStudent,
  prefilledClassroom,
}: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<string>('')
  const [classroomId, setClassroomId] = useState<string | null>(prefilledClassroom?.id ?? null)
  const [scope, setScope] = useState<'class' | 'individuals'>(
    prefilledStudent ? 'individuals' : 'class'
  )
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    prefilledStudent ? new Set([prefilledStudent.id]) : new Set()
  )
  const [selectedStandardIds, setSelectedStandardIds] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Reset form on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setDueDate('')
    setClassroomId(prefilledClassroom?.id ?? null)
    setScope(prefilledStudent ? 'individuals' : 'class')
    setSelectedStudentIds(prefilledStudent ? new Set([prefilledStudent.id]) : new Set())
    setSelectedStandardIds(new Set())
    setFiles([])
  }, [open, prefilledStudent, prefilledClassroom])

  // Body scroll lock + Escape close
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  // Load classrooms (when no prefill) and students for the chosen classroom
  useEffect(() => {
    if (!open || !profile?.school_id) return
    if (prefilledClassroom) return
    setLoadingMeta(true)
    supabase
      .from('classrooms')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('name')
      .then(({ data }) => {
        setClassrooms((data ?? []) as Classroom[])
        setLoadingMeta(false)
      })
  }, [open, profile?.school_id, prefilledClassroom])

  useEffect(() => {
    if (!open) return
    const cid = classroomId
    if (!cid) {
      setStudents([])
      return
    }
    supabase
      .from('student_classrooms')
      .select('student:student_id(*)')
      .eq('classroom_id', cid)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as Array<{ student: Student | Student[] | null }>
        const out: Student[] = []
        for (const r of rows) {
          if (!r.student) continue
          if (Array.isArray(r.student)) out.push(...r.student)
          else out.push(r.student)
        }
        setStudents(out)
      })
  }, [open, classroomId])

  const targetCount = useMemo(() => {
    if (scope === 'class') return students.length
    return selectedStudentIds.size
  }, [scope, students.length, selectedStudentIds])

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    selectedStandardIds.size > 0 &&
    targetCount > 0 &&
    !!profile

  async function handleSubmit() {
    if (!canSubmit || !profile?.school_id) return
    setSubmitting(true)
    try {
      const studentIds =
        scope === 'class' ? students.map((s) => s.id) : Array.from(selectedStudentIds)

      const assignmentId = await createStandardsAssignment({
        assignment: {
          school_id: profile.school_id,
          classroom_id: classroomId,
          teacher_id: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          assignment_type: scope === 'class' ? 'class' : 'individual',
          status: 'active',
          template_id: null,
          project_data: {},
        },
        standardIds: Array.from(selectedStandardIds),
        studentIds,
      })

      if (files.length > 0) {
        try {
          await uploadAssignmentAttachments({
            assignmentId,
            schoolId: profile.school_id,
            uploadedBy: profile.id,
            files,
          })
        } catch (e) {
          // Non-fatal: assignment is created; file upload can be retried.
          toast(e instanceof Error ? e.message : 'Some files failed to upload', 'error')
        }
      }

      toast(`Assigned to ${studentIds.length} student${studentIds.length === 1 ? '' : 's'}`, 'success')
      onCreated?.(assignmentId)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create assignment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (f.size > MAX_UPLOAD_BYTES * 4) {
        toast(`${f.name} is too large; pick a smaller file.`, 'error')
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  if (!open || !profile) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text">Assign a Project</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Title / description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Patterns in Nature"
              className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-text-muted">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text"
              />
            </div>

            {!prefilledClassroom && (
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-text-muted">Classroom</label>
                <select
                  value={classroomId ?? ''}
                  onChange={(e) => setClassroomId(e.target.value || null)}
                  disabled={loadingMeta}
                  className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text disabled:opacity-60"
                >
                  <option value="">— none (individuals only) —</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Scope */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Assign to</label>
            {prefilledStudent ? (
              <div className="rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text">
                {prefilledStudent.first_name} {prefilledStudent.last_name}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-sm text-text">
                  <input
                    type="radio"
                    checked={scope === 'class'}
                    onChange={() => setScope('class')}
                    disabled={!classroomId}
                  />
                  Whole class ({students.length})
                </label>
                <label className="flex items-center gap-1.5 text-sm text-text">
                  <input
                    type="radio"
                    checked={scope === 'individuals'}
                    onChange={() => setScope('individuals')}
                  />
                  Specific students
                </label>
              </div>
            )}

            {!prefilledStudent && scope === 'individuals' && students.length > 0 && (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-bg-muted bg-bg-card p-2">
                {students.map((s) => {
                  const checked = selectedStudentIds.has(s.id)
                  return (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-bg-muted/40">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = new Set(selectedStudentIds)
                          if (checked) next.delete(s.id)
                          else next.add(s.id)
                          setSelectedStudentIds(next)
                        }}
                      />
                      <span>{s.first_name} {s.last_name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Standards picker */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Standards</label>
            <StandardsPicker
              schoolId={profile.school_id}
              selectedIds={selectedStandardIds}
              onChange={setSelectedStandardIds}
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Attachments (optional — visible to all assigned)
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-bg-muted bg-bg-card px-3 py-2 text-sm text-text-muted hover:bg-bg-muted/40">
              <Paperclip className="h-4 w-4" />
              <span>Choose files…</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
                  >
                    <span className="truncate">
                      {f.name} <span className="text-text-light">— {(f.size / 1024).toFixed(1)} KB</span>
                    </span>
                    <button
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-text-light hover:bg-bg-muted hover:text-text"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-bg-muted px-5 py-3">
          <span className="text-xs text-text-muted">
            {targetCount} student{targetCount === 1 ? '' : 's'} ·{' '}
            {selectedStandardIds.size} standard{selectedStandardIds.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

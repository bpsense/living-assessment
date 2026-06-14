import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import { X, Search, Loader2, Check, StickyNote, Lock, Unlock, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { addTeacherNoteForStudents } from '../lib/sis-data'
import type { Student, NoteType } from '../types/database'

interface Props {
  open: boolean
  onClose: () => void
}

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'social-emotional', label: 'Social-Emotional' },
  { value: 'medical', label: 'Medical' },
]

// ============================================================
// Step 1: Multi-select student picker (classroom-scoped for educators)
// ============================================================

function StudentMultiSelect({
  schoolId,
  educatorId,
  role,
  selected,
  onChange,
}: {
  schoolId: string
  /** Current user's ID — used to fetch classroom assignments for educators */
  educatorId: string
  /** Current user's role — admins bypass classroom scoping */
  role: string
  selected: Student[]
  onChange: (next: Student[]) => void
}) {
  const [query, setQuery] = useState('')
  const [roster, setRoster] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  /** Educator's assigned classrooms (id + name). null until loaded. */
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[] | null>(null)
  /** Selected classroom filter; null = all of the educator's classrooms. */
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null)
  const [noClassrooms, setNoClassrooms] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAdmin = role === 'admin'
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  // Classroom IDs in the current scope (selected one, or all assigned).
  const scopedClassroomIds = !classrooms
    ? null
    : selectedClassroom
      ? [selectedClassroom]
      : classrooms.map((c) => c.id)

  // Focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch educator's assigned classrooms (educators only)
  useEffect(() => {
    if (isAdmin) {
      setClassrooms(null)
      return
    }

    async function fetchClassrooms() {
      const { data } = await supabase
        .from('educator_classrooms')
        .select('classroom_id, classrooms(id, name)')
        .eq('educator_id', educatorId)

      const rooms = (data ?? [])
        .map((r) => {
          // Supabase types the joined relation as an array; it's to-one here.
          const rel = (r as { classrooms: { id: string; name: string } | { id: string; name: string }[] | null }).classrooms
          const c = Array.isArray(rel) ? rel[0] : rel
          return c ? { id: c.id, name: c.name } : null
        })
        .filter((c): c is { id: string; name: string } => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name))

      if (rooms.length === 0) {
        setNoClassrooms(true)
        setClassrooms([])
      } else {
        setNoClassrooms(false)
        setClassrooms(rooms)
      }
    }
    fetchClassrooms()
  }, [educatorId, isAdmin])

  // Active student IDs in the current classroom scope (educators only).
  const fetchActiveStudentIds = useCallback(
    async (classroomIds: string[]): Promise<string[]> => {
      const { data } = await supabase
        .from('student_classrooms')
        .select('student_id')
        .in('classroom_id', classroomIds)
        .eq('status', 'active')
      return [...new Set((data ?? []).map((r) => r.student_id))]
    },
    []
  )

  // Load the full roster for the current scope. Unlike Quick Observation's
  // typeahead, we load the whole scoped list so the teacher can scan it and
  // multi-select / "select all" a group; the search box filters client-side.
  useEffect(() => {
    // Wait for classrooms to load for educators
    if (!isAdmin && scopedClassroomIds === null) return

    let cancelled = false
    setLoading(true)
    async function load() {
      if (!isAdmin && scopedClassroomIds && scopedClassroomIds.length > 0) {
        const studentIds = await fetchActiveStudentIds(scopedClassroomIds)
        if (cancelled) return
        if (studentIds.length === 0) {
          setRoster([])
          setLoading(false)
          return
        }
        const { data } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)
          .eq('school_id', schoolId)
          .order('last_name')
        if (!cancelled) setRoster((data ?? []) as Student[])
      } else if (!isAdmin) {
        // Educator with no classrooms in scope
        setRoster([])
      } else {
        // Admins see all students in the school
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', schoolId)
          .order('last_name')
        if (!cancelled) setRoster((data ?? []) as Student[])
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, isAdmin, selectedClassroom, classrooms, fetchActiveStudentIds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    )
  }, [roster, query])

  function toggle(student: Student) {
    if (selectedIds.has(student.id)) {
      onChange(selected.filter((s) => s.id !== student.id))
    } else {
      onChange([...selected, student])
    }
  }

  // Select / clear all currently-visible (filtered) students.
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(filtered.map((s) => s.id))
      onChange(selected.filter((s) => !visibleIds.has(s.id)))
    } else {
      const merged = [...selected]
      for (const s of filtered) {
        if (!selectedIds.has(s.id)) merged.push(s)
      }
      onChange(merged)
    }
  }

  // Educator has no classrooms assigned
  if (noClassrooms && !isAdmin) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-text-muted">No classrooms assigned.</p>
        <p className="text-xs text-text-light">
          Ask your admin to assign you to classrooms before writing notes.
        </p>
      </div>
    )
  }

  // Show classroom filter chips when the educator teaches more than one room.
  const showClassroomFilter = !isAdmin && classrooms !== null && classrooms.length > 1

  return (
    <div className="space-y-3">
      {showClassroomFilter && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedClassroom(null)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedClassroom === null
                ? 'bg-primary-500 text-white'
                : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
            )}
          >
            All classrooms
          </button>
          {classrooms!.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClassroom(c.id)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedClassroom === c.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search learner by name..."
          className="w-full rounded-xl border border-bg-muted bg-bg py-3 pl-10 pr-4 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-light" />
        )}
      </div>

      {/* Selection summary + select all */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-light">
          {selected.length > 0
            ? `${selected.length} selected`
            : 'Select one or more learners'}
        </p>
        {filtered.length > 0 && (
          <button
            onClick={toggleAllVisible}
            className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            {allVisibleSelected ? 'Clear all' : 'Select all'}
          </button>
        )}
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {!loading && filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-text-light">
            {query ? 'No learners found' : 'No learners available'}
          </p>
        )}
        {filtered.map((s) => {
          const initials = `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
          const isChecked = selectedIds.has(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                isChecked ? 'bg-primary-50' : 'hover:bg-primary-50'
              )}
            >
              <span
                className={clsx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  isChecked
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-bg-muted bg-bg'
                )}
              >
                {isChecked && <Check className="h-3.5 w-3.5" />}
              </span>
              {s.avatar_url ? (
                <img
                  src={s.avatar_url}
                  alt={`${s.first_name} ${s.last_name}`}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                  <span className="text-xs font-bold text-primary-700">{initials}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {s.first_name} {s.last_name}
                </p>
                {s.grade_level && (
                  <p className="text-[11px] text-text-light">Grade {s.grade_level}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Main modal
// ============================================================

export default function QuickNoteModal({ open, onClose }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [step, setStep] = useState<'select' | 'compose'>('select')
  const [selected, setSelected] = useState<Student[]>([])
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('general')
  const [confidential, setConfidential] = useState(true)
  const [saving, setSaving] = useState(false)

  // Reset when the modal closes (after the close animation).
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep('select')
        setSelected([])
        setContent('')
        setNoteType('general')
        setConfidential(true)
        setSaving(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  if (!profile) return null

  async function handleSave() {
    if (!profile || selected.length === 0 || !content.trim() || saving) return
    setSaving(true)
    try {
      const count = await addTeacherNoteForStudents(
        selected.map((s) => s.id),
        {
          content: content.trim(),
          note_type: noteType,
          is_confidential: confidential,
          school_id: profile.school_id,
          author_id: profile.id,
        }
      )
      toast(
        count === 1 ? 'Note added' : `Note added to ${count} learners`,
        'success'
      )
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add note', 'error')
      setSaving(false)
    }
  }

  const recipientSummary =
    selected.length === 1
      ? `${selected[0].first_name} ${selected[0].last_name}`
      : `${selected.length} learners`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="glass-scrim absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className={clsx(
          'glass-modal relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl',
          'animate-in slide-in-from-bottom duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-text">
              <StickyNote className="h-4 w-4 text-primary-500" />
              Quick Note
            </h2>
            {step === 'compose' && (
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <Users className="h-3 w-3" />
                {recipientSummary}
                <button
                  onClick={() => setStep('select')}
                  className="ml-1 text-primary-500 hover:underline"
                >
                  change
                </button>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'select' ? (
            <StudentMultiSelect
              schoolId={profile.school_id}
              educatorId={profile.id}
              role={profile.role}
              selected={selected}
              onChange={setSelected}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Note
                </label>
                <textarea
                  autoFocus
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  placeholder="Write a quick note…"
                  className="w-full resize-none rounded-xl border border-bg-muted bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {NOTE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setNoteType(t.value)}
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        noteType === t.value
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setConfidential((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-bg-muted bg-bg px-3 py-2.5 text-left transition-colors hover:bg-bg-muted"
              >
                <span className="flex items-center gap-2 text-sm text-text">
                  {confidential ? (
                    <Lock className="h-4 w-4 text-text-muted" />
                  ) : (
                    <Unlock className="h-4 w-4 text-primary-500" />
                  )}
                  {confidential ? 'Confidential (staff only)' : 'Visible to family'}
                </span>
                <span
                  className={clsx(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    confidential ? 'bg-bg-muted' : 'bg-primary-500'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      confidential ? 'translate-x-0.5' : 'translate-x-4'
                    )}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-bg-muted px-5 py-3">
          {step === 'select' ? (
            <button
              onClick={() => setStep('compose')}
              disabled={selected.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
              {selected.length > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {selected.length}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StickyNote className="h-4 w-4" />
              )}
              {saving
                ? 'Saving…'
                : selected.length === 1
                  ? 'Save note'
                  : `Save to ${selected.length} learners`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

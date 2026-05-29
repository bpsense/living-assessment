import { useState, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { X, Search, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ObservationForm from './observation/ObservationForm'
import type { Student } from '../types/database'

interface Props {
  open: boolean
  onClose: () => void
}

// ============================================================
// Step 1: Student search with typeahead
// ============================================================

function StudentSearch({
  schoolId,
  educatorId,
  role,
  onSelect,
}: {
  schoolId: string
  /** Current user's ID — used to fetch classroom assignments for educators */
  educatorId: string
  /** Current user's role — admins bypass classroom scoping */
  role: string
  onSelect: (student: Student) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [recentStudents, setRecentStudents] = useState<Student[]>([])
  /** Educator's assigned classrooms (id + name). null until loaded. */
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[] | null>(null)
  /** Selected classroom filter; null = all of the educator's classrooms. */
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null)
  const [noClassrooms, setNoClassrooms] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAdmin = role === 'admin'

  // Classroom IDs in the current scope (selected one, or all assigned).
  const scopedClassroomIds = !classrooms
    ? null
    : selectedClassroom
      ? [selectedClassroom]
      : classrooms.map((c) => c.id)

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch educator's assigned classrooms (educators only)
  useEffect(() => {
    if (isAdmin) {
      // Admins see all students — no classroom filter
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

  // Fetch active student IDs in the current classroom scope (educators only).
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

  // Load recent students (first 6) — scoped for educators, active-only.
  useEffect(() => {
    // Wait for classrooms to load for educators
    if (!isAdmin && scopedClassroomIds === null) return
    if (!isAdmin && scopedClassroomIds?.length === 0) return

    let cancelled = false
    async function loadRecent() {
      if (!isAdmin && scopedClassroomIds && scopedClassroomIds.length > 0) {
        const studentIds = await fetchActiveStudentIds(scopedClassroomIds)
        if (cancelled) return
        if (studentIds.length === 0) {
          setRecentStudents([])
          return
        }
        const { data } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)
          .eq('school_id', schoolId)
          .order('last_name')
          .limit(6)
        if (!cancelled) setRecentStudents((data ?? []) as Student[])
      } else {
        // Admins see all students
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', schoolId)
          .order('last_name')
          .limit(6)
        if (!cancelled) setRecentStudents((data ?? []) as Student[])
      }
    }
    loadRecent()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, isAdmin, selectedClassroom, classrooms, fetchActiveStudentIds])

  const search = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setResults([])
        return
      }
      // Don't search if educator has no classrooms
      if (!isAdmin && scopedClassroomIds?.length === 0) return

      setLoading(true)

      if (!isAdmin && scopedClassroomIds && scopedClassroomIds.length > 0) {
        // For educators: scope to ACTIVE students in their classroom(s)
        const studentIds = await fetchActiveStudentIds(scopedClassroomIds)
        if (studentIds.length === 0) {
          setResults([])
          setLoading(false)
          return
        }
        const { data } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)
          .eq('school_id', schoolId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .order('last_name')
          .limit(10)
        setResults((data ?? []) as Student[])
      } else {
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', schoolId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .order('last_name')
          .limit(10)
        setResults((data ?? []) as Student[])
      }
      setLoading(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schoolId, isAdmin, selectedClassroom, classrooms, fetchActiveStudentIds]
  )

  // Re-run the active search when the classroom filter changes.
  useEffect(() => {
    if (query.length > 0) search(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassroom])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 200)
  }

  const displayList = query.length > 0 ? results : recentStudents

  // Educator has no classrooms assigned
  if (noClassrooms && !isAdmin) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-text-muted">
          No classrooms assigned.
        </p>
        <p className="text-xs text-text-light">
          Ask your admin to assign you to classrooms before recording observations.
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
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search learner by name..."
          className="w-full rounded-xl border border-bg-muted bg-bg py-3 pl-10 pr-4 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-light" />
        )}
      </div>

      {query.length === 0 && recentStudents.length > 0 && (
        <p className="text-xs font-medium text-text-light">Learners</p>
      )}

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {displayList.length === 0 && query.length > 0 && !loading && (
          <p className="py-4 text-center text-sm text-text-light">
            No learners found
          </p>
        )}
        {displayList.map((s) => {
          const initials = `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-50"
            >
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

export default function QuickObserveModal({ open, onClose }: Props) {
  const { profile } = useAuth()
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      // Small delay to let close animation finish
      const timer = setTimeout(() => setSelectedStudent(null), 200)
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

  // Prevent body scroll
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="glass-scrim absolute inset-0"
        onClick={onClose}
      />

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
            <h2 className="text-base font-bold text-text">Quick Observation</h2>
            {selectedStudent && (
              <p className="text-xs text-text-muted">
                {selectedStudent.first_name} {selectedStudent.last_name}
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="ml-2 text-primary-500 hover:underline"
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
          {!selectedStudent ? (
            <StudentSearch
              schoolId={profile.school_id}
              educatorId={profile.id}
              role={profile.role}
              onSelect={setSelectedStudent}
            />
          ) : (
            <ObservationForm
              studentId={selectedStudent.id}
              schoolId={selectedStudent.school_id}
              compact
              onSaved={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

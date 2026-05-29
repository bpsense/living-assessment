import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Loader2, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'

// ============================================================
// Types — shape returned by get_educator_archived_students RPC
// ============================================================

interface ArchivedRow {
  student_id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  grade_level: string | null
  avatar_url: string | null
  classroom_id: string
  classroom_name: string
  enrolled_at: string
  archived_at: string | null
}

/** One student, with the classroom(s) they were archived from. */
interface ArchivedStudent {
  student_id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  grade_level: string | null
  avatar_url: string | null
  classrooms: { id: string; name: string }[]
  /** Most recent archived_at across the student's archived enrollments. */
  lastArchivedAt: string | null
}

// ============================================================
// Page
// ============================================================

export default function ArchivedStudents() {
  const { profile } = useAuth()
  const { formatStudentName } = useAccessControl()
  const navigate = useNavigate()

  const [students, setStudents] = useState<ArchivedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [classroomFilter, setClassroomFilter] = useState<string>('')

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: rpcErr } = await supabase.rpc(
        'get_educator_archived_students',
        { p_educator_id: profile!.id }
      )
      if (cancelled) return
      if (rpcErr) {
        setError(rpcErr.message)
        setLoading(false)
        return
      }

      // Group rows by student.
      const byStudent = new Map<string, ArchivedStudent>()
      for (const row of (data ?? []) as ArchivedRow[]) {
        const existing = byStudent.get(row.student_id)
        if (existing) {
          if (!existing.classrooms.some((c) => c.id === row.classroom_id)) {
            existing.classrooms.push({ id: row.classroom_id, name: row.classroom_name })
          }
          if (
            row.archived_at &&
            (!existing.lastArchivedAt || row.archived_at > existing.lastArchivedAt)
          ) {
            existing.lastArchivedAt = row.archived_at
          }
        } else {
          byStudent.set(row.student_id, {
            student_id: row.student_id,
            first_name: row.first_name,
            last_name: row.last_name,
            preferred_name: row.preferred_name,
            grade_level: row.grade_level,
            avatar_url: row.avatar_url,
            classrooms: [{ id: row.classroom_id, name: row.classroom_name }],
            lastArchivedAt: row.archived_at,
          })
        }
      }

      const list = [...byStudent.values()].sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      )
      setStudents(list)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  // Distinct classrooms for the filter dropdown.
  const classroomOptions = (() => {
    const map = new Map<string, string>()
    for (const s of students) {
      for (const c of s.classrooms) map.set(c.id, c.name)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })()

  const filtered = students.filter((s) => {
    if (classroomFilter && !s.classrooms.some((c) => c.id === classroomFilter)) {
      return false
    }
    if (search) {
      const q = search.toLowerCase()
      const name = `${s.first_name} ${s.last_name} ${s.preferred_name ?? ''}`.toLowerCase()
      const rooms = s.classrooms.map((c) => c.name).join(' ').toLowerCase()
      if (!name.includes(q) && !rooms.includes(q)) return false
    }
    return true
  })

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <Archive className="h-6 w-6 text-text-muted" />
          Archived Learners
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Learners you previously taught who have since been archived from a
          classroom you shared.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or classroom..."
            className="w-full rounded-lg border border-bg-muted bg-bg-card py-2.5 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        {classroomOptions.length > 1 && (
          <select
            value={classroomFilter}
            onChange={(e) => setClassroomFilter(e.target.value)}
            className="rounded-lg border border-bg-muted bg-bg-card px-3 py-2.5 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">All classrooms</option>
            {classroomOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Archive className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            {students.length === 0
              ? 'No archived learners yet.'
              : 'No archived learners match your search.'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-muted bg-bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Learner</th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-muted sm:table-cell">
                  Grade
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Classroom</th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-muted md:table-cell">
                  Archived
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const displayName = formatStudentName(s.first_name, s.last_name)
                const initials = `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
                return (
                  <tr
                    key={s.student_id}
                    className="border-b border-bg-muted last:border-0 transition-colors hover:bg-bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            alt={displayName}
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-semibold text-text-muted">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/student/${s.student_id}`)}
                            className="font-medium text-text hover:text-primary-600"
                          >
                            {displayName}
                          </button>
                          <p className="text-xs text-text-light sm:hidden">
                            {s.classrooms.map((c) => c.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {s.grade_level ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.classrooms.map((c) => (
                          <span
                            key={c.id}
                            className={clsx(
                              'inline-block rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted'
                            )}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted md:table-cell">
                      {formatDate(s.lastArchivedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

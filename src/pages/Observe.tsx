import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardPen,
  Search,
  Loader2,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Student, Classroom } from '../types/database'

/**
 * Quick Observe page — search for a student and jump to their observation form.
 * Replaces the empty stub with a full student search + recent students view.
 */
export default function Observe() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState<(Student & { classroom_name: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!profile) return

    async function fetch() {
      const [studRes, classRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('school_id', profile!.school_id)
          .order('first_name'),
        supabase
          .from('classrooms')
          .select('id, name')
          .eq('school_id', profile!.school_id),
      ])

      const studs = (studRes.data ?? []) as Student[]
      const classes = (classRes.data ?? []) as Pick<Classroom, 'id' | 'name'>[]
      const classMap = new Map(classes.map((c) => [c.id, c.name]))

      setStudents(
        studs.map((s) => ({
          ...s,
          classroom_name: classMap.get(s.classroom_id) ?? 'Unknown',
        }))
      )
      setLoading(false)
    }

    fetch()
  }, [profile])

  const filtered = search
    ? students.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          s.classroom_name.toLowerCase().includes(search.toLowerCase())
      )
    : students

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Quick Observe</h1>
        <p className="mt-1 text-sm text-text-muted">
          Select a learner to record an observation.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search learners..."
          autoFocus
          className="w-full rounded-lg border border-bg-muted bg-bg-card py-3 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-10 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            {search ? 'No learners match your search.' : 'No learners in your school yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((student) => {
            const initials =
              `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()
            return (
              <button
                key={student.id}
                onClick={() => navigate(`/student/${student.id}/observe`)}
                className="flex w-full items-center gap-4 rounded-xl border border-bg-muted bg-bg-card p-4 text-left shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {student.classroom_name}
                    {student.grade_level ? ` · Grade ${student.grade_level}` : ''}
                  </p>
                </div>
                <ClipboardPen className="h-5 w-5 shrink-0 text-primary-400" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

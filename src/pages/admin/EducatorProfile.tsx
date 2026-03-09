import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Search,
  ClipboardPen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/Toast'
import {
  useEducatorProfile,
  assignClassroom,
  unassignClassroom,
} from '../../lib/educator-data'

// ============================================================
// Rating helpers
// ============================================================

function getRatingLabel(rating: number): string {
  const level = Math.min(Math.ceil(rating), 4)
  const labels = ['Emerging', 'Developing', 'Achieving', 'Mastery']
  const base = labels[level - 1] ?? String(rating)
  const fraction = rating - (level - 1)
  if (fraction <= 0.34) return `${base} ⅓`
  if (fraction <= 0.67) return `${base} ⅔`
  return base
}

function RatingBadge({ rating }: { rating: number }) {
  const r = Number(rating)
  const label = getRatingLabel(r)
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-[10px] font-bold',
        r >= 3.5 && 'bg-success-50 text-success-700',
        r >= 2.5 && r < 3.5 && 'bg-primary-50 text-primary-700',
        r >= 1.5 && r < 2.5 && 'bg-accent-50 text-accent-700',
        r > 0 && r < 1.5 && 'bg-alert-50 text-alert-700',
        r <= 0 && 'bg-bg-muted text-text-muted'
      )}
    >
      {label}
    </span>
  )
}

// ============================================================
// Main page
// ============================================================

export default function EducatorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile: adminProfile } = useAuth()
  const { toast } = useToast()
  const {
    educator,
    classrooms,
    allClassrooms,
    monthlyStats,
    studentStats,
    recentObservations,
    loading,
    error,
    refetch,
  } = useEducatorProfile(id)

  const [studentFilter, setStudentFilter] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [addClassroomOpen, setAddClassroomOpen] = useState(false)

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !educator) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          onClick={() => navigate('/admin/educators')}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Educators
        </button>
        <div className="rounded-xl border border-alert-200 bg-alert-50 p-6 text-center">
          <p className="text-sm text-alert-700">{error ?? 'Educator not found'}</p>
        </div>
      </div>
    )
  }

  const assignedIds = new Set(classrooms.map((c) => c.id))
  const unassignedClassrooms = allClassrooms.filter((c) => !assignedIds.has(c.id))

  const initials = educator.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Filtered student stats
  const filteredStudents = studentFilter
    ? studentStats.filter((s) =>
        s.student_name.toLowerCase().includes(studentFilter.toLowerCase())
      )
    : studentStats

  // Monthly stats totals
  const totalMonthlyObs = monthlyStats.reduce((s, m) => s + m.count, 0)

  // Classroom assign/unassign handlers
  async function handleAssign(classroomId: string) {
    if (!adminProfile || assigning) return
    setAssigning(true)
    const { error: err } = await assignClassroom(educator!.id, classroomId, educator!.school_id)
    if (err) {
      toast(`Failed to assign: ${err}`, 'error')
    } else {
      toast('Classroom assigned', 'success')
      refetch()
    }
    setAssigning(false)
    setAddClassroomOpen(false)
  }

  async function handleUnassign(classroomId: string) {
    if (!adminProfile || assigning) return
    setAssigning(true)
    const { error: err } = await unassignClassroom(educator!.id, classroomId)
    if (err) {
      toast(`Failed to unassign: ${err}`, 'error')
    } else {
      toast('Classroom removed', 'success')
      refetch()
    }
    setAssigning(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/admin/educators')}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Educators
      </button>

      {/* ============ Header ============ */}
      <div className="flex items-center gap-4">
        {educator.avatar_url ? (
          <img
            src={educator.avatar_url}
            alt={educator.full_name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100">
            <span className="text-lg font-bold text-primary-700">{initials}</span>
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-text">{educator.full_name}</h1>
          <p className="text-sm text-text-muted">{educator.email}</p>
          <span className="mt-1 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
            Educator
          </span>
        </div>
      </div>

      {/* ============ Classroom Assignment ============ */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Assigned Classrooms</h2>
          {unassignedClassrooms.length > 0 && (
            <button
              onClick={() => setAddClassroomOpen(!addClassroomOpen)}
              className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Classroom
            </button>
          )}
        </div>

        {/* Add classroom dropdown */}
        {addClassroomOpen && unassignedClassrooms.length > 0 && (
          <div className="mb-4 rounded-lg border border-bg-muted bg-bg p-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Select a classroom to assign:</p>
            <div className="flex flex-wrap gap-2">
              {unassignedClassrooms.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAssign(c.id)}
                  disabled={assigning}
                  className="rounded-lg border border-bg-muted bg-bg-card px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50"
                >
                  {c.name}
                  {c.grade_level ? ` (${c.grade_level})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assigned list */}
        {classrooms.length === 0 ? (
          <p className="text-sm text-text-light">No classrooms assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classrooms.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-1.5"
              >
                <span className="text-xs font-medium text-primary-700">{c.name}</span>
                <button
                  onClick={() => handleUnassign(c.id)}
                  disabled={assigning}
                  className="rounded-full p-0.5 text-primary-400 transition-colors hover:bg-primary-100 hover:text-primary-700 disabled:opacity-50"
                  title="Remove classroom"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ Monthly Observation Stats ============ */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-text">
          Monthly Observations
          <span className="ml-2 text-xs font-normal text-text-muted">
            ({totalMonthlyObs} total over 12 months)
          </span>
        </h2>

        {monthlyStats.length === 0 ? (
          <p className="text-sm text-text-light">No observation data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {monthlyStats.map((stat) => {
              const maxCount = Math.max(...monthlyStats.map((s) => s.count), 1)
              const pct = (stat.count / maxCount) * 100

              return (
                <div key={stat.date} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-text-muted">
                    {stat.month}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-bg-muted">
                    {stat.count > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-text">
                    {stat.count}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ============ Student Stats ============ */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">
            Observations by Learner
            <span className="ml-2 text-xs font-normal text-text-muted">
              ({studentStats.length} learner{studentStats.length !== 1 ? 's' : ''})
            </span>
          </h2>
        </div>

        {studentStats.length > 4 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Filter by learner name..."
              className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
        )}

        {filteredStudents.length === 0 ? (
          <p className="text-sm text-text-light">
            {studentFilter ? 'No matching learners.' : 'No observations recorded yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-bg-muted">
                  <th className="pb-2 font-medium text-text-muted">Learner</th>
                  <th className="pb-2 font-medium text-text-muted">Classroom</th>
                  <th className="pb-2 text-right font-medium text-text-muted">Observations</th>
                  <th className="pb-2 text-right font-medium text-text-muted">Last Observed</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr
                    key={s.student_id}
                    className="border-b border-bg-muted/50 transition-colors hover:bg-bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/student/${s.student_id}`)}
                  >
                    <td className="py-2 font-medium text-text">{s.student_name}</td>
                    <td className="py-2 text-text-muted">{s.classroom_name}</td>
                    <td className="py-2 text-right font-semibold text-text">
                      {s.observation_count}
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      {s.last_observed_at
                        ? format(new Date(s.last_observed_at), 'MMM d, yyyy')
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============ Recent Observations ============ */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-text">
          Recent Observations
          <span className="ml-2 text-xs font-normal text-text-muted">
            (last 20)
          </span>
        </h2>

        {recentObservations.length === 0 ? (
          <p className="text-sm text-text-light">No observations recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentObservations.map((obs) => (
              <div
                key={obs.id}
                className="flex items-start gap-3 rounded-lg bg-bg px-3 py-2.5"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <ClipboardPen className="h-3.5 w-3.5 text-primary-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text">
                      {obs.student_name}
                    </span>
                    <span className="text-[10px] text-text-light">\u00b7</span>
                    <span className="text-[10px] text-text-muted">
                      {obs.dimension_name}
                    </span>
                    <RatingBadge rating={obs.rating} />
                  </div>
                  {obs.notes && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                      {obs.notes}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-text-light">
                    {format(new Date(obs.observed_at), 'MMM d, yyyy \u00b7 h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

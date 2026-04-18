import { useNavigate } from 'react-router-dom'
import { Loader2, School, Users, ClipboardPen, UsersRound, MapPin } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useDepartmentDashboard } from '../lib/department-data'
import { useDepartmentLabel } from '../lib/department-label'
import type { DepartmentSummary } from '../lib/department-data'

// ============================================================
// Rating badge (reused from other pages)
// ============================================================

const RATING_COLORS = [
  '',
  'bg-alert-50 text-alert-700',
  'bg-amber-50 text-amber-700',
  'bg-primary-50 text-primary-700',
  'bg-success-50 text-success-700',
]

function RatingBadge({ rating }: { rating: number }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${RATING_COLORS[rating] ?? 'bg-bg-muted text-text-muted'}`}>
      {rating}
    </span>
  )
}

// ============================================================
// Department card
// ============================================================

function DepartmentCard({ dept }: { dept: DepartmentSummary }) {
  const navigate = useNavigate()

  return (
    <div className="glass-card">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <MapPin className="h-5 w-5 text-primary-600" />
          </div>
          <h3 className="text-base font-bold text-text">{dept.name}</h3>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
          <span className="flex items-center gap-1">
            <School className="h-3.5 w-3.5" />
            {dept.classrooms.length} classroom{dept.classrooms.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {dept.student_count} learner{dept.student_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <ClipboardPen className="h-3.5 w-3.5" />
            {dept.observation_count} obs
          </span>
          <span className="flex items-center gap-1">
            <UsersRound className="h-3.5 w-3.5" />
            {dept.family_count} famil{dept.family_count !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {/* Classroom list */}
        {dept.classrooms.length === 0 ? (
          <p className="text-xs text-text-light">No classrooms assigned.</p>
        ) : (
          <div className="space-y-1.5">
            {dept.classrooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/classroom/${room.id}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-left transition-colors hover:bg-bg-muted/30"
              >
                <School className="h-4 w-4 shrink-0 text-text-light" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{room.name}</p>
                  {room.grade_level && (
                    <p className="text-[10px] text-text-light">Grade {room.grade_level}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>{room.student_count} learners</span>
                  <span>{room.observation_count} obs</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Main component
// ============================================================

export default function DepartmentDashboard() {
  const { profile } = useAuth()
  const { departmentAdminIds } = useAccessControl()
  const { singular, plural } = useDepartmentLabel()
  const { departments, recentObservations, loading, error } = useDepartmentDashboard(
    departmentAdminIds,
    profile?.school_id
  )

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
          <p className="mt-3 text-sm text-text-muted">Loading {plural.toLowerCase()}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-text">Something went wrong</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  const totalStudents = departments.reduce((n, d) => n + d.student_count, 0)
  const totalObs = departments.reduce((n, d) => n + d.observation_count, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">{singular} Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          {departments.length} {departments.length !== 1 ? plural.toLowerCase() : singular.toLowerCase()} &middot;{' '}
          {totalStudents} learner{totalStudents !== 1 ? 's' : ''} &middot;{' '}
          {totalObs} observation{totalObs !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Department cards */}
      {departments.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <MapPin className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            You are not assigned as an admin for any {plural.toLowerCase()}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept} />
          ))}
        </div>
      )}

      {/* Recent observations */}
      {recentObservations.length > 0 && (
        <div className="glass-card">
          <div className="border-b border-bg-muted px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Recent Observations</h2>
          </div>
          <div className="divide-y divide-bg-muted">
            {recentObservations.map((obs) => (
              <div key={obs.id} className="flex items-center gap-3 px-5 py-3">
                <RatingBadge rating={obs.rating} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{obs.student_name}</p>
                  <p className="text-xs text-text-muted">
                    {obs.dimension_name} &middot; {obs.classroom_name}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-light">
                  {new Date(obs.observed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

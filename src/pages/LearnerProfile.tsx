/**
 * LearnerProfile.tsx — Read-only profile view for learner role.
 * Shows the learner's own student record, classrooms (active + archived),
 * per-classroom assignment kanban, and observation progress.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Loader2, User, School, BarChart3, BookOpen, ClipboardList, Star, Archive } from 'lucide-react'
import type { Student, Dimension, Observation } from '../types/database'
import AssignmentKanban from '../components/learner/AssignmentKanban'
import { fetchLearnerAssignments, groupAssignmentsByClassroom, type LearnerAssignment } from '../lib/learner-assignments-data'

interface DimensionProgress {
  dimension: Dimension
  latestRating: number | null
  observationCount: number
}

interface ClassroomInfo {
  id: string
  name: string
  grade_level: string | null
  is_primary: boolean
  status: 'active' | 'archived'
}

export default function LearnerProfile() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [allClassrooms, setAllClassrooms] = useState<ClassroomInfo[]>([])
  const [progress, setProgress] = useState<DimensionProgress[]>([])
  const [assignments, setAssignments] = useState<LearnerAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('')
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('all')

  const activeClassrooms = useMemo(
    () => allClassrooms.filter((c) => c.status === 'active'),
    [allClassrooms]
  )
  const archivedClassrooms = useMemo(
    () => allClassrooms.filter((c) => c.status === 'archived'),
    [allClassrooms]
  )

  const assignmentsByClassroom = useMemo(
    () => groupAssignmentsByClassroom(assignments),
    [assignments]
  )

  const filteredAssignments = useMemo(() => {
    if (selectedClassroomId === 'all') return assignments
    return assignmentsByClassroom.get(selectedClassroomId) ?? []
  }, [assignments, assignmentsByClassroom, selectedClassroomId])

  useEffect(() => {
    if (!profile?.student_id) {
      setLoading(false)
      return
    }

    async function loadData() {
      setLoading(true)

      // Fetch student record
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('id', profile!.student_id!)
        .single()

      if (!studentData) {
        setLoading(false)
        return
      }

      setStudent(studentData as Student)

      // Fetch all classroom enrollments via junction table
      const { data: scData } = await supabase
        .from('student_classrooms')
        .select('classroom_id, is_primary, status')
        .eq('student_id', studentData.id)
      const scRows = (scData ?? []) as { classroom_id: string; is_primary: boolean; status: string }[]
      const classroomIds = scRows.map((r) => r.classroom_id)

      if (classroomIds.length > 0) {
        const { data: classroomsData } = await supabase
          .from('classrooms')
          .select('id, name, grade_level')
          .in('id', classroomIds)

        if (classroomsData) {
          const primaryMap = new Map(scRows.map((r) => [r.classroom_id, r.is_primary]))
          const statusMap = new Map(scRows.map((r) => [r.classroom_id, r.status]))
          const allRooms: ClassroomInfo[] = classroomsData.map((c) => ({
            id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            is_primary: primaryMap.get(c.id) ?? false,
            status: (statusMap.get(c.id) as 'active' | 'archived') ?? 'active',
          }))
          setAllClassrooms(allRooms)
        }
      }

      // Fetch school name
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', studentData.school_id)
        .single()
      if (schoolData) setSchoolName(schoolData.name)

      // Fetch dimensions (active)
      const { data: dimensions } = await supabase
        .from('dimensions')
        .select('*')
        .eq('school_id', studentData.school_id)
        .eq('is_active', true)
        .order('display_order')

      // Fetch observations for this student
      const { data: observations } = await supabase
        .from('observations')
        .select('*')
        .eq('student_id', studentData.id)
        .order('observed_at', { ascending: false })

      // Compute progress per dimension
      const dimProgress: DimensionProgress[] = (dimensions ?? []).map((dim: Dimension) => {
        const dimObs = (observations ?? []).filter((o: Observation) => o.dimension_id === dim.id)
        const latest = dimObs.length > 0 ? dimObs[0].rating : null
        return {
          dimension: dim,
          latestRating: latest,
          observationCount: dimObs.length,
        }
      })

      setProgress(dimProgress)

      // Fetch assignments for kanban
      try {
        const learnerAssignments = await fetchLearnerAssignments(studentData.id)
        setAssignments(learnerAssignments)
      } catch (err) {
        console.error('[LearnerProfile] Failed to fetch assignments:', err)
      }

      setLoading(false)
    }

    loadData()
  }, [profile?.student_id])

  const refetchAssignments = useCallback(async () => {
    if (!student) return
    try {
      const learnerAssignments = await fetchLearnerAssignments(student.id)
      setAssignments(learnerAssignments)
    } catch (err) {
      console.error('[LearnerProfile] Failed to refetch assignments:', err)
    }
  }, [student])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!profile?.student_id || !student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="mb-3 h-12 w-12 text-text-light" />
        <h2 className="text-lg font-semibold text-text">Profile Not Linked</h2>
        <p className="mt-1 text-sm text-text-muted">
          Your account has not been linked to a student record yet. Please contact your school administrator.
        </p>
      </div>
    )
  }

  const displayName = student.preferred_name ?? student.first_name
  const primaryClassroom = activeClassrooms.find((c) => c.is_primary) ?? activeClassrooms[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">
            {displayName} {student.last_name}
          </h1>
          <p className="text-sm text-text-muted">{schoolName}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard
          icon={<BookOpen className="h-5 w-5 text-accent-600" />}
          label="Grade Level"
          value={student.grade_level ?? primaryClassroom?.grade_level ?? '—'}
        />
        <InfoCard
          icon={<BarChart3 className="h-5 w-5 text-success-600" />}
          label="Total Observations"
          value={String(progress.reduce((sum, p) => sum + p.observationCount, 0))}
        />
      </div>

      {/* My Classrooms */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-text">
          <School className="h-5 w-5 text-primary-600" />
          My Classrooms
        </h2>
        {activeClassrooms.length === 0 ? (
          <p className="text-sm text-text-muted">Not assigned to any classrooms</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeClassrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/classroom/${c.id}`)}
                className="rounded-lg border border-bg-muted p-3 text-left transition hover:border-primary-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text">{c.name}</p>
                  {c.is_primary && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                </div>
                {c.grade_level && <p className="mt-0.5 text-xs text-text-muted">Grade {c.grade_level}</p>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Past Classrooms */}
      {archivedClassrooms.length > 0 && (
        <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-muted">
            <Archive className="h-4 w-4" />
            Past Classrooms
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {archivedClassrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/classroom/${c.id}`)}
                className="rounded-lg border border-bg-muted p-3 text-left opacity-70 transition hover:opacity-100 hover:shadow-sm"
              >
                <p className="text-sm font-medium text-text">{c.name}</p>
                <span className="text-xs text-text-light">Archived</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* My Assignments — per-classroom kanban */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-bold text-text">My Assignments</h2>
          {assignments.length > 0 && (
            <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-muted">
              {filteredAssignments.length}
            </span>
          )}
        </div>

        {/* Classroom tabs (only when enrolled in >1 classroom) */}
        {activeClassrooms.length > 1 && assignments.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedClassroomId('all')}
              className={clsx(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                selectedClassroomId === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'text-text-muted hover:bg-bg-muted'
              )}
            >
              All ({assignments.length})
            </button>
            {activeClassrooms.map((c) => {
              const count = assignmentsByClassroom.get(c.id)?.length ?? 0
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassroomId(c.id)}
                  className={clsx(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    selectedClassroomId === c.id
                      ? 'bg-primary-500 text-white'
                      : 'text-text-muted hover:bg-bg-muted'
                  )}
                >
                  {c.name} ({count})
                </button>
              )
            })}
          </div>
        )}

        <AssignmentKanban assignments={filteredAssignments} onUpdate={refetchAssignments} />
      </section>

      {/* Dimension progress */}
      <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-text">My Progress</h2>
        {progress.length === 0 ? (
          <p className="text-sm text-text-muted">No dimensions set up for your school yet.</p>
        ) : (
          <div className="space-y-4">
            {progress.map(({ dimension, latestRating, observationCount }) => (
              <div key={dimension.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{dimension.name}</span>
                  <span className="text-xs text-text-muted">
                    {latestRating !== null ? `${latestRating.toFixed(1)} / 4` : 'No data'}
                    {observationCount > 0 && ` (${observationCount} obs)`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: latestRating !== null ? `${(latestRating / 4) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-4 shadow-sm">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted">
        {icon}
      </div>
      <p className="text-lg font-bold text-text">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

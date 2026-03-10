/**
 * LearnerProfile.tsx — Read-only profile view for learner role.
 * Shows the learner's own student record, classroom, and observation progress.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Loader2, User, School, BarChart3, BookOpen } from 'lucide-react'
import type { Student, Dimension, Observation } from '../types/database'

interface DimensionProgress {
  dimension: Dimension
  latestRating: number | null
  observationCount: number
}

export default function LearnerProfile() {
  const { profile } = useAuth()
  const [student, setStudent] = useState<Student | null>(null)
  const [classroom, setClassroom] = useState<{ name: string; grade_level: string | null } | null>(null)
  const [progress, setProgress] = useState<DimensionProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('')

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

      // Fetch classroom
      if (studentData.classroom_id) {
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('name, grade_level')
          .eq('id', studentData.classroom_id)
          .single()
        if (classroomData) setClassroom(classroomData)
      }

      // Fetch school name
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', studentData.school_id)
        .single()
      if (schoolData) setSchoolName(schoolData.name)

      // Fetch dimensions (active + visible_to_family)
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
      setLoading(false)
    }

    loadData()
  }, [profile?.student_id])

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          icon={<School className="h-5 w-5 text-primary-600" />}
          label="Classroom"
          value={classroom?.name ?? 'Not assigned'}
        />
        <InfoCard
          icon={<BookOpen className="h-5 w-5 text-accent-600" />}
          label="Grade Level"
          value={student.grade_level ?? classroom?.grade_level ?? '—'}
        />
        <InfoCard
          icon={<BarChart3 className="h-5 w-5 text-success-600" />}
          label="Total Observations"
          value={String(progress.reduce((sum, p) => sum + p.observationCount, 0))}
        />
      </div>

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

import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ObservationForm from '../components/observation/ObservationForm'
import type { Student, Classroom } from '../types/database'

export default function RecordObservation() {
  const { id: studentId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const preselectedDimension = searchParams.get('dimension')

  const [student, setStudent] = useState<Student | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    async function load() {
      const { data: s, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (sErr || !s) {
        setError('Learner not found')
        setLoading(false)
        return
      }

      const studentData = s as Student
      setStudent(studentData)

      const { data: c } = await supabase
        .from('classrooms')
        .select('*')
        .eq('id', studentData.classroom_id)
        .single()

      setClassroom(c as Classroom | null)
      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-alert-500" />
          <h2 className="mt-3 text-lg font-semibold text-text">{error ?? 'Learner not found'}</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header card */}
      <div className="mb-6 rounded-xl border border-bg-muted bg-bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {student.avatar_url ? (
            <img
              src={student.avatar_url}
              alt={`${student.first_name} ${student.last_name}`}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
              <span className="text-sm font-bold text-primary-700">{initials}</span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-text">
              Record Observation
            </h1>
            <p className="text-sm text-text-muted">
              {student.first_name} {student.last_name}
              {classroom && <span className="text-text-light"> &middot; {classroom.name}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <ObservationForm
          studentId={student.id}
          schoolId={student.school_id}
          preselectedDimensionId={preselectedDimension}
          onSaved={() => navigate(`/student/${student.id}`)}
        />
      </div>
    </div>
  )
}

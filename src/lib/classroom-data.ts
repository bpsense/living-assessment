import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Profile,
  Classroom,
  Student,
  Dimension,
  InterestSurvey,
  StudentContact,
  Observation,
} from '../types/database'
import { computeObservationScores, type DimensionScore } from './scoring'
import { ageDecayFactor } from './living-data'
import { standardAgeForDate } from './age-utils'

// ============================================================
// Types
// ============================================================

export interface InterestPulseItem {
  dimension_id: string
  dimension_name: string
  icon: string | null
  avg_interest: number
}

export interface ClassroomViewData {
  classroom: Classroom | null
  educators: (Pick<Profile, 'id' | 'full_name'> & { role: 'lead' | 'support' })[]
  /** All educators in the school (for admin assignment UI) */
  allSchoolEducators: Pick<Profile, 'id' | 'full_name'>[]
  students: Student[]
  dimensions: Dimension[]
  /** DimensionScore[] keyed by student.id */
  studentScoresMap: Map<string, DimensionScore[]>
  classInterestPulse: InterestPulseItem[]
  /** Emergency contacts keyed by student.id */
  studentContactsMap: Map<string, StudentContact[]>
  /** Per-student enrollment status in this classroom (active/archived) */
  studentEnrollmentStatusMap: Map<string, 'active' | 'archived'>
  loading: boolean
  error: string | null
  refetch: () => void
}

// ============================================================
// Hook
// ============================================================

export function useClassroomView(
  classroomId: string | undefined
): ClassroomViewData {
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [educators, setEducators] = useState<(Pick<Profile, 'id' | 'full_name'> & { role: 'lead' | 'support' })[]>([])
  const [allSchoolEducators, setAllSchoolEducators] = useState<
    Pick<Profile, 'id' | 'full_name'>[]
  >([])
  const [students, setStudents] = useState<Student[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [studentScoresMap, setStudentScoresMap] = useState<
    Map<string, DimensionScore[]>
  >(new Map())
  const [classInterestPulse, setClassInterestPulse] = useState<
    InterestPulseItem[]
  >([])
  const [studentContactsMap, setStudentContactsMap] = useState<
    Map<string, StudentContact[]>
  >(new Map())
  const [studentEnrollmentStatusMap, setStudentEnrollmentStatusMap] = useState<
    Map<string, 'active' | 'archived'>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!classroomId) return
    let cancelled = false

    async function fetchAll() {
      try {
        // 1. Classroom
        const { data: cData, error: cErr } = await supabase
          .from('classrooms')
          .select('*')
          .eq('id', classroomId)
          .single()

        if (cErr || !cData) {
          throw new Error('Classroom not found')
        }
        if (cancelled) return
        const classroomData = cData as Classroom
        setClassroom(classroomData)

        // 2. Parallel fetches (students via junction table)
        const [ecRes, scRes, dimsRes, allEducatorsRes] = await Promise.all([
          supabase
            .from('educator_classrooms')
            .select('educator_id, role')
            .eq('classroom_id', classroomId),
          supabase
            .from('student_classrooms')
            .select('student_id, is_primary, status')
            .eq('classroom_id', classroomId),
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', classroomData.school_id)
            .eq('is_active', true)
            .order('display_order'),
          // All educators in the school (for admin assignment dropdown)
          supabase
            .from('profiles')
            .select('id, full_name')
            .eq('school_id', classroomData.school_id)
            .eq('role', 'educator')
            .order('full_name'),
        ])

        if (cancelled) return

        const ecRows = (ecRes.data ?? []) as { educator_id: string; role: 'lead' | 'support' }[]
        const educatorIds = ecRows.map((r) => r.educator_id)
        const roleByEducatorId = new Map(ecRows.map((r) => [r.educator_id, r.role]))
        const scData = (scRes.data ?? []) as { student_id: string; is_primary: boolean; status: string }[]
        const enrolledStudentIds = scData.map((r) => r.student_id)

        // Build enrollment status map
        const enrollmentStatusMap = new Map<string, 'active' | 'archived'>()
        for (const r of scData) {
          enrollmentStatusMap.set(r.student_id, (r.status as 'active' | 'archived') ?? 'active')
        }
        const dimsData = (dimsRes.data ?? []) as Dimension[]
        const allEducators = (allEducatorsRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]

        // Fetch the actual student records for enrolled students
        let studentsData: Student[] = []
        if (enrolledStudentIds.length > 0) {
          const { data: sData } = await supabase
            .from('students')
            .select('*')
            .in('id', enrolledStudentIds)
            .order('last_name')
          studentsData = (sData ?? []) as Student[]
        }
        if (cancelled) return

        const studentIds = studentsData.map((s) => s.id)

        setStudents(studentsData)
        setStudentEnrollmentStatusMap(enrollmentStatusMap)
        setDimensions(dimsData)
        setAllSchoolEducators(allEducators)

        // 3. Educator profiles, joined with their per-classroom role
        let educatorProfiles: (Pick<Profile, 'id' | 'full_name'> & { role: 'lead' | 'support' })[] = []
        if (educatorIds.length > 0) {
          const { data: epData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', educatorIds)
          educatorProfiles = ((epData ?? []) as Pick<Profile, 'id' | 'full_name'>[]).map((p) => ({
            ...p,
            role: roleByEducatorId.get(p.id) ?? 'lead',
          }))
        }
        if (cancelled) return
        setEducators(educatorProfiles)

        if (studentIds.length === 0) {
          setStudentScoresMap(new Map())
          setClassInterestPulse(
            dimsData.map((d) => ({
              dimension_id: d.id,
              dimension_name: d.name,
              icon: d.icon,
              avg_interest: 0,
            }))
          )
          setLoading(false)
          return
        }

        // 4. Observations + interest surveys + contacts. Per-dimension competency
        //    averages for the classroom mini-amoebas come from observations.
        const [obsRes, surveyRes, contactsRes] = await Promise.all([
          supabase
            .from('observations')
            .select('*')
            .in('student_id', studentIds)
            .order('observed_at', { ascending: true }),
          supabase
            .from('interest_surveys')
            .select('*')
            .in('student_id', studentIds)
            .order('submitted_at', { ascending: false }),
          supabase
            .from('student_contacts')
            .select('*')
            .in('student_id', studentIds)
            .order('is_primary', { ascending: false }),
        ])

        if (cancelled) return

        const allObservations = (obsRes.data ?? []) as Observation[]
        const allSurveys = (surveyRes.data ?? []) as InterestSurvey[]

        // Per-student contacts map
        const contactsMap = new Map<string, StudentContact[]>()
        for (const c of (contactsRes.data ?? []) as StudentContact[]) {
          const arr = contactsMap.get(c.student_id) ?? []
          arr.push(c)
          contactsMap.set(c.student_id, arr)
        }
        if (!cancelled) setStudentContactsMap(contactsMap)

        // 5. Build per-student current dimension scores.
        //    Competency comes from observations (current-month avg, else latest);
        //    interest comes from the most recent interest survey response.
        const scoresMap = new Map<string, DimensionScore[]>()
        const now = new Date()
        for (const st of studentsData) {
          const stObs = allObservations.filter((o) => o.student_id === st.id)
          const obsScores = computeObservationScores(stObs, dimsData)
          // Match the student profile's CURRENT-state amoeba: apply the same
          // age-rescale decay (×0.75/yr, keyed to the Dec-1 standard age) that
          // LivingVisualization applies to its live view, so the roster
          // thumbnail is a faithful mini of what you'd see clicking in.
          let decay = 1
          if (st.date_of_birth && stObs.length > 0) {
            const baseAge = standardAgeForDate(st.date_of_birth, new Date(stObs[0].observed_at))
            const curAge = standardAgeForDate(st.date_of_birth, now)
            if (baseAge != null && curAge != null) decay = ageDecayFactor(curAge, baseAge)
          }
          // Pick the most recent survey for this student.
          const latestSurvey = allSurveys
            .filter((s) => s.student_id === st.id)
            .sort(
              (a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            )[0]
          const responses = (latestSurvey?.responses ?? {}) as Record<string, number>
          const studentScores: DimensionScore[] = dimsData.map((d) => ({
            dimension_id: d.id,
            dimension_name: d.name,
            icon: d.icon,
            display_order: d.display_order,
            competency: (obsScores.get(d.id)?.competency ?? 0) * decay,
            interest: typeof responses[d.id] === 'number' ? responses[d.id] : 0,
            observation_count: 0,
            current_month_observation_count: obsScores.get(d.id)?.currentMonthCount ?? 0,
            latest_observation: null,
          }))
          scoresMap.set(st.id, studentScores)
        }

        // 6. Class interest pulse — average interest per dimension
        const pulse: InterestPulseItem[] = dimsData.map((dim) => {
          let total = 0
          let count = 0
          for (const st of studentsData) {
            const scores = scoresMap.get(st.id)
            const ds = scores?.find((s) => s.dimension_id === dim.id)
            if (ds && ds.interest > 0) {
              total += ds.interest
              count++
            }
          }
          return {
            dimension_id: dim.id,
            dimension_name: dim.name,
            icon: dim.icon,
            avg_interest: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
          }
        })

        if (!cancelled) {
          setStudentScoresMap(scoresMap)
          setClassInterestPulse(pulse)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load classroom')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [classroomId, fetchCount])

  return {
    classroom,
    educators,
    allSchoolEducators,
    students,
    dimensions,
    studentScoresMap,
    classInterestPulse,
    studentContactsMap,
    studentEnrollmentStatusMap,
    loading,
    error,
    refetch,
  }
}

// ============================================================
// Enrollment status mutation
// ============================================================

export async function updateStudentClassroomStatus(
  studentId: string,
  classroomId: string,
  status: 'active' | 'archived'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('student_classrooms')
    .update({
      status,
      // Stamp when the student left so we can compute educator/student
      // time-overlap for the archived-learners view; clear it on restore.
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)

  return { error: error?.message ?? null }
}


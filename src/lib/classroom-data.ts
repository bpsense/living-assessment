import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Profile,
  Classroom,
  Student,
  Dimension,
  Observation,
  InterestSurvey,
  StudentContact,
} from '../types/database'
import type { DimensionScore } from './scoring'
import { buildDimensionScores } from './scoring'

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
  educators: Pick<Profile, 'id' | 'full_name'>[]
  /** All educators in the school (for admin assignment UI) */
  allSchoolEducators: Pick<Profile, 'id' | 'full_name'>[]
  students: Student[]
  dimensions: Dimension[]
  /** DimensionScore[] keyed by student.id */
  studentScoresMap: Map<string, DimensionScore[]>
  classInterestPulse: InterestPulseItem[]
  /** Emergency contacts keyed by student.id */
  studentContactsMap: Map<string, StudentContact[]>
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
  const [educators, setEducators] = useState<
    Pick<Profile, 'id' | 'full_name'>[]
  >([])
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

        // 2. Parallel fetches
        const [ecRes, studentsRes, dimsRes, allEducatorsRes] = await Promise.all([
          supabase
            .from('educator_classrooms')
            .select('educator_id')
            .eq('classroom_id', classroomId),
          supabase
            .from('students')
            .select('*')
            .eq('classroom_id', classroomId)
            .order('last_name'),
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

        const educatorIds = (ecRes.data ?? []).map(
          (r) => (r as { educator_id: string }).educator_id
        )
        const studentsData = (studentsRes.data ?? []) as Student[]
        const dimsData = (dimsRes.data ?? []) as Dimension[]
        const studentIds = studentsData.map((s) => s.id)
        const allEducators = (allEducatorsRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]

        setStudents(studentsData)
        setDimensions(dimsData)
        setAllSchoolEducators(allEducators)

        // 3. Educator profiles
        let educatorProfiles: Pick<Profile, 'id' | 'full_name'>[] = []
        if (educatorIds.length > 0) {
          const { data: epData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', educatorIds)
          educatorProfiles = (epData ?? []) as Pick<
            Profile,
            'id' | 'full_name'
          >[]
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

        // 4. Observations (12-month lookback) + surveys + contacts
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        const [obsRes, surveyRes, contactsRes] = await Promise.all([
          supabase
            .from('observations')
            .select('*')
            .in('student_id', studentIds)
            .gte('observed_at', twelveMonthsAgo.toISOString())
            .order('observed_at', { ascending: false }),
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

        const allObs = (obsRes.data ?? []) as Observation[]
        const allSurveys = (surveyRes.data ?? []) as InterestSurvey[]

        // Build per-student contacts map
        const contactsMap = new Map<string, StudentContact[]>()
        for (const c of (contactsRes.data ?? []) as StudentContact[]) {
          const arr = contactsMap.get(c.student_id) ?? []
          arr.push(c)
          contactsMap.set(c.student_id, arr)
        }
        if (!cancelled) setStudentContactsMap(contactsMap)

        // 5. Build per-student dimension scores
        const scoresMap = new Map<string, DimensionScore[]>()
        for (const st of studentsData) {
          const stObs = allObs.filter((o) => o.student_id === st.id)
          const stSurveys = allSurveys.filter((s) => s.student_id === st.id)
          scoresMap.set(
            st.id,
            buildDimensionScores(dimsData, stObs, stSurveys)
          )
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
    loading,
    error,
    refetch,
  }
}


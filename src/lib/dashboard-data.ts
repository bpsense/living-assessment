import { useState, useEffect, useCallback } from 'react'
import {
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  format,
  differenceInDays,
} from 'date-fns'
import { supabase } from './supabase'
import type {
  Profile,
  Classroom,
  Student,
  Dimension,
  Observation,
  InterestSurvey,
} from '../types/database'
import type { DimensionScore } from './scoring'
import { buildDimensionScores } from './scoring'

// ============================================================
// Shared types
// ============================================================

export interface ClassroomCard {
  id: string
  name: string
  grade_level: string | null
  student_count: number
  observations_this_week: number
}

export type FlagType = 'no_observations' | 'emerging_streak' | 'interest_gap'

export interface AttentionFlag {
  student_id: string
  student_name: string
  flag_type: FlagType
  message: string
  dimension_name?: string
}

export interface ActivityItem {
  id: string
  student_id: string
  student_name: string
  dimension_name: string
  rating: number
  notes: string | null
  observer_name: string
  observed_at: string
}

export interface ChildCard {
  student: Student
  classroom_name: string
  dimensionScores: DimensionScore[]
}

export interface SchoolStats {
  totalStudents: number
  totalClassrooms: number
  totalEducators: number
  observationsThisPeriod: number
}

export interface ClassroomDimensionAvg {
  classroom_id: string
  classroom_name: string
  dimension_name: string
  avg_competency: number
}

export interface WeeklyVolume {
  week: string
  count: number
}

// ============================================================
// Educator Dashboard
// ============================================================

export interface EducatorDashboardData {
  classrooms: ClassroomCard[]
  attentionFlags: AttentionFlag[]
  recentActivity: ActivityItem[]
  loading: boolean
  error: string | null
}

export function useEducatorDashboard(
  profile: Profile | null,
  educatorIdOverride?: string
): EducatorDashboardData {
  const [classrooms, setClassrooms] = useState<ClassroomCard[]>([])
  const [attentionFlags, setAttentionFlags] = useState<AttentionFlag[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const effectiveId = educatorIdOverride ?? profile?.id

  useEffect(() => {
    if (!effectiveId || !profile) return
    let cancelled = false

    async function fetch() {
      try {
        // 1. Get educator's classrooms
        const { data: ecRows } = await supabase
          .from('educator_classrooms')
          .select('classroom_id')
          .eq('educator_id', effectiveId!)

        const classroomIds = (ecRows ?? []).map((r) => r.classroom_id)
        if (classroomIds.length === 0) {
          if (!cancelled) {
            setClassrooms([])
            setAttentionFlags([])
            setRecentActivity([])
            setLoading(false)
          }
          return
        }

        // 2. Parallel fetches
        const [classroomRes, studentsRes, dimensionsRes] = await Promise.all([
          supabase
            .from('classrooms')
            .select('*')
            .in('id', classroomIds),
          supabase
            .from('students')
            .select('*')
            .in('classroom_id', classroomIds),
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', profile!.school_id)
            .eq('is_active', true)
            .order('display_order'),
        ])

        const classroomData = (classroomRes.data ?? []) as Classroom[]
        const studentsData = (studentsRes.data ?? []) as Student[]
        const dimensionsData = (dimensionsRes.data ?? []) as Dimension[]
        const studentIds = studentsData.map((s) => s.id)

        if (studentIds.length === 0) {
          if (!cancelled) {
            setClassrooms(
              classroomData.map((c) => ({
                id: c.id,
                name: c.name,
                grade_level: c.grade_level,
                student_count: 0,
                observations_this_week: 0,
              }))
            )
            setAttentionFlags([])
            setRecentActivity([])
            setLoading(false)
          }
          return
        }

        // 3. Observations + surveys (12-month lookback)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        const [obsRes, surveyRes, profilesRes] = await Promise.all([
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
            .from('profiles')
            .select('id, full_name')
            .eq('school_id', profile!.school_id),
        ])

        if (cancelled) return

        const allObs = (obsRes.data ?? []) as Observation[]
        const allSurveys = (surveyRes.data ?? []) as InterestSurvey[]
        const profileMap = new Map(
          ((profilesRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]).map(
            (p) => [p.id, p.full_name]
          )
        )
        const dimMap = new Map(dimensionsData.map((d) => [d.id, d.name]))

        // 4. Build classroom cards
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const cards: ClassroomCard[] = classroomData.map((c) => {
          const classStudentIds = studentsData
            .filter((s) => s.classroom_id === c.id)
            .map((s) => s.id)
          const weekObs = allObs.filter(
            (o) =>
              classStudentIds.includes(o.student_id) &&
              new Date(o.observed_at) >= weekStart
          )
          return {
            id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            student_count: classStudentIds.length,
            observations_this_week: weekObs.length,
          }
        })

        // 5. Build attention flags
        const flags = computeAttentionFlags(
          studentsData,
          allObs,
          allSurveys,
          dimensionsData
        )

        // 6. Build recent activity (last 15)
        const activity: ActivityItem[] = allObs.slice(0, 15).map((o) => {
          const st = studentsData.find((s) => s.id === o.student_id)
          return {
            id: o.id,
            student_id: o.student_id,
            student_name: st
              ? `${st.first_name} ${st.last_name}`
              : 'Unknown',
            dimension_name: dimMap.get(o.dimension_id) ?? 'Unknown',
            rating: Number(o.rating),
            notes: o.notes,
            observer_name: profileMap.get(o.observer_id) ?? 'Unknown',
            observed_at: o.observed_at,
          }
        })

        if (!cancelled) {
          setClassrooms(cards)
          setAttentionFlags(flags)
          setRecentActivity(activity)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => {
      cancelled = true
    }
  }, [profile, effectiveId])

  return { classrooms, attentionFlags, recentActivity, loading, error }
}

// ============================================================
// Needs-Attention flag computation
// ============================================================

function computeAttentionFlags(
  students: Student[],
  observations: Observation[],
  surveys: InterestSurvey[],
  dimensions: Dimension[]
): AttentionFlag[] {
  const flags: AttentionFlag[] = []
  const twoWeeksAgo = subDays(new Date(), 14)

  for (const student of students) {
    const name = `${student.first_name} ${student.last_name}`
    const studentObs = observations
      .filter((o) => o.student_id === student.id)
      .sort(
        (a, b) =>
          new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )

    // 1. No observations in 2 weeks
    const latestObs = studentObs[0]
    if (!latestObs || new Date(latestObs.observed_at) < twoWeeksAgo) {
      flags.push({
        student_id: student.id,
        student_name: name,
        flag_type: 'no_observations',
        message: latestObs
          ? `No observations in ${differenceInDays(new Date(), new Date(latestObs.observed_at))} days`
          : 'No observations recorded yet',
      })
    }

    // 2. 3+ consecutive Emerging in any dimension
    for (const dim of dimensions) {
      const dimObs = studentObs
        .filter((o) => o.dimension_id === dim.id)
        .slice(0, 3)

      if (dimObs.length >= 3 && dimObs.every((o) => Number(o.rating) <= 1)) {
        flags.push({
          student_id: student.id,
          student_name: name,
          flag_type: 'emerging_streak',
          message: `3+ consecutive "Emerging" in ${dim.name}`,
          dimension_name: dim.name,
        })
      }
    }

    // 3. Interest–competency gap (opportunity)
    const latestSurvey = surveys.find((s) => s.student_id === student.id)
    if (latestSurvey) {
      const responses = latestSurvey.responses as Record<string, number>

      for (const dim of dimensions) {
        const interest = responses[dim.id]
        if (typeof interest !== 'number') continue

        const dimObs = studentObs
          .filter((o) => o.dimension_id === dim.id)
          .slice(0, 5)
        if (dimObs.length === 0) continue

        const avgComp =
          dimObs.reduce((sum, o) => sum + Number(o.rating), 0) / dimObs.length

        if (interest >= 4 && avgComp <= 2) {
          flags.push({
            student_id: student.id,
            student_name: name,
            flag_type: 'interest_gap',
            message: `High interest but low competency in ${dim.name}`,
            dimension_name: dim.name,
          })
        }
      }
    }
  }

  return flags
}

// ============================================================
// Parent Dashboard
// ============================================================

export interface ParentDashboardData {
  children: ChildCard[]
  surveyPrompts: { studentId: string; studentName: string }[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useParentDashboard(
  profile: Profile | null,
  parentIdOverride?: string
): ParentDashboardData {
  const [children, setChildren] = useState<ChildCard[]>([])
  const [surveyPrompts, setSurveyPrompts] = useState<
    { studentId: string; studentName: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    const parentId = parentIdOverride ?? profile?.id
    const schoolId = profile?.school_id
    if (!parentId || !schoolId) return
    let cancelled = false

    async function fetch() {
      try {
        // 1. Get linked students
        const { data: links } = await supabase
          .from('parent_students')
          .select('student_id')
          .eq('parent_id', parentId)

        const studentIds = (links ?? []).map((l) => l.student_id)
        if (studentIds.length === 0) {
          if (!cancelled) setLoading(false)
          return
        }

        // 2. Parallel data
        const [studentsRes, classroomsRes, dimsRes, obsRes, surveysRes] =
          await Promise.all([
            supabase.from('students').select('*').in('id', studentIds),
            supabase
              .from('classrooms')
              .select('*')
              .eq('school_id', schoolId),
            supabase
              .from('dimensions')
              .select('*')
              .eq('school_id', schoolId)
              .eq('is_active', true)
              .order('display_order'),
            supabase
              .from('observations')
              .select('*')
              .in('student_id', studentIds)
              .order('observed_at', { ascending: false }),
            supabase
              .from('interest_surveys')
              .select('*')
              .in('student_id', studentIds)
              .order('submitted_at', { ascending: false }),
          ])

        if (cancelled) return

        const studentsData = (studentsRes.data ?? []) as Student[]
        const classroomsData = (classroomsRes.data ?? []) as Classroom[]
        const dimsData = (dimsRes.data ?? []) as Dimension[]
        const allObs = (obsRes.data ?? []) as Observation[]
        const allSurveys = (surveysRes.data ?? []) as InterestSurvey[]

        // Family view: only show dimensions marked visible_to_family
        const familyDims = dimsData.filter((d) => d.visible_to_family)

        const classMap = new Map(classroomsData.map((c) => [c.id, c.name]))
        const thirtyDaysAgo = subDays(new Date(), 30)

        // 3. Build child cards
        const cards: ChildCard[] = studentsData.map((st) => {
          const stObs = allObs.filter((o) => o.student_id === st.id)
          const stSurveys = allSurveys.filter((s) => s.student_id === st.id)
          return {
            student: st,
            classroom_name: classMap.get(st.classroom_id) ?? '',
            dimensionScores: buildDimensionScores(familyDims, stObs, stSurveys),
          }
        })

        // 4. Survey prompts (no survey in last 30 days)
        const prompts: { studentId: string; studentName: string }[] = []
        for (const st of studentsData) {
          const latest = allSurveys.find((s) => s.student_id === st.id)
          if (!latest || new Date(latest.submitted_at) < thirtyDaysAgo) {
            prompts.push({
              studentId: st.id,
              studentName: st.first_name,
            })
          }
        }

        if (!cancelled) {
          setChildren(cards)
          setSurveyPrompts(prompts)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => {
      cancelled = true
    }
  }, [profile, parentIdOverride, fetchCount])

  return { children, surveyPrompts, loading, error, refetch }
}

// ============================================================
// Admin Dashboard
// ============================================================

export interface AdminDashboardData {
  stats: SchoolStats
  classroomComparison: ClassroomDimensionAvg[]
  observationVolume: WeeklyVolume[]
  dimensions: Dimension[]
  classrooms: Classroom[]
  loading: boolean
  error: string | null
}

export function useAdminDashboard(profile: Profile | null): AdminDashboardData {
  const [stats, setStats] = useState<SchoolStats>({
    totalStudents: 0,
    totalClassrooms: 0,
    totalEducators: 0,
    observationsThisPeriod: 0,
  })
  const [classroomComparison, setClassroomComparison] = useState<
    ClassroomDimensionAvg[]
  >([])
  const [observationVolume, setObservationVolume] = useState<WeeklyVolume[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function fetch() {
      try {
        const schoolId = profile!.school_id
        const monthStart = startOfMonth(new Date()).toISOString()

        // 1. Counts in parallel
        const [
          studentCountRes,
          classroomCountRes,
          educatorCountRes,
          periodObsCountRes,
          classroomRes,
          dimensionsRes,
          studentsRes,
          obsRes,
        ] = await Promise.all([
          supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId),
          supabase
            .from('classrooms')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('role', 'educator'),
          supabase
            .from('observations')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .gte('observed_at', monthStart),
          supabase
            .from('classrooms')
            .select('*')
            .eq('school_id', schoolId),
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('students')
            .select('*')
            .eq('school_id', schoolId),
          supabase
            .from('observations')
            .select('*')
            .eq('school_id', schoolId)
            .order('observed_at', { ascending: false })
            .limit(5000),
        ])

        if (cancelled) return

        const classroomData = (classroomRes.data ?? []) as Classroom[]
        const dimensionsData = (dimensionsRes.data ?? []) as Dimension[]
        const studentsData = (studentsRes.data ?? []) as Student[]
        const allObs = (obsRes.data ?? []) as Observation[]

        // 2. Stats
        const schoolStats: SchoolStats = {
          totalStudents: studentCountRes.count ?? 0,
          totalClassrooms: classroomCountRes.count ?? 0,
          totalEducators: educatorCountRes.count ?? 0,
          observationsThisPeriod: periodObsCountRes.count ?? 0,
        }

        // 3. Cross-classroom comparison
        const comparison = computeClassroomComparison(
          classroomData,
          studentsData,
          allObs,
          dimensionsData
        )

        // 4. Weekly volume (last 12 weeks)
        const volume = computeWeeklyVolume(allObs)

        if (!cancelled) {
          setStats(schoolStats)
          setClassroomComparison(comparison)
          setObservationVolume(volume)
          setDimensions(dimensionsData)
          setClassrooms(classroomData)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => {
      cancelled = true
    }
  }, [profile])

  return {
    stats,
    classroomComparison,
    observationVolume,
    dimensions,
    classrooms,
    loading,
    error,
  }
}

// ============================================================
// Admin helpers
// ============================================================

function computeClassroomComparison(
  classrooms: Classroom[],
  students: Student[],
  observations: Observation[],
  dimensions: Dimension[]
): ClassroomDimensionAvg[] {
  const result: ClassroomDimensionAvg[] = []

  for (const classroom of classrooms) {
    const classStudentIds = students
      .filter((s) => s.classroom_id === classroom.id)
      .map((s) => s.id)

    for (const dim of dimensions) {
      let total = 0
      let count = 0

      for (const sid of classStudentIds) {
        // Latest observation per student per dimension
        const latest = observations.find(
          (o) => o.student_id === sid && o.dimension_id === dim.id
        )
        if (latest) {
          total += Number(latest.rating)
          count++
        }
      }

      result.push({
        classroom_id: classroom.id,
        classroom_name: classroom.name,
        dimension_name: dim.name,
        avg_competency: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
      })
    }
  }

  return result
}

function computeWeeklyVolume(observations: Observation[]): WeeklyVolume[] {
  const weeks: WeeklyVolume[] = []
  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
    const we = endOfWeek(ws, { weekStartsOn: 1 })
    const count = observations.filter((o) => {
      const d = new Date(o.observed_at)
      return d >= ws && d <= we
    }).length

    weeks.push({ week: format(ws, 'MMM d'), count })
  }

  return weeks
}

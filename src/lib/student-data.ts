import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Student,
  Classroom,
  Dimension,
  Observation,
  InterestSurvey,
  Profile,
} from '../types/database'
import {
  computeCompetencyScores,
  extractInterestScores,
} from './scoring'
import type { DimensionScore } from './scoring'

// Re-export scoring types so existing imports from student-data continue to work
export type { DimensionScore, Zone, ZoneClassification } from './scoring'
export { classifyZones } from './scoring'

export interface TimelineEntry {
  id: string
  type: 'observation' | 'interest_survey'
  date: string
  dimension_name: string | null
  dimension_id: string | null
  rating: number | null
  observer_name: string | null
  notes: string | null
}

// ============================================================
// Build timeline entries from observations + surveys
// ============================================================

function buildTimeline(
  observations: Observation[],
  surveys: InterestSurvey[],
  dimensions: Dimension[],
  observers: Map<string, string>
): TimelineEntry[] {
  const dimMap = new Map(dimensions.map((d) => [d.id, d.name]))

  const obsEntries: TimelineEntry[] = observations.map((o) => ({
    id: o.id,
    type: 'observation',
    date: o.observed_at,
    dimension_name: dimMap.get(o.dimension_id) ?? null,
    dimension_id: o.dimension_id,
    rating: Number(o.rating),
    observer_name: observers.get(o.observer_id) ?? null,
    notes: o.notes,
  }))

  const surveyEntries: TimelineEntry[] = surveys.map((s) => ({
    id: s.id,
    type: 'interest_survey',
    date: s.submitted_at,
    dimension_name: null,
    dimension_id: null,
    rating: null,
    observer_name: null,
    notes: `Interest survey with ${Object.keys(s.responses).length} responses`,
  }))

  return [...obsEntries, ...surveyEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

// ============================================================
// Main data hook
// ============================================================

export interface StudentProfileData {
  student: Student | null
  classroom: Classroom | null
  dimensions: Dimension[]
  dimensionScores: DimensionScore[]
  timeline: TimelineEntry[]
  observations: Observation[]
  surveys: InterestSurvey[]
  observers: Map<string, string>
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useStudentProfile(studentId: string | undefined): StudentProfileData {
  const [student, setStudent] = useState<Student | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [surveys, setSurveys] = useState<InterestSurvey[]>([])
  const [observers, setObservers] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) return

    let cancelled = false
    // Only show the full-page loading spinner on the initial fetch.
    // Background refetches (from click-to-rate, etc.) silently update data
    // without unmounting the page.
    const isInitialLoad = fetchCount === 0
    if (isInitialLoad) setLoading(true)
    setError(null)

    async function fetchAll() {
      try {
        // Fetch student
        const { data: studentData, error: studentErr } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single()

        if (studentErr) throw new Error(`Student not found: ${studentErr.message}`)
        if (cancelled) return
        setStudent(studentData as Student)

        // 12-month lookback window for observations
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        // Fetch classroom, dimensions, observations, surveys in parallel
        const [classroomRes, dimensionsRes, observationsRes, surveysRes] =
          await Promise.all([
            supabase
              .from('classrooms')
              .select('*')
              .eq('id', (studentData as Student).classroom_id)
              .single(),
            supabase
              .from('dimensions')
              .select('*')
              .eq('school_id', (studentData as Student).school_id)
              .eq('is_active', true)
              .order('display_order'),
            supabase
              .from('observations')
              .select('*')
              .eq('student_id', studentId)
              .gte('observed_at', twelveMonthsAgo.toISOString())
              .order('observed_at', { ascending: false }),
            supabase
              .from('interest_surveys')
              .select('*')
              .eq('student_id', studentId)
              .order('submitted_at', { ascending: false }),
          ])

        if (cancelled) return

        const classroomData = classroomRes.data as Classroom | null
        const dimensionsData = (dimensionsRes.data ?? []) as Dimension[]
        const observationsData = (observationsRes.data ?? []) as Observation[]
        const surveysData = (surveysRes.data ?? []) as InterestSurvey[]

        setClassroom(classroomData)
        setDimensions(dimensionsData)
        setObservations(observationsData)
        setSurveys(surveysData)

        // Fetch unique observer names
        const observerIds = [...new Set(observationsData.map((o) => o.observer_id))]
        if (observerIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', observerIds)

          if (!cancelled && profilesData) {
            const map = new Map<string, string>()
            for (const p of profilesData as Pick<Profile, 'id' | 'full_name'>[]) {
              map.set(p.id, p.full_name)
            }
            setObservers(map)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load student data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [studentId, fetchCount])

  // Derived data
  const competencyMap = computeCompetencyScores(observations, dimensions)
  const interestMap = extractInterestScores(surveys, dimensions)

  const dimensionScores: DimensionScore[] = dimensions.map((dim) => {
    const dimObs = observations
      .filter((o) => o.dimension_id === dim.id)
      .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime())

    const comp = competencyMap.get(dim.id) ?? { competency: 0, currentMonthCount: 0 }

    return {
      dimension_id: dim.id,
      dimension_name: dim.name,
      icon: dim.icon,
      display_order: dim.display_order,
      competency: comp.competency,
      interest: interestMap.get(dim.id) ?? 0,
      observation_count: dimObs.length,
      current_month_observation_count: comp.currentMonthCount,
      latest_observation: dimObs[0] ?? null,
    }
  })

  const timeline = buildTimeline(observations, surveys, dimensions, observers)

  return {
    student,
    classroom,
    dimensions,
    dimensionScores,
    timeline,
    observations,
    surveys,
    observers,
    loading,
    error,
    refetch,
  }
}

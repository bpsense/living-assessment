import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type {
  Student,
  Classroom,
  School,
  Dimension,
  Observation,
  InterestSurvey,
  Profile,
} from '../types/database'
import type { DimensionScore } from './scoring'
import type { AcademicPeriod } from './scoring'
import {
  computeCompetencyForPeriod,
  extractInterestScores,
} from './scoring'

export type { AcademicPeriod } from './scoring'

export interface DimensionReportData {
  dimension: Dimension
  score: DimensionScore
  /** Most recent educator observation notes for this dimension */
  latestNarrative: string | null
  /** Observer name for the latest narrative */
  narrativeObserver: string | null
  /** Date of the latest observation */
  narrativeDate: string | null
}

export interface ReportData {
  student: Student
  classroom: Classroom | null
  school: School
  dimensions: Dimension[]
  dimensionScores: DimensionScore[]
  dimensionReports: DimensionReportData[]
  availablePeriods: AcademicPeriod[]
}

// ============================================================
// Competency level helpers
// ============================================================

export type CompetencyLevel = 'emerging' | 'developing' | 'practicing' | 'proficient'

export function getCompetencyLevel(score: number): CompetencyLevel {
  if (score < 1.5) return 'emerging'
  if (score < 2.5) return 'developing'
  if (score < 3.5) return 'practicing'
  return 'proficient'
}

export function getCompetencyLabel(score: number): string {
  const level = getCompetencyLevel(score)
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function getInterestLabel(score: number): string {
  if (score <= 0) return 'Not assessed'
  if (score < 2) return 'Low'
  if (score < 3) return 'Moderate'
  if (score < 4) return 'High'
  return 'Very High'
}

// ============================================================
// Build available academic periods from observations
// ============================================================

function buildPeriods(observations: Observation[]): AcademicPeriod[] {
  if (observations.length === 0) return []

  const monthSet = new Set<string>()
  for (const o of observations) {
    const d = new Date(o.observed_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthSet.add(key)
  }

  // Also include current month even if no observations yet
  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  monthSet.add(currentKey)

  const periods: AcademicPeriod[] = [...monthSet]
    .sort()
    .reverse()
    .map((key) => {
      const [y, m] = key.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0, 23, 59, 59, 999)
      const label = start.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
      return { key, label, start, end }
    })

  return periods
}

// ============================================================
// Main hook
// ============================================================

export interface UseReportOptions {
  studentId: string | undefined
  frameworkId: string | null
  periodKey: string | null
}

export interface UseReportResult {
  data: ReportData | null
  loading: boolean
  error: string | null
  setPeriodKey: (key: string | null) => void
  selectedPeriodKey: string | null
}

export function useReportData(studentId: string | undefined): UseReportResult {
  const [student, setStudent] = useState<Student | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [surveys, setSurveys] = useState<InterestSurvey[]>([])
  const [observers, setObservers] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedPeriodKey, setPeriodKey] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetchAll() {
      try {
        // 1. Fetch student
        const { data: studentData, error: studentErr } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single()

        if (studentErr) throw new Error(`Student not found: ${studentErr.message}`)
        if (cancelled) return
        const st = studentData as Student
        setStudent(st)

        // 2. Parallel fetch: classroom, school, dimensions, observations, surveys
        const [
          classroomRes,
          schoolRes,
          dimensionsRes,
          observationsRes,
          surveysRes,
        ] = await Promise.all([
          supabase.from('classrooms').select('*').eq('id', st.classroom_id).single(),
          supabase.from('schools').select('*').eq('id', st.school_id).single(),
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', st.school_id)
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('observations')
            .select('*')
            .eq('student_id', studentId!)
            .order('observed_at', { ascending: false })
            .limit(10000),
          supabase
            .from('interest_surveys')
            .select('*')
            .eq('student_id', studentId!)
            .order('submitted_at', { ascending: false }),
        ])

        if (cancelled) return

        setClassroom(classroomRes.data as Classroom | null)
        setSchool(schoolRes.data as School | null)
        setDimensions((dimensionsRes.data ?? []) as Dimension[])
        setObservations((observationsRes.data ?? []) as Observation[])
        setSurveys((surveysRes.data ?? []) as InterestSurvey[])

        // 3. Fetch observer names
        const obs = (observationsRes.data ?? []) as Observation[]
        const observerIds = [...new Set(obs.map((o) => o.observer_id))]
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
          setError(err instanceof Error ? err.message : 'Failed to load report data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [studentId])

  // ── Derived data ──

  const availablePeriods = buildPeriods(observations)

  // Auto-select current period if not set
  const effectivePeriodKey = selectedPeriodKey ?? (availablePeriods[0]?.key ?? null)
  const selectedPeriod = availablePeriods.find((p) => p.key === effectivePeriodKey) ?? null

  // Compute scores for the selected period
  const competencyMap = computeCompetencyForPeriod(observations, dimensions, selectedPeriod)
  const interestMap = extractInterestScores(
    surveys,
    dimensions,
    selectedPeriod?.end
  )

  const dimensionScores: DimensionScore[] = dimensions.map((dim) => {
    const dimObs = observations
      .filter((o) => o.dimension_id === dim.id)
      .sort(
        (a, b) =>
          new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )

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

  // Build dimension reports
  const dimensionReports: DimensionReportData[] = dimensions.map((dim) => {
    const score = dimensionScores.find((s) => s.dimension_id === dim.id)!
    const dimObs = observations
      .filter((o) => o.dimension_id === dim.id && o.notes)
      .sort(
        (a, b) =>
          new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )

    // If a period is selected, get the latest observation with notes within that period or before
    const relevantObs = selectedPeriod
      ? dimObs.filter((o) => new Date(o.observed_at) <= selectedPeriod.end)
      : dimObs

    const latestWithNotes = relevantObs[0] ?? null

    return {
      dimension: dim,
      score,
      latestNarrative: latestWithNotes?.notes ?? null,
      narrativeObserver: latestWithNotes
        ? observers.get(latestWithNotes.observer_id) ?? null
        : null,
      narrativeDate: latestWithNotes?.observed_at ?? null,
    }
  })

  // Build result
  const data: ReportData | null =
    student && school
      ? {
          student,
          classroom,
          school,
          dimensions,
          dimensionScores,
          dimensionReports,
          availablePeriods,
        }
      : null

  return {
    data,
    loading,
    error,
    setPeriodKey,
    selectedPeriodKey: effectivePeriodKey,
  }
}

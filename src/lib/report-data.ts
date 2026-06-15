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
  ReportingPeriod,
  SchoolContext,
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
// School-defined reporting periods → concrete date ranges
// ============================================================

export const DEFAULT_ACADEMIC_YEAR_START_MONTH = 9 // September

/** Academic start year → label, e.g. 2024 → "2024–2025". */
export function academicYearLabel(startYear: number): string {
  return `${startYear}–${startYear + 1}`
}

/** The academic start year that contains `date`, given the anchor month. */
function academicYearOf(date: Date, anchorMonth: number): number {
  const month = date.getMonth() + 1
  return month >= anchorMonth ? date.getFullYear() : date.getFullYear() - 1
}

/**
 * Resolve a reporting period to concrete dates for a given academic start year.
 * Months at/after the anchor belong to `startYear`; earlier months roll into
 * `startYear + 1`. A trailing guard keeps the range forward-facing for unusual
 * periods that straddle the anchor in reverse.
 */
function resolveReportingPeriod(
  period: ReportingPeriod,
  startYear: number,
  anchorMonth: number
): { start: Date; end: Date } {
  const yearFor = (m: number) => (m >= anchorMonth ? startYear : startYear + 1)
  const start = new Date(yearFor(period.startMonth), period.startMonth - 1, 1)
  let end = new Date(yearFor(period.endMonth), period.endMonth, 0, 23, 59, 59, 999)
  if (end < start) {
    end = new Date(yearFor(period.endMonth) + 1, period.endMonth, 0, 23, 59, 59, 999)
  }
  return { start, end }
}

/** Distinct academic start years drawn from observations, plus the current one, descending. */
function buildAcademicYears(observations: Observation[], anchorMonth: number): number[] {
  const years = new Set<number>()
  years.add(academicYearOf(new Date(), anchorMonth))
  for (const o of observations) {
    years.add(academicYearOf(new Date(o.observed_at), anchorMonth))
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * Build a composite period (bounding box + disjoint ranges) for the selected
 * reporting periods in the chosen academic year. Returns null when nothing is
 * selected, which makes the report fall back to all-time scoring.
 */
function buildCompositePeriod(
  reportingPeriods: ReportingPeriod[],
  selectedIds: string[],
  startYear: number,
  anchorMonth: number
): AcademicPeriod | null {
  const selected = reportingPeriods.filter((p) => selectedIds.includes(p.id))
  if (selected.length === 0) return null

  const ranges = selected.map((p) => resolveReportingPeriod(p, startYear, anchorMonth))
  const start = new Date(Math.min(...ranges.map((r) => r.start.getTime())))
  const end = new Date(Math.max(...ranges.map((r) => r.end.getTime())))
  const names = selected.map((p) => p.name.trim() || 'Untitled period').join(', ')

  return {
    key: `${startYear}:${selected.map((p) => p.id).join(',')}`,
    label: `${names} · ${academicYearLabel(startYear)}`,
    start,
    end,
    ranges,
  }
}

// ============================================================
// Main hook
// ============================================================

/** A reporting period resolved to concrete dates for the selected academic year. */
export interface ReportingPeriodOption {
  id: string
  name: string
  /** Resolved date range for the selected year, e.g. "Sep 2024 – Dec 2024". */
  rangeLabel: string
  selected: boolean
}

export interface UseReportResult {
  data: ReportData | null
  loading: boolean
  error: string | null
  /** School-defined reporting periods, resolved for the selected year. */
  reportingPeriodOptions: ReportingPeriodOption[]
  /** Academic start years available to choose from, descending. */
  availableYears: number[]
  /** Selected academic start year (e.g. 2024 → "2024–2025"). */
  selectedYear: number
  setSelectedYear: (year: number) => void
  /** Ids of the currently selected reporting periods. */
  selectedPeriodIds: string[]
  togglePeriod: (id: string) => void
  /** Human label for the selected period(s), for the report header. */
  periodLabel: string
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

  const [selectedYear, setSelectedYearState] = useState<number | null>(null)
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[] | null>(null)

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

  const settings = (school?.settings ?? {}) as SchoolContext
  const anchorMonth = settings.academic_year_start_month ?? DEFAULT_ACADEMIC_YEAR_START_MONTH
  const reportingPeriods = settings.reporting_periods ?? []
  const availableYears = buildAcademicYears(observations, anchorMonth)

  // Academic year: default to the one containing today.
  const effectiveYear = selectedYear ?? academicYearOf(new Date(), anchorMonth)

  // Default selection: the period whose range contains today, else the first one.
  const defaultSelectedIds: string[] = (() => {
    if (reportingPeriods.length === 0) return []
    const today = new Date()
    const current = reportingPeriods.find((p) => {
      const r = resolveReportingPeriod(p, effectiveYear, anchorMonth)
      return today >= r.start && today <= r.end
    })
    return [current?.id ?? reportingPeriods[0].id]
  })()
  const effectiveSelectedIds = selectedPeriodIds ?? defaultSelectedIds

  const selectedPeriod = buildCompositePeriod(
    reportingPeriods,
    effectiveSelectedIds,
    effectiveYear,
    anchorMonth
  )
  const periodLabel = selectedPeriod?.label ?? academicYearLabel(effectiveYear)

  // Resolve each period to a display range for the selected year.
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const reportingPeriodOptions: ReportingPeriodOption[] = reportingPeriods.map((p) => {
    const r = resolveReportingPeriod(p, effectiveYear, anchorMonth)
    return {
      id: p.id,
      name: p.name.trim() || 'Untitled period',
      rangeLabel: `${fmtMonth(r.start)} – ${fmtMonth(r.end)}`,
      selected: effectiveSelectedIds.includes(p.id),
    }
  })

  const setSelectedYear = (year: number) => setSelectedYearState(year)
  const togglePeriod = (id: string) =>
    setSelectedPeriodIds((prev) => {
      const base = prev ?? defaultSelectedIds
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })

  // Predicate: does a date fall within the selected period (any sub-range)?
  const inSelectedPeriod = (d: Date): boolean => {
    if (!selectedPeriod) return true
    return selectedPeriod.ranges
      ? selectedPeriod.ranges.some((r) => d >= r.start && d <= r.end)
      : d >= selectedPeriod.start && d <= selectedPeriod.end
  }

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

    // Prefer the latest note within the selected period(s); otherwise fall back
    // to the latest note at/before the period end (dimObs is sorted newest-first).
    const withinPeriod = dimObs.filter((o) => inSelectedPeriod(new Date(o.observed_at)))
    const beforeEnd = selectedPeriod
      ? dimObs.filter((o) => new Date(o.observed_at) <= selectedPeriod.end)
      : dimObs

    const latestWithNotes = withinPeriod[0] ?? beforeEnd[0] ?? null

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
        }
      : null

  return {
    data,
    loading,
    error,
    reportingPeriodOptions,
    availableYears,
    selectedYear: effectiveYear,
    setSelectedYear,
    selectedPeriodIds: effectiveSelectedIds,
    togglePeriod,
    periodLabel,
  }
}

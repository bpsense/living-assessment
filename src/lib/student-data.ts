import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Student,
  Classroom,
  Dimension,
  Observation,
  InterestSurvey,
  Profile,
  CompetencyScoreRow,
  CompetencyDimensionMapping,
  Competency,
  DimensionStandard,
} from '../types/database'
import { buildDimensionScores } from './scoring'
import type { DimensionScore, CompetencyBasedData } from './scoring'
import type { StandardAssessment } from './standards-assignment-data'

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

// Re-export for consumers that need to pass competency data to buildSnapshots
export type { CompetencyBasedData } from './scoring'

export interface StudentProfileData {
  student: Student | null
  /** Primary classroom (backward compat) */
  classroom: Classroom | null
  /** All classrooms the student is enrolled in */
  classrooms: (Classroom & { is_primary: boolean; status: 'active' | 'archived' })[]
  dimensions: Dimension[]
  dimensionScores: DimensionScore[]
  timeline: TimelineEntry[]
  observations: Observation[]
  surveys: InterestSurvey[]
  observers: Map<string, string>
  /** Competency-based scoring data (from assignments). null when no assignment data exists. */
  competencyData: CompetencyBasedData | null
  /** Standards-driven assessments for this student (append-only history that feeds the amoeba). */
  standardAssessments: StandardAssessment[]
  /** standard_id → dimension_id mapping for this school (rollup bridge). */
  dimensionStandards: DimensionStandard[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useStudentProfile(studentId: string | undefined): StudentProfileData {
  const [student, setStudent] = useState<Student | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [classrooms, setClassrooms] = useState<(Classroom & { is_primary: boolean; status: 'active' | 'archived' })[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [surveys, setSurveys] = useState<InterestSurvey[]>([])
  const [observers, setObservers] = useState<Map<string, string>>(new Map())
  const [competencyData, setCompetencyData] = useState<CompetencyBasedData | null>(null)
  const [standardAssessments, setStandardAssessments] = useState<StandardAssessment[]>([])
  const [dimensionStandards, setDimensionStandards] = useState<DimensionStandard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) return

    let cancelled = false
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

        const stu = studentData as Student

        // Lookback window: use enrollment date if available, otherwise 12 months
        const lookbackDate = stu.enrollment_date
          ? new Date(stu.enrollment_date)
          : (() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d })()
        // Ensure at least 12 months of history
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const observationCutoff = lookbackDate < twelveMonthsAgo ? lookbackDate : twelveMonthsAgo

        // Fetch all classroom enrollments via junction table
        const { data: scData } = await supabase
          .from('student_classrooms')
          .select('classroom_id, is_primary, status')
          .eq('student_id', studentId)
        const scRows = (scData ?? []) as { classroom_id: string; is_primary: boolean; status: string }[]
        const classroomIds = scRows.map((r) => r.classroom_id)
        const primaryMap = new Map(scRows.map((r) => [r.classroom_id, r.is_primary]))
        const statusMap = new Map(scRows.map((r) => [r.classroom_id, (r.status as 'active' | 'archived') ?? 'active']))

        if (cancelled) return

        // Fetch classrooms, dimensions, observations, surveys, competency data,
        // and the standards-driven amoeba pipeline (assessments + dimension bridges) in parallel
        const [
          classroomsRes,
          dimensionsRes,
          observationsRes,
          surveysRes,
          compScoresRes,
          mappingsRes,
          competenciesRes,
          standardAssessmentsRes,
          dimensionStandardsRes,
        ] = await Promise.all([
          classroomIds.length > 0
            ? supabase.from('classrooms').select('*').in('id', classroomIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from('dimensions')
            .select('*')
            .eq('school_id', stu.school_id)
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('observations')
            .select('*')
            .eq('student_id', studentId)
            .gte('observed_at', observationCutoff.toISOString())
            .order('observed_at', { ascending: false }),
          supabase
            .from('interest_surveys')
            .select('*')
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false }),
          // Competency scores for this student
          supabase
            .from('competency_scores')
            .select('*')
            .eq('student_id', studentId)
            .order('scored_at', { ascending: false }),
          // Competency-dimension mappings for this school
          supabase
            .from('competency_dimension_mappings')
            .select('*')
            .eq('school_id', stu.school_id),
          // Competencies for this school (for step_descriptors filtering)
          supabase
            .from('competencies')
            .select('*')
            .in(
              'framework_id',
              // Subquery: framework IDs for this school
              (
                await supabase
                  .from('competency_frameworks')
                  .select('id')
                  .eq('school_id', stu.school_id)
              ).data?.map((f) => f.id) || []
            ),
          // Standards-driven assessments — append-only history that feeds the amoeba
          supabase
            .from('assignment_standard_assessments')
            .select('*')
            .eq('student_id', studentId)
            .order('assessed_at', { ascending: true }),
          // standard_id ↔ dimension_id bridges for this school's amoeba rollup
          supabase
            .from('dimension_standards')
            .select('id, dimension_id, standard_id, school_id, created_at')
            .eq('school_id', stu.school_id),
        ])

        if (cancelled) return

        const classroomsList = ((classroomsRes.data ?? []) as Classroom[]).map((c) => ({
          ...c,
          is_primary: primaryMap.get(c.id) ?? false,
          status: statusMap.get(c.id) ?? 'active' as const,
        }))
        // Primary classroom for backward compat
        const classroomData = classroomsList.find((c) => c.is_primary) ?? classroomsList[0] ?? null
        const dimensionsData = (dimensionsRes.data ?? []) as Dimension[]
        const observationsData = (observationsRes.data ?? []) as Observation[]
        const surveysData = (surveysRes.data ?? []) as InterestSurvey[]
        const compScoresData = (compScoresRes.data ?? []) as CompetencyScoreRow[]
        const mappingsData = (mappingsRes.data ?? []) as CompetencyDimensionMapping[]
        const competenciesData = (competenciesRes.data ?? []) as Competency[]
        const standardAssessmentsData = (standardAssessmentsRes.data ?? []) as StandardAssessment[]
        const dimensionStandardsData = (dimensionStandardsRes.data ?? []) as DimensionStandard[]

        setClassroom(classroomData ? { ...classroomData } : null)
        setClassrooms(classroomsList)
        setDimensions(dimensionsData)
        setObservations(observationsData)
        setSurveys(surveysData)
        setStandardAssessments(standardAssessmentsData)
        setDimensionStandards(dimensionStandardsData)

        // Build competency-based data if we have scores and mappings
        if (compScoresData.length > 0 && mappingsData.length > 0) {
          setCompetencyData({
            competencyScores: compScoresData,
            mappings: mappingsData,
            competencies: competenciesData,
            gradeLevel: stu.grade_level,
          })
        } else {
          setCompetencyData(null)
        }

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

  // Derived data: build dimension scores blending observations + competency scores
  const dimensionScores = buildDimensionScores(
    dimensions,
    observations,
    surveys,
    competencyData ?? undefined
  )

  const timeline = buildTimeline(observations, surveys, dimensions, observers)

  return {
    student,
    classroom,
    classrooms,
    dimensions,
    dimensionScores,
    timeline,
    observations,
    surveys,
    observers,
    competencyData,
    standardAssessments,
    dimensionStandards,
    loading,
    error,
    refetch,
  }
}

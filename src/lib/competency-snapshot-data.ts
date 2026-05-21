/**
 * competency-snapshot-data.ts
 *
 * Data layer for the Competency Snapshot. Read-only.
 *
 * Output is a per-dimension grouping of `SnapshotRow`s, each carrying:
 *   - the standard
 *   - full assessment history (asc by assessed_at)
 *   - latest assessment (or null for ghost rows)
 *   - spectrum score (number in [0, 5] or null = untimed)
 *   - barPercent (0..100 — where to draw the marker on the bar)
 *   - zone ('below' | 'at' | 'above' | 'untimed' — for tally counts + sort)
 *   - trend (up | down | flat)
 *
 * Untimed and unassigned buckets are surfaced separately so the consumer can
 * render them without dropping anything.
 */
import { supabase } from './supabase'
import {
  ageFromDob,
  classifyBand,
  classifyTrend,
  computeSpectrumScore,
  spectrumToBarPercent,
  spectrumToZone,
  type Zone,
  type Trend,
} from './competency-snapshot'
import { type StandardAssessment } from './standards-assignment-data'
import type {
  Dimension,
  DimensionStandard,
  Standard,
  Student,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface SnapshotRow {
  standard: Standard
  latest: StandardAssessment | null
  history: StandardAssessment[]
  /** Continuous [0, 5] score or null when untimed. */
  spectrumScore: number | null
  /** 0..100 — where on the bar this marker sits. Untimed rows: 50 (centered). */
  barPercent: number
  /** Categorical bucket derived from spectrumScore. */
  zone: Zone
  trend: Trend
  /** True for age-appropriate standards with no assessment history. */
  isGhost: boolean
}

export interface DomainGroup {
  dimension: Dimension
  rows: SnapshotRow[]
  counts: Record<Zone, number>
  untimed: SnapshotRow[]
}

export interface CompetencySnapshot {
  learnerAge: number | null
  groups: DomainGroup[]
  unassigned: SnapshotRow[]
  totals: Record<Zone, number>
}

// ============================================================
// Fetch
// ============================================================

interface SnapshotInputs {
  student: Pick<Student, 'id' | 'school_id' | 'date_of_birth'>
  dimensions: Dimension[]
  dimensionStandards: DimensionStandard[]
  standards: Standard[]
  assessments: StandardAssessment[]
  familyView: boolean
  /** Optional override for "now" (lets tests pin the decay clock). */
  now?: Date
}

export async function getCompetencySnapshot(
  studentId: string,
  options: { familyView?: boolean } = {}
): Promise<CompetencySnapshot> {
  const familyView = options.familyView ?? false

  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, school_id, date_of_birth')
    .eq('id', studentId)
    .single()
  if (stuErr || !student) throw new Error(`Student not found: ${stuErr?.message}`)
  const stu = student as Pick<Student, 'id' | 'school_id' | 'date_of_birth'>

  const [dimsRes, dsRes, stdsRes, asRes] = await Promise.all([
    supabase
      .from('dimensions')
      .select('*')
      .eq('school_id', stu.school_id)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('dimension_standards')
      .select('id, dimension_id, standard_id, school_id, created_at')
      .eq('school_id', stu.school_id),
    supabase
      .from('standards')
      .select(
        'id, framework_id, school_id, code, description, grade_level, parent_id, display_order, visible_to_family, age_band_start, age_band_end, created_at, updated_at'
      )
      .eq('school_id', stu.school_id)
      .order('display_order'),
    supabase
      .from('assignment_standard_assessments')
      .select('*')
      .eq('student_id', studentId)
      .order('assessed_at', { ascending: true }),
  ])
  if (dimsRes.error) throw dimsRes.error
  if (dsRes.error) throw dsRes.error
  if (stdsRes.error) throw stdsRes.error
  if (asRes.error) throw asRes.error

  return buildCompetencySnapshot({
    student: stu,
    dimensions: (dimsRes.data ?? []) as Dimension[],
    dimensionStandards: (dsRes.data ?? []) as DimensionStandard[],
    standards: (stdsRes.data ?? []) as Standard[],
    assessments: (asRes.data ?? []) as StandardAssessment[],
    familyView,
  })
}

// ============================================================
// Standard detail (for the click-through modal)
// ============================================================

export interface StandardDetail {
  standard: Standard
  /** All assessments for this learner on this standard, descending by date. */
  history: StandardAssessment[]
  /** Parent assignments that include this standard for this learner. */
  assignments: Array<{
    id: string
    title: string
    description: string | null
    due_date: string | null
    status: string
  }>
  /** Matching competency by code, if one exists. Carries `name`, `objective`,
   *  and `step_descriptors` for the age-expectation panel. */
  competency: {
    code: string
    name: string
    objective: string | null
    step_descriptors: Record<string, string>
  } | null
  /** Names of educators who recorded assessments (assessor_id → full_name). */
  assessors: Record<string, string>
}

/**
 * Fetch everything the click-through modal needs for a single standard.
 * Separate from the page-load fetch because it's lazy (only on click).
 */
export async function getStandardDetail(args: {
  studentId: string
  schoolId: string
  standardId: string
}): Promise<StandardDetail> {
  const { studentId, schoolId, standardId } = args

  const [stdRes, histRes] = await Promise.all([
    supabase
      .from('standards')
      .select(
        'id, framework_id, school_id, code, description, grade_level, parent_id, display_order, visible_to_family, age_band_start, age_band_end, created_at, updated_at'
      )
      .eq('id', standardId)
      .single(),
    supabase
      .from('assignment_standard_assessments')
      .select('*')
      .eq('student_id', studentId)
      .eq('standard_id', standardId)
      .order('assessed_at', { ascending: false })
      .returns<StandardAssessment[]>(),
  ])
  if (stdRes.error || !stdRes.data) throw new Error(stdRes.error?.message ?? 'Standard not found')
  if (histRes.error) throw histRes.error

  const standard = stdRes.data as Standard
  const history = histRes.data ?? []

  // Pull the matching competency by code (school-scoped via framework).
  // Boundless seeded standards + competencies share codes; for CCSS schools
  // this returns null and the UI falls back to standard.description.
  const { data: compRows } = await supabase
    .from('competencies')
    .select('code, name, objective, step_descriptors, framework_id')
    .eq('code', standard.code)
  const competency = (() => {
    if (!compRows || compRows.length === 0) return null
    // If multiple, prefer one whose framework belongs to this school. We
    // don't have framework→school in this query; just take the first.
    const c = compRows[0] as {
      code: string
      name: string
      objective: string | null
      step_descriptors: Record<string, string>
    }
    return c
  })()

  // Parent assignment(s) that include this standard for this learner.
  const { data: saRows } = await supabase
    .from('student_assignments')
    .select(
      `id,
       assignment:assignment_id (
         id, title, description, due_date, status, school_id
       ),
       student_assignment_standards!inner ( standard_id )`
    )
    .eq('student_id', studentId)
    .eq('student_assignment_standards.standard_id', standardId)
  type SaRow = {
    id: string
    assignment: {
      id: string
      title: string
      description: string | null
      due_date: string | null
      status: string
      school_id: string
    }
  }
  const assignments = ((saRows ?? []) as unknown as SaRow[])
    .filter((r) => r.assignment?.school_id === schoolId)
    .map((r) => ({
      id: r.assignment.id,
      title: r.assignment.title,
      description: r.assignment.description,
      due_date: r.assignment.due_date,
      status: r.assignment.status,
    }))

  // Resolve assessor names for the history rows.
  const assessorIds = [...new Set(history.map((h) => h.assessor_id))]
  const assessors: Record<string, string> = {}
  if (assessorIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', assessorIds)
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string }>) {
      assessors[p.id] = p.full_name
    }
  }

  return { standard, history, assignments, competency, assessors }
}

// ============================================================
// Pure assembly (exported for tests)
// ============================================================

export function buildCompetencySnapshot(input: SnapshotInputs): CompetencySnapshot {
  const {
    student,
    dimensions,
    dimensionStandards,
    standards,
    assessments,
    familyView,
    now = new Date(),
  } = input

  const learnerAge = ageFromDob(student.date_of_birth ?? null, now)

  const visibleDims = familyView
    ? dimensions.filter((d) => d.visible_to_family)
    : dimensions
  const visibleDimIds = new Set(visibleDims.map((d) => d.id))

  const stdToDim = new Map<string, string>()
  for (const ds of dimensionStandards) {
    if (!visibleDimIds.has(ds.dimension_id)) continue
    stdToDim.set(ds.standard_id, ds.dimension_id)
  }

  const visibleStandards = standards.filter(
    (s) => !familyView || s.visible_to_family
  )
  const stdById = new Map(visibleStandards.map((s) => [s.id, s]))

  const historyByStd = new Map<string, StandardAssessment[]>()
  for (const a of assessments) {
    if (!stdById.has(a.standard_id)) continue
    const arr = historyByStd.get(a.standard_id)
    if (arr) arr.push(a)
    else historyByStd.set(a.standard_id, [a])
  }

  const groups: DomainGroup[] = visibleDims.map((dimension) => ({
    dimension,
    rows: [],
    counts: emptyZoneCounts(),
    untimed: [],
  }))
  const groupByDim = new Map(groups.map((g) => [g.dimension.id, g]))
  const unassigned: SnapshotRow[] = []

  const assessedStdIds = new Set(historyByStd.keys())
  for (const stdId of assessedStdIds) {
    const standard = stdById.get(stdId)
    if (!standard) continue
    const row = buildRow({
      standard,
      history: historyByStd.get(stdId) ?? [],
      learnerAge,
      isGhost: false,
      now,
    })
    placeRow(row, stdToDim, groupByDim, unassigned)
  }

  // Ghost rows for matching-band standards with no history.
  if (learnerAge !== null) {
    for (const standard of visibleStandards) {
      if (assessedStdIds.has(standard.id)) continue
      const band = classifyBand(learnerAge, standard.age_band_start, standard.age_band_end)
      if (band !== 'matching') continue
      const row = buildRow({ standard, history: [], learnerAge, isGhost: true, now })
      placeRow(row, stdToDim, groupByDim, unassigned)
    }
  }

  for (const group of groups) {
    group.rows.sort(rowSortFn)
    group.untimed.sort(rowSortFn)
  }
  unassigned.sort(rowSortFn)

  const totals = emptyZoneCounts()
  for (const group of groups) {
    for (const row of group.rows) totals[row.zone] += 1
    for (const row of group.untimed) totals[row.zone] += 1
  }
  for (const row of unassigned) totals[row.zone] += 1

  return {
    learnerAge,
    groups: groups.filter((g) => g.rows.length > 0 || g.untimed.length > 0),
    unassigned,
    totals,
  }
}

// ============================================================
// Helpers
// ============================================================

function buildRow(args: {
  standard: Standard
  history: StandardAssessment[]
  learnerAge: number | null
  isGhost: boolean
  now: Date
}): SnapshotRow {
  const { standard, history, learnerAge, isGhost, now } = args
  const band = classifyBand(learnerAge, standard.age_band_start, standard.age_band_end)
  const latest = history.length > 0 ? history[history.length - 1] : null

  let spectrumScore: number | null
  if (isGhost) {
    // Age-appropriate but unassessed — center of the bar, "at" by construction.
    spectrumScore = band === 'unknown' ? null : 3
  } else {
    spectrumScore = computeSpectrumScore(history, band, now)
  }

  const zone = spectrumToZone(spectrumScore)
  const barPercent = spectrumScore === null ? 50 : spectrumToBarPercent(spectrumScore)

  return {
    standard,
    latest,
    history,
    spectrumScore,
    barPercent,
    zone,
    trend: classifyTrend(history),
    isGhost,
  }
}

function placeRow(
  row: SnapshotRow,
  stdToDim: Map<string, string>,
  groupByDim: Map<string, DomainGroup>,
  unassigned: SnapshotRow[]
) {
  const dimId = stdToDim.get(row.standard.id)
  if (!dimId) {
    unassigned.push(row)
    return
  }
  const group = groupByDim.get(dimId)
  if (!group) {
    unassigned.push(row)
    return
  }
  if (row.zone === 'untimed') {
    group.untimed.push(row)
  } else {
    group.rows.push(row)
    group.counts[row.zone] += 1
  }
}

function emptyZoneCounts(): Record<Zone, number> {
  return { below: 0, at: 0, above: 0, untimed: 0 }
}

const ZONE_WEIGHT: Record<Zone, number> = { below: 0, at: 1, above: 2, untimed: 3 }

function rowSortFn(a: SnapshotRow, b: SnapshotRow): number {
  if (a.isGhost !== b.isGhost) return a.isGhost ? 1 : -1
  const zw = ZONE_WEIGHT[a.zone] - ZONE_WEIGHT[b.zone]
  if (zw !== 0) return zw
  // Within a zone, sort by bar position (left first).
  if (a.barPercent !== b.barPercent) return a.barPercent - b.barPercent
  return a.standard.code.localeCompare(b.standard.code, undefined, { numeric: true })
}

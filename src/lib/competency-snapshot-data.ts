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
  decayWeight,
  spectrumToBarPercent,
  spectrumToZone,
  type Zone,
  type Trend,
} from './competency-snapshot'
import {
  ASSESSMENT_LEVELS,
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'
import type {
  Competency,
  Dimension,
  DimensionStandard,
  Observation,
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
// Observations-driven snapshot (schools without the standards pipeline)
// ============================================================

/** Map a 1-4 observation rating to an assessment level. */
function ratingToLevel(rating: number): AssessmentLevel {
  const i = Math.min(4, Math.max(1, Math.round(Number(rating)))) - 1
  return ASSESSMENT_LEVELS[i]
}

/** Adapt a competency to the `Standard` shape the renderer expects (label = name). */
function competencyAsStandard(c: Competency, fallbackSchoolId: string): Standard {
  return {
    id: c.id,
    framework_id: c.framework_id ?? '',
    school_id: c.school_id ?? fallbackSchoolId,
    code: c.name, // marker label — the internal BL.* code is meaningless to users
    description: c.objective ?? c.name,
    grade_level: null,
    parent_id: null,
    display_order: c.display_order,
    visible_to_family: true,
    age_band_start: c.age_band_start,
    age_band_end: c.age_band_end,
    created_at: c.created_at,
    updated_at: c.created_at,
  }
}

/** Adapt an observation to the `StandardAssessment` shape (for level label + trend). */
function observationAsAssessment(o: Observation): StandardAssessment {
  return {
    id: o.id,
    student_assignment_id: '',
    student_id: o.student_id,
    school_id: o.school_id,
    standard_id: o.competency_id as string,
    level: ratingToLevel(Number(o.rating)),
    notes: o.notes,
    assessor_id: o.observer_id,
    assessed_at: o.observed_at,
    created_at: o.created_at,
  }
}

/**
 * Spectrum contribution [0,5] of a single observation, based on the step it was
 * assessed at relative to the learner's current age:
 *   - above step  -> "above" zone (>=4), even at "developing"
 *   - at step      -> raw rating 1-4 (zones: <2 below, 2-4 at, >=4 above)
 *   - below step   -> "below" zone (<2); "achieving"+ is handled as drop-off, so
 *                     only emerging/developing reach here
 * NULL assessed_age (legacy / dimension-level) falls back to raw rating.
 */
function observationStepScore(
  rating: number,
  assessedAge: number | null,
  learnerAge: number | null
): number {
  const r = Math.max(1, Math.min(4, Number(rating)))
  if (learnerAge == null || assessedAge == null) return r
  const rel = assessedAge - learnerAge
  if (rel > 0) return Math.min(5, 4 + 0.15 * (rel - 1) + 0.2 * (r - 1))
  if (rel < 0) return Math.max(0, Math.min(1.9, r - 1 - 0.3 * (Math.abs(rel) - 1)))
  return r
}

/**
 * Build the Competency Snapshot from the flat competency model
 * (`competencies` + `observations.competency_id` + `observations.assessed_age`).
 *
 * Position rule (per competency, vs the learner's CURRENT age):
 *   - drops off entirely once "achieving"+ is recorded at a below-age step
 *     (below-age content the learner has mastered)
 *   - otherwise positioned by a recency-weighted (90-day half-life, last 5)
 *     average of each observation's step-relative score (see observationStepScore)
 *   - age-appropriate competencies with no observations show as centered ghosts
 */
export function buildCompetencySnapshotFromObservations(input: {
  student: Pick<Student, 'id' | 'school_id' | 'date_of_birth'>
  dimensions: Dimension[]
  competencies: Competency[]
  observations: Observation[]
  familyView: boolean
  now?: Date
}): CompetencySnapshot {
  const { student, dimensions, competencies, observations, familyView, now = new Date() } = input
  const learnerAge = ageFromDob(student.date_of_birth ?? null, now)

  const visibleDims = familyView ? dimensions.filter((d) => d.visible_to_family) : dimensions
  const visibleDimIds = new Set(visibleDims.map((d) => d.id))

  const obsByComp = new Map<string, Observation[]>()
  for (const o of observations) {
    if (!o.competency_id) continue
    const arr = obsByComp.get(o.competency_id)
    if (arr) arr.push(o)
    else obsByComp.set(o.competency_id, [o])
  }

  const groups: DomainGroup[] = visibleDims.map((dimension) => ({
    dimension,
    rows: [],
    counts: emptyZoneCounts(),
    untimed: [],
  }))
  const groupByDim = new Map(groups.map((g) => [g.dimension.id, g]))
  const unassigned: SnapshotRow[] = []
  const nowMs = now.getTime()

  for (const comp of competencies) {
    if (!comp.dimension_id || !visibleDimIds.has(comp.dimension_id)) continue

    const hist = (obsByComp.get(comp.id) ?? [])
      .slice()
      .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())

    // Drop-off: ever achieved (3+) at a step below the learner's current age.
    const dropped = hist.some(
      (o) =>
        o.assessed_age != null &&
        learnerAge != null &&
        o.assessed_age < learnerAge &&
        Number(o.rating) >= 3
    )
    if (dropped) continue

    const applicableNow =
      learnerAge != null &&
      (comp.age_band_start == null || comp.age_band_start <= learnerAge) &&
      (comp.age_band_end == null || comp.age_band_end >= learnerAge)

    let spectrumScore: number | null
    let isGhost: boolean
    if (hist.length === 0) {
      // Known age + not age-appropriate -> omit. Unknown age -> show as untimed
      // (so the framework's competencies still appear; add a DOB to age-position).
      if (learnerAge != null && !applicableNow) continue
      isGhost = true
      spectrumScore = learnerAge == null ? null : 3
    } else {
      isGhost = false
      const recent = hist.slice(-5) // most recent 5
      let weightedSum = 0
      let totalWeight = 0
      for (const o of recent) {
        const days = Math.max(0, (nowMs - new Date(o.observed_at).getTime()) / 86_400_000)
        const w = decayWeight(days)
        weightedSum += observationStepScore(Number(o.rating), o.assessed_age, learnerAge) * w
        totalWeight += w
      }
      spectrumScore = totalWeight > 0 ? Math.max(0, Math.min(5, weightedSum / totalWeight)) : null
    }

    const adaptedHist = hist.map(observationAsAssessment)
    const zone = spectrumToZone(spectrumScore)
    const row: SnapshotRow = {
      standard: competencyAsStandard(comp, student.school_id),
      latest: adaptedHist.length ? adaptedHist[adaptedHist.length - 1] : null,
      history: adaptedHist,
      spectrumScore,
      barPercent: spectrumScore === null ? 50 : spectrumToBarPercent(spectrumScore),
      zone,
      trend: classifyTrend(adaptedHist),
      isGhost,
    }

    const group = groupByDim.get(comp.dimension_id)
    if (!group) {
      unassigned.push(row)
    } else if (zone === 'untimed') {
      group.untimed.push(row)
    } else {
      group.rows.push(row)
      group.counts[zone] += 1
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

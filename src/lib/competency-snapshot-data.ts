/**
 * competency-snapshot-data.ts
 *
 * Data layer for the Competency Snapshot section. Read-only; reuses
 * existing access in standards-assignment-data.ts and standards-snapshots.ts
 * conceptually but talks to supabase directly to keep one place to optimize.
 *
 * Output shape: per-dimension groups (matching the amoeba's spokes) of
 * SnapshotRow values, each carrying the latest assessment + computed
 * position + trend, plus age-appropriate ghost rows the learner has not
 * yet been assessed on. Untimed and unassigned buckets are surfaced
 * separately so the consumer can render them without dropping anything.
 */
import { supabase } from './supabase'
import {
  ageFromDob,
  classifyBand,
  classifyPosition,
  classifyTrend,
  type Position,
  type Trend,
} from './competency-snapshot'
import {
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'
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
  /** Latest assessment for this standard, or null for ghost rows. */
  latest: StandardAssessment | null
  /** Computed position; 'untimed' when standard has no age band. */
  position: Position
  /** up/down/flat. 'flat' for single or zero assessments. */
  trend: Trend
  /** Full assessment history for this standard, ascending by assessed_at. */
  history: StandardAssessment[]
  /** True when the row was added because the standard is age-appropriate
   *  but the learner has not been assessed on it yet. */
  isGhost: boolean
}

export interface DomainGroup {
  /** Amoeba dimension this group represents. */
  dimension: Dimension
  rows: SnapshotRow[]
  counts: Record<Position, number>
  /** Rows whose position is 'untimed' (no resolvable age band). */
  untimed: SnapshotRow[]
}

export interface CompetencySnapshot {
  /** Integer learner age, or null when DOB is missing. */
  learnerAge: number | null
  /** Per-dimension groups in display order. Empty groups are dropped. */
  groups: DomainGroup[]
  /** Rows whose standard does not roll up to any dimension. */
  unassigned: SnapshotRow[]
  /** Totals across the snapshot, useful for the page header strip. */
  totals: Record<Position, number>
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
}

/**
 * Pull every input the snapshot needs in a single round-trip per table.
 * Family view filters dimensions and standards server-side respecting the
 * `visible_to_family` flags. RLS additionally clamps the rows for parents.
 */
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
// Pure assembly (exported for tests)
// ============================================================

/**
 * Pure function from raw inputs to the snapshot view-model. Exported so
 * tests can exercise the per-domain grouping and ghost-row logic without
 * touching supabase.
 */
export function buildCompetencySnapshot(input: SnapshotInputs): CompetencySnapshot {
  const { student, dimensions, dimensionStandards, standards, assessments, familyView } = input

  const learnerAge = ageFromDob(student.date_of_birth ?? null)

  // Family view filters out family-hidden dimensions and standards.
  const visibleDims = familyView
    ? dimensions.filter((d) => d.visible_to_family)
    : dimensions
  const visibleDimIds = new Set(visibleDims.map((d) => d.id))

  // standard_id → dimension_id (we keep only bridges to visible dims)
  const stdToDim = new Map<string, string>()
  for (const ds of dimensionStandards) {
    if (!visibleDimIds.has(ds.dimension_id)) continue
    stdToDim.set(ds.standard_id, ds.dimension_id)
  }

  // Visible standards (family view also gates on standards.visible_to_family)
  const visibleStandards = standards.filter(
    (s) => !familyView || s.visible_to_family
  )
  const stdById = new Map(visibleStandards.map((s) => [s.id, s]))

  // Group full assessment history by standard, asc by assessed_at.
  const historyByStd = new Map<string, StandardAssessment[]>()
  for (const a of assessments) {
    if (!stdById.has(a.standard_id)) continue
    const arr = historyByStd.get(a.standard_id)
    if (arr) arr.push(a)
    else historyByStd.set(a.standard_id, [a])
  }

  // Build empty groups in dimension display order. Drop empties at the end.
  const groups: DomainGroup[] = visibleDims.map((dimension) => ({
    dimension,
    rows: [],
    counts: emptyPositionCounts(),
    untimed: [],
  }))
  const groupByDim = new Map(groups.map((g) => [g.dimension.id, g]))
  const unassigned: SnapshotRow[] = []

  // Standards the learner has actually been assessed on.
  const assessedStdIds = new Set(historyByStd.keys())
  for (const stdId of assessedStdIds) {
    const standard = stdById.get(stdId)
    if (!standard) continue
    const row = buildRow({ standard, history: historyByStd.get(stdId) ?? [], learnerAge, isGhost: false })
    placeRow(row, stdToDim, groupByDim, unassigned)
  }

  // Ghost rows: every standard whose age band overlaps the learner's age
  // AND on which the learner has not yet been assessed.
  if (learnerAge !== null) {
    for (const standard of visibleStandards) {
      if (assessedStdIds.has(standard.id)) continue
      const band = classifyBand(learnerAge, standard.age_band_start, standard.age_band_end)
      if (band !== 'matching') continue
      const row = buildRow({ standard, history: [], learnerAge, isGhost: true })
      placeRow(row, stdToDim, groupByDim, unassigned)
    }
  }

  // Sort rows within each group: needs-attention first, then by code.
  for (const group of groups) {
    group.rows.sort(rowSortFn)
    group.untimed.sort(rowSortFn)
  }
  unassigned.sort(rowSortFn)

  // Totals across all visible groups + unassigned (untimed counted in 'untimed').
  const totals = emptyPositionCounts()
  for (const group of groups) {
    for (const row of group.rows) totals[row.position] += 1
    for (const row of group.untimed) totals[row.position] += 1
  }
  for (const row of unassigned) totals[row.position] += 1

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
}): SnapshotRow {
  const { standard, history, learnerAge, isGhost } = args
  const band = classifyBand(learnerAge, standard.age_band_start, standard.age_band_end)
  const latest = history.length > 0 ? history[history.length - 1] : null
  const level: AssessmentLevel | null = latest ? latest.level : null

  // Ghost rows have no level — their position is 'at' by construction
  // (the band overlaps the learner's age), with 'untimed' falling out when
  // the band is missing.
  let position: Position
  if (level === null) {
    position = band === 'unknown' ? 'untimed' : 'at'
  } else {
    position = classifyPosition(level, band)
  }

  return {
    standard,
    latest,
    position,
    trend: classifyTrend(history),
    history,
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
  if (row.position === 'untimed') {
    group.untimed.push(row)
  } else {
    group.rows.push(row)
    group.counts[row.position] += 1
  }
}

function emptyPositionCounts(): Record<Position, number> {
  return { ahead: 0, at: 0, building: 0, untimed: 0 }
}

const POSITION_WEIGHT: Record<Position, number> = {
  building: 0,
  at: 1,
  ahead: 2,
  untimed: 3,
}

function rowSortFn(a: SnapshotRow, b: SnapshotRow): number {
  // Real (assessed) rows first, ghost rows after, then by position weight,
  // then by standard code for deterministic ordering.
  if (a.isGhost !== b.isGhost) return a.isGhost ? 1 : -1
  const pw = POSITION_WEIGHT[a.position] - POSITION_WEIGHT[b.position]
  if (pw !== 0) return pw
  return a.standard.code.localeCompare(b.standard.code, undefined, { numeric: true })
}

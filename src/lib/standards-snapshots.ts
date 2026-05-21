/**
 * standards-snapshots.ts
 *
 * Phase 3 (parallel) data path: builds the same monthly AmoebaSnapshot[]
 * shape that the LivingBlob already consumes, but sources from the new
 * `assignment_standard_assessments` (append-only) + `dimension_standards`
 * pipeline instead of the legacy skill_assessments → competencies path.
 *
 * Not yet wired into LivingVisualization — exported for shadow-mode
 * comparison and one-line switchover when verified.
 */
import { ageAt, type AmoebaSnapshot } from './living-data'
import type { Dimension, DimensionStandard } from '../types/database'
import {
  LEVEL_SCORE,
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'

export interface BuildStandardsSnapshotsInput {
  dateOfBirth: string
  schoolId: string
  dimensions: Dimension[]
  /** All assessments for the student, ordered ascending by assessed_at. */
  assessments: StandardAssessment[]
  /** standard_id ↔ dimension_id bridges (school-scoped). */
  dimensionStandards: DimensionStandard[]
}

/** Build monthly snapshots from earliest assessment (or 12mo ago) through now. */
export function buildSnapshotsFromStandards(
  input: BuildStandardsSnapshotsInput
): AmoebaSnapshot[] {
  const { dateOfBirth, schoolId, dimensions, assessments, dimensionStandards } = input
  if (!dateOfBirth || dimensions.length === 0) return []

  const dob = new Date(dateOfBirth)

  // standard_id → dimension_id (school-scoped)
  const standardToDim = new Map<string, string>()
  for (const ds of dimensionStandards) {
    if (ds.school_id !== schoolId) continue
    standardToDim.set(ds.standard_id, ds.dimension_id)
  }

  // Determine month range: from the earliest assessment month (or 12 months
  // back if none) through the current month.
  const now = new Date()
  const earliest =
    assessments.length > 0
      ? new Date(assessments[0].assessed_at)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const months: Date[] = []
  const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push(new Date(d))
  }

  // For each month: walk assessments ≤ end-of-month, keep latest per
  // (standard_id), then average level scores per dimension.
  const snaps: AmoebaSnapshot[] = []
  let prevAge = -1

  for (const month of months) {
    const cutoff = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)

    // Latest per standard up to cutoff
    const latestByStd = new Map<string, StandardAssessment>()
    for (const a of assessments) {
      if (new Date(a.assessed_at) > cutoff) break
      latestByStd.set(a.standard_id, a)
    }

    // Aggregate per dimension
    const sums = new Map<string, { sum: number; n: number }>()
    for (const a of latestByStd.values()) {
      const dimId = standardToDim.get(a.standard_id)
      if (!dimId) continue
      const score = LEVEL_SCORE[a.level as AssessmentLevel]
      const cur = sums.get(dimId) ?? { sum: 0, n: 0 }
      cur.sum += score
      cur.n += 1
      sums.set(dimId, cur)
    }

    const dimsOut: Record<string, number | null> = {}
    for (const dim of dimensions) {
      const agg = sums.get(dim.id)
      dimsOut[dim.id] = agg && agg.n > 0 ? agg.sum / agg.n : null
    }

    const { years, months: ageM } = ageAt(dob, cutoff)
    const isAgeRollover = prevAge !== -1 && years !== prevAge
    snaps.push({
      date: month.toISOString().slice(0, 10),
      label: month.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      ageYears: years,
      ageMonths: ageM,
      dimensions: dimsOut,
      isAgeRollover: isAgeRollover || undefined,
      prevAgeYears: isAgeRollover ? prevAge : undefined,
    })
    prevAge = years
  }

  return snaps
}

// ============================================================
// Current-only aggregate (for classroom mini-amoebas, dashboards, etc.)
// ============================================================

/**
 * For a single learner, compute the current per-dimension competency average
 * (1..4 or 0 when no contributing assessments) from their full assessment
 * history. Latest-per-standard wins; standards aggregate into their dimension
 * via the school-scoped `dimensionStandards` bridge.
 *
 * Returns a Record keyed by dimension_id. Use with `dimensions` to project
 * onto the `DimensionScore[]` shape (see `currentDimensionScoresFromStandards`).
 */
export function currentDimensionAveragesFromStandards(input: {
  schoolId: string
  dimensions: Dimension[]
  assessments: StandardAssessment[]
  dimensionStandards: DimensionStandard[]
}): Record<string, number> {
  const { schoolId, dimensions, assessments, dimensionStandards } = input

  const standardToDim = new Map<string, string>()
  for (const ds of dimensionStandards) {
    if (ds.school_id !== schoolId) continue
    standardToDim.set(ds.standard_id, ds.dimension_id)
  }

  // Latest assessment per standard (assessments arrive ASC by date so the
  // later overwrite wins).
  const latestByStd = new Map<string, StandardAssessment>()
  for (const a of assessments) {
    latestByStd.set(a.standard_id, a)
  }

  const sums = new Map<string, { sum: number; n: number }>()
  for (const a of latestByStd.values()) {
    const dimId = standardToDim.get(a.standard_id)
    if (!dimId) continue
    const score = LEVEL_SCORE[a.level as AssessmentLevel]
    const cur = sums.get(dimId) ?? { sum: 0, n: 0 }
    cur.sum += score
    cur.n += 1
    sums.set(dimId, cur)
  }

  const out: Record<string, number> = {}
  for (const dim of dimensions) {
    const agg = sums.get(dim.id)
    out[dim.id] = agg && agg.n > 0 ? agg.sum / agg.n : 0
  }
  return out
}

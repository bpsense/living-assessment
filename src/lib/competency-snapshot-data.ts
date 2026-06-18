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
import {
  classifyTrend,
  decayWeight,
  spectrumToBarPercent,
  spectrumToZone,
  RECENT_WINDOW_DAYS,
  type Zone,
  type Trend,
} from './competency-snapshot'
import { standardAgeForDate } from './age-utils'
import {
  ASSESSMENT_LEVELS,
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'
import type {
  Competency,
  Dimension,
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
  /** The assigned standard age this competency is assessed against (Dec-1 rule). */
  standardAge: number | null
  /** The age-specific "Achieving" descriptor for the standard age, or null. */
  stepDescriptor: string | null
  /** Full per-age "Achieving" descriptors (age string -> text) for stepping the
   *  assessed age up/down in the detail modal. */
  stepDescriptors: Record<string, string>
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
    student_id: o.student_id,
    school_id: o.school_id,
    standard_id: o.competency_id as string,
    level: ratingToLevel(Number(o.rating)),
    notes: o.notes,
    assessor_id: o.observer_id,
    assessed_at: o.observed_at,
    created_at: o.created_at,
    assessed_age: o.assessed_age,
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
  // The age standard we hold the learner to this school year (Dec-1 rule) — not
  // necessarily their actual current age. Drives applicability + positioning.
  const learnerAge = standardAgeForDate(student.date_of_birth ?? null, now)

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

    // "Current" = only observations within the recency window. Older ones remain
    // in `history` (for the detail modal) but no longer drive the position — the
    // snapshot reflects recent standing, mirroring the amoeba's recency bias.
    const recentHist = hist.filter(
      (o) => (nowMs - new Date(o.observed_at).getTime()) / 86_400_000 <= RECENT_WINDOW_DAYS
    )

    // Drop-off: recently achieved (3+) at a step below the learner's current age
    // (below-age content already mastered — uninformative about current standing).
    const dropped = recentHist.some(
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
    if (recentHist.length === 0) {
      // No current data (never assessed, or the last assessment is stale). Show
      // as a ghost awaiting a fresh observation when age-appropriate / age unknown.
      if (learnerAge != null && !applicableNow) continue
      isGhost = true
      spectrumScore = learnerAge == null ? null : 3
    } else {
      isGhost = false
      const recent = recentHist.slice(-5) // most recent 5 within the window
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

    // Full history (asc) for the modal; position/level/trend reflect only recent.
    const adaptedHist = hist.map(observationAsAssessment)
    const recentAdapted = recentHist.map(observationAsAssessment)
    const zone = spectrumToZone(spectrumScore)
    // Age-specific "Achieving" descriptor for the standard age (skip empty / N/A).
    const rawDesc = learnerAge != null ? comp.step_descriptors?.[String(learnerAge)] : null
    const stepDescriptor = rawDesc && rawDesc.trim() && rawDesc.trim() !== 'N/A' ? rawDesc.trim() : null
    const row: SnapshotRow = {
      standard: competencyAsStandard(comp, student.school_id),
      latest: recentAdapted.length ? recentAdapted[recentAdapted.length - 1] : null,
      history: adaptedHist,
      spectrumScore,
      barPercent: spectrumScore === null ? 50 : spectrumToBarPercent(spectrumScore),
      zone,
      trend: classifyTrend(recentAdapted),
      isGhost,
      standardAge: learnerAge,
      stepDescriptor,
      stepDescriptors: comp.step_descriptors ?? {},
    }

    const group = groupByDim.get(comp.dimension_id)
    if (!group) {
      unassigned.push(row)
    } else if (zone === 'untimed') {
      group.untimed.push(row)
    } else {
      group.rows.push(row)
      // Ghosts (no recent assessment) are tracked via isGhost, not as "at age".
      if (!isGhost) group.counts[zone] += 1
    }
  }

  for (const group of groups) {
    group.rows.sort(rowSortFn)
    group.untimed.sort(rowSortFn)
  }
  unassigned.sort(rowSortFn)

  const totals = emptyZoneCounts()
  for (const group of groups) {
    for (const row of group.rows) if (!row.isGhost) totals[row.zone] += 1
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

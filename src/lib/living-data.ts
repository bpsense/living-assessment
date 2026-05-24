/**
 * living-data.ts
 *
 * Shared helpers for the amoeba pipeline (post-cutover):
 *  - `AmoebaSnapshot` shape
 *  - `ageAt` / `endOfMonth` time utilities
 *  - `snapshotToDimensionScores` (snapshot → DimensionScore[] for LivingBlob)
 *  - `smoothSnapshots` / `interpolateScores` (rendering smoothing)
 *
 * The actual snapshot builder lives in `standards-snapshots.ts` and reads
 * from `assignment_standard_assessments` + `dimension_standards`.
 */

import type { Dimension, InterestSurvey } from '../types/database'
import type { DimensionScore } from './scoring'

// ============================================================
// Types
// ============================================================

export interface AmoebaSnapshot {
  /** ISO date string (first of the month) */
  date: string
  /** Human-readable label, e.g. "Mar 2026" */
  label: string
  /** Student age years at end-of-month cutoff */
  ageYears: number
  /** Remaining months past ageYears */
  ageMonths: number
  /** dimension_id → average 1-4 (or null when no contributing assessments) */
  dimensions: Record<string, number | null>
  /** True on the snapshot for the student's birthday month (rollover) */
  isAgeRollover?: boolean
  /** Previous snapshot's ageYears (only on rollover) */
  prevAgeYears?: number
}

// ============================================================
// Age helpers
// ============================================================

/** Last day of the given month at 23:59:59.999. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/** Years between dob and at, ignoring time-of-day. */
export function ageAt(dob: Date, at: Date): { years: number; months: number } {
  let years = at.getFullYear() - dob.getFullYear()
  let months = at.getMonth() - dob.getMonth()
  if (at.getDate() < dob.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years: Math.max(0, years), months: Math.max(0, months) }
}

// ============================================================
// Dimension score mapping (snapshot → DimensionScore[])
// ============================================================

/**
 * Convert a snapshot + interest survey into the DimensionScore[] shape that
 * LivingBlob consumes. competency = avg level (1-4) or 0 if null. interest =
 * latest survey response for the dimension or 0.
 */
export function snapshotToDimensionScores(
  snapshot: AmoebaSnapshot,
  dimensions: Dimension[],
  surveys: InterestSurvey[]
): DimensionScore[] {
  const cutoff = endOfMonth(new Date(snapshot.date)).getTime()
  const survey = [...surveys]
    .filter((s) => new Date(s.submitted_at).getTime() <= cutoff)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
  const responses = (survey?.responses ?? {}) as Record<string, number>

  return dimensions.map((d) => {
    const competency = snapshot.dimensions[d.id]
    const interest = typeof responses[d.id] === 'number' ? responses[d.id] : 0
    return {
      dimension_id: d.id,
      dimension_name: d.name,
      icon: d.icon,
      display_order: d.display_order,
      competency: competency ?? 0,
      interest,
      observation_count: 0,
      current_month_observation_count: 0,
      latest_observation: null,
      competency_breakdown: undefined,
    }
  })
}

// ============================================================
// Smoothing
// ============================================================

/**
 * Forward-looking smoothing on the per-dimension competency time series.
 * Doesn't ramp across age-rollover snapshots — each year stands alone.
 */
export function smoothSnapshots(
  snapshots: AmoebaSnapshot[],
  lookahead: number = 3
): AmoebaSnapshot[] {
  if (snapshots.length <= 1) return snapshots
  // Collect dimension ids from first snapshot
  const dimIds = Object.keys(snapshots[0].dimensions)
  if (dimIds.length === 0) return snapshots

  const rolloverIdxs = new Set<number>()
  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].isAgeRollover) rolloverIdxs.add(i)
  }

  // Build smoothed per-dimension series
  const smoothed: Record<string, (number | null)[]> = {}
  for (const id of dimIds) {
    const raw = snapshots.map((s) => s.dimensions[id])
    smoothed[id] = forwardSmooth(raw, lookahead, rolloverIdxs)
  }

  return snapshots.map((s, i) => ({
    ...s,
    dimensions: Object.fromEntries(dimIds.map((id) => [id, smoothed[id][i]])),
  }))
}

function forwardSmooth(
  values: (number | null)[],
  lookahead: number,
  rolloverIdxs: Set<number>
): (number | null)[] {
  const n = values.length
  const result: (number | null)[] = [...values]

  for (let i = 1; i < n; i++) {
    const cur = values[i]
    const prev = values[i - 1]
    if (cur == null || prev == null || cur === prev) continue
    if (rolloverIdxs.has(i)) continue // never ramp across age boundary

    // Find the start of the flat "from" region (don't cross rollovers)
    let flatStart = i - 1
    while (flatStart > 0 && values[flatStart - 1] === prev) {
      if (rolloverIdxs.has(flatStart)) break
      flatStart--
    }

    const rampStart = Math.max(flatStart, i - lookahead)
    const rampLength = i - rampStart
    if (rampLength <= 0) continue

    for (let j = rampStart; j < i; j++) {
      const t = (j - rampStart + 1) / (rampLength + 1)
      const eased = t * t // quadratic ease-in
      result[j] = prev + (cur - prev) * eased
    }
  }

  return result
}

// ============================================================
// Interpolation (used by LivingVisualization for fluid morphing)
// ============================================================

// ============================================================
// Age-rescale decay (visualization layer only)
// ============================================================

/**
 * Default per-birthday competency decay. A score of 3.0 (Achieving) at age 6
 * displays as 2.25 (mid-Developing) once the learner turns 7 — modelling
 * "the rubric got harder, so the same observed performance lands a tier lower."
 */
export const DEFAULT_AGE_DECAY_FACTOR = 0.75

/**
 * Cumulative decay factor for a snapshot at `ageYears`, given a baseline
 * (the age at the earliest snapshot in the timeline). Pure function — no
 * dependency on snapshot data; safe to memoize on (ageYears, baselineAgeYears).
 */
export function ageDecayFactor(
  ageYears: number,
  baselineAgeYears: number,
  factor: number = DEFAULT_AGE_DECAY_FACTOR
): number {
  const k = Math.max(0, ageYears - baselineAgeYears)
  if (k === 0) return 1
  return Math.pow(factor, k)
}

/**
 * Apply the age-rescale decay to a DimensionScore[] in place of the raw
 * competency values. Interest values are not touched.
 */
export function decayDimensionScores(
  scores: DimensionScore[],
  ageYears: number,
  baselineAgeYears: number,
  factor: number = DEFAULT_AGE_DECAY_FACTOR
): DimensionScore[] {
  const f = ageDecayFactor(ageYears, baselineAgeYears, factor)
  if (f === 1) return scores
  return scores.map((s) => ({ ...s, competency: s.competency * f }))
}

// ============================================================
// Interpolation (used by LivingVisualization for fluid morphing)
// ============================================================

export function interpolateScores(
  from: DimensionScore[],
  to: DimensionScore[],
  t: number
): DimensionScore[] {
  return to.map((toScore, i) => {
    const fromScore = from[i] ?? toScore
    return {
      ...toScore,
      competency: fromScore.competency + (toScore.competency - fromScore.competency) * t,
      interest: fromScore.interest + (toScore.interest - fromScore.interest) * t,
    }
  })
}

// ============================================================
// Enriched snapshot for the visualization layer
// ============================================================

/**
 * Snapshot enriched with the DimensionScore[] derived from {@link snapshotToDimensionScores}.
 * This is what LivingVisualization / LivingBlob consume.
 */
export interface Snapshot extends AmoebaSnapshot {
  dimensionScores: DimensionScore[]
}


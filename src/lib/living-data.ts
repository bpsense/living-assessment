/**
 * living-data.ts
 * Builds historical snapshots from observations and surveys for timeline playback.
 * Each snapshot represents the state of a student's competency & interest at a point in time.
 */

import type { Observation, InterestSurvey, Dimension } from '../types/database'
import type { DimensionScore, CompetencyBasedData } from './student-data'
import { computeCompetencyBasedScores } from './scoring'

// ============================================================
// Types
// ============================================================

export interface Snapshot {
  /** ISO date string */
  date: string
  /** Human-readable label, e.g. "Mar 2024" */
  label: string
  /** Scores at this point in time */
  dimensionScores: DimensionScore[]
  /** If this snapshot is the first in a new school year, the year label (e.g. "24/25") */
  schoolYearTransition?: string
}

/**
 * Represents a school-year boundary visible in the amoeba.
 * The `scale` is the fraction of the current canvas that this year's
 * canvas occupied (e.g. 0.75 means the outer ring of that year was 75%
 * of the current outer ring).
 */
export interface SchoolYearRing {
  /** Short label, e.g. "22/23" */
  label: string
  /** Scale factor relative to the current (outermost) canvas. 0–1. */
  scale: number
}

/**
 * Compute the school-year rings that should be drawn on the amoeba
 * to show the "expanding canvas" effect. Each ring represents a
 * previous school year's outer boundary, compressed inward.
 *
 * The current school year always has scale = 1 (the outermost ring).
 * Each prior year's scale shrinks by a compounding compression factor,
 * representing growing expectations as the student ages.
 */
export function computeSchoolYearRings(snapshots: Snapshot[]): SchoolYearRing[] {
  if (snapshots.length === 0) return []

  // Find all distinct school years in the data
  const years = new Set<number>()
  for (const snap of snapshots) {
    const d = new Date(snap.date)
    years.add(schoolYearOf(d))
  }
  const sorted = [...years].sort((a, b) => a - b)
  if (sorted.length <= 1) return [] // no prior years to show

  const currentYear = sorted[sorted.length - 1]
  const rings: SchoolYearRing[] = []

  // Each prior year's canvas is compressed relative to the current.
  // The compression factor represents how expectations expand each year.
  const COMPRESSION_PER_YEAR = 0.78 // each prior year shrinks by ~22%

  for (let i = 0; i < sorted.length - 1; i++) {
    const yearsBehind = currentYear - sorted[i]
    const scale = Math.pow(COMPRESSION_PER_YEAR, yearsBehind)
    const startYr = sorted[i]
    const label = `${String(startYr).slice(-2)}/${String(startYr + 1).slice(-2)}`
    rings.push({ label, scale })
  }

  return rings
}

/** A school year spans Aug–Jul. Aug-Dec → startYear = that year. Jan-Jul → startYear = prev year. */
function schoolYearOf(d: Date): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
}

// ============================================================
// Build time-series snapshots
// ============================================================

/**
 * Create monthly snapshots of dimension scores covering at least the last
 * 12 months (back to the start of the school year) through to the present.
 * This ensures the timeline is always available for educators to rewind
 * and add observations to past months, even when no historical data exists.
 *
 * For each snapshot date, competency is the latest observation rating up
 * to that date and interest is the latest survey response up to that date.
 */
export function buildSnapshots(
  observations: Observation[],
  surveys: InterestSurvey[],
  dimensions: Dimension[],
  competencyData?: CompetencyBasedData | null
): Snapshot[] {
  if (dimensions.length === 0) return []

  const hasCompData =
    competencyData &&
    competencyData.competencyScores.length > 0 &&
    competencyData.mappings.length > 0

  // Sort chronologically (oldest first)
  const sortedObs = [...observations].sort(
    (a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
  )
  const sortedSurveys = [...surveys].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  )

  // Sort competency scores chronologically for time-based filtering
  const sortedCompScores = hasCompData
    ? [...competencyData.competencyScores].sort(
        (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
      )
    : []

  // Determine the start date: the earlier of 12 months ago or the first
  // observation/survey/score. This ensures we always have a full year of months
  // to scrub through.
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const allDates = [
    ...sortedObs.map((o) => new Date(o.observed_at).getTime()),
    ...sortedSurveys.map((s) => new Date(s.submitted_at).getTime()),
    ...sortedCompScores.map((s) => new Date(s.scored_at).getTime()),
  ]
  const earliestData = allDates.length > 0 ? Math.min(...allDates) : now.getTime()
  const startTime = Math.min(twelveMonthsAgo.getTime(), earliestData)

  // Generate monthly snapshot dates from start through to now
  const snapshotDates: Date[] = []
  const start = new Date(startTime)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)

  while (cursor.getTime() <= now.getTime()) {
    snapshotDates.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  // Always include current month as the final snapshot
  const lastSnapshot = snapshotDates[snapshotDates.length - 1]
  if (
    !lastSnapshot ||
    lastSnapshot.getFullYear() !== now.getFullYear() ||
    lastSnapshot.getMonth() !== now.getMonth()
  ) {
    snapshotDates.push(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  // Build each snapshot
  const snapshots: Snapshot[] = snapshotDates.map((snapshotDate) => {
    // Use end of month as cutoff (last millisecond)
    const cutoff = new Date(
      snapshotDate.getFullYear(),
      snapshotDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    ).getTime()

    // Observations up to this date
    const obsUpToDate = sortedObs.filter(
      (o) => new Date(o.observed_at).getTime() <= cutoff
    )
    // Only unlinked observations when we have competency data
    const unlinkedObs = hasCompData
      ? obsUpToDate.filter((o) => !o.assignment_id)
      : obsUpToDate

    // Competency scores up to this date
    const compScoresUpToDate = hasCompData
      ? sortedCompScores.filter(
          (s) => new Date(s.scored_at).getTime() <= cutoff
        )
      : []

    // Compute competency-based dimension scores for this snapshot
    const compBasedMap =
      hasCompData && compScoresUpToDate.length > 0
        ? computeCompetencyBasedScores(
            compScoresUpToDate,
            competencyData.mappings,
            competencyData.competencies,
            dimensions,
            competencyData.gradeLevel
          )
        : null

    // Latest survey up to this date
    const surveysUpToDate = sortedSurveys.filter(
      (s) => new Date(s.submitted_at).getTime() <= cutoff
    )
    const latestSurvey = surveysUpToDate[surveysUpToDate.length - 1] ?? null

    // Is this snapshot for the current month?
    const isCurrentMonth =
      snapshotDate.getFullYear() === now.getFullYear() &&
      snapshotDate.getMonth() === now.getMonth()

    const monthStart = new Date(
      snapshotDate.getFullYear(),
      snapshotDate.getMonth(),
      1
    ).getTime()

    // Compute scores per dimension
    const dimensionScores: DimensionScore[] = dimensions.map((dim) => {
      // All observations for this dimension up to cutoff (for counts/latest), newest first
      const allDimObs = obsUpToDate
        .filter((o) => o.dimension_id === dim.id)
        .sort(
          (a, b) =>
            new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
        )

      // Unlinked observations for observation-based scoring
      const dimObs = unlinkedObs
        .filter((o) => o.dimension_id === dim.id)
        .sort(
          (a, b) =>
            new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
        )

      let obsCompetency: number
      let currentMonthCount = 0

      if (isCurrentMonth) {
        const thisMonthObs = dimObs.filter(
          (o) => new Date(o.observed_at).getTime() >= monthStart
        )
        currentMonthCount = thisMonthObs.length

        if (thisMonthObs.length > 0) {
          obsCompetency =
            thisMonthObs.reduce((sum, o) => sum + Number(o.rating), 0) /
            thisMonthObs.length
        } else {
          obsCompetency = dimObs.length > 0 ? Number(dimObs[0].rating) : 0
        }
      } else {
        obsCompetency = dimObs.length > 0 ? Number(dimObs[0].rating) : 0
      }

      // Blend observation + competency-based scores
      const compBased = compBasedMap?.get(dim.id)
      const hasCompScores = compBased && compBased.breakdown.length > 0

      let competency: number
      if (hasCompScores && obsCompetency > 0) {
        competency = (compBased.score + obsCompetency) / 2
      } else if (hasCompScores) {
        competency = compBased.score
      } else {
        competency = obsCompetency
      }

      // Interest from latest survey
      let interest = 0
      if (latestSurvey?.responses && typeof latestSurvey.responses === 'object') {
        const val = (latestSurvey.responses as Record<string, number>)[dim.id]
        interest = typeof val === 'number' ? val : 0
      }

      return {
        dimension_id: dim.id,
        dimension_name: dim.name,
        icon: dim.icon,
        display_order: dim.display_order,
        competency,
        interest,
        observation_count: allDimObs.length,
        current_month_observation_count: currentMonthCount,
        latest_observation: allDimObs[0] ?? null,
        competency_breakdown: hasCompScores ? compBased.breakdown : undefined,
      }
    })

    return {
      date: snapshotDate.toISOString(),
      label: snapshotDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      dimensionScores,
    }
  })

  // Apply school-year compression: when the timeline crosses from one
  // school year to the next (July→August), compress older competency
  // values so the canvas appears to expand with growing expectations.
  return applyYearTransitionCompression(snapshots)
}

/**
 * At each school-year boundary (August), compress all competency values
 * so that the previous year's levels are rescaled to a smaller canvas:
 *
 * - Previous Achieving/Mastery (3-4) → Developing range (~1.5–2.5)
 * - Previous Emerging/Developing (0-2) → Emerging range (~0–1.5)
 *
 * This creates the visual effect of the canvas expanding: the same
 * absolute competency level occupies less of the chart after the
 * transition, because expectations have grown.
 *
 * The compression is applied backwards from the current year — each
 * prior year gets progressively more compressed.
 */
function applyYearTransitionCompression(snapshots: Snapshot[]): Snapshot[] {
  if (snapshots.length === 0) return snapshots

  // Find all distinct school years
  const yearSet = new Set<number>()
  for (const snap of snapshots) {
    yearSet.add(schoolYearOf(new Date(snap.date)))
  }
  const sortedYears = [...yearSet].sort((a, b) => a - b)

  if (sortedYears.length <= 1) return snapshots // nothing to compress

  const currentYear = sortedYears[sortedYears.length - 1]

  // Compression per year back: each prior year's values are scaled down
  const COMPRESSION_PER_YEAR = 0.78

  return snapshots.map((snap) => {
    const snapYear = schoolYearOf(new Date(snap.date))
    if (snapYear >= currentYear) {
      // Current year — no compression, but mark Aug as transition
      const d = new Date(snap.date)
      const isAugust = d.getMonth() === 7 && snapYear === currentYear
      return isAugust
        ? { ...snap, schoolYearTransition: `${String(currentYear).slice(-2)}/${String(currentYear + 1).slice(-2)}` }
        : snap
    }

    const yearsBehind = currentYear - snapYear
    const scale = Math.pow(COMPRESSION_PER_YEAR, yearsBehind)

    // Mark the first month of each school year as a transition
    const d = new Date(snap.date)
    const isAugust = d.getMonth() === 7
    const yearLabel = `${String(snapYear).slice(-2)}/${String(snapYear + 1).slice(-2)}`

    return {
      ...snap,
      ...(isAugust ? { schoolYearTransition: yearLabel } : {}),
      dimensionScores: snap.dimensionScores.map((ds) => ({
        ...ds,
        // Scale competency down: a "4" from 2 years ago looks like ~2.4 on today's canvas
        competency: ds.competency * scale,
        // Interest stays unscaled (it's the student's current feeling, not relative to expectations)
      })),
    }
  })
}

/**
 * Get an ISO date string to use for back-dating observations to a snapshot's period.
 * Uses the middle of the snapshot's month (15th at noon).
 * If the snapshot is in the current month, returns "now" instead.
 */
export function getSnapshotObservationDate(snapshot: Snapshot): string {
  const snapshotDate = new Date(snapshot.date)
  const now = new Date()

  // If the snapshot is the current month, return now
  if (
    snapshotDate.getFullYear() === now.getFullYear() &&
    snapshotDate.getMonth() === now.getMonth()
  ) {
    return now.toISOString()
  }

  // Otherwise, use the 15th of the snapshot's month at noon
  const midMonth = new Date(
    snapshotDate.getFullYear(),
    snapshotDate.getMonth(),
    15,
    12,
    0,
    0
  )
  return midMonth.toISOString()
}

/**
 * Interpolate between two DimensionScore arrays for smooth animation.
 * `t` ranges from 0 (fully `from`) to 1 (fully `to`).
 */
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
// Forward-looking smoothing for timeline playback
// ============================================================

/**
 * Apply forward-looking smoothing to snapshot time series.
 *
 * Raw snapshots have staircase-shaped data — a dimension stays at
 * "Emerging" for months then suddenly jumps to "Developing." This
 * function creates a gradual ramp in the months leading up to each
 * change, as if the student's growth was gradually building toward
 * the new level.
 *
 * - Only smooths transitions between non-zero values (the 0→first
 *   observation transition stays sharp since 0 means "no data").
 * - The actual change-point value is preserved — the ramp leads
 *   up to it, never overshoots past it.
 * - Uses a quadratic ease-in so growth starts slowly and accelerates.
 *
 * @param lookahead How many months before a change the ramp begins (default 3)
 */
export function smoothSnapshots(
  snapshots: Snapshot[],
  lookahead: number = 3
): Snapshot[] {
  if (snapshots.length <= 1) return snapshots

  const dimCount = snapshots[0].dimensionScores.length
  if (dimCount === 0) return snapshots

  // Extract and smooth each dimension's time series independently
  const smoothedComp: number[][] = []
  const smoothedInt: number[][] = []

  for (let d = 0; d < dimCount; d++) {
    const rawComp = snapshots.map((s) => s.dimensionScores[d].competency)
    const rawInt = snapshots.map((s) => s.dimensionScores[d].interest)
    smoothedComp.push(forwardSmooth(rawComp, lookahead))
    smoothedInt.push(forwardSmooth(rawInt, lookahead))
  }

  // Rebuild snapshots with smoothed values
  return snapshots.map((snap, i) => ({
    ...snap,
    dimensionScores: snap.dimensionScores.map((ds, d) => ({
      ...ds,
      competency: smoothedComp[d][i],
      interest: smoothedInt[d][i],
    })),
  }))
}

/**
 * Forward-looking smoothing for a single value series.
 *
 * For each transition (e.g. 1→2), creates a gradual ramp over the
 * `lookahead` months preceding the change. The change-point itself
 * keeps its exact value.
 *
 * Example with lookahead=3:
 *   Raw:      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]
 *   Smoothed: [1, 1, 1, 1, 1, 1, 1, 1, 1.06, 1.25, 1.56, 2]
 */
function forwardSmooth(values: number[], lookahead: number): number[] {
  const n = values.length
  const result = [...values]

  for (let i = 1; i < n; i++) {
    // Only smooth transitions between non-zero values.
    // 0 means "no data" — don't ramp into or out of it.
    if (values[i] === values[i - 1] || values[i] === 0 || values[i - 1] === 0) {
      continue
    }

    const fromVal = values[i - 1]
    const toVal = values[i]

    // Find where the flat "from" region starts (don't ramp past it)
    let flatStart = i - 1
    while (flatStart > 0 && values[flatStart - 1] === fromVal) {
      flatStart--
    }

    // Ramp starts at most `lookahead` months before the change,
    // but never before the start of the flat region
    const rampStart = Math.max(flatStart, i - lookahead)
    const rampLength = i - rampStart

    if (rampLength <= 0) continue

    for (let j = rampStart; j < i; j++) {
      // t goes from ~0 at rampStart to ~1 at the change point
      const t = (j - rampStart + 1) / (rampLength + 1)
      // Quadratic ease-in: starts slow, accelerates toward the new level
      const eased = t * t
      result[j] = fromVal + (toVal - fromVal) * eased
    }
  }

  return result
}

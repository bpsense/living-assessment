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
  /** Which grade level this snapshot belongs to (e.g. "3", "K") */
  gradeYear?: string
  /** True on September snapshots where the grade increments */
  isGradeTransition?: boolean
  /** The grade that just ended (only on transition snapshots) */
  prevGradeYear?: string
}

// ============================================================
// Grade-level ordering & transition helpers
// ============================================================

/** Ordered list of grade levels from youngest to oldest */
const GRADE_ORDER = ['Pre-K', 'TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

/**
 * Count how many September 1st boundaries fall between a date and today.
 * A September boundary is crossed when moving from before Sep 1 of a year
 * to on/after Sep 1 of that year.
 */
function countSeptembersBetween(fromDate: Date, toDate: Date): number {
  let count = 0
  const startYear = fromDate.getFullYear()
  const endYear = toDate.getFullYear()

  for (let y = startYear; y <= endYear; y++) {
    const sep1 = new Date(y, 8, 1) // September 1
    if (sep1 > fromDate && sep1 <= toDate) {
      count++
    }
  }
  return count
}

/**
 * Given a student's current grade level and a snapshot date,
 * determine what grade the student was in at that time.
 * Returns undefined if grade_level is null or not in the ordered list.
 */
function gradeAtDate(
  currentGrade: string,
  snapshotDate: Date,
  now: Date
): string | undefined {
  const idx = GRADE_ORDER.indexOf(currentGrade)
  if (idx < 0) return undefined

  const sepsBetween = countSeptembersBetween(snapshotDate, now)
  const historicalIdx = idx - sepsBetween
  if (historicalIdx < 0) return GRADE_ORDER[0]
  return GRADE_ORDER[historicalIdx]
}

/** Competency decay factor applied at grade transitions */
const GRADE_TRANSITION_COMPETENCY_FACTOR = 0.35
/** Interest decay factor at grade transitions (interest persists more) */
const GRADE_TRANSITION_INTEREST_FACTOR = 0.85
/** Minimum competency to maintain presence in the Emerging ring */
const GRADE_TRANSITION_MIN_COMPETENCY = 0.25

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
  competencyData?: CompetencyBasedData | null,
  gradeLevel?: string | null
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

    // Determine grade metadata for this snapshot
    const snapshotGrade = gradeLevel
      ? gradeAtDate(gradeLevel, snapshotDate, now)
      : undefined

    return {
      date: snapshotDate.toISOString(),
      label: snapshotDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      dimensionScores,
      gradeYear: snapshotGrade,
    }
  })

  // Mark September grade transitions and apply score reductions
  if (typeof console !== 'undefined') {
    console.log(
      `[LivingData] buildSnapshots called with gradeLevel="${gradeLevel}", ` +
      `found in GRADE_ORDER: ${gradeLevel ? GRADE_ORDER.indexOf(gradeLevel) >= 0 : 'null'}, ` +
      `snapshots: ${snapshots.length}, ` +
      `septemberSnapshots: ${snapshots.filter(s => new Date(s.date).getMonth() === 8).map(s => s.label).join(', ') || 'none'}`
    )
  }
  if (gradeLevel && GRADE_ORDER.indexOf(gradeLevel) >= 0) {
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1]
      const curr = snapshots[i]
      const currDate = new Date(curr.date)

      // September snapshot with a different (higher) grade than the previous month
      if (
        currDate.getMonth() === 8 && // September (0-indexed)
        curr.gradeYear &&
        prev.gradeYear &&
        curr.gradeYear !== prev.gradeYear
      ) {
        curr.isGradeTransition = true
        curr.prevGradeYear = prev.gradeYear

        // Check if there are any non-zero scores to decay
        const hasScores = curr.dimensionScores.some(
          (ds) => ds.competency > 0 || ds.interest > 0
        )

        if (hasScores) {
          // Apply competency decay — the student's skills are now measured
          // against a higher bar, so scores drop toward Emerging
          curr.dimensionScores = curr.dimensionScores.map((ds) => ({
            ...ds,
            competency:
              ds.competency > 0
                ? Math.max(
                    ds.competency * GRADE_TRANSITION_COMPETENCY_FACTOR,
                    GRADE_TRANSITION_MIN_COMPETENCY
                  )
                : 0,
            interest:
              ds.interest > 0
                ? ds.interest * GRADE_TRANSITION_INTEREST_FACTOR
                : 0,
          }))
        }

        if (typeof console !== 'undefined') {
          console.log(
            `[LivingData] Grade transition at ${curr.label}: ` +
            `${prev.gradeYear} → ${curr.gradeYear}` +
            (hasScores ? ' (scores decayed)' : ' (no pre-transition scores)')
          )
        }
      }
    }
  }

  return snapshots
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

  // Identify grade boundary indices so smoothing doesn't ramp across them
  const gradeBoundaries = new Set<number>()
  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].isGradeTransition) gradeBoundaries.add(i)
  }

  // Extract and smooth each dimension's time series independently
  const smoothedComp: number[][] = []
  const smoothedInt: number[][] = []

  for (let d = 0; d < dimCount; d++) {
    const rawComp = snapshots.map((s) => s.dimensionScores[d].competency)
    const rawInt = snapshots.map((s) => s.dimensionScores[d].interest)
    smoothedComp.push(forwardSmooth(rawComp, lookahead, gradeBoundaries))
    smoothedInt.push(forwardSmooth(rawInt, lookahead, gradeBoundaries))
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
function forwardSmooth(values: number[], lookahead: number, gradeBoundaries?: Set<number>): number[] {
  const n = values.length
  const result = [...values]

  for (let i = 1; i < n; i++) {
    // Only smooth transitions between non-zero values.
    // 0 means "no data" — don't ramp into or out of it.
    // Also skip smoothing if this index crosses a grade boundary.
    if (values[i] === values[i - 1] || values[i] === 0 || values[i - 1] === 0) {
      continue
    }
    if (gradeBoundaries && gradeBoundaries.has(i)) {
      continue
    }

    const fromVal = values[i - 1]
    const toVal = values[i]

    // Find where the flat "from" region starts (don't ramp past it or past grade boundaries)
    let flatStart = i - 1
    while (flatStart > 0 && values[flatStart - 1] === fromVal) {
      if (gradeBoundaries && gradeBoundaries.has(flatStart)) break
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

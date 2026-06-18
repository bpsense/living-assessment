import type {
  Dimension,
  Observation,
  InterestSurvey,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface DimensionScore {
  dimension_id: string
  dimension_name: string
  icon: string | null
  display_order: number
  /** Competency score (0-4 scale) from direct observations. 0 = no data. */
  competency: number
  /** Latest interest survey score for this dimension (1-5 scale) */
  interest: number
  /** Total number of observations for this dimension (all time) */
  observation_count: number
  /** Number of observations in the current scoring period (current month) */
  current_month_observation_count: number
  /** Most recent observation */
  latest_observation: Observation | null
}

export type Zone = 'growth' | 'mastery' | 'cruise' | 'explore'

export interface ZoneClassification {
  zone: Zone
  dimension_name: string
  dimension_id: string
}

// ============================================================
// Observation-based competency scoring — current month average with carry-forward
// ============================================================

/**
 * Compute per-dimension competency scores from direct observations.
 * Current month: average of ALL observations that month.
 * No current-month data: fall back to the latest observation overall.
 */
export function computeObservationScores(
  observations: Observation[],
  dimensions: Dimension[],
  referenceDate?: Date
): Map<string, { competency: number; currentMonthCount: number }> {
  const scores = new Map<string, { competency: number; currentMonthCount: number }>()

  const now = referenceDate ?? new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  for (const dim of dimensions) {
    const dimObs = observations.filter((o) => o.dimension_id === dim.id)

    const currentMonthObs = dimObs.filter(
      (o) => new Date(o.observed_at).getTime() >= monthStart
    )

    if (currentMonthObs.length > 0) {
      const sum = currentMonthObs.reduce((acc, o) => acc + Number(o.rating), 0)
      scores.set(dim.id, {
        competency: sum / currentMonthObs.length,
        currentMonthCount: currentMonthObs.length,
      })
    } else {
      const latest = [...dimObs].sort(
        (a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )[0]
      scores.set(dim.id, {
        competency: latest ? Number(latest.rating) : 0,
        currentMonthCount: 0,
      })
    }
  }

  return scores
}

// ============================================================
// Period-aware competency scoring (for reports)
// ============================================================

export interface AcademicPeriod {
  key: string
  label: string
  start: Date
  end: Date
  /**
   * Optional disjoint sub-ranges. When present, an observation counts if it
   * falls within ANY range (used for multi-period reports). `start`/`end`
   * remain the overall bounding box.
   */
  ranges?: { start: Date; end: Date }[]
}

/**
 * Compute per-dimension competency scores for a specific academic period.
 * When period is null, falls back to current-month logic.
 */
export function computeObservationScoresForPeriod(
  observations: Observation[],
  dimensions: Dimension[],
  period: AcademicPeriod | null
): Map<string, { competency: number; currentMonthCount: number }> {
  if (!period) return computeObservationScores(observations, dimensions)

  const scores = new Map<string, { competency: number; currentMonthCount: number }>()

  const inPeriod = (d: Date) =>
    period.ranges
      ? period.ranges.some((r) => d >= r.start && d <= r.end)
      : d >= period.start && d <= period.end

  for (const dim of dimensions) {
    const dimObs = observations.filter((o) => o.dimension_id === dim.id)

    const periodObs = dimObs.filter((o) => inPeriod(new Date(o.observed_at)))

    if (periodObs.length > 0) {
      const sum = periodObs.reduce((acc, o) => acc + Number(o.rating), 0)
      scores.set(dim.id, {
        competency: sum / periodObs.length,
        currentMonthCount: periodObs.length,
      })
    } else {
      const priorObs = dimObs
        .filter((o) => new Date(o.observed_at) <= period.end)
        .sort(
          (a, b) =>
            new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
        )
      scores.set(dim.id, {
        competency: priorObs[0] ? Number(priorObs[0].rating) : 0,
        currentMonthCount: 0,
      })
    }
  }

  return scores
}

/** @deprecated Use computeObservationScoresForPeriod instead */
export const computeCompetencyForPeriod = computeObservationScoresForPeriod

// ============================================================
// Interest score extraction
// ============================================================

/**
 * Extract per-dimension interest scores from survey responses.
 * The most recent survey wins. Optionally filter to surveys before periodEnd.
 */
export function extractInterestScores(
  surveys: InterestSurvey[],
  dimensions: Dimension[],
  periodEnd?: Date
): Map<string, number> {
  const scores = new Map<string, number>()

  const filtered = periodEnd
    ? surveys.filter((s) => new Date(s.submitted_at) <= periodEnd)
    : surveys

  const latest = [...filtered].sort(
    (a, b) =>
      new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  )[0]

  for (const dim of dimensions) {
    if (latest?.responses && typeof latest.responses === 'object') {
      const val = (latest.responses as Record<string, number>)[dim.id]
      scores.set(dim.id, typeof val === 'number' ? val : 0)
    } else {
      scores.set(dim.id, 0)
    }
  }

  return scores
}

// ============================================================
// Zone classification — 2x2 matrix
// ============================================================

export function classifyZones(dimensionScores: DimensionScore[]): ZoneClassification[] {
  const COMP_MID = 2.5
  const INT_MID = 2.5

  return dimensionScores
    .filter((d) => d.competency > 0 || d.interest > 0)
    .map((d) => {
      let zone: Zone
      if (d.interest >= INT_MID && d.competency < COMP_MID) {
        zone = 'growth'
      } else if (d.interest >= INT_MID && d.competency >= COMP_MID) {
        zone = 'mastery'
      } else if (d.interest < INT_MID && d.competency >= COMP_MID) {
        zone = 'cruise'
      } else {
        zone = 'explore'
      }
      return {
        zone,
        dimension_name: d.dimension_name,
        dimension_id: d.dimension_id,
      }
    })
}

// ============================================================
// Build dimension scores — combined helper
// ============================================================

/**
 * Build DimensionScore[] from observation + interest data.
 *
 * Scoring logic:
 *  - Competency channel: current-month average of observations for each
 *    dimension, with carry-forward fallback to the latest prior observation.
 *  - Interest channel: latest interest survey response per dimension.
 *  - 0 when a dimension has no data.
 */
export function buildDimensionScores(
  dims: Dimension[],
  obs: Observation[],
  surveys: InterestSurvey[]
): DimensionScore[] {
  const observationMap = computeObservationScores(obs, dims)
  const interestMap = extractInterestScores(surveys, dims)

  return dims.map((dim) => {
    const dimObs = obs
      .filter((o) => o.dimension_id === dim.id)
      .sort(
        (a, b) =>
          new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )

    const obsScore = observationMap.get(dim.id) ?? { competency: 0, currentMonthCount: 0 }

    return {
      dimension_id: dim.id,
      dimension_name: dim.name,
      icon: dim.icon,
      display_order: dim.display_order,
      competency: Math.round(obsScore.competency * 100) / 100,
      interest: interestMap.get(dim.id) ?? 0,
      observation_count: dimObs.length,
      current_month_observation_count: obsScore.currentMonthCount,
      latest_observation: dimObs[0] ?? null,
    }
  })
}

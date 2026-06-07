import type {
  Dimension,
  Observation,
  InterestSurvey,
  CompetencyScoreRow,
  CompetencyDimensionMapping,
  Competency,
  CompetencyScoreSource,
} from '../types/database'
import { GRADE_TO_STEP } from '../types/database'

// ============================================================
// Types
// ============================================================

export interface CompetencyBreakdown {
  competency_id: string
  competency_code: string
  competency_name: string
  score: number
  source: CompetencyScoreSource
  is_above_grade?: boolean
}

export interface DimensionScore {
  dimension_id: string
  dimension_name: string
  icon: string | null
  display_order: number
  /** Competency score (0-4 scale). Blends competency-based scores from
   *  assignments with direct observation scores. 0 = no data. */
  competency: number
  /** Latest interest survey score for this dimension (1-5 scale) */
  interest: number
  /** Total number of observations for this dimension (all time) */
  observation_count: number
  /** Number of observations in the current scoring period (current month) */
  current_month_observation_count: number
  /** Most recent observation */
  latest_observation: Observation | null
  /** Breakdown of individual competency scores contributing to this dimension */
  competency_breakdown?: CompetencyBreakdown[]
}

export type Zone = 'growth' | 'mastery' | 'cruise' | 'explore'

export interface ZoneClassification {
  zone: Zone
  dimension_name: string
  dimension_id: string
}

// ============================================================
// Grade step resolution (inline to avoid circular deps)
// ============================================================

function resolveStep(gradeLevel: string | null): string {
  if (!gradeLevel) return '1'
  if (GRADE_TO_STEP[gradeLevel]) return GRADE_TO_STEP[gradeLevel]
  const num = parseInt(gradeLevel, 10)
  if (!isNaN(num) && num >= 0 && num <= 10) return String(num)
  return '1'
}

// ============================================================
// Observation-based competency scoring — current month average with carry-forward
// ============================================================

/**
 * Compute per-dimension competency scores from direct observations.
 * Current month: average of ALL observations that month.
 * No current-month data: fall back to the latest observation overall.
 *
 * When `filterUnlinked` is true, only observations NOT linked to
 * assignments are considered (assignment-linked observations feed
 * through competency_scores instead).
 */
export function computeObservationScores(
  observations: Observation[],
  dimensions: Dimension[],
  referenceDate?: Date,
  filterUnlinked = false
): Map<string, { competency: number; currentMonthCount: number }> {
  const scores = new Map<string, { competency: number; currentMonthCount: number }>()
  const obs = filterUnlinked ? observations.filter((o) => !o.assignment_id) : observations

  const now = referenceDate ?? new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  for (const dim of dimensions) {
    const dimObs = obs.filter((o) => o.dimension_id === dim.id)

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
// Competency-based dimension scoring (from assignments)
// ============================================================

/**
 * Compute dimension scores from competency_scores via competency_dimension_mappings.
 * For each dimension, averages all competency scores that map to it,
 * filtering out competencies where the student's grade step descriptor is N/A.
 */
export function computeCompetencyBasedScores(
  competencyScores: CompetencyScoreRow[],
  mappings: CompetencyDimensionMapping[],
  competencies: Competency[],
  dimensions: Dimension[],
  gradeLevel: string | null
): Map<string, { score: number; breakdown: CompetencyBreakdown[] }> {
  const result = new Map<string, { score: number; breakdown: CompetencyBreakdown[] }>()

  if (competencyScores.length === 0 || mappings.length === 0) {
    for (const dim of dimensions) {
      result.set(dim.id, { score: 0, breakdown: [] })
    }
    return result
  }

  const stepKey = resolveStep(gradeLevel)
  const compMap = new Map(competencies.map((c) => [c.id, c]))

  // Group mappings by dimension
  const dimMappings = new Map<string, CompetencyDimensionMapping[]>()
  for (const m of mappings) {
    if (!dimMappings.has(m.dimension_id)) dimMappings.set(m.dimension_id, [])
    dimMappings.get(m.dimension_id)!.push(m)
  }

  // Best score per competency: prefer teacher > skill_assessment > ai_inferred > observation, then latest
  const bestScoreByComp = new Map<string, CompetencyScoreRow>()
  const sorted = [...competencyScores].sort((a, b) => {
    const priority: Record<string, number> = { teacher: 4, skill_assessment: 3, ai_inferred: 2, observation: 1 }
    const sp = (priority[b.source] || 0) - (priority[a.source] || 0)
    if (sp !== 0) return sp
    return new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()
  })
  for (const s of sorted) {
    if (!bestScoreByComp.has(s.competency_id)) {
      bestScoreByComp.set(s.competency_id, s)
    }
  }

  for (const dim of dimensions) {
    const mapEntries = dimMappings.get(dim.id) || []
    const breakdown: CompetencyBreakdown[] = []

    for (const mapping of mapEntries) {
      const comp = compMap.get(mapping.competency_id)
      if (!comp) continue

      // Skip if this competency doesn't apply at the student's grade level
      const descriptor = comp.step_descriptors[stepKey]
      if (!descriptor || descriptor === 'N/A') continue

      const scoreRow = bestScoreByComp.get(mapping.competency_id)
      if (!scoreRow) continue

      // Above-grade exclusion rule:
      // If this score came from an above-grade skill assignment and the score
      // is below 3, exclude it from the dimension average. This prevents
      // penalizing learners for attempting harder work.
      if (scoreRow.is_above_grade && Number(scoreRow.score) < 3) {
        continue
      }

      breakdown.push({
        competency_id: comp.id,
        competency_code: comp.code,
        competency_name: comp.name,
        score: Number(scoreRow.score),
        source: scoreRow.source,
        is_above_grade: scoreRow.is_above_grade || undefined,
      })
    }

    const avg =
      breakdown.length > 0
        ? breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length
        : 0

    result.set(dim.id, { score: avg, breakdown })
  }

  return result
}

// ============================================================
// Period-aware competency scoring (for reports)
// ============================================================

export interface AcademicPeriod {
  key: string
  label: string
  start: Date
  end: Date
}

/**
 * Compute per-dimension competency scores for a specific academic period.
 * When period is null, falls back to current-month logic.
 */
export function computeObservationScoresForPeriod(
  observations: Observation[],
  dimensions: Dimension[],
  period: AcademicPeriod | null,
  filterUnlinked = false
): Map<string, { competency: number; currentMonthCount: number }> {
  if (!period) return computeObservationScores(observations, dimensions, undefined, filterUnlinked)

  const scores = new Map<string, { competency: number; currentMonthCount: number }>()
  const obs = filterUnlinked ? observations.filter((o) => !o.assignment_id) : observations

  for (const dim of dimensions) {
    const dimObs = obs.filter((o) => o.dimension_id === dim.id)

    const periodObs = dimObs.filter((o) => {
      const d = new Date(o.observed_at)
      return d >= period.start && d <= period.end
    })

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
 * Optional competency-based data to blend into dimension scores.
 * When provided, competency_scores from assignments are mapped to
 * dimensions and blended with direct observation scores.
 */
export interface CompetencyBasedData {
  competencyScores: CompetencyScoreRow[]
  mappings: CompetencyDimensionMapping[]
  competencies: Competency[]
  gradeLevel: string | null
}

/**
 * Build DimensionScore[] by blending observation-based and
 * competency-based (assignment) scores.
 *
 * Scoring logic:
 *  - Observation channel: current-month average of unlinked observations
 *    (not connected to an assignment), with carry-forward fallback.
 *  - Competency channel: average of competency_scores mapped to each
 *    dimension, filtered by the student's grade-level step.
 *  - If both channels have data for a dimension: average of the two averages
 *    (equal weight) so both contribute.
 *  - If only one channel has data: use that channel.
 *  - If neither: 0.
 */
export function buildDimensionScores(
  dims: Dimension[],
  obs: Observation[],
  surveys: InterestSurvey[],
  competencyData?: CompetencyBasedData
): DimensionScore[] {
  const hasCompData = competencyData && competencyData.competencyScores.length > 0

  // Observation channel: only unlinked observations when competency data exists
  const observationMap = computeObservationScores(obs, dims, undefined, !!hasCompData)
  const interestMap = extractInterestScores(surveys, dims)

  // Competency channel (from assignments)
  const compBasedMap = hasCompData
    ? computeCompetencyBasedScores(
        competencyData.competencyScores,
        competencyData.mappings,
        competencyData.competencies,
        dims,
        competencyData.gradeLevel
      )
    : null

  return dims.map((dim) => {
    const dimObs = obs
      .filter((o) => o.dimension_id === dim.id)
      .sort(
        (a, b) =>
          new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
      )

    const obsScore = observationMap.get(dim.id) ?? { competency: 0, currentMonthCount: 0 }
    const compBased = compBasedMap?.get(dim.id)
    const hasCompScores = compBased && compBased.breakdown.length > 0
    const hasObsScore = obsScore.competency > 0

    // Blend the two channels
    let competency: number
    let breakdown: CompetencyBreakdown[] | undefined

    if (hasCompScores && hasObsScore) {
      // Both sources contribute equally
      competency = (compBased.score + obsScore.competency) / 2
      breakdown = compBased.breakdown
    } else if (hasCompScores) {
      competency = compBased.score
      breakdown = compBased.breakdown
    } else {
      // Observation-only (backward compat)
      competency = obsScore.competency
    }

    return {
      dimension_id: dim.id,
      dimension_name: dim.name,
      icon: dim.icon,
      display_order: dim.display_order,
      competency: Math.round(competency * 100) / 100,
      interest: interestMap.get(dim.id) ?? 0,
      observation_count: dimObs.length,
      current_month_observation_count: obsScore.currentMonthCount,
      latest_observation: dimObs[0] ?? null,
      competency_breakdown: breakdown,
    }
  })
}

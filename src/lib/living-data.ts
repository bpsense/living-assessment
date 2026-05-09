/**
 * living-data.ts
 *
 * Builds monthly amoeba snapshots for a student by rolling up the V2
 * skill_assessments table through the standards framework into the
 * school's Learner Profile dimensions.
 *
 * Pipeline at each snapshot date M:
 *   skill_assessments (level → 1-4 score, age-relative cap applied)
 *     → competencies (via skill_competencies)
 *     → competency_subdomain → competency_domain
 *     → competency_domain_dimension_map (school-scoped)
 *     → average per dimension
 *
 * Interest dots layer in separately from interest_surveys.
 */

import type { Dimension, InterestSurvey, SkillCompetency } from '../types/database'
import type { SkillAssessment, AssessmentLevel } from '../types/skill-assessment'
import { ASSESSMENT_LEVEL_RANK } from '../types/skill-assessment'
import type { DimensionScore } from './scoring'

// ============================================================
// Types
// ============================================================

export interface CompetencyDomainDimensionMap {
  id: string
  school_id: string
  competency_domain_id: string
  dimension_id: string
}

/** Subset of CompetencySubdomain we actually need for the rollup. */
export interface SubdomainLite {
  id: string
  domain_id: string
}

/** Subset of Competency we need: id, subdomain, age band. */
export interface CompetencyLite {
  id: string
  subdomain_id: string
  age_band_start: number | null
  age_band_end: number | null
}

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

export interface BuildSnapshotsInput {
  dateOfBirth: string
  schoolId: string
  dimensions: Dimension[]
  assessments: SkillAssessment[]
  surveys: InterestSurvey[]
  skillCompetencies: SkillCompetency[]
  competencies: CompetencyLite[]
  subdomains: SubdomainLite[]
  domainDimensionMap: CompetencyDomainDimensionMap[]
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
// Score conversion
// ============================================================

function levelScore(level: AssessmentLevel): number {
  return ASSESSMENT_LEVEL_RANK[level]
}

// ============================================================
// Snapshot computation
// ============================================================

/**
 * Build monthly snapshots from earliest assessment (or 12mo ago) through now.
 * Returns [] if no dimensions / dob is null — caller should render empty state
 * before invoking this.
 */
export function buildSnapshots(input: BuildSnapshotsInput): AmoebaSnapshot[] {
  const {
    dateOfBirth,
    schoolId,
    dimensions,
    assessments,
    skillCompetencies,
    competencies,
    subdomains,
    domainDimensionMap,
  } = input

  if (!dateOfBirth || dimensions.length === 0) return []

  const dob = new Date(dateOfBirth)

  // ── Lookup tables ─────────────────────────────────────────
  // skill_id → competency_ids
  const skillToComps = new Map<string, string[]>()
  for (const sc of skillCompetencies) {
    const arr = skillToComps.get(sc.skill_id) ?? []
    arr.push(sc.competency_id)
    skillToComps.set(sc.skill_id, arr)
  }
  // competency_id → CompetencyLite
  const compById = new Map(competencies.map((c) => [c.id, c]))
  // subdomain_id → domain_id
  const subToDomain = new Map(subdomains.map((s) => [s.id, s.domain_id]))
  // domain_id → dimension_id (school-scoped)
  const domainToDimension = new Map<string, string>()
  for (const m of domainDimensionMap) {
    if (m.school_id !== schoolId) continue
    domainToDimension.set(m.competency_domain_id, m.dimension_id)
  }

  // ── Determine snapshot range ──────────────────────────────
  const sortedAssessments = [...assessments].sort(
    (a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
  )
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const earliestAssessment = sortedAssessments[0]
    ? new Date(sortedAssessments[0].assessed_at).getTime()
    : now.getTime()
  const startTime = Math.min(twelveMonthsAgo.getTime(), earliestAssessment)

  const snapshotDates: Date[] = []
  const cursor = new Date(new Date(startTime).getFullYear(), new Date(startTime).getMonth(), 1)
  while (cursor.getTime() <= now.getTime()) {
    snapshotDates.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const last = snapshotDates[snapshotDates.length - 1]
  if (!last || last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()) {
    snapshotDates.push(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  // ── Build each snapshot ───────────────────────────────────
  const snapshots: AmoebaSnapshot[] = snapshotDates.map((monthStart) => {
    const cutoff = endOfMonth(monthStart).getTime()
    const { years: ageYears, months: ageMonths } = ageAt(dob, endOfMonth(monthStart))

    // Per-dimension accumulators
    const sums = new Map<string, { sum: number; count: number }>()
    for (const d of dimensions) sums.set(d.id, { sum: 0, count: 0 })

    for (const a of sortedAssessments) {
      if (new Date(a.assessed_at).getTime() > cutoff) break // sorted ascending
      const baseScore = levelScore(a.level)
      const compIds = skillToComps.get(a.skill_id)
      if (!compIds || compIds.length === 0) continue

      for (const cid of compIds) {
        const comp = compById.get(cid)
        if (!comp) continue

        // Age cap: above band → emerging (1)
        let effective = baseScore
        if (
          comp.age_band_start != null &&
          comp.age_band_end != null &&
          ageYears > comp.age_band_end
        ) {
          effective = 1
        }

        const domainId = subToDomain.get(comp.subdomain_id)
        if (!domainId) continue
        const dimensionId = domainToDimension.get(domainId)
        if (!dimensionId) continue

        const acc = sums.get(dimensionId)
        if (!acc) continue
        acc.sum += effective
        acc.count += 1
      }
    }

    const dimResult: Record<string, number | null> = {}
    for (const d of dimensions) {
      const acc = sums.get(d.id)!
      dimResult[d.id] = acc.count > 0 ? acc.sum / acc.count : null
    }

    return {
      date: monthStart.toISOString(),
      label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      ageYears,
      ageMonths,
      dimensions: dimResult,
    }
  })

  // ── Mark age-rollover snapshots (birthday month) ──────────
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].ageYears !== snapshots[i - 1].ageYears) {
      snapshots[i].isAgeRollover = true
      snapshots[i].prevAgeYears = snapshots[i - 1].ageYears
    }
  }

  return snapshots
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


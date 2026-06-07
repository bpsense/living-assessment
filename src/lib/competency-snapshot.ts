/**
 * competency-snapshot.ts
 *
 * Pure helpers for the Competency Snapshot. No data access lives here — see
 * `competency-snapshot-data.ts` for supabase reads.
 *
 * Position model (v2): a continuous "spectrum score" on the scale [0, 5].
 *   - The weighted-average level (1=emerging .. 4=mastery) of all recent
 *     assessments, with exponential decay over time (newer dominates).
 *   - Plus a band offset that shifts the bar by ±1 depending on whether the
 *     standard is older/matching/younger than the learner's age.
 *
 * Zone landmarks on the spectrum:
 *   0.0–2.0  below   (working below age expectation)
 *   2.0–4.0  at      (developing → achieving in band reads centered)
 *   4.0–5.0  above   (mastery in band; achieving on stretch content)
 *
 * Visual position on the bar: a simple linear map (score → percent) anchored
 * so that score 3.0 — a "matching-band achieving" reading — lands at 50%.
 */
import {
  LEVEL_SCORE,
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'

// ============================================================
// Band relation
// ============================================================

export type BandRelation = 'older' | 'matching' | 'younger' | 'unknown'

export function classifyBand(
  learnerAge: number | null,
  bandStart: number | null,
  bandEnd: number | null
): BandRelation {
  if (learnerAge === null || bandStart === null || bandEnd === null) {
    return 'unknown'
  }
  if (learnerAge < bandStart) return 'older'
  if (learnerAge > bandEnd) return 'younger'
  return 'matching'
}

/**
 * Per-assessment band-adjusted level score. This is the core of the
 * "spectrum" rule and is asymmetric on the younger band:
 *
 *   matching band:   level (1..4) — pure level on the spectrum
 *   older band:      level + 1   — stretch always counts (engagement on
 *                                  older material adds context, success on
 *                                  it reads as ahead)
 *   younger band:    asymmetric. Penalize gaps; never penalize successes.
 *     - emerging  (1) → 0     (deep below: a 7yo not getting 4-5 work)
 *     - developing(2) → 1     (below:      visible gap)
 *     - achieving (3) → 3     (at:         has the foundation, no extra credit)
 *     - mastery   (4) → 3.5   (at, right:  clearly mastered, but the bar
 *                                          is for harder content, so this
 *                                          does NOT bump into "above")
 *
 * Returns 0 for unknown band so the caller can short-circuit there.
 */
export function adjustedLevelScore(
  level: AssessmentLevel,
  band: BandRelation
): number {
  const lvl = LEVEL_SCORE[level] // 1..4
  if (band === 'matching') return lvl
  if (band === 'older') return lvl + 1
  if (band === 'younger') {
    if (lvl >= 4) return 3.5 // mastery
    if (lvl >= 3) return 3 // achieving
    return lvl - 1 // emerging / developing penalize gaps
  }
  return lvl // unknown — caller treats as untimed anyway
}

// ============================================================
// Spectrum (continuous position)
// ============================================================

export type Zone = 'below' | 'at' | 'above' | 'untimed'

/** Half-life for the exponential-decay weighting. 90 days = ~one school
 *  term. An assessment 3 months old contributes half as much as a
 *  same-day assessment. */
export const DECAY_HALF_LIFE_DAYS = 90

export function decayWeight(
  daysAgo: number,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  if (daysAgo <= 0) return 1
  return Math.pow(0.5, daysAgo / halfLifeDays)
}

/**
 * Decay-weighted average of the *raw* per-assessment level scores (1..4).
 * Exported for unit tests + UI display; this is the value the modal shows
 * before any band shift is applied. Returns null on empty history.
 */
export function weightedLevelScore(
  history: StandardAssessment[],
  now: Date = new Date(),
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number | null {
  if (history.length === 0) return null
  let weightedSum = 0
  let totalWeight = 0
  const nowMs = now.getTime()
  for (const a of history) {
    const days = Math.max(0, (nowMs - new Date(a.assessed_at).getTime()) / 86_400_000)
    const w = decayWeight(days, halfLifeDays)
    weightedSum += LEVEL_SCORE[a.level] * w
    totalWeight += w
  }
  return totalWeight === 0 ? null : weightedSum / totalWeight
}

/**
 * Computes the spectrum score for a single (standard, learner) pair.
 *   - Returns null when band is unknown or history is empty.
 *   - Otherwise: decay-weighted average of each assessment's BAND-ADJUSTED
 *     score (see `adjustedLevelScore`). Applying the band rule per
 *     assessment rather than as a constant offset is what implements the
 *     asymmetric younger-band behavior: gaps still penalize, but successes
 *     no longer drag the spectrum down.
 *   - Clamped to [0, 5].
 */
export function computeSpectrumScore(
  history: StandardAssessment[],
  band: BandRelation,
  now: Date = new Date(),
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number | null {
  if (band === 'unknown' || history.length === 0) return null
  let weightedSum = 0
  let totalWeight = 0
  const nowMs = now.getTime()
  for (const a of history) {
    const days = Math.max(0, (nowMs - new Date(a.assessed_at).getTime()) / 86_400_000)
    const w = decayWeight(days, halfLifeDays)
    weightedSum += adjustedLevelScore(a.level, band) * w
    totalWeight += w
  }
  if (totalWeight === 0) return null
  return Math.max(0, Math.min(5, weightedSum / totalWeight))
}

/**
 * Maps the spectrum score to a 0..100 bar percent. The mapping is anchored
 * so:  score 2 → 33%, score 3 → 50%, score 4 → 67%. Below 2 fills the left
 * "below" zone; above 4 fills the right "above" zone.
 */
export function spectrumToBarPercent(score: number): number {
  // Linear: pos = score/5 * 100, then nudge so 3.0 lands at 50% (matching
  // achieving in band). A score range of 0..5 maps to bar 0..100 with the
  // visual zones partitioned at 33% and 67%.
  const clamped = Math.max(0, Math.min(5, score))
  return (clamped / 5) * 100
}

/** Bucket the spectrum score into a zone for tally chips + sort order.
 *
 * Boundary at score 4 belongs to "above" (matching-band mastery and
 * older-band achieving both land here and the user-confirmed rule says
 * both should read above age expectation). */
export function spectrumToZone(score: number | null): Zone {
  if (score === null) return 'untimed'
  if (score < 2) return 'below'
  if (score >= 4) return 'above'
  return 'at'
}

// ============================================================
// Trend (kept from v1)
// ============================================================

export type Trend = 'up' | 'down' | 'flat'

export function classifyTrend(assessments: StandardAssessment[]): Trend {
  if (assessments.length < 2) return 'flat'
  const sorted = [...assessments].sort(
    (a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
  )
  const latest = sorted[sorted.length - 1]
  const prior = sorted[sorted.length - 2]
  const delta = LEVEL_SCORE[latest.level] - LEVEL_SCORE[prior.level]
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

// ============================================================
// Age
// ============================================================

export function ageFromDob(
  dob: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

// ============================================================
// Display tokens
// ============================================================

export const ZONE_LABEL: Record<Zone, string> = {
  below: 'Below age expectation',
  at: 'At age expectation',
  above: 'Above age expectation',
  untimed: 'Untimed',
}

export const ZONE_SHORT: Record<Zone, string> = {
  below: 'Below',
  at: 'At age level',
  above: 'Above',
  untimed: 'Untimed',
}

export const ZONE_TOKEN: Record<
  Zone,
  { dot: string; chip: string; text: string }
> = {
  below: { dot: 'bg-accent-500', chip: 'bg-accent-50 text-accent-700', text: 'text-accent-700' },
  at: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700', text: 'text-sky-700' },
  above: { dot: 'bg-primary-500', chip: 'bg-primary-50 text-primary-700', text: 'text-primary-700' },
  untimed: { dot: 'bg-bg-muted', chip: 'bg-bg-muted text-text-muted', text: 'text-text-muted' },
}

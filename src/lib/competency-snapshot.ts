/**
 * competency-snapshot.ts
 *
 * Pure helpers for the Competency Snapshot section. No data access lives
 * here — see `competency-snapshot-data.ts` for the supabase reads.
 *
 * The position rule is fixed and load-bearing: parents and educators see
 * the same labels, so this logic must not drift. The table is replicated
 * verbatim in the docstring of `classifyPosition` for auditability.
 */
import {
  LEVEL_SCORE,
  type AssessmentLevel,
  type StandardAssessment,
} from './standards-assignment-data'

// ============================================================
// Position
// ============================================================

/** Where this standard sits relative to the learner's age. */
export type Position = 'building' | 'at' | 'ahead' | 'untimed'

/** Where the standard's age band sits relative to the learner. */
export type BandRelation = 'older' | 'matching' | 'younger' | 'unknown'

/** Determines whether the standard's age band is older, matching, or
 *  younger than the learner's current age. */
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
 * Position rule (must implement EXACTLY this table):
 *
 *   older band    + (achieving|mastery)     -> ahead
 *   older band    + (emerging|developing)   -> at
 *   matching band                           -> at
 *   younger band  + (achieving|mastery)     -> at
 *   younger band  + (emerging|developing)   -> building
 *
 * Rationale: an older-band standard not yet mastered is age-appropriate
 * stretch (AT). A younger-band standard not yet mastered is a real gap
 * (BUILDING). Matching band collapses to AT regardless of level — the
 * trend arrow conveys movement within the level scale.
 *
 * Returns 'untimed' when the band can't be resolved (no DOB, or the
 * standard has no age_band_start/end).
 */
export function classifyPosition(
  level: AssessmentLevel,
  band: BandRelation
): Position {
  if (band === 'unknown') return 'untimed'
  const reachedAchieving = LEVEL_SCORE[level] >= 3 // achieving or mastery
  if (band === 'older') return reachedAchieving ? 'ahead' : 'at'
  if (band === 'matching') return 'at'
  // band === 'younger'
  return reachedAchieving ? 'at' : 'building'
}

// ============================================================
// Trend
// ============================================================

export type Trend = 'up' | 'down' | 'flat'

/**
 * Compare the latest assessment to the immediately prior assessment on
 * the same standard, using the level ordinal (emerging < developing <
 * achieving < mastery). Single assessment = flat.
 */
export function classifyTrend(assessments: StandardAssessment[]): Trend {
  if (assessments.length < 2) return 'flat'
  // Caller is expected to pass either ascending or descending order;
  // we re-sort defensively so the helper is order-agnostic.
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

/**
 * Integer learner age in years from an ISO date-of-birth (yyyy-mm-dd).
 * Returns null when the value is missing or unparseable.
 *
 * Duplicated intentionally with src/lib/age-utils.ts:getAgeFromDob to
 * keep this helper module dependency-light for unit tests. Behavior
 * matches that helper.
 */
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
// Display tokens (no inline hex — neutral developmental palette)
// ============================================================

export const POSITION_LABEL: Record<Position, string> = {
  ahead: 'Ahead of age expectation',
  at: 'At age expectation',
  building: 'Building toward age expectation',
  untimed: 'Untimed',
}

export const POSITION_SHORT: Record<Position, string> = {
  ahead: 'Ahead',
  at: 'At age level',
  building: 'Building',
  untimed: 'Untimed',
}

/** Tailwind class tokens by position. Defined here so both audiences
 *  see the same colors. Tokens map to the project's design palette:
 *  primary (teal), accent (amber), and a blue derived from sky utilities. */
export const POSITION_TOKEN: Record<
  Position,
  { dot: string; bar: string; chip: string; text: string }
> = {
  ahead: {
    dot: 'bg-primary-500',
    bar: 'bg-primary-500',
    chip: 'bg-primary-50 text-primary-700',
    text: 'text-primary-700',
  },
  at: {
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700',
    text: 'text-sky-700',
  },
  building: {
    dot: 'bg-accent-500',
    bar: 'bg-accent-500',
    chip: 'bg-accent-50 text-accent-700',
    text: 'text-accent-700',
  },
  untimed: {
    dot: 'bg-bg-muted',
    bar: 'bg-bg-muted',
    chip: 'bg-bg-muted text-text-muted',
    text: 'text-text-muted',
  },
}

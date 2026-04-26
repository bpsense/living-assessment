/**
 * age-utils.ts
 * Helpers for computing learner ages from date of birth, and matching
 * ages against age bands on classrooms, skills, and competencies.
 */

/**
 * Compute integer age in years from an ISO date string (yyyy-mm-dd).
 * Returns null when the input is missing or unparseable.
 */
export function getAgeFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

/**
 * Check whether an item's [start, end] age band overlaps a query [min, max]
 * range. Items with no declared band are treated as "any age" and match.
 * A null bound on either side is treated as open-ended.
 */
export function ageBandOverlaps(
  bandStart: number | null,
  bandEnd: number | null,
  rangeMin: number | null | undefined,
  rangeMax: number | null | undefined
): boolean {
  if (bandStart === null && bandEnd === null) return true
  if ((rangeMin === null || rangeMin === undefined) && (rangeMax === null || rangeMax === undefined)) {
    return true
  }
  const itemStart = bandStart ?? Number.NEGATIVE_INFINITY
  const itemEnd = bandEnd ?? Number.POSITIVE_INFINITY
  const queryStart = rangeMin ?? Number.NEGATIVE_INFINITY
  const queryEnd = rangeMax ?? Number.POSITIVE_INFINITY
  return itemStart <= queryEnd && itemEnd >= queryStart
}

/**
 * Format an age band for display: returns e.g. "Ages 6–8", "Ages 6+",
 * "Up to 8", or null when both bounds are missing.
 */
export function formatAgeBand(
  start: number | null,
  end: number | null
): string | null {
  if (start === null && end === null) return null
  if (start !== null && end !== null) {
    return start === end ? `Age ${start}` : `Ages ${start}–${end}`
  }
  if (start !== null) return `Ages ${start}+`
  return `Up to ${end}`
}

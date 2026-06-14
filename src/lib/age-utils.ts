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
 * Whole-year age on a specific date (dob is yyyy-mm-dd). Null if unparseable.
 */
export function ageOnDate(dob: string | null | undefined, at: Date): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  let age = at.getFullYear() - birth.getFullYear()
  const md = at.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && at.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

/**
 * Assigned "standard age" for the school year containing `date`, via the Dec-1
 * cutoff. The school year runs Sep–Aug, so a date in Jan–Aug belongs to the
 * year that began the previous September. Whichever age the student is on Dec 1
 * (the school-year midpoint) is the standard they are held to for the WHOLE
 * year — so the expectation steps up every September, not on the birthday.
 *
 *   born ≤ Aug 31         → already the next age at year start  → higher standard
 *   birthday Sep 1–Dec 1  → turns next age in the first half     → higher standard
 *   birthday Dec 2–Jun 30 → at the current age most of the year  → current standard
 */
export function standardAgeForDate(
  dob: string | null | undefined,
  date: Date
): number | null {
  // Sep = month index 8. Sep–Dec belong to this calendar year's school year;
  // Jan–Aug belong to the one that started the previous September.
  const schoolYearStart = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  return ageOnDate(dob, new Date(schoolYearStart, 11, 1)) // Dec 1
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

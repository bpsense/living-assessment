/**
 * observation-snapshots.ts
 *
 * Builds the monthly AmoebaSnapshot[] the LivingBlob consumes, sourced from the
 * `observations` table (dimension_id + 1-4 rating). This is the path for schools
 * that assess via direct observations rather than the standards/assignments
 * pipeline — i.e. clicking "Record Observation" now feeds the amoeba timeline.
 *
 * Per month, per dimension the score mirrors `computeObservationScores`
 * (scoring.ts): average the ratings observed that month; if none that month,
 * carry forward the most recent prior observation; null until the first one.
 */
import { ageAt, type AmoebaSnapshot } from './living-data'
import { standardAgeForDate } from './age-utils'
import type { Dimension, Observation } from '../types/database'

export interface BuildObservationSnapshotsInput {
  dateOfBirth: string
  dimensions: Dimension[]
  /** All observations for the student (any order). */
  observations: Observation[]
}

/** Build monthly snapshots from the earliest observation (or 12mo ago) through now. */
export function buildSnapshotsFromObservations(
  input: BuildObservationSnapshotsInput
): AmoebaSnapshot[] {
  const { dateOfBirth, dimensions, observations } = input
  if (!dateOfBirth || dimensions.length === 0 || observations.length === 0) return []

  const dob = new Date(dateOfBirth)

  // Pre-group observations by dimension, each sorted ascending by observed_at.
  const byDim = new Map<string, { t: number; rating: number }[]>()
  for (const o of observations) {
    if (!o.dimension_id) continue
    const arr = byDim.get(o.dimension_id) ?? []
    arr.push({ t: new Date(o.observed_at).getTime(), rating: Number(o.rating) })
    byDim.set(o.dimension_id, arr)
  }
  for (const arr of byDim.values()) arr.sort((a, b) => a.t - b.t)

  // Month range: from the earliest observation's month through the current month.
  const now = new Date()
  let earliestT = Infinity
  for (const arr of byDim.values()) if (arr.length) earliestT = Math.min(earliestT, arr[0].t)
  const earliest = isFinite(earliestT)
    ? new Date(earliestT)
    : new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const months: Date[] = []
  const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push(new Date(d))
  }

  const snaps: AmoebaSnapshot[] = []
  let prevStd = -1

  for (const month of months) {
    const monthStart = month.getTime()
    const cutoff = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).getTime()

    const dimsOut: Record<string, number | null> = {}
    for (const dim of dimensions) {
      const arr = byDim.get(dim.id)
      if (!arr || arr.length === 0 || arr[0].t > cutoff) {
        dimsOut[dim.id] = null
        continue
      }
      // Observations in [monthStart, cutoff] → average; else carry forward latest ≤ cutoff.
      let sum = 0
      let n = 0
      let lastBeforeCutoff: number | null = null
      for (const rec of arr) {
        if (rec.t > cutoff) break
        lastBeforeCutoff = rec.rating
        if (rec.t >= monthStart) {
          sum += rec.rating
          n += 1
        }
      }
      dimsOut[dim.id] = n > 0 ? sum / n : lastBeforeCutoff
    }

    const { years, months: ageM } = ageAt(dob, new Date(cutoff))
    // Standard age (Dec-1 rule) drives the rollover/decay — it steps in September,
    // so the blob rescales at the start of each school year, not on the birthday.
    const standardAge = standardAgeForDate(dateOfBirth, month) ?? years
    const isAgeRollover = prevStd !== -1 && standardAge !== prevStd
    snaps.push({
      date: month.toISOString().slice(0, 10),
      label: month.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      ageYears: years,
      ageMonths: ageM,
      standardAge,
      dimensions: dimsOut,
      isAgeRollover: isAgeRollover || undefined,
      prevAgeYears: isAgeRollover ? prevStd : undefined,
    })
    prevStd = standardAge
  }

  return snaps
}

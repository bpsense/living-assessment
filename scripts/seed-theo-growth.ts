/**
 * seed-theo-growth.ts
 *
 * Replaces Theo Lindqvist's (DOB 2019-03-04) historical assessments under the
 * existing "Continuous Growth Tracking 2023–2026" assignment with a richer,
 * realistic pattern:
 *
 *   - Each age-year, scores ramp from ~developing up to that band's peak,
 *     with a small ebb-and-flow wobble.
 *   - At each birthday (March), raw scores reset DOWN — modelling the
 *     advancement of the rubric into a harder age band.
 *   - Each dimension follows its own profile (Math grows fast and holds;
 *     Creative Expression peaks then regresses; Physical stays modest; etc.)
 *
 * Idempotent: deletes only Theo's existing assessments under the
 * "Continuous Growth Tracking 2023–2026" assignment, then re-inserts.
 *
 *   npx tsx scripts/seed-theo-growth.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Bootstrap ──────────────────────────────────────────────────

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(__filename2)

function loadEnv() {
  const paths = [
    resolve(__dirname2, '..', '.env.local'),
    resolve(process.cwd(), '.env.local'),
  ]
  for (const p of paths) {
    try {
      for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq < 0) continue
        if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1)
      }
      return
    } catch {}
  }
}

loadEnv()

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Config ─────────────────────────────────────────────────────

const THEO_ID = '22222222-2222-4222-8222-222222222222'
const THEO_DOB = '2019-03-04'
const SCHOOL_ID = 'ffb55bc2-2678-45b1-8552-286f21b2b247'
const ASSIGNMENT_TITLE = 'Continuous Growth Tracking 2023–2026'

const LEVELS = ['emerging', 'developing', 'achieving', 'mastery'] as const
type Level = (typeof LEVELS)[number]

function levelFromScore(score: number): Level {
  if (score < 1.5) return 'emerging'
  if (score < 2.5) return 'developing'
  if (score < 3.5) return 'achieving'
  return 'mastery'
}

// ── Dimension profiles ─────────────────────────────────────────
//
// (start, peak, end) per age band — represents where in the 1–4 competency
// scale Theo sits at the start of the year, at his mid-year peak, and at the
// end (before the next birthday reset). Different dimensions have different
// trajectories so the amoeba is visibly asymmetric.

type AgeBand = { start: number; peak: number; end: number }
type DimProfile = {
  // wobble frequency multiplier (small per-dim variation in the bumpiness)
  freq: number
  // Per actual age. Missing ages fall back to last defined.
  bands: Record<number, AgeBand>
}

function profileFor(dimName: string): DimProfile {
  const n = dimName.toLowerCase()
  if (n.includes('math')) {
    // Fast learner, climbs to mastery and holds
    return {
      freq: 0.7,
      bands: {
        4: { start: 1.8, peak: 2.8, end: 2.7 },
        5: { start: 1.6, peak: 3.5, end: 3.5 },
        6: { start: 2.0, peak: 4.0, end: 4.0 },
        7: { start: 2.4, peak: 3.6, end: 3.6 },
      },
    }
  }
  if (n.includes('language') || n.includes('communic') || n.includes('literacy')) {
    return {
      freq: 1.0,
      bands: {
        4: { start: 2.0, peak: 2.6, end: 2.4 },
        5: { start: 1.8, peak: 3.0, end: 2.9 },
        6: { start: 2.0, peak: 3.5, end: 3.3 },
        7: { start: 2.2, peak: 3.0, end: 3.0 },
      },
    }
  }
  if (n.includes('scien') || n.includes('environ')) {
    // Late bloomer
    return {
      freq: 1.3,
      bands: {
        4: { start: 1.4, peak: 2.0, end: 1.9 },
        5: { start: 1.4, peak: 2.5, end: 2.3 },
        6: { start: 1.7, peak: 3.0, end: 2.9 },
        7: { start: 1.9, peak: 2.8, end: 2.8 },
      },
    }
  }
  if (n.includes('creativ') || n.includes('making')) {
    // Volatile — peaks mid-year then regresses
    return {
      freq: 1.6,
      bands: {
        4: { start: 2.2, peak: 3.0, end: 2.2 },
        5: { start: 1.8, peak: 3.2, end: 2.2 },
        6: { start: 1.6, peak: 3.0, end: 2.3 },
        7: { start: 1.8, peak: 2.6, end: 2.6 },
      },
    }
  }
  if (n.includes('inner') || n.includes('well')) {
    // Slow steady grower
    return {
      freq: 0.9,
      bands: {
        4: { start: 1.8, peak: 2.0, end: 2.0 },
        5: { start: 1.6, peak: 2.4, end: 2.4 },
        6: { start: 1.8, peak: 2.8, end: 2.7 },
        7: { start: 2.0, peak: 2.8, end: 2.8 },
      },
    }
  }
  if (n.includes('physical') || n.includes('movement')) {
    // Stays near developing all along
    return {
      freq: 1.1,
      bands: {
        4: { start: 2.0, peak: 2.5, end: 2.3 },
        5: { start: 1.8, peak: 2.5, end: 2.2 },
        6: { start: 1.9, peak: 2.7, end: 2.5 },
        7: { start: 2.0, peak: 2.5, end: 2.5 },
      },
    }
  }
  if (n.includes('collab') || n.includes('relation')) {
    // Grows then regresses (group dynamics fluctuate)
    return {
      freq: 1.2,
      bands: {
        4: { start: 1.8, peak: 2.8, end: 2.2 },
        5: { start: 1.6, peak: 3.2, end: 2.5 },
        6: { start: 1.8, peak: 3.5, end: 2.8 },
        7: { start: 2.0, peak: 3.0, end: 3.0 },
      },
    }
  }
  if (n.includes('global') || n.includes('citizen')) {
    return {
      freq: 0.8,
      bands: {
        4: { start: 1.4, peak: 2.2, end: 2.1 },
        5: { start: 1.5, peak: 2.8, end: 2.7 },
        6: { start: 1.8, peak: 3.2, end: 3.0 },
        7: { start: 2.0, peak: 3.0, end: 3.0 },
      },
    }
  }
  // Fallback — gentle climber
  return {
    freq: 1.0,
    bands: {
      4: { start: 1.6, peak: 2.4, end: 2.2 },
      5: { start: 1.6, peak: 2.8, end: 2.6 },
      6: { start: 1.8, peak: 3.0, end: 2.8 },
      7: { start: 2.0, peak: 2.8, end: 2.8 },
    },
  }
}

// Parabolic interpolation through (0, start), (0.5, peak), (1, end).
function parabolicCurve(t: number, band: AgeBand): number {
  const { start, peak, end } = band
  const a = 2 * (start + end) - 4 * peak
  const b = 4 * peak - 3 * start - end
  const c = start
  return a * t * t + b * t + c
}

// ── Age helpers ────────────────────────────────────────────────

function ageYearsAt(dob: Date, at: Date): number {
  let years = at.getFullYear() - dob.getFullYear()
  const m = at.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) years -= 1
  return Math.max(0, years)
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  // 1. Find the assignment and Theo's student_assignment under it
  const { data: assignment } = await sb
    .from('assignments')
    .select('id, classroom_id')
    .eq('title', ASSIGNMENT_TITLE)
    .single()
  if (!assignment) {
    console.error(`Assignment not found: ${ASSIGNMENT_TITLE}`)
    console.error('Run scripts/seed-estepona-67-growth.ts first to create the assignment.')
    process.exit(1)
  }

  const { data: theoSA } = await sb
    .from('student_assignments')
    .select('id')
    .eq('assignment_id', assignment.id)
    .eq('student_id', THEO_ID)
    .single()
  if (!theoSA) {
    console.error('Theo has no student_assignment for this assignment.')
    process.exit(1)
  }
  const studentAssignmentId = theoSA.id as string

  // 2. Standards in the assignment, mapped to their dimension
  const { data: stds } = await sb
    .from('assignment_standards')
    .select('standard_id')
    .eq('assignment_id', assignment.id)
  const stdIds = (stds ?? []).map((s) => s.standard_id as string)
  if (stdIds.length === 0) {
    console.error('No assignment_standards rows.')
    process.exit(1)
  }

  const { data: dimMaps } = await sb
    .from('dimension_standards')
    .select('standard_id, dimension_id, dimensions:dimensions(id, name)')
    .eq('school_id', SCHOOL_ID)
    .in('standard_id', stdIds)
  const stdToDim = new Map<string, { id: string; name: string }>()
  for (const m of (dimMaps ?? []) as any[]) {
    if (m.dimensions) stdToDim.set(m.standard_id, { id: m.dimensions.id, name: m.dimensions.name })
  }
  console.log(`Standards mapped to dimensions: ${stdToDim.size} / ${stdIds.length}`)

  // 3. Months of the timeline (must match the bigger seed)
  const months: Date[] = []
  for (
    let d = new Date(2023, 8, 1);
    d <= new Date(2026, 4, 1);
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push(new Date(d))
  }
  const dob = new Date(THEO_DOB)

  // For each month: age, and where it sits inside its age band.
  // Group consecutive months by age to determine band length & position.
  const ageOfMonth: number[] = months.map((m) =>
    ageYearsAt(dob, new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999))
  )
  const bandLen: number[] = new Array(months.length).fill(0)
  const bandPos: number[] = new Array(months.length).fill(0)
  let i = 0
  while (i < months.length) {
    let j = i
    while (j + 1 < months.length && ageOfMonth[j + 1] === ageOfMonth[i]) j++
    const len = j - i + 1
    for (let k = i; k <= j; k++) {
      bandLen[k] = len
      bandPos[k] = k - i
    }
    i = j + 1
  }

  // 4. Delete Theo's existing assessments under this assignment
  const { error: delErr, count } = await sb
    .from('assignment_standard_assessments')
    .delete({ count: 'exact' })
    .eq('student_assignment_id', studentAssignmentId)
  if (delErr) {
    console.error('Failed to clear Theo\'s assessments:', delErr.message)
    process.exit(1)
  }
  console.log(`Cleared ${count ?? 0} existing Theo assessments.`)

  // 5. Find an assessor — reuse the assignment's teacher
  const { data: teacher } = await sb
    .from('assignments')
    .select('teacher_id')
    .eq('id', assignment.id)
    .single()
  const teacherId = teacher?.teacher_id

  // 6. Generate new assessments
  const rows: any[] = []
  for (let mi = 0; mi < months.length; mi++) {
    const age = ageOfMonth[mi]
    const t = bandLen[mi] <= 1 ? 0 : bandPos[mi] / (bandLen[mi] - 1)
    const month = months[mi]
    const assessedAt = new Date(month.getFullYear(), month.getMonth(), 15, 12, 0, 0)

    for (const sid of stdIds) {
      const dim = stdToDim.get(sid)
      if (!dim) continue
      const prof = profileFor(dim.name)
      // Fall back to nearest defined age band
      const band =
        prof.bands[age] ??
        prof.bands[Math.max(...Object.keys(prof.bands).map(Number).filter((k) => k <= age))] ??
        prof.bands[Math.min(...Object.keys(prof.bands).map(Number))]
      const base = parabolicCurve(t, band)
      // Wobble: small sinusoidal ebb-and-flow within the year
      const wobble = 0.18 * Math.sin(mi * prof.freq + sid.charCodeAt(0) * 0.13)
      const score = Math.max(0.6, Math.min(4.3, base + wobble))
      rows.push({
        student_assignment_id: studentAssignmentId,
        student_id: THEO_ID,
        school_id: SCHOOL_ID,
        standard_id: sid,
        level: levelFromScore(score),
        notes: null,
        assessor_id: teacherId,
        assessed_at: assessedAt.toISOString(),
      })
    }
  }

  console.log(`\nInserting ${rows.length} assessments…`)
  for (let k = 0; k < rows.length; k += 500) {
    const batch = rows.slice(k, k + 500)
    const { error } = await sb.from('assignment_standard_assessments').insert(batch)
    if (error) {
      console.error(`Batch ${k / 500} failed:`, error.message)
      process.exit(1)
    }
  }

  // 7. Print per-month per-dimension averages so the curve is inspectable
  console.log('\n── Per-month dimension averages (level scores) ──')
  const dimNames = Array.from(new Set(Array.from(stdToDim.values()).map((d) => d.name)))
  const header = ['month', 'age'].concat(dimNames.map((n) => n.slice(0, 14).padEnd(14)))
  console.log(header.join(' | '))
  for (let mi = 0; mi < months.length; mi++) {
    const monthLabel = months[mi].toLocaleString('en-US', { month: 'short', year: '2-digit' })
    const monthRows = rows.filter((r) =>
      r.assessed_at.startsWith(
        `${months[mi].getFullYear()}-${String(months[mi].getMonth() + 1).padStart(2, '0')}`
      )
    )
    const byDim = new Map<string, number[]>()
    for (const r of monthRows) {
      const dim = stdToDim.get(r.standard_id)!
      const score =
        r.level === 'emerging' ? 1 : r.level === 'developing' ? 2 : r.level === 'achieving' ? 3 : 4
      const list = byDim.get(dim.name) ?? []
      list.push(score)
      byDim.set(dim.name, list)
    }
    const cols = dimNames.map((n) => {
      const arr = byDim.get(n) ?? []
      const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      return avg.toFixed(2).padStart(14)
    })
    console.log([monthLabel, String(ageOfMonth[mi])].concat(cols).join(' | '))
  }

  console.log('\n✅ Done. Reload Theo\'s profile to see the new pattern.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

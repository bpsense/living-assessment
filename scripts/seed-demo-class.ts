/**
 * seed-demo-class.ts
 *
 * Populates the **Demo Class** (Demo Location · Boundless Life) with 10
 * fictional learners and ~2 school years of observation history (Sep 2024 →
 * Jun 2026) so the amoeba timeline / Living Visualization has rich demo data.
 *
 * Writes to the CURRENT amoeba pipeline: the `observations` table
 * (dimension_id + competency_id + integer rating 1-4 + assessed_age), which is
 * what `buildSnapshotsFromObservations` reads. (The older standards/assignment
 * seed scripts feed a pipeline the visualization no longer uses.)
 *
 * Model — matches the product's behaviour (Option B, "keep built-in age-shrink"):
 *   - Every learner starts ALL 8 dimensions at Emerging (rating 1) in Sep 2024.
 *   - Raw ratings grow continuously toward a per-(student,dimension) ceiling,
 *     with light month-to-month ebb/flow (each dimension on its own rhythm) so
 *     growth is never uniform across students or dimensions.
 *   - Raw does NOT reset over summer. The visualization's per-birthday
 *     age-rescale (decayDimensionScores, ×0.75/yr) is what produces the
 *     "shrinks back as they get older, then grows again" effect on the blob.
 *   - 5–8 observations per student per month, rotating across dimensions, so a
 *     subset of competencies is left "not yet assessed" each month (carry-forward).
 *
 * Idempotent: upserts the 10 students by fixed id and deletes their existing
 * observations before re-seeding.
 *
 *   npx tsx scripts/seed-demo-class.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { standardAgeForDate } from '../src/lib/age-utils'

// ── Bootstrap ──────────────────────────────────────────────────

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(__filename2)

function loadEnv() {
  const paths = [resolve(__dirname2, '..', '.env.local'), resolve(process.cwd(), '.env.local')]
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Config ─────────────────────────────────────────────────────

const SCHOOL_ID = 'ffb55bc2-2678-45b1-8552-286f21b2b247' // Boundless Life
const CLASSROOM_ID = 'a5cf9435-4ed3-4a9f-b4ad-aefa92bfecae' // Demo Class (Demo Location, age 8-9)

// Generated school months (summer Jul/Aug 2025 intentionally skipped — the
// snapshot builder carries values forward across the gap).
const MONTHS: { y: number; m: number }[] = []
for (const [y, mStart, mEnd] of [
  [2024, 8, 11], // Sep–Dec 2024 (0-indexed months)
  [2025, 0, 5], //  Jan–Jun 2025
  [2025, 8, 11], // Sep–Dec 2025
  [2026, 0, 5], //  Jan–Jun 2026
] as const) {
  for (let m = mStart; m <= mEnd; m++) MONTHS.push({ y, m })
}
const BASELINE = { y: 2024, m: 8 } // Sep 2024 — every dimension starts at Emerging here

// Elapsed months from the baseline (Sep 2024 = 0 … Jun 2026 = 21).
function elapsed(y: number, m: number): number {
  return (y * 12 + m) - (BASELINE.y * 12 + BASELINE.m)
}
const SPAN = elapsed(2026, 5) // 21

// ── Learners ───────────────────────────────────────────────────
// Fixed ids → idempotent re-runs. All are 8 or 9 as of 2026-06-14, with
// varied birthdays. `arch` selects a growth profile (below).

type Arch =
  | 'highAcademic'
  | 'highSocial'
  | 'strongAllRounder'
  | 'creativeSpike'
  | 'academicStrongSocialLow'
  | 'solidMid'
  | 'developing'
  | 'oneStruggle'
  | 'lateBloomer'
  | 'strugglerGrowing'

interface Learner {
  id: string
  first: string
  last: string
  dob: string // YYYY-MM-DD
  grade: string
  pronouns: string
  arch: Arch
}

const LEARNERS: Learner[] = [
  { id: 'd0000001-0000-4000-8000-000000000001', first: 'Mateo', last: 'Reyes', dob: '2016-09-22', grade: '4', pronouns: 'he/him', arch: 'highAcademic' },
  { id: 'd0000002-0000-4000-8000-000000000002', first: 'Amara', last: 'Okafor', dob: '2016-11-30', grade: '4', pronouns: 'she/her', arch: 'strongAllRounder' },
  { id: 'd0000003-0000-4000-8000-000000000003', first: 'Sofia', last: 'Marchetti', dob: '2017-02-14', grade: '4', pronouns: 'she/her', arch: 'creativeSpike' },
  { id: 'd0000004-0000-4000-8000-000000000004', first: 'Kai', last: 'Nakamura', dob: '2017-05-08', grade: '4', pronouns: 'he/him', arch: 'academicStrongSocialLow' },
  { id: 'd0000005-0000-4000-8000-000000000005', first: 'Noor', last: 'Haddad', dob: '2016-07-19', grade: '4', pronouns: 'she/her', arch: 'solidMid' },
  { id: 'd0000006-0000-4000-8000-000000000006', first: 'Liam', last: 'Gallagher', dob: '2017-10-03', grade: '3', pronouns: 'he/him', arch: 'strugglerGrowing' },
  { id: 'd0000007-0000-4000-8000-000000000007', first: 'Yuki', last: 'Tanaka', dob: '2017-12-12', grade: '3', pronouns: 'they/them', arch: 'oneStruggle' },
  { id: 'd0000008-0000-4000-8000-000000000008', first: 'Elena', last: 'Volkova', dob: '2018-03-25', grade: '3', pronouns: 'she/her', arch: 'lateBloomer' },
  { id: 'd0000009-0000-4000-8000-000000000009', first: 'Omar', last: 'Hassan', dob: '2018-01-18', grade: '3', pronouns: 'he/him', arch: 'developing' },
  { id: 'd0000010-0000-4000-8000-000000000010', first: 'Priya', last: 'Sharma', dob: '2017-08-29', grade: '3', pronouns: 'she/her', arch: 'highSocial' },
]

// Per-archetype ceiling for each dimension by display_order:
//   0 Think Deeply · 1 Create Boldly · 2 Reason & Solve · 3 Communicate ·
//   4 Know Yourself · 5 Keep Growing · 6 Connect Across Difference · 7 Navigate
// Values are raw monthly-average targets on the 1–4 scale reached by Jun 2026.
const CEILINGS: Record<Arch, number[]> = {
  highAcademic:            [4.0, 3.7, 4.0, 3.9, 3.6, 3.7, 3.5, 3.6],
  highSocial:              [3.5, 3.4, 3.3, 3.7, 4.0, 3.9, 4.0, 3.8],
  strongAllRounder:        [3.6, 3.5, 3.7, 3.8, 3.6, 3.5, 3.7, 3.6],
  creativeSpike:           [2.9, 4.0, 2.7, 3.1, 3.2, 2.8, 3.3, 2.9],
  academicStrongSocialLow: [3.8, 3.6, 3.9, 3.7, 2.4, 2.6, 2.3, 2.7],
  solidMid:                [3.0, 2.9, 3.1, 3.0, 3.2, 2.8, 3.0, 2.9],
  developing:              [2.5, 2.4, 2.6, 2.5, 2.7, 2.3, 2.6, 2.4],
  oneStruggle:             [3.0, 2.8, 1.8, 3.1, 2.9, 3.0, 3.0, 2.7], // Reason & Solve lags badly
  lateBloomer:             [3.3, 3.2, 3.4, 3.1, 3.0, 3.2, 3.1, 3.3], // slow yr1, steep yr2
  strugglerGrowing:        [2.2, 2.4, 1.9, 2.0, 2.5, 2.3, 2.6, 2.1], // low overall, but clearly climbing
}

// Growth-curve shape: progress p(t), t in [0,1] across the whole span.
function progress(arch: Arch, t: number): number {
  if (arch === 'lateBloomer') return Math.pow(t, 1.9) // slow start, accelerates
  if (arch === 'solidMid' || arch === 'developing') return 1 - Math.pow(1 - t, 1.3) // gentle
  return 1 - Math.pow(1 - t, 1.6) // ease-out: quick early gains, tapering
}

// ── Deterministic pseudo-random (FNV-1a) so re-runs are identical ──
function rand(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

// The age standard a learner is assessed against (Dec-1 rule) comes from the
// shared standardAgeForDate (src/lib/age-utils) so the seed matches the app.

const LEVEL_NAME = ['', 'Emerging', 'Developing', 'Achieving', 'Mastery']

// ── Main ───────────────────────────────────────────────────────

async function main() {
  // 1. Active dimensions for the school, in display order.
  const { data: dims, error: dimErr } = await sb
    .from('dimensions')
    .select('id, name, display_order')
    .eq('school_id', SCHOOL_ID)
    .eq('is_active', true)
    .order('display_order')
  if (dimErr || !dims || dims.length === 0) {
    console.error('No active dimensions:', dimErr?.message)
    process.exit(1)
  }
  console.log(`Dimensions (${dims.length}): ${dims.map((d) => d.name).join(', ')}`)

  // 2. Competencies per dimension (with age bands) for competency linkage.
  const { data: comps, error: compErr } = await sb
    .from('competencies')
    .select('id, dimension_id, name, age_band_start, age_band_end, display_order')
    .in('dimension_id', dims.map((d) => d.id))
  if (compErr || !comps || comps.length === 0) {
    console.error('No competencies:', compErr?.message)
    process.exit(1)
  }
  const compsByDim = new Map<string, typeof comps>()
  for (const c of comps) {
    const arr = compsByDim.get(c.dimension_id) ?? []
    arr.push(c)
    compsByDim.set(c.dimension_id, arr)
  }
  for (const arr of compsByDim.values()) arr.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  console.log(`Competencies: ${comps.length} across ${compsByDim.size} dimensions`)

  // 3. Observers — two real educators (fallback to admins, then any).
  const { data: edus } = await sb
    .from('profiles')
    .select('id, full_name, role')
    .eq('school_id', SCHOOL_ID)
    .eq('is_active', true)
    .in('role', ['educator', 'admin'])
    .order('role') // 'admin' < 'educator' alphabetically; we just need ≥1
  const observerIds = (edus ?? []).map((e) => e.id)
  if (observerIds.length === 0) {
    console.error('No educator/admin profile to attribute observations to.')
    process.exit(1)
  }
  // Prefer educators; if present use up to two of them, else use what we have.
  const educatorsFirst = [
    ...(edus ?? []).filter((e) => e.role === 'educator'),
    ...(edus ?? []).filter((e) => e.role !== 'educator'),
  ].map((e) => e.id)
  const observers = educatorsFirst.slice(0, 2).length ? educatorsFirst.slice(0, 2) : observerIds.slice(0, 2)
  console.log(`Observers: ${observers.join(', ')}`)

  // 4. Upsert the 10 learners (trigger auto-creates the student_classrooms row).
  const studentRows = LEARNERS.map((l) => ({
    id: l.id,
    school_id: SCHOOL_ID,
    classroom_id: CLASSROOM_ID,
    first_name: l.first,
    last_name: l.last,
    date_of_birth: l.dob,
    grade_level: l.grade,
    pronouns: l.pronouns,
    enrollment_date: '2024-09-01',
    student_status: 'active',
  }))
  const { error: upErr } = await sb.from('students').upsert(studentRows, { onConflict: 'id' })
  if (upErr) {
    console.error('Student upsert failed:', upErr.message)
    process.exit(1)
  }
  console.log(`Upserted ${studentRows.length} learners into Demo Class`)

  // 5. Clear any prior observations for these learners (clean re-seed).
  const learnerIds = LEARNERS.map((l) => l.id)
  const { count: delCount } = await sb
    .from('observations')
    .delete({ count: 'exact' })
    .in('student_id', learnerIds)
  console.log(`Cleared ${delCount ?? 0} prior observations for these learners`)

  // 6. Generate observations.
  const rows: any[] = []
  let obsSeq = 0

  for (const l of LEARNERS) {
    const ceilings = CEILINGS[l.arch]

    for (let mi = 0; mi < MONTHS.length; mi++) {
      const { y, m } = MONTHS[mi]
      const isBaseline = y === BASELINE.y && m === BASELINE.m

      // How many observations this month (5–8). Baseline month covers all 8
      // dimensions so the opening blob is a full Emerging ring.
      const n = isBaseline ? dims.length : 5 + Math.floor(rand(`n:${l.id}:${mi}`) * 4)

      // Which dimensions to assess: rotate so coverage stays even across months.
      let dimIndexes: number[]
      if (isBaseline) {
        dimIndexes = dims.map((_, i) => i)
      } else {
        const offset = (mi * 3 + Math.floor(rand(`off:${l.id}:${mi}`) * 8)) % dims.length
        dimIndexes = Array.from({ length: n }, (_, k) => (offset + k) % dims.length)
      }

      for (const di of dimIndexes) {
        const dim = dims[di]
        const t = elapsed(y, m) / SPAN

        // Raw target rating on the 1–4 scale.
        let raw: number
        if (isBaseline) {
          raw = 1 // everyone starts at Emerging
        } else {
          const ceiling = ceilings[di]
          const p = progress(l.arch, t)
          const trend = 1 + p * (ceiling - 1)
          // Ebb/flow: each dimension wobbles on its own phase + small jitter.
          const phase = rand(`ph:${l.id}:${dim.id}`)
          const wobble = 0.35 * Math.sin(2 * Math.PI * (1.3 * t + phase))
          const jitter = (rand(`j:${l.id}:${dim.id}:${mi}`) - 0.5) * 0.5
          raw = trend + wobble + jitter
        }
        const rating = Math.max(1, Math.min(4, Math.round(raw)))

        // Observation date: a weekday-ish day within the month.
        const day = 5 + Math.floor(rand(`day:${l.id}:${dim.id}:${mi}`) * 20)
        const obsDate = new Date(Date.UTC(y, m, day, 12, 0, 0))
        const age = standardAgeForDate(l.dob, obsDate) ?? 8 // standard for the obs's school year

        // Pick an age-appropriate competency in this dimension (rotate for variety).
        const all = compsByDim.get(dim.id) ?? []
        const inBand = all.filter(
          (c) =>
            (c.age_band_start == null || c.age_band_start <= age) &&
            (c.age_band_end == null || c.age_band_end >= age)
        )
        const pool = inBand.length ? inBand : all
        const comp = pool[Math.floor(rand(`comp:${l.id}:${dim.id}:${mi}`) * pool.length)]

        // Light, realistic notes on ~30% of records.
        let notes: string | null = null
        if (rand(`note:${l.id}:${dim.id}:${mi}`) < 0.3) {
          notes = `${LEVEL_NAME[rating]} — ${comp?.name ?? dim.name}`
        }

        rows.push({
          school_id: SCHOOL_ID,
          student_id: l.id,
          dimension_id: dim.id,
          competency_id: comp?.id ?? null,
          assessed_age: comp ? age : null,
          observer_id: observers[obsSeq % observers.length],
          rating,
          notes,
          observed_at: obsDate.toISOString(),
        })
        obsSeq++
      }
    }
  }

  // ── Current-term assessment round ────────────────────────────
  // The Competency Snapshot only counts observations from the last ~2 months
  // (RECENT_WINDOW_DAYS). Without fresh data the snapshot reads "not recently
  // assessed". This sweep assesses ~90% of each learner's age-appropriate
  // competencies within the last ~6 weeks at their current level, so the
  // snapshot is populated (and ~10% stay "not yet assessed", as intended).
  const RECENT_START = Date.UTC(2026, 4, 10) // May 10, 2026
  const RECENT_END = Date.UTC(2026, 5, 12) //  Jun 12, 2026
  const RECENT_SPAN = RECENT_END - RECENT_START
  let recentCount = 0

  for (const l of LEARNERS) {
    const ceilings = CEILINGS[l.arch]
    const ageNow = standardAgeForDate(l.dob, new Date(RECENT_END)) ?? 8 // current-year standard
    for (let di = 0; di < dims.length; di++) {
      const dim = dims[di]
      const pool = (compsByDim.get(dim.id) ?? []).filter(
        (c) =>
          (c.age_band_start == null || c.age_band_start <= ageNow) &&
          (c.age_band_end == null || c.age_band_end >= ageNow)
      )
      for (const comp of pool) {
        if (rand(`recskip:${l.id}:${comp.id}`) < 0.1) continue // ~10% left unassessed
        const v = ceilings[di] + (rand(`reclvl:${l.id}:${comp.id}`) - 0.5) * 1.2 // ±0.6
        const rating = Math.max(1, Math.min(4, Math.round(v)))
        const when = new Date(RECENT_START + rand(`recday:${l.id}:${comp.id}`) * RECENT_SPAN)
        rows.push({
          school_id: SCHOOL_ID,
          student_id: l.id,
          dimension_id: dim.id,
          competency_id: comp.id,
          assessed_age: ageNow,
          observer_id: observers[obsSeq % observers.length],
          rating,
          notes: null,
          observed_at: when.toISOString(),
        })
        obsSeq++
        recentCount++
      }
    }
  }
  console.log(`Added ${recentCount} current-term (last ~6 weeks) assessments across ${LEARNERS.length} learners`)

  console.log(`\nGenerated ${rows.length} observations (~${Math.round(rows.length / LEARNERS.length)}/learner). Inserting…`)
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await sb.from('observations').insert(batch)
    if (error) {
      console.error(`Batch @${i} failed:`, error.message)
      for (const r of batch) {
        const { error: e } = await sb.from('observations').insert(r)
        if (e) {
          console.error('  Bad row:', JSON.stringify(r), e.message)
          process.exit(1)
        }
      }
    } else {
      process.stdout.write(`  …${Math.min(i + batch.length, rows.length)}/${rows.length}\n`)
    }
  }

  // 7. Preview: first learner's Think Deeply raw monthly average over time.
  console.log('\n── Raw growth preview (Mateo · Think Deeply, every ~4 months) ──')
  const mateo = LEARNERS[0]
  const td = dims[0]
  for (let mi = 0; mi < MONTHS.length; mi += 4) {
    const { y, m } = MONTHS[mi]
    const monthRows = rows.filter(
      (r) => r.student_id === mateo.id && r.dimension_id === td.id && r.observed_at.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)
    )
    const avg = monthRows.length ? monthRows.reduce((s, r) => s + r.rating, 0) / monthRows.length : null
    const label = new Date(Date.UTC(y, m, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric' })
    console.log(`  ${label}: ${avg == null ? '(carry-forward)' : avg.toFixed(2)}`)
  }

  console.log('\n✅ Done. Open a Demo Class learner profile to see the amoeba timeline.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

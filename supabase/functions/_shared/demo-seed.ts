/**
 * demo-seed.ts — runtime-agnostic demo-class seeder.
 *
 * Used by BOTH the `seed-school-demo` edge function (Deno) and the
 * `scripts/seed-school-demo.ts` CLI (Node/tsx). It takes an already-built
 * Supabase client (service role) + the parsed Boundless framework JSON and
 * makes a school look like Boundless's "Demo Class":
 *
 *   1. Reconcile the school's 8 dimensions to the Boundless identity and seed
 *      the 73 age-banded competencies (ported from scripts/seed-boundless-framework.ts).
 *   2. Ensure a "Demo" classroom.
 *   3. Ensure a silent "Demo Educator" auth user + profile (the observer).
 *   4. Upsert 10 fictional learners — aged to fit the Demo class's age band
 *      (deterministic per-school ids).
 *   5. Regenerate ~2 school years of monthly observations that grow smoothly
 *      from Emerging toward each archetype's ceiling (active month-to-month
 *      movement). The visualization's ×0.75 September rescale turns each new
 *      school year into a clear step-down, so the amoeba visibly shrinks
 *      scrubbing back across September (~2-pt span over the two years).
 *      90% of each learner's age-appropriate competencies assessed 3×/month.
 *
 * No supabase-js / Node / Deno imports — the client is injected, so the same
 * code runs in both runtimes. Idempotent: safe to re-run.
 */

// ── Injected client shape (only the bits we use) ──────────────────
// Loosely typed so we don't depend on @supabase/supabase-js types across runtimes.
type SB = any

export interface FwComp {
  name: string
  age_band_start: number | null
  age_band_end: number | null
  step_descriptors: Record<string, string>
}
export interface FwStd {
  name: string
  competencies: FwComp[]
}
export interface FwDim {
  name: string
  strand: string
  learner_profile: string
  area_of_development: string
  standards: FwStd[]
}
export interface Framework {
  dimensions: FwDim[]
}

export interface SeedOpts {
  /** Fraction of age-appropriate competencies assessed each month (default 0.9). */
  coverage?: number
  /** Observations per assessed competency per month (default 3). */
  perCompPerMonth?: number
  /** Progress logger (default no-op). */
  log?: (msg: string) => void
}

export interface SeedResult {
  dimensions: number
  competencies: number
  classroomId: string
  educatorId: string
  students: number
  observations: number
}

// ── Boundless dimension identity (matches seed-boundless-framework.ts) ──
// Keywords locate an EXISTING (legacy-named) dimension to become each Boundless
// dimension. Schools created after migration 099 already carry the Boundless
// names, so the exact-name match below wins first and these never fire.
const MATCHERS: Record<string, RegExp[]> = {
  'Think Deeply': [/scien/i],
  'Create Boldly': [/creativ/i],
  'Reason & Solve': [/math/i],
  'Communicate with Impact': [/literac/i, /languag/i],
  'Know Yourself': [/inner self/i, /emotion/i, /know yourself/i],
  'Keep Growing': [/physical/i],
  'Connect Across Difference': [/collaborat/i, /relational/i, /connect/i],
  'Navigate the World': [/global/i, /citizen/i, /navigate/i],
}
const ICONS: Record<string, string> = {
  'Think Deeply': 'microscope',
  'Create Boldly': 'palette',
  'Reason & Solve': 'calculator',
  'Communicate with Impact': 'book-open',
  'Know Yourself': 'heart',
  'Keep Growing': 'activity',
  'Connect Across Difference': 'users',
  'Navigate the World': 'globe',
}
const norm = (s: string) => (s || '').trim().toLowerCase()
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const compCode = (dimName: string, subName: string) => `BL.${slug(dimName)}.${slug(subName)}`

// ── Learners (10) — archetypes drive per-dimension shape ──────────
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
  first: string
  last: string
  pronouns: string
  arch: Arch
}

// Names + archetypes only. Ages (DOB + grade) are derived from the Demo
// classroom's age band at seed time (see learnerDob), so the cohort always
// matches the class it lives in.
const LEARNERS: Learner[] = [
  { first: 'Mateo', last: 'Reyes', pronouns: 'he/him', arch: 'highAcademic' },
  { first: 'Amara', last: 'Okafor', pronouns: 'she/her', arch: 'strongAllRounder' },
  { first: 'Sofia', last: 'Marchetti', pronouns: 'she/her', arch: 'creativeSpike' },
  { first: 'Kai', last: 'Nakamura', pronouns: 'he/him', arch: 'academicStrongSocialLow' },
  { first: 'Noor', last: 'Haddad', pronouns: 'she/her', arch: 'solidMid' },
  { first: 'Liam', last: 'Gallagher', pronouns: 'he/him', arch: 'strugglerGrowing' },
  { first: 'Yuki', last: 'Tanaka', pronouns: 'they/them', arch: 'oneStruggle' },
  { first: 'Elena', last: 'Volkova', pronouns: 'she/her', arch: 'lateBloomer' },
  { first: 'Omar', last: 'Hassan', pronouns: 'he/him', arch: 'developing' },
  { first: 'Priya', last: 'Sharma', pronouns: 'she/her', arch: 'highSocial' },
]

// Default age band for an auto-created Demo class (when the school has no
// pre-set range). Covers the full competency set; learners spread across it.
const DEFAULT_AGE_MIN = 8
const DEFAULT_AGE_MAX = 11

// Latest school-year start in the seed window (Sep 2025). Ages are anchored
// here so the CURRENT roster sits squarely in the class band.
const CURRENT_SY = 2025

/**
 * DOB + grade for learner `i`, derived from the class age band. Each learner's
 * CURRENT-year standard age is spread across [ageMin, ageMax], so the roster
 * reads in-band today; a year earlier they were one younger (still sensible).
 * Birth months Jul–Nov keep both the Dec-1 standard age AND the present-day real
 * age equal to that target (birthday already passed by Dec 1, not yet by June).
 */
function learnerDob(i: number, ageMin: number, ageMax: number): { dob: string; grade: string } {
  const span = Math.max(0, ageMax - ageMin)
  const curAge = ageMin + (span === 0 ? 0 : i % (span + 1)) // current standard age, in-band
  const birthYear = CURRENT_SY - curAge // age `curAge` on Dec 1 2025
  const month = 7 + (i % 5) // 7..11 (Jul–Nov)
  const day = 4 + ((i * 7) % 22) // 4..25
  const dob = `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { dob, grade: String(Math.max(1, curAge - 5)) } // US: age 12 ≈ grade 7
}

// Per-archetype "flavor" for each dimension by display_order:
//   0 Think Deeply · 1 Create Boldly · 2 Reason & Solve · 3 Communicate ·
//   4 Know Yourself · 5 Keep Growing · 6 Connect Across Difference · 7 Navigate
// Higher value → that dimension reaches a higher year-2 raw ceiling (1.8–4.0).
const CEILINGS: Record<Arch, number[]> = {
  highAcademic: [4.0, 3.7, 4.0, 3.9, 3.6, 3.7, 3.5, 3.6],
  highSocial: [3.5, 3.4, 3.3, 3.7, 4.0, 3.9, 4.0, 3.8],
  strongAllRounder: [3.6, 3.5, 3.7, 3.8, 3.6, 3.5, 3.7, 3.6],
  creativeSpike: [2.9, 4.0, 2.7, 3.1, 3.2, 2.8, 3.3, 2.9],
  academicStrongSocialLow: [3.8, 3.6, 3.9, 3.7, 2.4, 2.6, 2.3, 2.7],
  solidMid: [3.0, 2.9, 3.1, 3.0, 3.2, 2.8, 3.0, 2.9],
  developing: [2.5, 2.4, 2.6, 2.5, 2.7, 2.3, 2.6, 2.4],
  oneStruggle: [3.0, 2.8, 1.8, 3.1, 2.9, 3.0, 3.0, 2.7],
  lateBloomer: [3.3, 3.2, 3.4, 3.1, 3.0, 3.2, 3.1, 3.3],
  strugglerGrowing: [2.2, 2.4, 1.9, 2.0, 2.5, 2.3, 2.6, 2.1],
}

// ── Time span: Sep 2024 → Jun 2026 (summer Jul/Aug 2025 skipped) ──
const MONTHS: { y: number; m: number }[] = []
for (const [y, mStart, mEnd] of [
  [2024, 8, 11], // Sep–Dec 2024
  [2025, 0, 5], //  Jan–Jun 2025
  [2025, 8, 11], // Sep–Dec 2025
  [2026, 0, 5], //  Jan–Jun 2026
] as const) {
  for (let m = mStart; m <= mEnd; m++) MONTHS.push({ y, m })
}
const BASELINE = { y: 2024, m: 8 }
const elapsed = (y: number, m: number) => y * 12 + m - (BASELINE.y * 12 + BASELINE.m)
const SPAN = elapsed(2026, 5) // 21 — full span Sep 2024 → Jun 2026

// ── Deterministic helpers (FNV-1a + xorshift) so re-runs are identical ──
function fnv(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}
function rand(seed: string): number {
  return (fnv(seed) % 100000) / 100000
}
/** Deterministic, valid v4-shaped UUID from a seed string (unique per school+index). */
function deterministicUuid(seed: string): string {
  let x = fnv(seed) || 0x12345678
  const b: number[] = []
  for (let i = 0; i < 16; i++) {
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    b.push(x & 0xff)
  }
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant
  const h = b.map((n) => n.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
}

// ── Inlined standard-age (Dec-1 rule) — mirrors src/lib/age-utils.ts ──
function ageOnDate(dob: string, at: Date): number {
  const birth = new Date(dob + 'T00:00:00')
  let age = at.getFullYear() - birth.getFullYear()
  const md = at.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && at.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}
function standardAgeForDate(dob: string, date: Date): number {
  const schoolYearStart = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  return ageOnDate(dob, new Date(schoolYearStart, 11, 1))
}

// ── Growth curve: continuous month-to-month movement across both years ──
// Per-archetype progress shape over the full span. Raw grows smoothly from
// Emerging (1) toward the archetype ceiling, so the amoeba visibly morphs every
// month. The visualization's ×0.75 September rescale then turns each new school
// year into a clear step-down (the "shrink scrubbing back across September"),
// while the overall 2-year displayed span is ~2 pts.
function progress(arch: Arch, t: number): number {
  if (arch === 'lateBloomer') return Math.pow(t, 1.9) // slow start, accelerates
  if (arch === 'solidMid' || arch === 'developing') return 1 - Math.pow(1 - t, 1.3) // gentle
  return 1 - Math.pow(1 - t, 1.6) // ease-out: quick early gains, tapering
}
function rawTarget(arch: Arch, di: number, el: number): number {
  const ceiling = CEILINGS[arch][di] // 1.8 – 4.0
  const p = progress(arch, el / SPAN)
  return 1 + p * (ceiling - 1)
}

const LEVEL_NAME = ['', 'Emerging', 'Developing', 'Achieving', 'Mastery']

// ══════════════════════════════════════════════════════════════════
export async function seedSchoolDemo(
  client: SB,
  schoolId: string,
  framework: Framework,
  opts: SeedOpts = {}
): Promise<SeedResult> {
  const coverage = opts.coverage ?? 0.9
  const perComp = opts.perCompPerMonth ?? 3
  const log = opts.log ?? (() => {})

  // Demo learner ids are deterministic per school. Clear their prior
  // observations FIRST so the competency replace below never has to churn
  // (SET NULL) references we're about to drop anyway — keeps re-runs clean.
  const learnerIds = LEARNERS.map((_, i) => deterministicUuid(`${schoolId}:learner:${i}`))
  await client.from('observations').delete().in('student_id', learnerIds)

  // ── 1. Reconcile dimensions → Boundless identity ────────────────
  const { data: existing0 } = await client
    .from('dimensions')
    .select('id, name, display_order, is_active')
    .eq('school_id', schoolId)
  const existing: any[] = existing0 ?? []
  const used = new Set<string>()
  const dimIdByName: Record<string, string> = {}

  for (let i = 0; i < framework.dimensions.length; i++) {
    const bDim = framework.dimensions[i]
    let match =
      existing.find((d) => !used.has(d.id) && norm(d.name) === norm(bDim.name)) ||
      existing.find((d) => !used.has(d.id) && norm(d.name) === norm(bDim.area_of_development))
    if (!match) {
      for (const rx of MATCHERS[bDim.name] ?? []) {
        match = existing.find((d) => !used.has(d.id) && rx.test(d.name))
        if (match) break
      }
    }
    const common = {
      name: bDim.name,
      strand: bDim.strand,
      learner_profile: bDim.learner_profile,
      area_of_development: bDim.area_of_development,
      category: bDim.strand,
      icon: ICONS[bDim.name] ?? null,
      display_order: i,
      is_active: true,
    }
    if (match) {
      used.add(match.id)
      await client.from('dimensions').update(common).eq('id', match.id)
      dimIdByName[bDim.name] = match.id
    } else {
      const { data: created } = await client
        .from('dimensions')
        .insert({ school_id: schoolId, ...common, visible_to_family: true })
        .select('id')
        .single()
      dimIdByName[bDim.name] = created!.id
    }
  }
  log(`Reconciled ${framework.dimensions.length} dimensions`)

  // ── 2. Competencies — replace Boundless-seeded, insert the 73 ───
  await client.from('competencies').delete().eq('school_id', schoolId).like('code', 'BL.%')
  const compRows: any[] = []
  for (const bDim of framework.dimensions) {
    let order = 0
    for (const std of bDim.standards) {
      for (const c of std.competencies) {
        compRows.push({
          school_id: schoolId,
          dimension_id: dimIdByName[bDim.name],
          standard_label: std.name,
          name: c.name,
          code: compCode(bDim.name, c.name),
          step_descriptors: c.step_descriptors,
          age_band_start: c.age_band_start,
          age_band_end: c.age_band_end,
          display_order: order++,
        })
      }
    }
  }
  for (let i = 0; i < compRows.length; i += 100) {
    const { error } = await client.from('competencies').insert(compRows.slice(i, i + 100))
    if (error) throw new Error(`competency insert failed: ${error.message}`)
  }
  log(`Seeded ${compRows.length} competencies`)

  // Re-read competencies with ids + age bands, grouped by dimension.
  const dims = framework.dimensions.map((d) => ({ id: dimIdByName[d.name], name: d.name }))
  const { data: comps } = await client
    .from('competencies')
    .select('id, dimension_id, age_band_start, age_band_end, display_order, name, code')
    .eq('school_id', schoolId)
    .like('code', 'BL.%')
  const compsByDim = new Map<string, any[]>()
  for (const c of comps ?? []) {
    const arr = compsByDim.get(c.dimension_id) ?? []
    arr.push(c)
    compsByDim.set(c.dimension_id, arr)
  }
  for (const arr of compsByDim.values()) arr.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  // ── 3. Demo classroom (+ its age band — learners are aged to fit it) ──
  let { data: room } = await client
    .from('classrooms')
    .select('id, age_min, age_max')
    .eq('school_id', schoolId)
    .eq('name', 'Demo')
    .maybeSingle()
  if (!room) {
    const { data: created, error } = await client
      .from('classrooms')
      .insert({ school_id: schoolId, name: 'Demo', age_min: DEFAULT_AGE_MIN, age_max: DEFAULT_AGE_MAX })
      .select('id, age_min, age_max')
      .single()
    if (error) throw new Error(`classroom create failed: ${error.message}`)
    room = created
  }
  const classroomId = room!.id as string
  const ageMin = room!.age_min ?? DEFAULT_AGE_MIN
  const ageMax = room!.age_max ?? DEFAULT_AGE_MAX
  // DOB + grade per learner, aged to fit the class band (shared by the student
  // rows and the observation generator so assessed_age stays consistent).
  const meta = LEARNERS.map((_, i) => learnerDob(i, ageMin, ageMax))
  log(`Demo classroom ${classroomId} (ages ${ageMin}–${ageMax})`)

  // ── 4. Demo educator (silent auth user + profile) — the observer ─
  const educatorEmail = `demo-educator-${schoolId}@demo.invalid`
  let educatorId: string | null = null
  const { data: existingProfile } = await client
    .from('profiles')
    .select('id')
    .eq('email', educatorEmail)
    .maybeSingle()
  if (existingProfile) {
    educatorId = existingProfile.id
  } else {
    const password = deterministicUuid(`pw:${schoolId}`) + 'Aa1!'
    const { data: createdUser, error: cuErr } = await client.auth.admin.createUser({
      email: educatorEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Educator', role: 'educator', school_id: schoolId },
    })
    if (cuErr || !createdUser?.user) throw new Error(`demo educator create failed: ${cuErr?.message}`)
    educatorId = createdUser.user.id
    await client.from('profiles').upsert(
      {
        id: educatorId,
        school_id: schoolId,
        role: 'educator',
        full_name: 'Demo Educator',
        email: educatorEmail,
        avatar_url: null,
      },
      { onConflict: 'id' }
    )
  }
  log(`Demo educator ${educatorId}`)

  // ── 5. Learners (deterministic per-school ids; ids computed above) ──
  const studentRows = LEARNERS.map((l, i) => ({
    id: learnerIds[i],
    school_id: schoolId,
    classroom_id: classroomId,
    first_name: l.first,
    last_name: l.last,
    date_of_birth: meta[i].dob,
    grade_level: meta[i].grade,
    pronouns: l.pronouns,
    enrollment_date: '2024-09-01',
    student_status: 'active',
  }))
  const { error: upErr } = await client.from('students').upsert(studentRows, { onConflict: 'id' })
  if (upErr) throw new Error(`student upsert failed: ${upErr.message}`)

  // ── 6. Observations — 90% of age-appropriate comps, 3×/month ────
  const rows: any[] = []
  for (let li = 0; li < LEARNERS.length; li++) {
    const l = LEARNERS[li]
    const sid = learnerIds[li]
    for (let mi = 0; mi < MONTHS.length; mi++) {
      const { y, m } = MONTHS[mi]
      const el = elapsed(y, m)
      for (let di = 0; di < dims.length; di++) {
        const dim = dims[di]
        const target = rawTarget(l.arch, di, el)
        const ageStd = standardAgeForDate(meta[li].dob, new Date(Date.UTC(y, m, 15)))
        const pool = (compsByDim.get(dim.id) ?? []).filter(
          (c) =>
            (c.age_band_start == null || c.age_band_start <= ageStd) &&
            (c.age_band_end == null || c.age_band_end >= ageStd)
        )
        for (const comp of pool) {
          // Stable per-competency key (code is deterministic; ids churn on re-seed)
          // → which 10% are skipped, the jitter, and the days are run-invariant.
          const k = comp.code ?? comp.id
          // ~10% of competencies left unassessed each month (rotates by month).
          if (rand(`skip:${sid}:${k}:${mi}`) >= coverage) continue
          for (let occ = 0; occ < perComp; occ++) {
            const wobble = 0.3 * Math.sin(2 * Math.PI * (1.3 * (el / 21) + rand(`ph:${sid}:${dim.id}`)))
            const jitter = (rand(`j:${sid}:${k}:${mi}:${occ}`) - 0.5) * 0.9
            const rating = Math.max(1, Math.min(4, Math.round(target + wobble + jitter)))
            const day = 3 + occ * 8 + Math.floor(rand(`day:${sid}:${k}:${mi}:${occ}`) * 6)
            const when = new Date(Date.UTC(y, m, Math.min(day, 27), 12, 0, 0))
            const notes =
              rand(`note:${sid}:${k}:${mi}:${occ}`) < 0.12
                ? `${LEVEL_NAME[rating]} — ${comp.name}`
                : null
            rows.push({
              school_id: schoolId,
              student_id: sid,
              dimension_id: dim.id,
              competency_id: comp.id,
              assessed_age: ageStd,
              observer_id: educatorId,
              rating,
              notes,
              observed_at: when.toISOString(),
            })
          }
        }
      }
    }
  }

  log(`Generated ${rows.length} observations (~${Math.round(rows.length / LEARNERS.length)}/learner). Inserting…`)
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await client.from('observations').insert(rows.slice(i, i + 1000))
    if (error) throw new Error(`observation insert @${i} failed: ${error.message}`)
    log(`  …${Math.min(i + 1000, rows.length)}/${rows.length}`)
  }

  return {
    dimensions: framework.dimensions.length,
    competencies: compRows.length,
    classroomId,
    educatorId: educatorId!,
    students: studentRows.length,
    observations: rows.length,
  }
}

/**
 * seed-multiyear-observations.ts
 *
 * Seeds 2+ years of realistic observation data for a specific student
 * to demonstrate the grade transition squeeze animation.
 *
 * Run: npx tsx scripts/seed-multiyear-observations.ts
 *
 * Creates monthly observations from Mar 2024 through Apr 2026 for
 * student Gia Chen (f1ae80a0-3d64-442b-9354-a54402b072a7).
 *
 * Growth pattern per school year:
 *   Grade 1 (Mar-Aug 2024): start Emerging, grow to Achieving by Aug
 *   Grade 2 (Sep 2024-Aug 2025): start Emerging (new rubric), grow to Developing/Achieving
 *   Grade 3 (Sep 2025-Apr 2026): start Emerging, grow to Developing
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

const STUDENT_ID = 'f1ae80a0-3d64-442b-9354-a54402b072a7'

// ── Main ───────────────────────────────────────────────────────

async function main() {
  // 1. Fetch student info
  const { data: student, error: stuErr } = await sb
    .from('students')
    .select('id, first_name, last_name, school_id, grade_level')
    .eq('id', STUDENT_ID)
    .single()

  if (stuErr || !student) {
    console.error('Student not found:', stuErr?.message)
    process.exit(1)
  }

  console.log(`\nStudent: ${student.first_name} ${student.last_name} (Grade ${student.grade_level})`)
  console.log(`School: ${student.school_id}`)

  // 2. Fetch dimensions for this school
  const { data: dims } = await sb
    .from('dimensions')
    .select('id, name, display_order')
    .eq('school_id', student.school_id)
    .eq('is_active', true)
    .order('display_order')

  if (!dims || dims.length === 0) {
    console.error('No dimensions found')
    process.exit(1)
  }

  console.log(`Dimensions (${dims.length}):`, dims.map(d => d.name).join(', '))

  // 3. Find an observer (educator) for this school
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, role')
    .eq('school_id', student.school_id)
    .in('role', ['educator', 'admin'])
    .limit(1)

  const observerId = profiles?.[0]?.id
  if (!observerId) {
    console.error('No educator found for this school')
    process.exit(1)
  }

  console.log(`Observer: ${observerId}`)

  // 4. Delete existing observations for this student
  const { error: delErr, count } = await sb
    .from('observations')
    .delete({ count: 'exact' })
    .eq('student_id', STUDENT_ID)

  console.log(`\nDeleted ${count ?? 0} existing observations`)

  // 5. Delete existing interest surveys for this student
  const { count: surveyCount } = await sb
    .from('interest_surveys')
    .delete({ count: 'exact' })
    .eq('student_id', STUDENT_ID)

  console.log(`Deleted ${surveyCount ?? 0} existing interest surveys`)

  // 6. Generate multi-year observations
  //
  // Growth pattern: each school year the student starts at Emerging
  // and grows. Different dimensions grow at different rates to make
  // the amoeba shape interesting.
  //
  // Per-dimension growth profiles (how fast they progress each year):
  const growthProfiles: Record<string, { base: number; rate: number }[]> = {}
  dims.forEach((dim, i) => {
    // Each dimension gets a unique growth trajectory per year
    // "base" is the starting score in September, "rate" is monthly growth
    const profiles = [
      // Grade 1 (Mar-Aug 2024): 6 months
      { base: 0.8 + (i * 0.15) % 0.6, rate: 0.25 + (i * 0.05) % 0.15 },
      // Grade 2 (Sep 2024-Aug 2025): 12 months
      { base: 0.7 + (i * 0.1) % 0.5, rate: 0.15 + (i * 0.03) % 0.1 },
      // Grade 3 (Sep 2025-Apr 2026): 8 months
      { base: 0.6 + (i * 0.12) % 0.4, rate: 0.12 + (i * 0.04) % 0.08 },
    ]
    growthProfiles[dim.id] = profiles
  })

  // School year boundaries
  const years = [
    { start: new Date('2024-03-01'), end: new Date('2024-08-31'), yearIdx: 0 },
    { start: new Date('2024-09-01'), end: new Date('2025-08-31'), yearIdx: 1 },
    { start: new Date('2025-09-01'), end: new Date('2026-04-30'), yearIdx: 2 },
  ]

  const observations: any[] = []
  const surveys: any[] = []

  for (const year of years) {
    const cursor = new Date(year.start)
    let monthsInYear = 0

    while (cursor <= year.end) {
      const obsDate = new Date(cursor.getFullYear(), cursor.getMonth(), 15, 12, 0, 0)

      // Create one observation per dimension per month
      for (const dim of dims) {
        const profile = growthProfiles[dim.id][year.yearIdx]
        // Score grows over months, capped at 4
        const rawScore = profile.base + profile.rate * monthsInYear
        const score = Math.min(4, Math.max(1, Math.round(rawScore * 2) / 2)) // round to nearest 0.5

        observations.push({
          student_id: STUDENT_ID,
          dimension_id: dim.id,
          observer_id: observerId,
          rating: score,
          observed_at: obsDate.toISOString(),
          notes: `Monthly assessment - ${dim.name}`,
          school_id: student.school_id,
        })
      }

      // Create an interest survey every 2-3 months
      if (monthsInYear % 2 === 0) {
        const responses: Record<string, number> = {}
        dims.forEach((dim, i) => {
          // Interest varies — some dimensions have high interest, some low
          const baseInterest = 2 + Math.sin(i * 1.5 + year.yearIdx) * 1.5
          const jitter = (monthsInYear * 0.1) * Math.cos(i + year.yearIdx)
          responses[dim.id] = Math.min(5, Math.max(1, Math.round((baseInterest + jitter) * 2) / 2))
        })

        surveys.push({
          student_id: STUDENT_ID,
          submitted_at: obsDate.toISOString(),
          responses,
          school_id: student.school_id,
        })
      }

      cursor.setMonth(cursor.getMonth() + 1)
      monthsInYear++
    }
  }

  console.log(`\nInserting ${observations.length} observations...`)

  // Insert in batches of 100
  for (let i = 0; i < observations.length; i += 100) {
    const batch = observations.slice(i, i + 100)
    const { error } = await sb.from('observations').insert(batch)
    if (error) {
      console.error(`Error inserting observations batch ${i}:`, error.message)
      // Try one by one to find the problematic row
      for (const obs of batch) {
        const { error: singleErr } = await sb.from('observations').insert(obs)
        if (singleErr) {
          console.error('  Failed row:', obs.dimension_id, obs.observed_at, singleErr.message)
        }
      }
    }
  }

  console.log(`Inserting ${surveys.length} interest surveys...`)
  for (const survey of surveys) {
    const { error } = await sb.from('interest_surveys').insert(survey)
    if (error) console.error('Survey error:', error.message)
  }

  // Summary: show what scores look like at key months
  console.log('\n── Score Summary (first dimension) ──')
  const firstDim = dims[0]
  const profile = growthProfiles[firstDim.id]
  for (const year of years) {
    const cursor = new Date(year.start)
    let m = 0
    while (cursor <= year.end) {
      const p = profile[year.yearIdx]
      const raw = p.base + p.rate * m
      const score = Math.min(4, Math.max(1, Math.round(raw * 2) / 2))
      const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const grade = year.yearIdx + 1
      console.log(`  ${label} (Grade ${grade}): ${firstDim.name} = ${score}`)
      cursor.setMonth(cursor.getMonth() + 1)
      m++
    }
  }

  console.log('\n✅ Done! Reload the student profile to see the multi-year timeline.')
}

main().catch(console.error)

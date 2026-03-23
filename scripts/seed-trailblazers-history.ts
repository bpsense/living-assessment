/**
 * seed-trailblazers-history.ts
 *
 * Enriches Trailblazers students (ages 12-15) with 3-4 years of
 * competency history and monthly interest surveys that drive growth.
 *
 * Run with: npx tsx scripts/seed-trailblazers-history.ts
 *
 * This script:
 * 1. Finds all Trailblazers students and gives them 3-4 year enrollment history
 * 2. Creates historical classroom records (Navigators → Pathfinders → Trailblazers)
 * 3. Deletes existing observations for these students and regenerates 3-4 years' worth
 * 4. Generates monthly interest surveys with evolving interests
 * 5. Correlates interest with competency:
 *    - High interest + low competency → faster growth (Growth Zone)
 *    - Low interest + high competency → stagnation or regression (Cruise Zone)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// Bootstrap
// ============================================================

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(__filename2)

function loadEnv() {
  const candidates = [
    resolve(__dirname2, '..', '.env.local'),
    resolve(process.cwd(), '.env.local'),
  ]
  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, 'utf-8')
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        const key = trimmed.slice(0, eq)
        const val = trimmed.slice(eq + 1)
        if (!process.env[key]) process.env[key] = val
      }
      return
    } catch {}
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing env vars.')
  process.exit(1)
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SCHOOL_NAME = 'Demo School 123'
const NOW = new Date('2026-03-15T12:00:00Z')

// ============================================================
// Helpers
// ============================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

// ============================================================
// Assessment levels
// ============================================================

const LEVELS = ['emerging', 'developing', 'achieving', 'exceeding'] as const
type Level = (typeof LEVELS)[number]

const LEVEL_TO_RATING: Record<Level, number> = {
  emerging: 1,
  developing: 2,
  achieving: 3,
  exceeding: 4,
}

// ============================================================
// Student personality profiles — each student gets a unique
// interest/competency story
// ============================================================

interface StudentProfile {
  /** Display name for logging */
  name: string
  /** Per-dimension interest trajectory: start value (1-5) and growth rate per year */
  interestCurves: { start: number; yearlyDelta: number; noise: number }[]
  /** Per-dimension competency speed multiplier (1 = normal) */
  competencyMultiplier: number[]
  /** Overall archetype label */
  archetype: string
}

/**
 * Generate a unique interest/competency profile for a student.
 * Creates the interest → competency correlation:
 *  - 2-3 "passion" dimensions: high interest that grows, faster competency
 *  - 1-2 "disengaged" dimensions: low/falling interest, stagnating competency
 *  - Rest: moderate interest, normal growth
 */
function generateStudentProfile(
  studentName: string,
  dimCount: number,
  studentIdx: number
): StudentProfile {
  const archetypes = [
    'Science-obsessed maker',
    'Bookworm & writer',
    'Social leader & organizer',
    'Athletic & outdoorsy',
    'Creative artist',
    'Math & logic nerd',
    'Global thinker',
    'All-rounder',
    'Late bloomer finding passions',
    'Passionate but scattered',
  ]

  const archetype = archetypes[studentIdx % archetypes.length]
  const interestCurves: { start: number; yearlyDelta: number; noise: number }[] = []
  const competencyMultiplier: number[] = []

  // Pick 2-3 passion dimensions and 1-2 disengaged ones
  const indices = Array.from({ length: dimCount }, (_, i) => i)
  const passionCount = 2 + (studentIdx % 2) // 2 or 3
  const disengagedCount = 1 + (studentIdx % 2) // 1 or 2

  // Rotate which dimensions are passionate based on student index
  const shuffled = [...indices].sort(() => Math.sin(studentIdx * 7 + indices.length) - 0.5)
  const passionDims = new Set(shuffled.slice(0, passionCount))
  const disengagedDims = new Set(shuffled.slice(passionCount, passionCount + disengagedCount))

  for (let i = 0; i < dimCount; i++) {
    if (passionDims.has(i)) {
      // Passion: starts moderate-high, grows, fast competency
      interestCurves.push({
        start: 3.0 + Math.random() * 1.5, // 3.0 - 4.5
        yearlyDelta: 0.3 + Math.random() * 0.4, // grows 0.3-0.7 per year
        noise: 0.3,
      })
      competencyMultiplier.push(1.4 + Math.random() * 0.4) // 1.4-1.8x speed
    } else if (disengagedDims.has(i)) {
      // Disengaged: starts low or drops, slow/regressing competency
      interestCurves.push({
        start: 1.5 + Math.random() * 1.0, // 1.5 - 2.5
        yearlyDelta: -0.2 - Math.random() * 0.3, // drops 0.2-0.5 per year
        noise: 0.4,
      })
      competencyMultiplier.push(0.4 + Math.random() * 0.3) // 0.4-0.7x speed
    } else {
      // Moderate: normal interest and growth
      interestCurves.push({
        start: 2.5 + Math.random() * 1.0, // 2.5 - 3.5
        yearlyDelta: 0.1 * (Math.random() - 0.3), // slight drift
        noise: 0.5,
      })
      competencyMultiplier.push(0.8 + Math.random() * 0.4) // 0.8-1.2x speed
    }
  }

  return { name: studentName, interestCurves, competencyMultiplier, archetype }
}

/**
 * Calculate interest score at a given month offset from enrollment.
 * Returns value clamped to 1-5.
 */
function interestAtMonth(
  curve: { start: number; yearlyDelta: number; noise: number },
  monthOffset: number
): number {
  const years = monthOffset / 12
  const base = curve.start + curve.yearlyDelta * years
  const noise = (Math.random() - 0.5) * curve.noise
  return clamp(Math.round((base + noise) * 2) / 2, 1, 5) // round to 0.5 increments, clamp 1-5
}

/**
 * Progress competency level with interest-driven modifiers.
 * High interest → faster advancement.
 * Low interest → stagnation or regression.
 */
function progressWithInterest(
  current: Level,
  monthsAtLevel: number,
  compMultiplier: number,
  interestScore: number // 1-5
): Level {
  const idx = LEVELS.indexOf(current)

  // Interest-driven regression:
  // Low interest (1-2) on a high competency → 8-12% regression chance
  if (interestScore <= 2 && idx >= 2) {
    const regChance = 0.04 + (3 - interestScore) * 0.04 // 8% at 1, 4% at 2
    if (Math.random() < regChance) {
      return LEVELS[idx - 1]
    }
  }

  // Normal regression (smaller chance)
  if (Math.random() < 0.03 && idx > 0) {
    return LEVELS[idx - 1]
  }

  if (idx >= 3) return current // already exceeding

  // Base advance chance
  let advanceChance = 0.18

  // Competency multiplier from archetype
  advanceChance *= compMultiplier

  // Interest boost: high interest accelerates, low interest decelerates
  if (interestScore >= 4) advanceChance *= 1.5
  else if (interestScore >= 3) advanceChance *= 1.1
  else if (interestScore <= 2) advanceChance *= 0.5
  else if (interestScore <= 1) advanceChance *= 0.2

  // Time factor — stuck at a level? slight boost
  if (monthsAtLevel > 6) advanceChance += 0.04
  if (monthsAtLevel > 12) advanceChance += 0.04

  if (Math.random() < advanceChance) {
    return LEVELS[idx + 1]
  }

  return current
}

// ============================================================
// Age-band skill transitions: as students age, they move into
// new skill ranges (the "expanding canvas")
// ============================================================

interface DimSkillSet {
  dimensionId: string
  dimensionIdx: number
  skills: { id: string; name: string; minAge: number; maxAge: number }[]
}

/**
 * Get the skills active for a student at a given age.
 * As the student ages, new age-band skills appear (emerging)
 * and old ones complete.
 */
function activeSkillsAtAge(
  allDimSkills: DimSkillSet[],
  age: number
): Map<string, { id: string; name: string; dimIdx: number }[]> {
  const result = new Map<string, { id: string; name: string; dimIdx: number }[]>()
  for (const ds of allDimSkills) {
    const active = ds.skills
      .filter((s) => age >= s.minAge && age <= s.maxAge + 1) // +1 buffer
      .map((s) => ({ id: s.id, name: s.name, dimIdx: ds.dimensionIdx }))
    result.set(ds.dimensionId, active)
  }
  return result
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🚀 Enriching Trailblazers with deep history & interest surveys...\n')

  // ── Find school ──
  const { data: school } = await sb
    .from('schools')
    .select('id')
    .eq('name', SCHOOL_NAME)
    .single()
  if (!school) { console.error('❌ School not found'); process.exit(1) }
  const schoolId = school.id
  console.log(`✅ School: ${schoolId}`)

  // ── Get dimensions ──
  const { data: dimensions } = await sb
    .from('dimensions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')
  if (!dimensions || dimensions.length === 0) {
    console.error('❌ No dimensions found')
    process.exit(1)
  }
  console.log(`✅ ${dimensions.length} dimensions`)

  // ── Find Trailblazers classroom ──
  const { data: tbClassroom } = await sb
    .from('classrooms')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('name', 'Trailblazers')
    .single()
  if (!tbClassroom) { console.error('❌ Trailblazers classroom not found'); process.exit(1) }

  // ── Find Pathfinders & Navigators for historical records ──
  const { data: allClassrooms } = await sb
    .from('classrooms')
    .select('id, name')
    .eq('school_id', schoolId)
  const classroomByName = new Map((allClassrooms || []).map((c: any) => [c.name, c.id]))

  // ── Get Trailblazers students ──
  const { data: students } = await sb
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .eq('classroom_id', tbClassroom.id)
  if (!students || students.length === 0) {
    console.error('❌ No Trailblazers students found')
    process.exit(1)
  }
  console.log(`✅ ${students.length} Trailblazers students`)

  // ── Get all skills for school ──
  const { data: allSkills } = await sb
    .from('skills')
    .select('id, name, progression_domain, category, min_grade, max_grade')
    .eq('school_id', schoolId)
  if (!allSkills || allSkills.length === 0) {
    console.error('❌ No skills found')
    process.exit(1)
  }

  // Group skills by dimension (via progression_domain matching dimension name)
  const dimNameToId = new Map(dimensions.map((d: any) => [d.name, d.id]))
  const dimSkillSets: DimSkillSet[] = dimensions.map((dim: any, idx: number) => {
    const dimSkills = allSkills
      .filter((s: any) => s.progression_domain === dim.name)
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        minAge: gradeToAge(s.min_grade),
        maxAge: gradeToAge(s.max_grade),
      }))
    return { dimensionId: dim.id, dimensionIdx: idx, skills: dimSkills }
  })

  // ── Get educators for Trailblazers ──
  const { data: edLinks } = await sb
    .from('educator_classrooms')
    .select('educator_id')
    .eq('classroom_id', tbClassroom.id)
  const educatorIds = (edLinks || []).map((e: any) => e.educator_id)
  // Also get Pathfinder/Navigator educators for historical assessments
  const { data: allEdLinks } = await sb
    .from('educator_classrooms')
    .select('educator_id, classroom_id')
    .eq('school_id', schoolId)
  const educatorsByClassroom = new Map<string, string[]>()
  for (const link of allEdLinks || []) {
    const list = educatorsByClassroom.get(link.classroom_id) || []
    list.push(link.educator_id)
    educatorsByClassroom.set(link.classroom_id, list)
  }

  // ── Update enrollment dates to 3-4 years ago ──
  console.log('\n📅 Updating enrollment dates...')
  const enrollmentDates: Date[] = []
  for (let i = 0; i < students.length; i++) {
    // 60% get 3 years, 40% get 4 years
    const yearsBack = i < Math.ceil(students.length * 0.6) ? 3 : 4
    const enrollDate = new Date(NOW)
    enrollDate.setFullYear(enrollDate.getFullYear() - yearsBack)
    // Add some variance (±2 months)
    enrollDate.setMonth(enrollDate.getMonth() + Math.floor(Math.random() * 4) - 2)
    enrollmentDates.push(enrollDate)

    await sb
      .from('students')
      .update({ enrollment_date: enrollDate.toISOString().split('T')[0] })
      .eq('id', students[i].id)
  }
  console.log(`  ✅ Updated enrollment dates (${students.length} students)`)

  // ── Create historical classroom records ──
  console.log('\n🏫 Creating historical classroom records...')
  // Delete existing historical records for these students
  for (const s of students) {
    await sb
      .from('student_classrooms')
      .delete()
      .eq('student_id', s.id)
      .eq('status', 'archived')
  }

  const historicalInserts: any[] = []
  const navigatorsId = classroomByName.get('Navigators')
  const pathfindersId = classroomByName.get('Pathfinders')

  for (let i = 0; i < students.length; i++) {
    const yearsBack = i < Math.ceil(students.length * 0.6) ? 3 : 4

    // All 3+ year students came from Pathfinders
    if (pathfindersId) {
      historicalInserts.push({
        student_id: students[i].id,
        classroom_id: pathfindersId,
        school_id: schoolId,
        is_primary: false,
        status: 'archived',
      })
    }

    // 4-year students also came from Navigators
    if (yearsBack >= 4 && navigatorsId) {
      historicalInserts.push({
        student_id: students[i].id,
        classroom_id: navigatorsId,
        school_id: schoolId,
        is_primary: false,
        status: 'archived',
      })
    }
  }
  if (historicalInserts.length > 0) {
    await sb.from('student_classrooms').insert(historicalInserts)
  }
  console.log(`  ✅ Created ${historicalInserts.length} historical classroom records`)

  // ── Delete existing observations and surveys for these students ──
  console.log('\n🧹 Cleaning existing observations & surveys...')
  const studentIds = students.map((s: any) => s.id)
  for (const sid of studentIds) {
    await sb.from('observations').delete().eq('student_id', sid)
    await sb.from('interest_surveys').delete().eq('student_id', sid)
  }
  console.log('  ✅ Cleaned')

  // ── Generate profiles and history ──
  console.log('\n📊 Generating competency history & interest surveys...')

  const BATCH = 200
  let totalObs = 0
  let totalSurveys = 0

  const observationBuffer: any[] = []
  const surveyBuffer: any[] = []

  const NOTES_POOL = [
    'Significant progress in this area',
    'Showing deep engagement and curiosity',
    'Applying concepts independently',
    'Connecting ideas across subjects',
    'Strong collaboration with peers',
    'Leading discussions confidently',
    'Would benefit from more challenge',
    'Excellent work on recent project',
    'Self-directed learning emerging',
    'Making sophisticated connections',
    null, null, null, null, null, null, null, null, null, null,
  ]

  for (let si = 0; si < students.length; si++) {
    const student = students[si]
    const enrollDate = enrollmentDates[si]
    const totalMonths = monthsBetween(enrollDate, NOW)
    const profile = generateStudentProfile(
      `${student.first_name} ${student.last_name}`,
      dimensions.length,
      si
    )

    console.log(`  🧑‍🎓 ${profile.name} (${profile.archetype}) — ${totalMonths} months of history`)

    // Calculate age at enrollment
    const dob = new Date(student.date_of_birth)
    const ageAtEnrollment = (enrollDate.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

    // Track per-dimension competency state
    const dimLevels: Level[] = dimensions.map(() => 'emerging' as Level)
    const dimMonthsAtLevel: number[] = dimensions.map(() => 0)

    // Track which classroom they're in at each point
    function classroomAtAge(age: number): string {
      if (age < 9) return classroomByName.get('Navigators') || tbClassroom.id
      if (age < 12) return classroomByName.get('Pathfinders') || tbClassroom.id
      return tbClassroom.id
    }

    for (let m = 0; m <= totalMonths; m++) {
      const assessDate = new Date(enrollDate)
      assessDate.setMonth(assessDate.getMonth() + m)
      if (assessDate > NOW) break

      const currentAge = ageAtEnrollment + m / 12
      const currentClassroom = classroomAtAge(currentAge)
      const classroomEdus = educatorsByClassroom.get(currentClassroom) || educatorIds
      const assessor = classroomEdus.length > 0 ? pick(classroomEdus) : educatorIds[0]

      // Calculate interest scores for this month
      const monthInterests: number[] = dimensions.map((_: any, di: number) =>
        interestAtMonth(profile.interestCurves[di], m)
      )

      // ── Observation per dimension ──
      for (let di = 0; di < dimensions.length; di++) {
        const dim = dimensions[di]
        const interest = monthInterests[di]

        // Progress competency with interest influence
        const newLevel = progressWithInterest(
          dimLevels[di],
          dimMonthsAtLevel[di],
          profile.competencyMultiplier[di],
          interest
        )

        if (newLevel !== dimLevels[di]) {
          dimMonthsAtLevel[di] = 0
        } else {
          dimMonthsAtLevel[di]++
        }
        dimLevels[di] = newLevel

        observationBuffer.push({
          school_id: schoolId,
          student_id: student.id,
          dimension_id: dim.id,
          observer_id: assessor,
          rating: LEVEL_TO_RATING[newLevel],
          notes: pick(NOTES_POOL),
          observed_at: assessDate.toISOString(),
        })
        totalObs++
      }

      // ── Interest survey (monthly) ──
      const responses: Record<string, number | Record<string, string>> = {}
      const notes: Record<string, string> = {}

      for (let di = 0; di < dimensions.length; di++) {
        const dim = dimensions[di]
        responses[dim.id] = monthInterests[di]

        // Add occasional notes (~15% chance)
        if (Math.random() < 0.15) {
          const interestVal = monthInterests[di]
          const compLevel = dimLevels[di]
          if (interestVal >= 4 && LEVELS.indexOf(compLevel) <= 1) {
            notes[dim.id] = 'Really excited about this — wants to learn more!'
          } else if (interestVal <= 2 && LEVELS.indexOf(compLevel) >= 2) {
            notes[dim.id] = 'Getting a bit bored — needs new challenges'
          } else if (interestVal >= 4) {
            notes[dim.id] = 'This is my favorite area'
          } else if (interestVal <= 1.5) {
            notes[dim.id] = "I don't really like this much"
          }
        }
      }

      if (Object.keys(notes).length > 0) {
        responses['_notes'] = notes
      }

      surveyBuffer.push({
        school_id: schoolId,
        student_id: student.id,
        responses,
        submitted_at: assessDate.toISOString(),
      })
      totalSurveys++
    }
  }

  // ── Flush observation batches ──
  console.log(`\n  📝 Inserting ${totalObs} observations...`)
  for (let i = 0; i < observationBuffer.length; i += BATCH) {
    const { error } = await sb.from('observations').insert(observationBuffer.slice(i, i + BATCH))
    if (error) throw new Error(`Observations batch ${i}: ${error.message}`)
    if (i % 2000 === 0 && i > 0) process.stdout.write(`     ... ${i}/${totalObs}\r`)
  }
  console.log(`  ✅ ${totalObs} observations inserted`)

  // ── Flush survey batches ──
  console.log(`\n  📋 Inserting ${totalSurveys} interest surveys...`)
  for (let i = 0; i < surveyBuffer.length; i += BATCH) {
    const { error } = await sb.from('interest_surveys').insert(surveyBuffer.slice(i, i + BATCH))
    if (error) throw new Error(`Surveys batch ${i}: ${error.message}`)
    if (i % 1000 === 0 && i > 0) process.stdout.write(`     ... ${i}/${totalSurveys}\r`)
  }
  console.log(`  ✅ ${totalSurveys} interest surveys inserted`)

  // ── Summary ──
  console.log('\n' + '='.repeat(60))
  console.log('🎉 Trailblazers enrichment complete:')
  console.log(`   ${students.length} students with 3-4 year history`)
  console.log(`   ${historicalInserts.length} historical classroom records`)
  console.log(`   ${totalObs} observations (monthly per dimension)`)
  console.log(`   ${totalSurveys} interest surveys (monthly)`)
  console.log('')
  console.log('📌 Interest → Competency correlation:')
  console.log('   • High interest + low competency → Growth Zone (faster advancement)')
  console.log('   • Low interest + high competency → Cruise Zone (stagnation/regression)')
  console.log('   • Each student has 2-3 passion dimensions and 1-2 disengaged ones')
  console.log('='.repeat(60))
}

// ============================================================
// Utility
// ============================================================

function gradeToAge(grade: string | null): number {
  if (!grade) return 4
  const map: Record<string, number> = {
    'Pre-K': 4, 'TK': 5, 'K': 5,
    '1': 6, '2': 7, '3': 8, '4': 9, '5': 10,
    '6': 11, '7': 12, '8': 13, '9': 14, '10': 15,
  }
  return map[grade] ?? 4
}

// ============================================================
// Run
// ============================================================

main().catch((err) => {
  console.error('\n❌ Failed:', err)
  process.exit(1)
})

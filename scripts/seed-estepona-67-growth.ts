/**
 * seed-estepona-67-growth.ts
 *
 * Densifies amoeba data for the Estepona 6-7 classroom so the timeline
 * shows visible growth across ~3 school years.
 *
 * Creates one "Continuous Growth Tracking 2023–2026" assignment per student,
 * then inserts monthly `assignment_standard_assessments` rows from Sep 2023
 * through May 2026 (33 months) for ~3 standards per dimension, with each
 * student/dimension following a smooth growth curve (emerging → mastery)
 * with light per-month jitter and a per-student offset.
 *
 * Idempotent: deletes any prior assignment titled exactly
 * "Continuous Growth Tracking 2023–2026" for this classroom before re-seeding.
 *
 *   npx tsx scripts/seed-estepona-67-growth.ts
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

const CLASSROOM_ID = '16d371d8-916e-464b-8b65-0dd4104aff91' // Estepona 6-7
const SCHOOL_ID = 'ffb55bc2-2678-45b1-8552-286f21b2b247' // Boundless Life
const ASSIGNMENT_TITLE = 'Continuous Growth Tracking 2023–2026'

const START_YEAR = 2023
const START_MONTH = 8 // Sep (0-indexed)
const END_YEAR = 2026
const END_MONTH = 4 // May (0-indexed)

const STDS_PER_DIM = 3 // standards per dimension to track each month

const LEVELS = ['emerging', 'developing', 'achieving', 'mastery'] as const
type Level = (typeof LEVELS)[number]

function levelFromScore(score: number): Level {
  if (score < 1.5) return 'emerging'
  if (score < 2.5) return 'developing'
  if (score < 3.5) return 'achieving'
  return 'mastery'
}

// Deterministic pseudo-random in [0,1) from string seed
function rand(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  // 1. Classroom + students
  const { data: roster, error: rosterErr } = await sb
    .from('student_classrooms')
    .select('student_id, students:students(id, first_name, last_name)')
    .eq('classroom_id', CLASSROOM_ID)

  if (rosterErr || !roster || roster.length === 0) {
    console.error('No students found in classroom:', rosterErr?.message)
    process.exit(1)
  }
  const students = roster.map((r: any) => r.students).filter(Boolean)
  console.log(`Students (${students.length}):`, students.map((s: any) => `${s.first_name} ${s.last_name}`).join(', '))

  // 2. Teacher (any educator from school) — use existing assignment's teacher
  const { data: anyAssign } = await sb
    .from('assignments')
    .select('teacher_id')
    .eq('classroom_id', CLASSROOM_ID)
    .limit(1)
    .single()
  const teacherId = anyAssign?.teacher_id
  if (!teacherId) {
    console.error('No teacher found via existing assignments in classroom.')
    process.exit(1)
  }
  console.log(`Teacher (assessor): ${teacherId}`)

  // 3. Standards mapped to dimensions for this school (age 6-7 band)
  const { data: mapping } = await sb
    .from('dimension_standards')
    .select('dimension_id, standard_id, dimensions:dimensions(id, name, display_order), standards:standards(id, age_band_start, age_band_end)')
    .eq('school_id', SCHOOL_ID)

  if (!mapping || mapping.length === 0) {
    console.error('No dimension_standards mapped for school.')
    process.exit(1)
  }

  // Group by dimension, filter age band overlapping 6-7, pick STDS_PER_DIM each
  const byDim = new Map<string, { dim: any; std_ids: string[] }>()
  for (const m of mapping as any[]) {
    const s = m.standards
    if (!s) continue
    if (s.age_band_start != null && s.age_band_start > 7) continue
    if (s.age_band_end != null && s.age_band_end < 6) continue
    const entry = byDim.get(m.dimension_id) ?? { dim: m.dimensions, std_ids: [] }
    entry.std_ids.push(m.standard_id)
    byDim.set(m.dimension_id, entry)
  }

  const chosen: { dim_id: string; dim_name: string; display_order: number; standards: string[] }[] = []
  for (const [dim_id, { dim, std_ids }] of byDim) {
    if (!dim) continue
    // Sort std_ids deterministically and take first STDS_PER_DIM
    const picks = [...std_ids].sort().slice(0, STDS_PER_DIM)
    if (picks.length === 0) continue
    chosen.push({
      dim_id,
      dim_name: dim.name,
      display_order: dim.display_order ?? 0,
      standards: picks,
    })
  }
  chosen.sort((a, b) => a.display_order - b.display_order)
  console.log(`\nDimensions covered (${chosen.length}):`)
  for (const d of chosen) console.log(`  ${d.dim_name}: ${d.standards.length} standards`)

  const allStandardIds = chosen.flatMap((d) => d.standards)
  console.log(`Total standards tracked: ${allStandardIds.length}`)

  // 4. Idempotent cleanup — delete prior seed assignment if it exists
  const { data: prior } = await sb
    .from('assignments')
    .select('id')
    .eq('classroom_id', CLASSROOM_ID)
    .eq('title', ASSIGNMENT_TITLE)

  if (prior && prior.length > 0) {
    const ids = prior.map((p) => p.id)
    console.log(`\nCleaning up ${ids.length} prior seed assignment(s)…`)
    // Delete dependent rows first (children may not cascade — be explicit)
    const { data: priorSAs } = await sb
      .from('student_assignments')
      .select('id')
      .in('assignment_id', ids)
    const saIds = (priorSAs ?? []).map((s) => s.id)
    if (saIds.length > 0) {
      await sb.from('assignment_standard_assessments').delete().in('student_assignment_id', saIds)
      await sb.from('student_assignment_standards').delete().in('student_assignment_id', saIds)
      await sb.from('student_assignments').delete().in('id', saIds)
    }
    await sb.from('assignment_standards').delete().in('assignment_id', ids)
    await sb.from('assignments').delete().in('id', ids)
  }

  // 5. Create the new assignment
  const { data: newAssign, error: assignErr } = await sb
    .from('assignments')
    .insert({
      school_id: SCHOOL_ID,
      classroom_id: CLASSROOM_ID,
      teacher_id: teacherId,
      title: ASSIGNMENT_TITLE,
      description:
        'Continuous monthly assessment across all dimensions to demonstrate growth over time.',
      assignment_type: 'class',
      status: 'active',
      due_date: '2026-06-15',
    })
    .select('id')
    .single()
  if (assignErr || !newAssign) {
    console.error('Failed to create assignment:', assignErr?.message)
    process.exit(1)
  }
  const assignmentId = newAssign.id as string
  console.log(`\nCreated assignment: ${assignmentId}`)

  // 6. assignment_standards
  const asRows = allStandardIds.map((sid) => ({ assignment_id: assignmentId, standard_id: sid }))
  const { error: asErr } = await sb.from('assignment_standards').insert(asRows)
  if (asErr) {
    console.error('assignment_standards insert failed:', asErr.message)
    process.exit(1)
  }

  // 7. student_assignments (one per student)
  const saRows = students.map((s: any) => ({
    assignment_id: assignmentId,
    student_id: s.id,
    status: 'in_progress',
    assigned_at: new Date(START_YEAR, START_MONTH, 1).toISOString(),
  }))
  const { data: saInserted, error: saErr } = await sb
    .from('student_assignments')
    .insert(saRows)
    .select('id, student_id')
  if (saErr || !saInserted) {
    console.error('student_assignments insert failed:', saErr?.message)
    process.exit(1)
  }
  const studentAssignmentByStudent = new Map<string, string>()
  for (const r of saInserted) studentAssignmentByStudent.set(r.student_id, r.id)

  // 8. student_assignment_standards is auto-populated by the
  //    `trg_snapshot_assignment_standards` trigger on student_assignments insert.

  // 9. Build month list
  const months: Date[] = []
  for (
    let d = new Date(START_YEAR, START_MONTH, 1);
    d <= new Date(END_YEAR, END_MONTH, 1);
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push(new Date(d))
  }
  console.log(`\nMonths to generate: ${months.length} (${months[0].toDateString()} → ${months[months.length - 1].toDateString()})`)

  // 10. Growth curve per (student, dimension): smooth ramp + jitter
  //
  //   start ~ 1.0 + per-student offset
  //   target ~ 3.6 + per-(student,dim) offset
  //   level(m) = start + (m / (M-1)) * (target - start) + jitter
  //
  // Different dimensions also have a slight phase offset so the amoeba
  // doesn't grow uniformly in all directions.
  const M = months.length
  const assessments: any[] = []

  for (const student of students) {
    const sId: string = student.id
    const saId = studentAssignmentByStudent.get(sId)!
    const studentOffset = (rand(`stu:${sId}`) - 0.5) * 0.4 // ±0.2

    for (const dim of chosen) {
      const dimPhase = rand(`dim:${sId}:${dim.dim_id}`) // 0..1
      const start = 1.0 + studentOffset + dimPhase * 0.3 // 0.8..1.5
      const target = 3.4 + rand(`tgt:${sId}:${dim.dim_id}`) * 0.5 // 3.4..3.9

      for (let mi = 0; mi < M; mi++) {
        const t = M === 1 ? 0 : mi / (M - 1)
        // Add gentle S-curve so growth accelerates mid-period
        const eased = t * t * (3 - 2 * t)
        const base = start + eased * (target - start)

        for (const stdId of dim.standards) {
          const jitter = (rand(`j:${sId}:${stdId}:${mi}`) - 0.5) * 0.5
          const score = Math.max(0.6, Math.min(4.2, base + jitter))
          const level = levelFromScore(score)
          const month = months[mi]
          // Spread assessment dates across the month a little
          const day = 10 + Math.floor(rand(`day:${sId}:${stdId}:${mi}`) * 12)
          const assessedAt = new Date(month.getFullYear(), month.getMonth(), day, 12, 0, 0)
          assessments.push({
            student_assignment_id: saId,
            student_id: sId,
            school_id: SCHOOL_ID,
            standard_id: stdId,
            level,
            notes: null,
            assessor_id: teacherId,
            assessed_at: assessedAt.toISOString(),
          })
        }
      }
    }
  }

  console.log(`\nInserting ${assessments.length} assessments…`)
  for (let i = 0; i < assessments.length; i += 500) {
    const batch = assessments.slice(i, i + 500)
    const { error } = await sb.from('assignment_standard_assessments').insert(batch)
    if (error) {
      console.error(`Batch ${i / 500} failed:`, error.message)
      // Probe to find the first bad row
      for (const a of batch) {
        const { error: e } = await sb.from('assignment_standard_assessments').insert(a)
        if (e) {
          console.error('  Bad row:', JSON.stringify(a), e.message)
          process.exit(1)
        }
      }
    } else {
      process.stdout.write(`  …${Math.min(i + batch.length, assessments.length)}/${assessments.length}\n`)
    }
  }

  // 11. Summary
  console.log('\n── Growth preview (first student, first dimension) ──')
  const s0 = students[0]
  const d0 = chosen[0]
  const std0 = d0.standards[0]
  for (let mi = 0; mi < M; mi += 4) {
    const row = assessments.find(
      (a) => a.student_id === s0.id && a.standard_id === std0 && a.assessed_at.startsWith(`${months[mi].getFullYear()}-${String(months[mi].getMonth() + 1).padStart(2, '0')}`)
    )
    console.log(
      `  ${months[mi].toLocaleString('en-US', { month: 'short', year: 'numeric' })}: ${d0.dim_name} / ${std0.slice(0, 8)} → ${row?.level ?? 'n/a'}`
    )
  }

  console.log('\n✅ Done. Reload an Estepona 6-7 student profile to see the amoeba grow.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

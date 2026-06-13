/**
 * seed-boundless-framework.ts
 *
 * Seeds the canonical Boundless competency framework (8 dimensions, 73
 * competencies with age-by-age step descriptors) as each school's EDITABLE base.
 * Source of truth: supabase/seed/boundless_framework.json
 *
 * Requires migration 084 (adds dimensions.strand/learner_profile/area_of_development
 * and competencies.school_id/dimension_id/standard_label/display_order). The
 * --dry-run path only READS + reports, so it is safe to run before 084 is applied.
 *
 * Run (preview, read-only):   npx tsx scripts/seed-boundless-framework.ts --dry-run
 * Run (apply, all schools):   npx tsx scripts/seed-boundless-framework.ts
 * Run (apply, one school):    npx tsx scripts/seed-boundless-framework.ts --school=<uuid>
 *
 * Per school it:
 *   1. Reconciles dimensions — best-fit-matches each Boundless dimension to an
 *      existing one (keyword match) and UPDATES it to the Boundless identity
 *      (name = action phrase, + strand/profile/area), or CREATES it if missing.
 *      Observations are untouched (they reference dimension_id, which is stable).
 *   2. Replaces this school's Boundless-seeded competencies (code prefix 'BL.')
 *      and inserts the 73 fresh, attached to the right dimension. Idempotent.
 *   3. Reports any existing dimension it could NOT match (kept as legacy; its
 *      observations stay put) — those are resolved later in the data-mapping step.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Bootstrap (mirrors seed-multiyear-observations.ts) ───────────
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
    } catch { /* try next */ }
  }
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const DRY = process.argv.includes('--dry-run')
const schoolArg = (process.argv.find((a) => a.startsWith('--school=')) || '').split('=')[1] || null

// ── Framework + helpers ──────────────────────────────────────────
interface FwComp { name: string; age_band_start: number | null; age_band_end: number | null; step_descriptors: Record<string, string> }
interface FwStd { name: string; competencies: FwComp[] }
interface FwDim { name: string; strand: string; learner_profile: string; area_of_development: string; standards: FwStd[] }
const fw: { dimensions: FwDim[] } = JSON.parse(
  readFileSync(resolve(__dirname2, '..', 'supabase', 'seed', 'boundless_framework.json'), 'utf-8')
)

// Keywords that locate an EXISTING dimension to become each Boundless dimension.
// Deliberately avoids ambiguous tokens (e.g. 'communicat' would grab a
// "Communication & Collaboration" dim; 'social' would grab "Social Studies").
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
  'Think Deeply': 'microscope', 'Create Boldly': 'palette', 'Reason & Solve': 'calculator',
  'Communicate with Impact': 'book-open', 'Know Yourself': 'heart', 'Keep Growing': 'activity',
  'Connect Across Difference': 'users', 'Navigate the World': 'globe',
}
const norm = (s: string) => (s || '').trim().toLowerCase()
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const compCode = (dimName: string, subName: string) => `BL.${slug(dimName)}.${slug(subName)}`

async function run() {
  console.log(`\n=== Seed Boundless framework ${DRY ? '(DRY RUN — read-only)' : '(APPLYING)'} ===`)
  let schoolsQ = sb.from('schools').select('id, name')
  if (schoolArg) schoolsQ = schoolsQ.eq('id', schoolArg)
  const { data: schools, error } = await schoolsQ
  if (error) { console.error(error); process.exit(1) }

  for (const school of schools ?? []) {
    console.log(`\n── ${school.name} (${school.id}) ──`)
    const { data: dims } = await sb.from('dimensions').select('id, name, display_order, icon, is_active').eq('school_id', school.id)
    const existing = dims ?? []
    const used = new Set<string>()
    const plan: { bDim: FwDim; idx: number; action: 'update' | 'create'; dim?: any; nComp: number }[] = []

    for (let i = 0; i < fw.dimensions.length; i++) {
      const bDim = fw.dimensions[i]
      let match =
        existing.find((d) => !used.has(d.id) && norm(d.name) === norm(bDim.name)) ||
        existing.find((d) => !used.has(d.id) && norm(d.name) === norm(bDim.area_of_development))
      if (!match) {
        for (const rx of MATCHERS[bDim.name] ?? []) {
          match = existing.find((d) => !used.has(d.id) && rx.test(d.name))
          if (match) break
        }
      }
      const nComp = bDim.standards.reduce((a, s) => a + s.competencies.length, 0)
      if (match) { used.add(match.id); plan.push({ bDim, idx: i, action: 'update', dim: match, nComp }) }
      else plan.push({ bDim, idx: i, action: 'create', nComp })
    }
    const legacy = existing.filter((d) => !used.has(d.id))

    for (const p of plan) {
      const arrow = p.action === 'update' ? `update "${p.dim.name}" ->` : 'create'
      console.log(`   [${p.action.toUpperCase()}] ${arrow} "${p.bDim.name}" (${p.bDim.strand}) · ${p.nComp} competencies`)
    }
    if (legacy.length) console.log(`   [LEGACY · kept] ${legacy.map((d) => `"${d.name}"`).join(', ')} — observations stay; map later`)

    if (DRY) continue

    // ---- APPLY ----
    const dimIdByBoundless: Record<string, string> = {}
    for (const p of plan) {
      const common = {
        name: p.bDim.name, strand: p.bDim.strand, learner_profile: p.bDim.learner_profile,
        area_of_development: p.bDim.area_of_development, category: p.bDim.strand, display_order: p.idx,
      }
      if (p.action === 'update') {
        await sb.from('dimensions').update(common).eq('id', p.dim.id)
        dimIdByBoundless[p.bDim.name] = p.dim.id
      } else {
        const { data: created } = await sb.from('dimensions').insert({
          school_id: school.id, ...common, icon: ICONS[p.bDim.name] ?? null, is_active: true, visible_to_family: true,
        }).select('id').single()
        dimIdByBoundless[p.bDim.name] = created!.id
      }
    }

    // replace this school's Boundless-seeded competencies, then insert fresh
    await sb.from('competencies').delete().eq('school_id', school.id).like('code', 'BL.%')
    const rows: any[] = []
    for (const bDim of fw.dimensions) {
      let order = 0
      for (const std of bDim.standards) {
        for (const c of std.competencies) {
          rows.push({
            school_id: school.id, dimension_id: dimIdByBoundless[bDim.name], standard_label: std.name,
            name: c.name, code: compCode(bDim.name, c.name), step_descriptors: c.step_descriptors,
            age_band_start: c.age_band_start, age_band_end: c.age_band_end, display_order: order++,
          })
        }
      }
    }
    // chunked insert (73 rows, but keep it tidy)
    for (let i = 0; i < rows.length; i += 100) {
      const { error: insErr } = await sb.from('competencies').insert(rows.slice(i, i + 100))
      if (insErr) { console.error('   insert error:', insErr.message); process.exit(1) }
    }
    console.log(`   ✓ applied: ${plan.length} dimensions, ${rows.length} competencies`)
  }
  console.log(`\nDone.${DRY ? ' (no changes written)' : ''}\n`)
}

run()

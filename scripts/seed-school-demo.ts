/**
 * seed-school-demo.ts
 *
 * Make a school look like Boundless's "Demo Class": apply the Boundless
 * framework (8 dimensions + 73 competencies), create a "Demo" classroom + a
 * silent Demo Educator, 10 learners, and ~2 school years of monthly
 * observations with a big year-over-year step (90% of competencies assessed
 * 3×/month). All logic lives in the shared seeder so this CLI and the
 * `seed-school-demo` edge function stay in lockstep.
 *
 *   npx tsx scripts/seed-school-demo.ts --school=<uuid>
 *   npx tsx scripts/seed-school-demo.ts --all        # every school
 *
 * Supersedes seed-demo-class.ts (Boundless-only) + seed-boundless-framework.ts
 * (framework-only) for the demo-class use case.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { seedSchoolDemo, type Framework } from '../supabase/functions/_shared/demo-seed'

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

const schoolArg = (process.argv.find((a) => a.startsWith('--school=')) || '').split('=')[1] || null
const ALL = process.argv.includes('--all')

const framework: Framework = JSON.parse(
  readFileSync(resolve(__dirname2, '..', 'supabase', 'seed', 'boundless_framework.json'), 'utf-8')
)

async function main() {
  if (!schoolArg && !ALL) {
    console.error('Usage: npx tsx scripts/seed-school-demo.ts --school=<uuid> | --all')
    process.exit(1)
  }

  let q = sb.from('schools').select('id, name').is('archived_at', null)
  if (schoolArg) q = q.eq('id', schoolArg)
  const { data: schools, error } = await q
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  if (!schools?.length) {
    console.error('No matching school(s).')
    process.exit(1)
  }

  for (const school of schools) {
    console.log(`\n── ${school.name} (${school.id}) ──`)
    const result = await seedSchoolDemo(sb, school.id, framework, {
      log: (m) => console.log(`   ${m}`),
    })
    console.log(
      `   ✅ ${result.dimensions} dims · ${result.competencies} comps · ${result.students} learners · ${result.observations} observations`
    )
  }
  console.log('\nDone. Open a Demo learner profile to see the amoeba timeline.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

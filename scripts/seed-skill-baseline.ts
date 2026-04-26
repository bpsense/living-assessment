/**
 * seed-skill-baseline.ts
 *
 * Seeds the developmental skill baseline (~156 skills across 8 domains and
 * 5 age bands) into the `skills` table as system-owned baseline rows
 * (school_id = NULL). The skills are tagged to the default Learner Profile's
 * domains by name.
 *
 * Idempotent: deletes any existing skills attached to the default profile's
 * domains before re-inserting, so re-running mirrors the JSON exactly.
 *
 *   npx tsx scripts/seed-skill-baseline.ts
 *
 * Required env (loaded from .env.local if present):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: skill-baseline.json uses JS-style line comments (`// ...`) as section
 * dividers. They are stripped before JSON.parse — see stripComments below.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Bootstrap ──────────────────────────────────────────────────

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(__filename2)
const REPO_ROOT = resolve(__dirname2, '..')

function loadEnv() {
  // Walk up from REPO_ROOT and CWD so this script works from the main checkout
  // or a worktree (where .env.local typically lives only in the main checkout).
  const seen = new Set<string>()
  function ascend(start: string) {
    let dir = start
    for (let i = 0; i < 6; i++) {
      const p = resolve(dir, '.env.local')
      if (!seen.has(p)) {
        seen.add(p)
        try {
          const text = readFileSync(p, 'utf-8')
          for (const line of text.split('\n')) {
            const t = line.trim()
            if (!t || t.startsWith('#')) continue
            const eq = t.indexOf('=')
            if (eq < 0) continue
            if (!process.env[t.slice(0, eq)]) {
              process.env[t.slice(0, eq)] = t.slice(eq + 1)
            }
          }
          return true
        } catch {
          // keep climbing
        }
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return false
  }
  ascend(REPO_ROOT) || ascend(process.cwd())
}

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY in env / .env.local'
  )
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Types & helpers ────────────────────────────────────────────

interface BaselineSkill {
  domain: string
  name: string
  description: string
  age_band_start: number
  age_band_end: number
  source?: string
}

interface BaselineFile {
  meta: {
    version?: string
    domains: string[]
    [k: string]: unknown
  }
  skills: BaselineSkill[]
}

const EXPECTED_DOMAINS = [
  'Language & Communication',
  'Mathematical Thinking',
  'Scientific & Environmental Inquiry',
  'Creative Expression & Making',
  'Inner Self & Well Being',
  'Physical Wellbeing & Movement',
  'Collaboration & Relational Skills',
  'Global Citizenship & Contribution',
] as const

const BATCH_SIZE = 25

/**
 * Strip JS-style line comments (`// ...`) so the file parses as JSON.
 * The baseline file uses comments as section dividers; the regex matches
 * everything from `//` to end of line. Block comments are not used.
 */
function stripComments(jsonString: string): string {
  return jsonString.replace(/\/\/[^\n]*/g, '')
}

function loadBaseline(): BaselineFile {
  const path = resolve(REPO_ROOT, 'skill-baseline.json')
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(stripComments(raw)) as BaselineFile
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('▸ Loading skill-baseline.json …')
  const baseline = loadBaseline()
  const fileVersion = baseline.meta.version ?? '?'
  console.log(
    `  version=${fileVersion}, ${baseline.skills.length} skills in file`
  )

  // 1. Default learner profile
  console.log('▸ Resolving default Learner Profile …')
  const { data: profile, error: profileErr } = await sb
    .from('learner_profiles')
    .select('id, name, school_id')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  if (profileErr || !profile) {
    console.error('No default Learner Profile found:', profileErr?.message ?? '(empty)')
    process.exit(1)
  }
  console.log(`  default profile id=${profile.id} name="${profile.name}"`)

  // 2. Domains for that profile
  console.log('▸ Resolving Learner Profile domains …')
  const { data: domains, error: domainsErr } = await sb
    .from('learner_profile_domains')
    .select('id, name')
    .eq('profile_id', profile.id)

  if (domainsErr || !domains) {
    console.error('Failed to fetch domains:', domainsErr?.message)
    process.exit(1)
  }

  const domainByName = new Map<string, string>()
  for (const d of domains as { id: string; name: string }[]) {
    domainByName.set(d.name, d.id)
  }
  console.log(`  fetched ${domainByName.size} domains`)

  // 3. Validate that every expected domain is present.
  const missing = EXPECTED_DOMAINS.filter((n) => !domainByName.has(n))
  const extra = [...domainByName.keys()].filter(
    (n) => !(EXPECTED_DOMAINS as readonly string[]).includes(n)
  )

  if (missing.length > 0) {
    console.error('✗ Missing expected domains on the default profile:')
    for (const n of missing) console.error(`    - ${n}`)
    if (extra.length > 0) {
      console.error('  Domains that are present but unexpected:')
      for (const n of extra) console.error(`    + ${n}`)
    }
    process.exit(1)
  }
  if (extra.length > 0) {
    console.warn('⚠ Default profile has extra domains not used by the baseline:')
    for (const n of extra) console.warn(`    + ${n}`)
  }

  const defaultDomainIds = EXPECTED_DOMAINS.map((n) => domainByName.get(n) as string)

  // 4. Delete existing skills tagged to the default profile's domains.
  // Scope to those domain ids only — leaves school-specific skills alone
  // (they're tagged to school-owned, non-default profile domains).
  console.log('▸ Deleting existing baseline skills for default profile domains …')
  const { error: delErr, count: delCount } = await sb
    .from('skills')
    .delete({ count: 'exact' })
    .in('domain_id', defaultDomainIds)

  if (delErr) {
    console.error('Failed to delete existing skills:', delErr.message)
    process.exit(1)
  }
  console.log(`  deleted ${delCount ?? 0} prior skill(s)`)

  // 5. Resolve every JSON skill against the domain map, surface any unknowns.
  type ResolvedSkill = {
    name: string
    description: string
    age_band_start: number | null
    age_band_end: number | null
    domain_id: string
    school_id: null
    source_reference: string | null
    is_assessable: true
    source_framework: 'baseline'
  }

  const resolved: ResolvedSkill[] = []
  const skipped: { skill: BaselineSkill; reason: string }[] = []

  for (const s of baseline.skills) {
    const domainId = domainByName.get(s.domain)
    if (!domainId) {
      skipped.push({ skill: s, reason: `unknown domain "${s.domain}"` })
      continue
    }
    if (!(EXPECTED_DOMAINS as readonly string[]).includes(s.domain)) {
      skipped.push({ skill: s, reason: `domain "${s.domain}" is not in EXPECTED_DOMAINS` })
      continue
    }
    resolved.push({
      name: s.name,
      description: s.description,
      age_band_start: typeof s.age_band_start === 'number' ? s.age_band_start : null,
      age_band_end: typeof s.age_band_end === 'number' ? s.age_band_end : null,
      domain_id: domainId,
      school_id: null,
      source_reference: s.source ?? null,
      is_assessable: true,
      source_framework: 'baseline',
    })
  }

  // 6. Insert in batches.
  console.log(`▸ Inserting ${resolved.length} skill(s) in batches of ${BATCH_SIZE} …`)
  let inserted = 0
  for (let i = 0; i < resolved.length; i += BATCH_SIZE) {
    const batch = resolved.slice(i, i + BATCH_SIZE)
    const { error: insErr, count } = await sb
      .from('skills')
      .insert(batch, { count: 'exact' })

    if (insErr) {
      console.error(
        `✗ Batch ${i / BATCH_SIZE + 1} failed (rows ${i}–${i + batch.length - 1}):`,
        insErr.message
      )
      process.exit(1)
    }
    inserted += count ?? batch.length
    console.log(`  batch ${i / BATCH_SIZE + 1}: +${count ?? batch.length} (running ${inserted})`)
  }

  // 7. Per-domain summary.
  const perDomain = new Map<string, number>()
  for (const r of resolved) {
    const name = [...domainByName.entries()].find(([, id]) => id === r.domain_id)?.[0] ?? '?'
    perDomain.set(name, (perDomain.get(name) ?? 0) + 1)
  }

  console.log('\n=== Summary ===')
  for (const name of EXPECTED_DOMAINS) {
    const n = perDomain.get(name) ?? 0
    console.log(`  ${name.padEnd(38)} ${String(n).padStart(3)} skill${n === 1 ? '' : 's'}`)
  }
  console.log('  ' + '-'.repeat(46))
  console.log(`  ${'Total inserted'.padEnd(38)} ${String(inserted).padStart(3)}`)
  console.log(`  ${'Skills in JSON'.padEnd(38)} ${String(baseline.skills.length).padStart(3)}`)

  if (skipped.length > 0) {
    console.warn(`\n⚠ Skipped ${skipped.length} skill(s):`)
    for (const { skill, reason } of skipped) {
      console.warn(`  - "${skill.name}" (${reason})`)
    }
  } else {
    console.log('\nNo skills skipped. Domain mapping is complete.')
  }

  if (inserted !== baseline.skills.length) {
    console.error(
      `\n✗ Mismatch: inserted ${inserted} but JSON has ${baseline.skills.length}.`
    )
    process.exit(1)
  }

  console.log('\n✓ Done.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

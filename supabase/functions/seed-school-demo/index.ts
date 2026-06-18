// supabase/functions/seed-school-demo/index.ts
// Edge Function — seeds a school's "Demo" class (Boundless framework + 10
// learners + ~2 years of observations) using the service-role key. Invoked
// automatically from the system-admin "create school" flow, so every new
// school gets demo data by default.
//
// The heavy work (~38k observation inserts) runs in EdgeRuntime.waitUntil so
// the HTTP response returns immediately and the caller never blocks/times out.
// Shared generation logic lives in ../_shared/demo-seed.ts (also used by the
// scripts/seed-school-demo.ts CLI). The Boundless framework is cloned from an
// existing school's competencies at runtime — no large JSON is bundled.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { seedSchoolDemo, type Framework } from '../_shared/demo-seed.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/**
 * Build the canonical Boundless Framework object by cloning it from whichever
 * existing school already carries it (every established school does). Keeps the
 * demo framework in lockstep with live data and avoids bundling the seed JSON.
 */
async function loadFrameworkFromDb(client: any, excludeSchoolId: string): Promise<Framework> {
  const { data: allBl } = await client.from('competencies').select('school_id').like('code', 'BL.%')
  const counts = new Map<string, number>()
  for (const r of allBl ?? []) {
    if (r.school_id && r.school_id !== excludeSchoolId) counts.set(r.school_id, (counts.get(r.school_id) ?? 0) + 1)
  }
  const templateId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!templateId) throw new Error('No template school with the Boundless framework found')

  const { data: tDims } = await client
    .from('dimensions')
    .select('id, name, strand, learner_profile, area_of_development, display_order')
    .eq('school_id', templateId)
    .order('display_order')
  const { data: tComps } = await client
    .from('competencies')
    .select('dimension_id, name, standard_label, step_descriptors, age_band_start, age_band_end, display_order')
    .eq('school_id', templateId)
    .like('code', 'BL.%')
    .order('display_order')

  const byDim = new Map<string, any[]>()
  for (const c of tComps ?? []) {
    const arr = byDim.get(c.dimension_id) ?? []
    arr.push(c)
    byDim.set(c.dimension_id, arr)
  }

  const dimensions = (tDims ?? []).map((d: any) => {
    const comps = byDim.get(d.id) ?? []
    const order: string[] = []
    const groups = new Map<string, any[]>()
    for (const c of comps) {
      const label = c.standard_label ?? 'General'
      if (!groups.has(label)) {
        groups.set(label, [])
        order.push(label)
      }
      groups.get(label)!.push(c)
    }
    return {
      name: d.name,
      strand: d.strand,
      learner_profile: d.learner_profile,
      area_of_development: d.area_of_development,
      standards: order.map((label) => ({
        name: label,
        competencies: groups.get(label)!.map((c) => ({
          name: c.name,
          age_band_start: c.age_band_start,
          age_band_end: c.age_band_end,
          step_descriptors: c.step_descriptors ?? {},
        })),
      })),
    }
  })

  return { dimensions }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    // 1. Verify the caller is an authenticated admin / system admin.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await anonClient
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()
    const { data: sysAdmin } = await anonClient
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const isSystemAdmin = !!sysAdmin

    if (!callerProfile || (callerProfile.role !== 'admin' && !isSystemAdmin)) {
      return jsonResponse({ error: 'Only admins can seed demo data' }, 403)
    }

    // 2. Parse body.
    const { school_id } = (await req.json()) as { school_id?: string }
    if (!school_id) return jsonResponse({ error: 'school_id is required' }, 400)
    if (!isSystemAdmin && callerProfile.school_id !== school_id) {
      return jsonResponse({ error: 'Cannot seed a different school' }, 403)
    }

    // 3. Service client for the privileged seed.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const framework = await loadFrameworkFromDb(serviceClient, school_id)

    // 4. Run the (heavy) seed in the background so the caller returns instantly.
    const work = seedSchoolDemo(serviceClient, school_id, framework, {
      log: (m) => console.log('[seed-school-demo]', m),
    })
      .then((r) => console.log('[seed-school-demo] done', JSON.stringify(r)))
      .catch((e) => console.error('[seed-school-demo] FAILED', e?.message ?? e))
    // @ts-ignore EdgeRuntime is a Supabase Edge global
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
    else await work

    return jsonResponse({ accepted: true, school_id })
  } catch (err) {
    console.error('seed-school-demo error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})

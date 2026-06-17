// supabase/functions/resolve-ip-geo/index.ts
// Resolves a batch of audit-log login IPs to coarse location (country only)
// for the super-admin "Logins & Activity" dashboard.
//
// Results are cached in public.ip_geo_cache so each unique IP is sent to the
// upstream provider (ipinfo.io) at most once, ever — a data-minimization measure.
// Only the ISO country code is kept; region/city/coords/ISP are never stored.
//
// AUTH: system admins only — mirrors the activity_log access model. The function is
// the sole external recipient of the IP; without it, no login IP would leave the DB.
//
// CONFIG: set the IPINFO_TOKEN secret to lift rate limits in production. The function
// also works tokenless (ipinfo's free, lower-limit mode) so it runs without setup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Cap a single batch so a malformed/oversized request can't fan out unbounded
// upstream calls. A dashboard page surfaces far fewer distinct IPs than this.
const MAX_IPS = 100

interface Geo {
  countryCode: string | null
  region: string | null
}

/** Resolve one IP via ipinfo. Returns null on transient failure (so we retry later,
 *  rather than caching a bad result); returns nulled Geo for private/bogon IPs. */
async function resolveUpstream(ip: string): Promise<Geo | null> {
  const token = Deno.env.get('IPINFO_TOKEN')
  const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json${token ? `?token=${token}` : ''}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as { country?: string; bogon?: boolean }
    if (data.bogon) return { countryCode: null, region: null } // private/reserved — cache as unknown
    if (!data.country) return null
    // Country only (product decision): region is deliberately not collected or stored.
    return { countryCode: data.country, region: null }
  } catch (_err) {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    // 2. System-admin gate (prevents use as an open geo-IP proxy)
    const { data: sysAdmin } = await anonClient
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sysAdmin) return jsonResponse({ error: 'Forbidden' }, 403)

    // 3. Parse + sanitize the IP list
    const body = (await req.json().catch(() => ({}))) as { ips?: unknown }
    const ips = Array.isArray(body.ips)
      ? [...new Set(body.ips.filter((v): v is string => typeof v === 'string' && v.length > 0))].slice(0, MAX_IPS)
      : []
    if (ips.length === 0) return jsonResponse({ results: {} })

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 4. Serve cache hits
    const results: Record<string, Geo | null> = {}
    const { data: cached } = await service
      .from('ip_geo_cache')
      .select('ip, country_code, region')
      .in('ip', ips)
    const cachedIps = new Set<string>()
    for (const row of (cached ?? []) as Array<{ ip: string; country_code: string | null; region: string | null }>) {
      results[row.ip] = { countryCode: row.country_code, region: row.region }
      cachedIps.add(row.ip)
    }

    // 5. Resolve misses upstream, then persist successes (incl. cached-unknown bogons)
    const misses = ips.filter((ip) => !cachedIps.has(ip))
    const resolved = await Promise.all(misses.map(async (ip) => ({ ip, geo: await resolveUpstream(ip) })))

    const toInsert: Array<{ ip: string; country_code: string | null; region: string | null }> = []
    for (const { ip, geo } of resolved) {
      results[ip] = geo
      if (geo !== null) toInsert.push({ ip, country_code: geo.countryCode, region: geo.region })
    }
    if (toInsert.length > 0) {
      await service.from('ip_geo_cache').upsert(toInsert, { onConflict: 'ip' })
    }

    return jsonResponse({ results })
  } catch (err) {
    console.error('resolve-ip-geo error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})

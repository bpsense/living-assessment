// supabase/functions/map-competencies-to-dimensions/index.ts
// AI edge function: maps a school's competencies to their dimensions.
// Runs automatically on framework upload and dimension changes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────

interface RequestBody {
  school_id: string
}

interface CompetencyInfo {
  id: string
  code: string
  name: string
  objective: string | null
  domain_name: string
  subdomain_name: string
}

interface DimensionInfo {
  id: string
  name: string
  description: string | null
  category: string
}

interface MappingResult {
  competency_id: string
  dimension_id: string
  confidence: number
  reasoning: string
}

// ── Helpers ────────────────────────────────────────────────────

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

// ── Auth helpers ───────────────────────────────────────────────
// Verify the caller's JWT and load their authorization facts. The heavy
// work below runs as service-role (RLS-bypassing), so every request MUST
// pass through here first and then be checked against the target school.

async function requireUser(req: Request, url: string, serviceKey: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: 'Missing authorization', status: 401 as const }
  const token = authHeader.replace('Bearer ', '')
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token)
  if (error || !user) return { error: 'Unauthorized', status: 401 as const }

  const svc = createClient(url, serviceKey)
  const [{ data: caller }, { data: sysRow }] = await Promise.all([
    svc.from('profiles').select('school_id, role').eq('id', user.id).maybeSingle(),
    svc.from('system_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])
  const isSysAdmin = !!sysRow
  if (!caller && !isSysAdmin) return { error: 'Profile not found', status: 403 as const }
  return { caller: caller as { school_id: string; role: string } | null, isSysAdmin }
}

function authorizedForSchool(
  caller: { school_id: string; role: string } | null,
  isSysAdmin: boolean,
  schoolId: string | null | undefined,
  roles: string[],
) {
  if (isSysAdmin) return true
  if (!caller || !schoolId) return false
  return caller.school_id === schoolId && roles.includes(caller.role)
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { school_id } = (await req.json()) as RequestBody
    if (!school_id) return jsonResponse({ error: 'school_id required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    // Only an admin of this school (or a system admin) may remap it school-wide.
    const auth = await requireUser(req, supabaseUrl, serviceKey, anonKey)
    if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)
    if (!authorizedForSchool(auth.caller, auth.isSysAdmin, school_id, ['admin'])) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Fetch school's competencies with domain/subdomain context
    const { data: frameworks } = await sb
      .from('competency_frameworks')
      .select('id')
      .eq('school_id', school_id)
      .order('is_default', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)

    if (!frameworks || frameworks.length === 0) {
      return jsonResponse({ error: 'No competency framework found', mapped: 0 })
    }

    const frameworkId = frameworks[0].id

    const { data: competencies } = await sb
      .from('competencies')
      .select(`
        id, code, name, objective,
        subdomain:competency_subdomains(
          name,
          domain:competency_domains(name)
        )
      `)
      .eq('framework_id', frameworkId)

    if (!competencies || competencies.length === 0) {
      return jsonResponse({ error: 'No competencies found', mapped: 0 })
    }

    // Flatten competency info
    const compInfos: CompetencyInfo[] = competencies.map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      objective: c.objective,
      domain_name: c.subdomain?.domain?.name || 'Unknown',
      subdomain_name: c.subdomain?.name || 'Unknown',
    }))

    // 2. Fetch school's active dimensions
    const { data: dimensions } = await sb
      .from('dimensions')
      .select('id, name, description, category')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .order('display_order')

    if (!dimensions || dimensions.length === 0) {
      return jsonResponse({ error: 'No active dimensions found', mapped: 0 })
    }

    // 3. Build prompt and call Claude
    const dimensionList = dimensions
      .map((d: DimensionInfo) => `- "${d.name}" (${d.category}): ${d.description || 'No description'}`)
      .join('\n')

    const competencyList = compInfos
      .map((c) => `- ${c.code}: "${c.name}" [${c.domain_name} > ${c.subdomain_name}] — ${c.objective || 'No objective'}`)
      .join('\n')

    const systemPrompt = `You are an expert in curriculum alignment and competency mapping for K-10 education.

Your task: Map each competency to the most relevant school dimension(s).

A competency should map to 1-3 dimensions that it most directly develops. Consider:
- The competency's name, objective, and domain context
- The dimension's name, description, and category
- The natural pedagogical alignment between them

Return JSON array with objects: { "competency_id": "...", "dimension_id": "...", "confidence": 0.0-1.0, "reasoning": "brief explanation" }

Rules:
- Every competency must map to at least 1 dimension
- Maximum 3 dimensions per competency
- confidence >= 0.7 for primary mappings, 0.4-0.69 for secondary
- Be precise — don't over-map. A competency about "self-awareness" shouldn't map to "Mathematical Thinking"
- Return ONLY the JSON array, no other text`

    const userPrompt = `School Dimensions:
${dimensionList}

Competencies to Map:
${competencyList}

Map each competency to the most relevant dimension(s). Return ONLY the JSON array.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return jsonResponse({ error: `Anthropic API error: ${errText}` }, 500)
    }

    const aiResult = await response.json()
    const content = aiResult.content?.[0]?.text || '[]'

    // Parse the JSON array from Claude's response
    let mappings: MappingResult[]
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      mappings = JSON.parse(cleaned)
    } catch {
      return jsonResponse({ error: 'Failed to parse AI response', raw: content }, 500)
    }

    // 4. Validate and save mappings
    const validCompIds = new Set(compInfos.map((c) => c.id))
    const validDimIds = new Set(dimensions.map((d: DimensionInfo) => d.id))

    const validMappings = mappings.filter(
      (m) => validCompIds.has(m.competency_id) && validDimIds.has(m.dimension_id)
    )

    // Clear existing mappings for this school
    await sb
      .from('competency_dimension_mappings')
      .delete()
      .eq('school_id', school_id)

    // Insert new mappings
    if (validMappings.length > 0) {
      const inserts = validMappings.map((m) => ({
        school_id,
        competency_id: m.competency_id,
        dimension_id: m.dimension_id,
        confidence: Math.min(1, Math.max(0, m.confidence)),
        reasoning: m.reasoning,
      }))

      // Batch in groups of 100
      for (let i = 0; i < inserts.length; i += 100) {
        const batch = inserts.slice(i, i + 100)
        const { error } = await sb.from('competency_dimension_mappings').insert(batch)
        if (error) console.error('Insert batch error:', error)
      }
    }

    return jsonResponse({
      success: true,
      mapped: validMappings.length,
      total_competencies: compInfos.length,
      total_dimensions: dimensions.length,
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})

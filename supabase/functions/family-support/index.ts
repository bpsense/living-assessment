// supabase/functions/family-support/index.ts
// Supabase Edge Function — generates personalized family support suggestions
// by calling the Anthropic Claude API and caching results.
// Focuses on actionable, warm ideas for how families can support learning at home.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROMPT_VERSION = 'v1'

// ── Types ──────────────────────────────────────────────────────

interface ZoneDimension {
  dimension_id: string
  dimension_name: string
  zone: 'growth' | 'mastery' | 'cruise' | 'explore'
  competency: number
  interest: number
}

interface SchoolContext {
  mission?: string
  core_values?: string
  pedagogical_approach?: string
  teaching_methodologies?: string
  assessment_philosophy?: string
  curriculum_framework?: string
  standards_notes?: string
}

interface RequestBody {
  student_id: string
  school_id: string
  student_name: string
  grade_level: string | null
  zones: ZoneDimension[]
  school_context?: SchoolContext | null
  student_context?: string | null
}

interface FamilySuggestion {
  id: string
  category: string
  dimension_name: string
  title: string
  description: string
  why_it_helps: string
  materials_needed: string
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

/**
 * Deterministic SHA-256 hash of zone data + school context for cache lookup.
 * Zones are sorted by dimension_id so order doesn't matter.
 */
async function computeZoneHash(
  zones: ZoneDimension[],
  schoolContext?: SchoolContext | null,
  studentContextHash?: string | null
): Promise<string> {
  const sorted = [...zones].sort((a, b) =>
    a.dimension_id.localeCompare(b.dimension_id)
  )
  let canonical = sorted
    .map(
      (z) =>
        `${z.dimension_id}:${z.zone}:${z.competency.toFixed(2)}:${z.interest.toFixed(2)}`
    )
    .join('|')

  if (schoolContext) {
    const ctxParts = [
      schoolContext.mission,
      schoolContext.core_values,
      schoolContext.pedagogical_approach,
      schoolContext.teaching_methodologies,
      schoolContext.assessment_philosophy,
      schoolContext.curriculum_framework,
      schoolContext.standards_notes,
    ]
      .filter(Boolean)
      .join('||')
    if (ctxParts) canonical += `##${ctxParts}`
  }

  if (studentContextHash) {
    canonical += `$$${studentContextHash}`
  }

  // Prefix with "family-" to differentiate from learning-suggestions cache
  canonical = `family-${canonical}`

  const data = new TextEncoder().encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function formatZoneDimensions(dims: ZoneDimension[]): string {
  if (dims.length === 0) return '  (none)\n'
  return dims
    .map(
      (d) =>
        `  - ${d.dimension_name}: competency ${d.competency.toFixed(1)}/4, interest ${d.interest.toFixed(1)}/5`
    )
    .join('\n') + '\n'
}

function formatSchoolContext(ctx: SchoolContext | null | undefined): string {
  if (!ctx) return ''

  const lines: string[] = []
  if (ctx.mission) lines.push(`- School Mission: ${ctx.mission}`)
  if (ctx.core_values) lines.push(`- Core Values: ${ctx.core_values}`)
  if (ctx.pedagogical_approach) lines.push(`- Approach: ${ctx.pedagogical_approach}`)

  if (lines.length === 0) return ''

  return `\nSCHOOL CONTEXT (for alignment, do NOT use educational jargon in your response):
${lines.join('\n')}\n`
}

function buildPrompt(body: RequestBody): string {
  const groups = {
    growth: body.zones.filter((z) => z.zone === 'growth'),
    mastery: body.zones.filter((z) => z.zone === 'mastery'),
    cruise: body.zones.filter((z) => z.zone === 'cruise'),
    explore: body.zones.filter((z) => z.zone === 'explore'),
  }

  const schoolCtx = formatSchoolContext(body.school_context)

  // Rich prompt with full student context
  if (body.student_context) {
    return `You are a warm, experienced family engagement specialist who helps families support their children's learning at home through everyday moments and simple activities.

CHILD'S NAME: ${body.student_name}
GRADE LEVEL: ${body.grade_level ?? 'Not specified'}
${schoolCtx}
FULL LEARNING PROFILE:
${body.student_context}

LEARNING AREAS SUMMARY:

GROWTH areas (high interest, developing skill — great opportunity):
${formatZoneDimensions(groups.growth)}
MASTERY areas (strong skill and interest — build on these strengths):
${formatZoneDimensions(groups.mastery)}
CRUISE areas (strong skill, lower engagement — maintain naturally):
${formatZoneDimensions(groups.cruise)}
EXPLORE areas (still developing — needs a spark of curiosity):
${formatZoneDimensions(groups.explore)}

Generate 4-6 specific, actionable suggestions for how ${body.student_name}'s family can support learning AT HOME. Each suggestion should:

1. Use ${body.student_name}'s first name naturally in the description
2. Build on existing interests, strengths, and observations mentioned in the profile
3. Focus on natural moments — cooking together, bedtime reading, car rides, errands, weekends, outdoor play
4. Require NO special purchases or materials (use everyday household items)
5. Be written in warm, encouraging language — NO educational jargon
6. Feel doable for busy families — 5-15 minutes woven into daily life
7. Be culturally sensitive and flexible (don't assume specific family structures)
8. Explain WHY the activity helps in simple terms a parent would appreciate

For each suggestion return a JSON object with these exact fields:
- "id": unique string ("fam-1", "fam-2", etc.)
- "category": one of "daily-routine", "weekend-activity", "reading", "conversation", "creative-play", "outdoor", "social"
- "dimension_name": the learning area this supports
- "title": concise, inviting title (max 50 characters, e.g. "Kitchen Math with ${body.student_name}")
- "description": 2-3 warm sentences describing what the family can do. Be specific and practical.
- "why_it_helps": 1 sentence explaining why this supports ${body.student_name}'s development (in plain language)
- "materials_needed": what's needed — "None" or list simple household items only

Respond ONLY with a JSON array. No markdown fences, no other text.`
  }

  // Fallback: minimal prompt
  return `You are a warm, experienced family engagement specialist who helps families support their children's learning at home through everyday moments and simple activities.

CHILD'S NAME: ${body.student_name}
GRADE LEVEL: ${body.grade_level ?? 'Not specified'}
${schoolCtx}
LEARNING AREAS:

GROWTH areas (high interest, developing skill — great opportunity):
${formatZoneDimensions(groups.growth)}
MASTERY areas (strong skill and interest — build on these strengths):
${formatZoneDimensions(groups.mastery)}
CRUISE areas (strong skill, lower engagement — maintain naturally):
${formatZoneDimensions(groups.cruise)}
EXPLORE areas (still developing — needs a spark of curiosity):
${formatZoneDimensions(groups.explore)}

Generate 4-6 specific, actionable suggestions for how ${body.student_name}'s family can support learning AT HOME. Each suggestion should:

1. Use ${body.student_name}'s first name naturally in the description
2. Focus on natural moments — cooking together, bedtime reading, car rides, errands, weekends, outdoor play
3. Require NO special purchases or materials (use everyday household items)
4. Be written in warm, encouraging language — NO educational jargon
5. Feel doable for busy families — 5-15 minutes woven into daily life
6. Be culturally sensitive and flexible
7. Explain WHY the activity helps in simple terms

For each suggestion return a JSON object with these exact fields:
- "id": unique string ("fam-1", "fam-2", etc.)
- "category": one of "daily-routine", "weekend-activity", "reading", "conversation", "creative-play", "outdoor", "social"
- "dimension_name": the learning area this supports
- "title": concise, inviting title (max 50 characters)
- "description": 2-3 warm sentences describing what the family can do. Be specific and practical.
- "why_it_helps": 1 sentence explaining why this supports ${body.student_name}'s development (in plain language)
- "materials_needed": what's needed — "None" or list simple household items only

Respond ONLY with a JSON array. No markdown fences, no other text.`
}

// ── Claude API call ────────────────────────────────────────────

async function callClaude(
  prompt: string,
  apiKey: string
): Promise<FamilySuggestion[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Claude API error ${res.status}: ${errorText}`)
  }

  const result = await res.json()
  const text: string = result.content?.[0]?.text ?? ''

  // Extract JSON array from response (Claude may occasionally wrap in markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('No JSON array found in Claude response')
  }

  return JSON.parse(jsonMatch[0]) as FamilySuggestion[]
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicApiKey) {
      return jsonResponse(
        { error: 'ANTHROPIC_API_KEY not configured. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' },
        500
      )
    }

    // Create Supabase client with the caller's JWT so RLS applies
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // 2. Parse body
    const body: RequestBody = await req.json()

    if (!body.student_id || !body.school_id || !body.zones?.length) {
      return jsonResponse({ error: 'Missing required fields: student_id, school_id, zones' }, 400)
    }

    // 3. Compute a quick hash of the student context for cache invalidation
    let studentContextHash: string | null = null
    if (body.student_context) {
      const ctxData = new TextEncoder().encode(body.student_context)
      const ctxHashBuffer = await crypto.subtle.digest('SHA-256', ctxData)
      studentContextHash = Array.from(new Uint8Array(ctxHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)
    }

    // 4. Check cache
    const zoneHash = await computeZoneHash(body.zones, body.school_context, studentContextHash)

    const { data: cached } = await supabase
      .from('family_support_suggestions')
      .select('*')
      .eq('student_id', body.student_id)
      .eq('zone_hash', zoneHash)
      .eq('prompt_version', PROMPT_VERSION)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      return jsonResponse({
        suggestions: cached.suggestions,
        cached: true,
        suggestion_id: cached.id,
        educator_notes: cached.educator_notes,
      })
    }

    // 5. Generate via Claude
    const prompt = buildPrompt(body)
    const suggestions = await callClaude(prompt, anthropicApiKey)

    // 6. Cache the result
    const { data: inserted, error: insertError } = await supabase
      .from('family_support_suggestions')
      .insert({
        school_id: body.school_id,
        student_id: body.student_id,
        zone_hash: zoneHash,
        zone_data: body.zones,
        suggestions,
        requested_by: user.id,
        prompt_version: PROMPT_VERSION,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Cache insert failed:', insertError.message)
    }

    return jsonResponse({
      suggestions,
      cached: false,
      suggestion_id: inserted?.id ?? null,
      educator_notes: {},
    })
  } catch (err) {
    console.error('family-support error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    )
  }
})

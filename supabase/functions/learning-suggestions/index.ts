// supabase/functions/learning-suggestions/index.ts
// Supabase Edge Function — generates personalized learning suggestions
// by calling the Anthropic Claude API and caching results.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROMPT_VERSION = 'v3'

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

interface Suggestion {
  id: string
  zone: string
  dimension_name: string
  title: string
  description: string
  activity_type: string
  priority: string
  parent_friendly_summary: string | null
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
 * School context is included so cache invalidates when school context changes.
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

  // Include school context in hash if present
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

  // Include student context hash for cache invalidation
  if (studentContextHash) {
    canonical += `$$${studentContextHash}`
  }

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
  if (ctx.mission) lines.push(`- Mission: ${ctx.mission}`)
  if (ctx.core_values) lines.push(`- Core Values: ${ctx.core_values}`)
  if (ctx.pedagogical_approach) lines.push(`- Pedagogical Approach: ${ctx.pedagogical_approach}`)
  if (ctx.teaching_methodologies) lines.push(`- Teaching Methodologies: ${ctx.teaching_methodologies}`)
  if (ctx.assessment_philosophy) lines.push(`- Assessment Philosophy: ${ctx.assessment_philosophy}`)
  if (ctx.curriculum_framework) lines.push(`- Curriculum Framework: ${ctx.curriculum_framework}`)
  if (ctx.standards_notes) lines.push(`- Standards & Goals: ${ctx.standards_notes}`)

  if (lines.length === 0) return ''

  return `\nSCHOOL PEDAGOGICAL CONTEXT:
${lines.join('\n')}

IMPORTANT: Align all suggestions with the school's pedagogical approach, teaching methodologies, and assessment philosophy described above. Activities should feel natural within this school's educational framework.\n`
}

function buildPrompt(body: RequestBody): string {
  const groups = {
    growth: body.zones.filter((z) => z.zone === 'growth'),
    mastery: body.zones.filter((z) => z.zone === 'mastery'),
    cruise: body.zones.filter((z) => z.zone === 'cruise'),
    explore: body.zones.filter((z) => z.zone === 'explore'),
  }

  const schoolCtx = formatSchoolContext(body.school_context)

  // If we have a full student context document, use the rich prompt
  if (body.student_context) {
    return `You are an experienced early-childhood / elementary educator analyzing a student's complete learning profile to generate actionable, personalized suggestions for their teacher.

FULL STUDENT CONTEXT DOCUMENT:
${body.student_context}

LEARNING ZONE SUMMARY (for quick reference):

GROWTH ZONE (High interest, developing skill — HIGHEST LEARNING LEVERAGE):
${formatZoneDimensions(groups.growth)}
MASTERY ZONE (High interest, strong skill — challenge and extend):
${formatZoneDimensions(groups.mastery)}
CRUISE ZONE (Strong skill, lower engagement — maintain, don't push):
${formatZoneDimensions(groups.cruise)}
EXPLORE ZONE (Lower in both — needs a spark of curiosity first):
${formatZoneDimensions(groups.explore)}

Generate 3-5 specific, actionable learning activity suggestions that:
1. Draw on the FULL context above — reference specific observations, teacher notes, and family input where relevant
2. Prioritize Growth Zone dimensions (highest learning leverage)
3. Use strengths from the Mastery Zone to scaffold into weaker areas
4. Acknowledge the student's home interests and strengths noted by family
5. Suggest creative ways to spark curiosity in Explore Zone dimensions
6. Avoid pushing Cruise Zone dimensions — mention only if they connect naturally
7. Align with the school's pedagogical approach if described in the context

For each suggestion return a JSON object with these exact fields:
- "id": unique string ("sug-1", "sug-2", etc.)
- "zone": primary zone this targets ("growth", "mastery", "cruise", or "explore")
- "dimension_name": the dimension this suggestion is for
- "title": concise title (max 60 characters)
- "description": 2-3 sentences describing the activity, materials, or approach. Reference specific observations or notes where relevant.
- "activity_type": one of "project", "exploration", "practice", "challenge", "connection"
- "priority": "high" for growth zone, "medium" for mastery/explore, "low" for cruise
- "parent_friendly_summary": one warm, encouraging sentence suitable to share with the student's family

Respond ONLY with a JSON array. No markdown fences, no other text.`
  }

  // Fallback: minimal prompt (no context document available)
  return `You are an experienced early-childhood / elementary educator analyzing a student's learning profile to generate actionable suggestions for their teacher.

STUDENT CONTEXT:
- Name: ${body.student_name}
- Grade: ${body.grade_level ?? 'Not specified'}
${schoolCtx}
LEARNING ZONES (based on observed competency and student-reported interest):

GROWTH ZONE (High interest, developing skill — HIGHEST LEARNING LEVERAGE):
${formatZoneDimensions(groups.growth)}
MASTERY ZONE (High interest, strong skill — challenge and extend):
${formatZoneDimensions(groups.mastery)}
CRUISE ZONE (Strong skill, lower engagement — maintain, don't push):
${formatZoneDimensions(groups.cruise)}
EXPLORE ZONE (Lower in both — needs a spark of curiosity first):
${formatZoneDimensions(groups.explore)}

Generate 3-5 specific, actionable learning activity suggestions that:
1. Prioritize Growth Zone dimensions (highest learning leverage)
2. Use strengths from the Mastery Zone to scaffold into weaker areas
3. Suggest creative ways to spark curiosity in Explore Zone dimensions
4. Avoid pushing Cruise Zone dimensions — mention only if they connect naturally${schoolCtx ? '\n5. Align with the school\'s pedagogical approach and curriculum framework' : ''}

For each suggestion return a JSON object with these exact fields:
- "id": unique string ("sug-1", "sug-2", etc.)
- "zone": primary zone this targets ("growth", "mastery", "cruise", or "explore")
- "dimension_name": the dimension this suggestion is for
- "title": concise title (max 60 characters)
- "description": 2-3 sentences describing the activity, materials, or approach
- "activity_type": one of "project", "exploration", "practice", "challenge", "connection"
- "priority": "high" for growth zone, "medium" for mastery/explore, "low" for cruise
- "parent_friendly_summary": one warm, encouraging sentence suitable to share with the student's family

Respond ONLY with a JSON array. No markdown fences, no other text.`
}

// ── Claude API call ────────────────────────────────────────────

async function callClaude(
  prompt: string,
  apiKey: string
): Promise<Suggestion[]> {
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

  return JSON.parse(jsonMatch[0]) as Suggestion[]
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
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('getUser failed:', authError?.message)
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
        .slice(0, 16) // First 16 hex chars is enough for cache invalidation
    }

    // 4. Check cache
    const zoneHash = await computeZoneHash(body.zones, body.school_context, studentContextHash)

    const { data: cached } = await supabase
      .from('learning_suggestions')
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
        educator_actions: cached.educator_actions,
      })
    }

    // 5. Generate via Claude
    const prompt = buildPrompt(body)
    const suggestions = await callClaude(prompt, anthropicApiKey)

    // 6. Cache the result
    const { data: inserted, error: insertError } = await supabase
      .from('learning_suggestions')
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
      educator_actions: {},
    })
  } catch (err) {
    console.error('learning-suggestions error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    )
  }
})

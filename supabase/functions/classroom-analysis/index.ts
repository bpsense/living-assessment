// supabase/functions/classroom-analysis/index.ts
// Supabase Edge Function — generates a classroom-level AI analysis by calling
// the Anthropic Claude API. Looks across all active learners' competency data,
// parent feedback, and educator notes to surface trends, learner clusters that
// would benefit from shared personalized learning, and outliers needing
// attention. Results are cached in classroom_analyses keyed by an input hash.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROMPT_VERSION = 'v1'

// ── Types ──────────────────────────────────────────────────────

interface StudentScore {
  dimension_id: string
  dimension_name: string
  competency: number // 0-4 (0 = no data)
  interest: number // 0-5 (0 = no data)
}

interface StudentPayload {
  id: string
  first_name: string
  last_name: string
  grade_level: string | null
  age: number | null
  scores: StudentScore[]
}

interface RequestBody {
  classroom_id: string
  school_id: string
  classroom_name: string
  grade_level: string | null
  dimensions: { id: string; name: string }[]
  students: StudentPayload[]
}

interface ClassroomAnalysis {
  summary: string
  trends: { title: string; detail: string; dimension_name?: string | null }[]
  clusters: {
    dimension_name: string
    students: string[]
    rationale: string
    suggested_focus: string
  }[]
  outliers: { student_name: string; concern: string; recommended_action: string }[]
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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Deterministic hash of the analysis inputs (students, scores, notes digest)
 * so identical classroom state reuses a cached analysis.
 */
async function computeInputHash(body: RequestBody, notesDigest: string): Promise<string> {
  const studentsCanonical = [...body.students]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      const scores = [...s.scores]
        .sort((a, b) => a.dimension_id.localeCompare(b.dimension_id))
        .map((sc) => `${sc.dimension_id}:${sc.competency.toFixed(2)}:${sc.interest.toFixed(2)}`)
        .join(',')
      return `${s.id}|${s.age ?? ''}|${s.grade_level ?? ''}|${scores}`
    })
    .join('||')
  return sha256Hex(`${body.classroom_id}##${studentsCanonical}##${notesDigest}`)
}

const LEVEL_LABEL: Record<number, string> = {
  0: 'no data',
  1: 'Emerging',
  2: 'Developing',
  3: 'Achieving',
  4: 'Mastery',
}

function compBucket(score: number): number {
  if (score <= 0) return 0
  if (score < 1.5) return 1
  if (score < 2.5) return 2
  if (score < 3.5) return 3
  return 4
}

function formatStudentBlock(
  s: StudentPayload,
  notesByStudent: Map<string, string[]>,
  parentByStudent: Map<string, string[]>
): string {
  const name = `${s.first_name} ${s.last_name[0]}.`
  const ageGrade = [
    s.age != null ? `age ${s.age}` : null,
    s.grade_level ? `grade ${s.grade_level}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const scoreLines = s.scores
    .filter((sc) => sc.competency > 0 || sc.interest > 0)
    .map(
      (sc) =>
        `    - ${sc.dimension_name}: competency ${sc.competency.toFixed(1)}/4 (${LEVEL_LABEL[compBucket(sc.competency)]}), interest ${sc.interest.toFixed(1)}/5`
    )
    .join('\n')

  let block = `  ${name}${ageGrade ? ` (${ageGrade})` : ''}\n${scoreLines || '    - no competency/interest data yet'}`

  const eduNotes = notesByStudent.get(s.id) ?? []
  if (eduNotes.length > 0) {
    block += `\n    Educator notes: ${eduNotes.slice(0, 3).join(' | ')}`
  }
  const parentNotes = parentByStudent.get(s.id) ?? []
  if (parentNotes.length > 0) {
    block += `\n    Family input: ${parentNotes.slice(0, 2).join(' | ')}`
  }
  return block
}

function buildPrompt(
  body: RequestBody,
  notesByStudent: Map<string, string[]>,
  parentByStudent: Map<string, string[]>
): string {
  const studentBlocks = body.students
    .map((s) => formatStudentBlock(s, notesByStudent, parentByStudent))
    .join('\n\n')

  return `You are an experienced instructional coach analyzing a whole classroom's learning data to help the lead educator plan. The competency scale is 1-4: 1=Emerging, 2=Developing, 3=Achieving, 4=Mastery. Interest is self-reported 1-5. "Below age expectation" generally means a competency notably lower than what is typical for the learner's age/grade and lower than most classroom peers in that dimension.

CLASSROOM: ${body.classroom_name}${body.grade_level ? ` (Grade ${body.grade_level})` : ''}
LEARNERS: ${body.students.length}
DIMENSIONS: ${body.dimensions.map((d) => d.name).join(', ')}

LEARNER PROFILES:
${studentBlocks}

Analyze the classroom and produce:
1. TRENDS — class-wide patterns across dimensions (strengths, common gaps, interest vs. competency mismatches).
2. CLUSTERS — groups of learners who share a specific area below age expectation and would benefit from the SAME small-group personalized learning focus. Each cluster targets one dimension and lists the learners (use "First L." names exactly as shown above).
3. OUTLIERS — individual learners who stand out and may need attention: significantly below expectation across areas, a sharp interest/competency mismatch, or signals from educator/family notes.

Return ONLY a JSON object (no markdown fences, no extra text) with this exact shape:
{
  "summary": "2-3 sentence overview of the class's current state",
  "trends": [ { "title": "short title", "detail": "1-2 sentences", "dimension_name": "dimension or null" } ],
  "clusters": [ { "dimension_name": "the dimension", "students": ["First L.", "First L."], "rationale": "why these learners group together", "suggested_focus": "a concrete shared personalized-learning focus" } ],
  "outliers": [ { "student_name": "First L.", "concern": "what stands out", "recommended_action": "a concrete next step" } ]
}

Only include clusters with 2 or more learners. If there is insufficient data for a section, return an empty array for it. Base every claim strictly on the data provided.`
}

// ── Claude API call ────────────────────────────────────────────

async function callClaude(prompt: string, apiKey: string): Promise<ClassroomAnalysis> {
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
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON object found in Claude response')
  }
  return JSON.parse(jsonMatch[0]) as ClassroomAnalysis
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body: RequestBody = await req.json()
    if (!body.classroom_id || !body.school_id || !body.students?.length) {
      return jsonResponse(
        { error: 'Missing required fields: classroom_id, school_id, students' },
        400
      )
    }

    const studentIds = body.students.map((s) => s.id)

    // Gather qualitative context (RLS-scoped to the caller): recent educator
    // notes (non-confidential) and family notes for these learners.
    const sixMonthsAgo = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString()
    const [eduNotesRes, parentNotesRes] = await Promise.all([
      supabase
        .from('teacher_notes')
        .select('student_id, content, note_type, created_at')
        .in('student_id', studentIds)
        .eq('is_confidential', false)
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: false }),
      supabase
        .from('parent_notes')
        .select('student_id, content, note_type, created_at')
        .in('student_id', studentIds)
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: false }),
    ])

    const notesByStudent = new Map<string, string[]>()
    for (const n of (eduNotesRes.data ?? []) as { student_id: string; content: string }[]) {
      const arr = notesByStudent.get(n.student_id) ?? []
      if (arr.length < 3) arr.push(n.content.slice(0, 200))
      notesByStudent.set(n.student_id, arr)
    }
    const parentByStudent = new Map<string, string[]>()
    for (const n of (parentNotesRes.data ?? []) as { student_id: string; content: string }[]) {
      const arr = parentByStudent.get(n.student_id) ?? []
      if (arr.length < 2) arr.push(n.content.slice(0, 200))
      parentByStudent.set(n.student_id, arr)
    }

    // Cache lookup
    const notesDigest = await sha256Hex(
      JSON.stringify([...notesByStudent.entries()]) + JSON.stringify([...parentByStudent.entries()])
    )
    const inputHash = await computeInputHash(body, notesDigest)

    const { data: cached } = await supabase
      .from('classroom_analyses')
      .select('id, analysis, created_at')
      .eq('classroom_id', body.classroom_id)
      .eq('input_hash', inputHash)
      .eq('prompt_version', PROMPT_VERSION)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      return jsonResponse({
        analysis: cached.analysis,
        cached: true,
        analysis_id: cached.id,
        generated_at: cached.created_at,
      })
    }

    // Generate via Claude
    const prompt = buildPrompt(body, notesByStudent, parentByStudent)
    const analysis = await callClaude(prompt, anthropicApiKey)

    const { data: inserted, error: insertError } = await supabase
      .from('classroom_analyses')
      .insert({
        classroom_id: body.classroom_id,
        school_id: body.school_id,
        input_hash: inputHash,
        analysis,
        prompt_version: PROMPT_VERSION,
        requested_by: user.id,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      console.error('Cache insert failed:', insertError.message)
    }

    return jsonResponse({
      analysis,
      cached: false,
      analysis_id: inserted?.id ?? null,
      generated_at: inserted?.created_at ?? new Date().toISOString(),
    })
  } catch (err) {
    console.error('classroom-analysis error:', err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500
    )
  }
})

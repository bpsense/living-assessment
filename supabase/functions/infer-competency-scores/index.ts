// supabase/functions/infer-competency-scores/index.ts
// AI edge function: analyzes qualitative feedback to suggest competency scores.
// Called after a teacher provides qualitative feedback on a student assignment.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────

interface RequestBody {
  student_assignment_id: string
}

interface InferredScore {
  competency_id: string
  suggested_score: number
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

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { student_assignment_id } = (await req.json()) as RequestBody
    if (!student_assignment_id) {
      return jsonResponse({ error: 'student_assignment_id required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Fetch student assignment with details
    const { data: sa, error: saErr } = await sb
      .from('student_assignments')
      .select(`
        id, qualitative_feedback, student_id,
        assignment:assignments(
          id, title, description,
          assignment_competencies(
            competency:competencies(
              id, code, name, objective, step_descriptors
            )
          )
        ),
        student:students(first_name, last_name, grade_level)
      `)
      .eq('id', student_assignment_id)
      .single()

    if (saErr || !sa) {
      return jsonResponse({ error: 'Student assignment not found' }, 404)
    }

    const feedback = sa.qualitative_feedback
    if (!feedback || feedback.trim().length < 10) {
      return jsonResponse({ error: 'Insufficient qualitative feedback', inferred: [] })
    }

    const assignment = (sa as any).assignment
    const student = (sa as any).student
    const competencies = (assignment?.assignment_competencies || []).map((ac: any) => ac.competency)

    if (competencies.length === 0) {
      return jsonResponse({ error: 'No competencies linked to assignment', inferred: [] })
    }

    // 2. Get existing teacher scores to know which are already rated
    const { data: existingScores } = await sb
      .from('competency_scores')
      .select('competency_id, score')
      .eq('student_assignment_id', student_assignment_id)
      .eq('source', 'teacher')

    const ratedIds = new Set((existingScores || []).map((s: any) => s.competency_id))

    // Identify unrated competencies
    const unrated = competencies.filter((c: any) => !ratedIds.has(c.id))

    // Even for rated competencies, AI can suggest adjustments
    const gradeLevel = student?.grade_level || '1'

    // 3. Build prompt
    const competencyDescriptions = competencies
      .map((c: any) => {
        const stepKey = gradeLevel
        const descriptor = c.step_descriptors?.[stepKey] || c.objective || 'No descriptor'
        const rated = ratedIds.has(c.id)
        const existing = existingScores?.find((s: any) => s.competency_id === c.id)
        return `- ${c.code} "${c.name}": ${descriptor}${rated ? ` [Already rated: ${existing?.score}]` : ' [NOT YET RATED]'}`
      })
      .join('\n')

    const systemPrompt = `You are an expert K-10 educator analyzing student work feedback.

Your task: Based on the teacher's qualitative feedback, infer competency scores for competencies that haven't been explicitly rated.

Rating scale (0-4 with 1/3 increments):
- 0.33, 0.67, 1.00 = Emerging (beginning to show awareness)
- 1.33, 1.67, 2.00 = Developing (growing understanding)
- 2.33, 2.67, 3.00 = Achieving (solid demonstration)
- 3.33, 3.67, 4.00 = Mastery (consistent, deep understanding)

Guidelines:
- Only infer scores for competencies marked [NOT YET RATED] unless the feedback strongly contradicts an existing rating
- Be conservative — only suggest a score if the feedback provides clear evidence
- Provide brief reasoning for each inference
- Return a JSON array: [{ "competency_id": "...", "suggested_score": 2.33, "reasoning": "..." }]
- If no inferences can be made, return an empty array []
- Return ONLY the JSON array, no other text`

    const userPrompt = `Student: ${student?.first_name} ${student?.last_name} (Grade ${gradeLevel})
Assignment: "${assignment?.title}"
${assignment?.description ? `Description: ${assignment.description}` : ''}

Competencies:
${competencyDescriptions}

Teacher's Qualitative Feedback:
"${feedback}"

Analyze the feedback and suggest scores for unrated competencies. Return ONLY the JSON array.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
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

    let inferred: InferredScore[]
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      inferred = JSON.parse(cleaned)
    } catch {
      return jsonResponse({ error: 'Failed to parse AI response', raw: content }, 500)
    }

    // 4. Validate inferred scores
    const validCompIds = new Set(competencies.map((c: any) => c.id))
    const validInferred = inferred.filter(
      (s) =>
        validCompIds.has(s.competency_id) &&
        typeof s.suggested_score === 'number' &&
        s.suggested_score >= 0 &&
        s.suggested_score <= 4
    )

    // 5. Save inferred scores to student_assignment for teacher review
    await sb
      .from('student_assignments')
      .update({ ai_inferred_scores: validInferred })
      .eq('id', student_assignment_id)

    return jsonResponse({
      success: true,
      inferred: validInferred,
      total_competencies: competencies.length,
      already_rated: ratedIds.size,
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})

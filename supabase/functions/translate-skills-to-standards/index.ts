// supabase/functions/translate-skills-to-standards/index.ts
// AI edge function: translates a student's assessed skills/competencies
// to a target standards framework (CCSS, NGSS, IB, etc.)
//
// Input: { student_id, school_id, target_framework_id }
// Output: { mappings: [...], error?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────

interface RequestBody {
  student_id: string
  school_id: string
  target_framework_id: string
}

interface AssessmentInfo {
  id: string
  source_type: 'competency_score' | 'skill_assessment'
  skill_name: string
  domain_name: string
  score: number
  level: string
  grade_level: string | null
  description: string
}

interface StandardInfo {
  id: string
  code: string
  description: string
  grade_level: string | null
  domain: string | null
}

interface MappingResult {
  source_id: string
  source_type: 'competency_score' | 'skill_assessment'
  standard_id: string
  confidence: number
  level_in_standard: string
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

function scoreToLevel(score: number): string {
  if (score < 1.5) return 'Emerging'
  if (score < 2.5) return 'Developing'
  if (score < 3.5) return 'Achieving'
  return 'Exceeding'
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { student_id, school_id, target_framework_id } = (await req.json()) as RequestBody
    if (!student_id || !school_id || !target_framework_id) {
      return jsonResponse({ error: 'student_id, school_id, and target_framework_id required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Fetch student info (age/grade)
    const { data: student } = await sb
      .from('students')
      .select('id, first_name, last_name, date_of_birth, grade_level')
      .eq('id', student_id)
      .single()

    if (!student) {
      return jsonResponse({ error: 'Student not found' }, 404)
    }

    const studentAge = student.date_of_birth
      ? Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    // 2. Fetch the student's competency scores with competency context
    const { data: compScores } = await sb
      .from('competency_scores')
      .select(`
        id, score, competency_id, source, scored_at,
        competency:competencies(
          code, name, objective,
          subdomain:competency_subdomains(
            name,
            domain:competency_domains(name)
          )
        )
      `)
      .eq('student_id', student_id)
      .eq('school_id', school_id)
      .order('scored_at', { ascending: false })

    // 3. Fetch the student's graded skill assignments
    const { data: skillAssignments } = await sb
      .from('student_skill_assignments')
      .select(`
        id, score, status, notes,
        skill_assignment:skill_assignments(
          skill:skills(name, description, category, progression_domain, progression_strand),
          assigned_step:skill_progression_steps(grade_level, expectation_description)
        )
      `)
      .eq('student_id', student_id)
      .eq('status', 'graded')
      .not('score', 'is', null)

    // Build assessment list
    const assessments: AssessmentInfo[] = []

    // From competency scores
    if (compScores) {
      for (const cs of compScores as any[]) {
        const comp = cs.competency
        if (!comp) continue
        assessments.push({
          id: cs.id,
          source_type: 'competency_score',
          skill_name: comp.name || comp.code,
          domain_name: comp.subdomain?.domain?.name || 'Unknown',
          score: cs.score,
          level: scoreToLevel(cs.score),
          grade_level: student.grade_level,
          description: comp.objective || comp.name,
        })
      }
    }

    // From skill assignments
    if (skillAssignments) {
      for (const sa of skillAssignments as any[]) {
        const skill = sa.skill_assignment?.skill
        const step = sa.skill_assignment?.assigned_step
        if (!skill || sa.score === null) continue
        assessments.push({
          id: sa.id,
          source_type: 'skill_assessment',
          skill_name: skill.name,
          domain_name: skill.progression_domain || skill.category || 'General',
          score: sa.score,
          level: scoreToLevel(sa.score),
          grade_level: step?.grade_level || student.grade_level,
          description: skill.description || skill.name,
        })
      }
    }

    if (assessments.length === 0) {
      return jsonResponse({
        mappings: [],
        error: 'No assessments found for this student',
      })
    }

    // 4. Fetch target framework standards
    const { data: framework } = await sb
      .from('standards_frameworks')
      .select('id, name, framework_type')
      .eq('id', target_framework_id)
      .single()

    if (!framework) {
      return jsonResponse({ error: 'Target framework not found' }, 404)
    }

    const { data: standards } = await sb
      .from('standards')
      .select('id, code, description, grade_level, domain')
      .eq('framework_id', target_framework_id)
      .not('grade_level', 'is', null) // Only leaf standards with grade levels
      .order('display_order')

    if (!standards || standards.length === 0) {
      return jsonResponse({
        mappings: [],
        error: 'No standards found in target framework',
      })
    }

    // 5. Filter standards to relevant grade band
    const gradeStr = student.grade_level || (studentAge ? String(Math.max(0, studentAge - 5)) : null)
    const relevantStandards = filterStandardsByGrade(standards as StandardInfo[], gradeStr)

    // 6. Build prompt and call Claude
    const assessmentList = assessments
      .slice(0, 50) // Limit to 50 most recent assessments
      .map((a) =>
        `- [${a.source_type}:${a.id}] "${a.skill_name}" (${a.domain_name}) — Level: ${a.level} (${a.score.toFixed(1)}/4) — ${a.description}`
      )
      .join('\n')

    const standardsList = relevantStandards
      .map((s) => `- [${s.id}] ${s.code}: ${s.description} (Grade: ${s.grade_level || 'N/A'})`)
      .join('\n')

    const systemPrompt = `You are an expert in curriculum alignment and standards translation for K-10 education.

Your task: Map a student's assessed skills and competencies to the most relevant standards in the "${framework.name}" framework.

Context:
- Student grade: ${gradeStr || 'Unknown'}
- Student age: ${studentAge || 'Unknown'}
- Assessment levels: Emerging (0-1.5), Developing (1.5-2.5), Achieving (2.5-3.5), Exceeding (3.5-4.0)

Rules:
- Each assessment can map to 0-3 standards (not every assessment will have a match)
- Only create a mapping if there is genuine alignment between the skill and the standard
- confidence >= 0.7 for strong alignments, 0.4-0.69 for partial
- level_in_standard should translate the student's level to the standard's framework context
  - For a student "Achieving" on a grade-level standard: "Meets Standard"
  - For a student "Developing" on a grade-level standard: "Approaching Standard"
  - For a student "Emerging": "Below Standard"
  - For a student "Exceeding": "Exceeds Standard"
- Be conservative — it is better to have fewer high-confidence mappings than many low-confidence ones
- Return ONLY a JSON array of mapping objects`

    const userPrompt = `Student Assessments:
${assessmentList}

Target Standards (${framework.name}):
${standardsList}

Map each assessment to relevant standards. Return ONLY a JSON array with objects:
{ "source_id": "...", "source_type": "competency_score"|"skill_assessment", "standard_id": "...", "confidence": 0.0-1.0, "level_in_standard": "...", "reasoning": "brief explanation" }`

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
      return jsonResponse({ error: `AI API error: ${errText}`, mappings: [] }, 500)
    }

    const aiResult = await response.json()
    const content = aiResult.content?.[0]?.text || '[]'

    // Parse the JSON array from Claude's response
    let mappings: MappingResult[]
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      mappings = JSON.parse(cleaned)
    } catch {
      return jsonResponse({ error: 'Failed to parse AI response', mappings: [], raw: content }, 500)
    }

    // 7. Validate mappings
    const validSourceIds = new Set(assessments.map((a) => a.id))
    const validStandardIds = new Set(relevantStandards.map((s) => s.id))

    const validMappings = mappings.filter(
      (m) => validSourceIds.has(m.source_id) && validStandardIds.has(m.standard_id)
    ).map((m) => ({
      ...m,
      confidence: Math.min(1, Math.max(0, m.confidence)),
    }))

    return jsonResponse({
      mappings: validMappings,
      total_assessments: assessments.length,
      total_standards: relevantStandards.length,
      total_mappings: validMappings.length,
    })
  } catch (err) {
    return jsonResponse({ error: String(err), mappings: [] }, 500)
  }
})

// ── Grade filtering helper ─────────────────────────────────────

function filterStandardsByGrade(standards: StandardInfo[], gradeStr: string | null): StandardInfo[] {
  if (!gradeStr || standards.length <= 100) return standards

  // Parse grade to numeric for comparison
  const gradeNum = parseGradeToNum(gradeStr)
  if (gradeNum === null) return standards

  // Include standards within ±2 grade levels
  return standards.filter((s) => {
    if (!s.grade_level) return false
    const sGrade = parseGradeToNum(s.grade_level)
    if (sGrade === null) return true // Include if can't parse
    return Math.abs(sGrade - gradeNum) <= 2
  })
}

function parseGradeToNum(grade: string): number | null {
  const g = grade.trim().toUpperCase()
  if (g === 'K' || g === 'PRE-K' || g === 'TK') return 0
  // Handle ranges like "K-2", "3-5", "6-8"
  if (g.includes('-')) {
    const parts = g.split('-').map((p) => parseGradeToNum(p.trim()))
    const nums = parts.filter((p): p is number => p !== null)
    if (nums.length > 0) return nums.reduce((a, b) => a + b, 0) / nums.length
    return null
  }
  const n = parseInt(g, 10)
  return isNaN(n) ? null : n
}

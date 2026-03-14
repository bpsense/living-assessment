import type { AssignmentTemplate } from '../types/database'

// ============================================================
// Types
// ============================================================

export interface PBLValidationResult {
  score: number
  elements: {
    challenging_problem: ValidationItem
    sustained_inquiry: ValidationItem
    authenticity: ValidationItem
    student_voice_choice: ValidationItem
    reflection: ValidationItem
    critique_revision: ValidationItem
    public_product: ValidationItem
  }
  suggestions: string[]
}

export interface ValidationItem {
  present: boolean
  strength: 'missing' | 'weak' | 'adequate' | 'strong'
  feedback: string
}

// ============================================================
// Validator
// ============================================================

export function validateTemplate(
  template: Pick<
    AssignmentTemplate,
    | 'driving_question'
    | 'phases'
    | 'authenticity_hook'
    | 'final_product'
    | 'choice_points'
    | 'critique_protocol'
  >
): PBLValidationResult {
  const suggestions: string[] = []

  // 1. Challenging Problem
  const challenging_problem = validateChallengingProblem(template.driving_question, suggestions)

  // 2. Sustained Inquiry
  const sustained_inquiry = validateSustainedInquiry(template.phases, suggestions)

  // 3. Authenticity
  const authenticity = validateAuthenticity(template.authenticity_hook, template.final_product, suggestions)

  // 4. Student Voice & Choice
  const student_voice_choice = validateStudentVoice(template.choice_points, template.phases, suggestions)

  // 5. Reflection
  const reflection = validateReflection(template.phases, suggestions)

  // 6. Critique & Revision
  const critique_revision = validateCritique(template.critique_protocol, template.phases, suggestions)

  // 7. Public Product
  const public_product = validatePublicProduct(template.final_product, suggestions)

  const elements = {
    challenging_problem,
    sustained_inquiry,
    authenticity,
    student_voice_choice,
    reflection,
    critique_revision,
    public_product,
  }

  // Score: each element worth ~14 points, weighted by strength
  const strengthScores: Record<string, number> = {
    missing: 0,
    weak: 5,
    adequate: 10,
    strong: 14,
  }

  const rawScore = Object.values(elements).reduce(
    (sum, item) => sum + strengthScores[item.strength],
    0
  )
  const score = Math.min(100, Math.round((rawScore / 98) * 100))

  return { score, elements, suggestions }
}

// ============================================================
// Individual validators
// ============================================================

function validateChallengingProblem(
  drivingQuestion: string | null,
  suggestions: string[]
): ValidationItem {
  if (!drivingQuestion || drivingQuestion.trim().length === 0) {
    suggestions.push('Add a driving question to frame the project.')
    return { present: false, strength: 'missing', feedback: 'No driving question provided.' }
  }

  const words = drivingQuestion.trim().split(/\s+/)
  if (words.length < 10) {
    suggestions.push('Expand your driving question — aim for a rich, open-ended prompt.')
    return { present: true, strength: 'weak', feedback: 'Driving question is short (fewer than 10 words).' }
  }

  const openStems = /^(how|why|what if|in what ways|what would)/i
  if (openStems.test(drivingQuestion.trim())) {
    return { present: true, strength: 'strong', feedback: 'Open-ended driving question with strong inquiry stem.' }
  }

  return { present: true, strength: 'adequate', feedback: 'Driving question present. Consider starting with "How might we...", "Why does...", or "What would happen if...".' }
}

function validateSustainedInquiry(
  phases: AssignmentTemplate['phases'],
  suggestions: string[]
): ValidationItem {
  if (!phases || phases.length === 0) {
    suggestions.push('Add project phases to support sustained inquiry.')
    return { present: false, strength: 'missing', feedback: 'No project phases defined.' }
  }

  if (phases.length < 3) {
    suggestions.push('Add at least 3 phases for sustained, iterative inquiry.')
    return { present: true, strength: 'weak', feedback: `Only ${phases.length} phase(s). PBL projects typically need 3-4+ phases.` }
  }

  const totalDays = phases.reduce((s, p) => s + p.duration_days, 0)
  const hasDeepPhase = phases.some((p) => p.dok_level >= 3)
  const hasInvestigation = phases.some((p) =>
    p.activities.some((a) => a.activity_type === 'investigation')
  )

  if (totalDays >= 5 && hasDeepPhase && hasInvestigation) {
    return { present: true, strength: 'strong', feedback: `${phases.length} phases over ${totalDays} days with deep inquiry activities.` }
  }

  return { present: true, strength: 'adequate', feedback: `${phases.length} phases, ${totalDays} day(s). Consider adding investigation activities and DOK 3+ phases.` }
}

function validateAuthenticity(
  authenticityHook: string | null,
  finalProduct: AssignmentTemplate['final_product'],
  suggestions: string[]
): ValidationItem {
  if (!authenticityHook || authenticityHook.trim().length === 0) {
    suggestions.push('Describe how this project connects to the real world (authenticity hook).')
    return { present: false, strength: 'missing', feedback: 'No authenticity hook described.' }
  }

  const audience = finalProduct?.audience?.toLowerCase() ?? ''
  const isExternalAudience = audience && audience !== 'teacher' && audience !== 'class' && audience !== 'classroom'

  if (isExternalAudience) {
    return { present: true, strength: 'strong', feedback: 'Real-world connection with an external audience.' }
  }

  return { present: true, strength: 'adequate', feedback: 'Authenticity hook present. Consider specifying an audience beyond the classroom.' }
}

function validateStudentVoice(
  choicePoints: AssignmentTemplate['choice_points'],
  _phases: AssignmentTemplate['phases'],
  suggestions: string[]
): ValidationItem {
  if (!choicePoints || choicePoints.length === 0) {
    suggestions.push('Add choice points where learners can make decisions about their learning.')
    return { present: false, strength: 'missing', feedback: 'No choice points defined.' }
  }

  const phaseIds = new Set(choicePoints.map((cp) => cp.phase_id))
  const hasProductChoice = choicePoints.some((cp) => cp.choice_type === 'product_format')
  const multiPhase = phaseIds.size >= 2

  if (multiPhase && hasProductChoice) {
    return { present: true, strength: 'strong', feedback: `${choicePoints.length} choice points across ${phaseIds.size} phases, including product format choice.` }
  }

  if (choicePoints.length >= 2) {
    return { present: true, strength: 'adequate', feedback: `${choicePoints.length} choice points. Consider spanning multiple phases and including product format choice.` }
  }

  return { present: true, strength: 'weak', feedback: 'Only 1 choice point. Add more opportunities for learner agency.' }
}

function validateReflection(
  phases: AssignmentTemplate['phases'],
  suggestions: string[]
): ValidationItem {
  if (!phases || phases.length === 0) {
    return { present: false, strength: 'missing', feedback: 'No phases to contain reflection prompts.' }
  }

  const phasesWithReflection = phases.filter(
    (p) => p.reflection_prompts && p.reflection_prompts.length > 0
  )

  if (phasesWithReflection.length === 0) {
    suggestions.push('Add reflection prompts to at least 2 phases.')
    return { present: false, strength: 'missing', feedback: 'No reflection prompts in any phase.' }
  }

  if (phasesWithReflection.length < 2) {
    suggestions.push('Add reflection prompts to more phases — reflection should be ongoing.')
    return { present: true, strength: 'weak', feedback: `Reflection in ${phasesWithReflection.length} of ${phases.length} phases.` }
  }

  if (phasesWithReflection.length === phases.length) {
    return { present: true, strength: 'strong', feedback: 'Reflection prompts in every phase.' }
  }

  return { present: true, strength: 'adequate', feedback: `Reflection in ${phasesWithReflection.length} of ${phases.length} phases.` }
}

function validateCritique(
  critiqueProtocol: string | null,
  phases: AssignmentTemplate['phases'],
  suggestions: string[]
): ValidationItem {
  const hasCritiqueProtocol = !!critiqueProtocol && critiqueProtocol.trim().length > 0
  const hasPeerCheckpoint = (phases ?? []).some(
    (p) =>
      p.checkpoint &&
      (p.checkpoint.assessment_type === 'peer_review' || p.checkpoint.assessment_type === 'group_critique')
  )

  if (!hasCritiqueProtocol && !hasPeerCheckpoint) {
    suggestions.push('Add a critique protocol or peer review checkpoint for feedback and revision.')
    return { present: false, strength: 'missing', feedback: 'No critique protocol or peer review checkpoints.' }
  }

  if (hasCritiqueProtocol && hasPeerCheckpoint) {
    return { present: true, strength: 'strong', feedback: 'Critique protocol and peer review checkpoint both present.' }
  }

  return { present: true, strength: 'adequate', feedback: hasCritiqueProtocol ? 'Critique protocol present. Consider adding a peer review checkpoint.' : 'Peer review checkpoint present. Consider adding a critique protocol.' }
}

function validatePublicProduct(
  finalProduct: AssignmentTemplate['final_product'],
  suggestions: string[]
): ValidationItem {
  if (!finalProduct || !finalProduct.description) {
    suggestions.push('Define a final product that learners will create and share.')
    return { present: false, strength: 'missing', feedback: 'No final product defined.' }
  }

  const hasAudience = !!finalProduct.audience && finalProduct.audience.trim().length > 0
  const hasPresentation = !!finalProduct.presentation_format && finalProduct.presentation_format.trim().length > 0
  const audience = (finalProduct.audience ?? '').toLowerCase()
  const isExternal = hasAudience && audience !== 'teacher' && audience !== 'class' && audience !== 'classroom'

  if (hasAudience && hasPresentation && isExternal) {
    return { present: true, strength: 'strong', feedback: 'Public product with external audience and presentation format.' }
  }

  if (hasAudience && hasPresentation) {
    suggestions.push('Consider an audience beyond the classroom for greater authenticity.')
    return { present: true, strength: 'adequate', feedback: 'Final product defined with audience and presentation format.' }
  }

  suggestions.push('Specify an audience and presentation format for the final product.')
  return { present: true, strength: 'weak', feedback: 'Final product described but missing audience or presentation details.' }
}

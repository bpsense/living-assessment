/**
 * useAssignmentForm.ts
 *
 * Shared form state + submit for both assignment shapes. ProjectAssignmentForm
 * and FocusedTaskForm render type-specific fields over this one hook, so the
 * shared bits (dimensions, competencies, age, visibility, status) stay in sync
 * and the submit/validation logic lives in one place.
 */
import { useMemo, useState } from 'react'
import {
  createAssignment,
  updateAssignment,
  type Assignment,
  type AssignmentInput,
  type AssignmentType,
  type AssignmentStatus,
  type AssignmentWithRelations,
  type CollaborationType,
  type ScaffoldingLevel,
  type TaskFormat,
  type PblPhase,
  type PblPhaseKey,
} from '../../lib/assignment-data'

export const DEFAULT_PBL_PHASES: { phase: PblPhaseKey; title: string }[] = [
  { phase: 'launch', title: 'Launch' },
  { phase: 'inquiry', title: 'Sustained Inquiry' },
  { phase: 'critique', title: 'Critique & Revision' },
  { phase: 'product', title: 'Public Product' },
]

function emptyPhases(): PblPhase[] {
  return DEFAULT_PBL_PHASES.map((p) => ({
    phase: p.phase,
    title: p.title,
    description: '',
    learning_goals: [],
    key_activities: [],
    milestone: null,
  }))
}

export interface AssignmentFormState {
  title: string
  description: string
  // project / PBL
  driving_question: string
  authentic_context: string
  learner_voice: string
  pbl_phases: PblPhase[]
  reflection_prompts: string[]
  collaboration_type: CollaborationType
  // focused task
  focus_area: string
  learning_intention: string
  instructions: string
  success_criteria: string
  scaffolding_level: ScaffoldingLevel
  task_format: TaskFormat
  // shared
  age_min: number | null
  age_max: number | null
  duration_estimate: string
  materials: string
  visible_to_family: boolean
  add_to_library: boolean
  status: AssignmentStatus
  dimension_ids: string[]
  competency_ids: string[]
}

function initialState(existing?: AssignmentWithRelations | null): AssignmentFormState {
  return {
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    driving_question: existing?.driving_question ?? '',
    authentic_context: existing?.authentic_context ?? '',
    learner_voice: existing?.learner_voice ?? '',
    pbl_phases: existing?.pbl_phases?.length ? existing.pbl_phases : emptyPhases(),
    reflection_prompts: existing?.reflection_prompts ?? [],
    collaboration_type: existing?.collaboration_type ?? 'individual',
    focus_area: existing?.focus_area ?? '',
    learning_intention: existing?.learning_intention ?? '',
    instructions: existing?.instructions ?? '',
    success_criteria: existing?.success_criteria ?? '',
    scaffolding_level: existing?.scaffolding_level ?? 'introductory',
    task_format: existing?.task_format ?? 'written',
    age_min: existing?.age_min ?? null,
    age_max: existing?.age_max ?? null,
    duration_estimate: existing?.duration_estimate ?? '',
    materials: existing?.materials ?? '',
    visible_to_family: existing?.visible_to_family ?? true,
    add_to_library: existing?.library_status === 'school_library',
    status: existing?.status === 'archived' ? 'draft' : existing?.status ?? 'draft',
    dimension_ids: existing?.dimension_ids ?? [],
    competency_ids: existing?.competency_ids ?? [],
  }
}

export interface UseAssignmentFormOptions {
  schoolId: string
  createdBy: string
  type: AssignmentType
  existing?: AssignmentWithRelations | null
  competenciesByDimension: Map<string, { id: string }[]>
}

export function useAssignmentForm({
  schoolId,
  createdBy,
  type,
  existing,
  competenciesByDimension,
}: UseAssignmentFormOptions) {
  const [form, setForm] = useState<AssignmentFormState>(() => initialState(existing))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!existing

  function setField<K extends keyof AssignmentFormState>(key: K, value: AssignmentFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updatePhase(index: number, patch: Partial<PblPhase>) {
    setForm((f) => ({
      ...f,
      pbl_phases: f.pbl_phases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }))
  }

  function toggleDimension(dimId: string) {
    setForm((f) => {
      const has = f.dimension_ids.includes(dimId)
      const nextDims = has ? f.dimension_ids.filter((d) => d !== dimId) : [...f.dimension_ids, dimId]
      // Prune competencies whose dimension was removed.
      let nextComps = f.competency_ids
      if (has) {
        const removed = new Set((competenciesByDimension.get(dimId) ?? []).map((c) => c.id))
        nextComps = f.competency_ids.filter((c) => !removed.has(c))
      }
      return { ...f, dimension_ids: nextDims, competency_ids: nextComps }
    })
  }

  function toggleCompetency(compId: string) {
    setForm((f) => ({
      ...f,
      competency_ids: f.competency_ids.includes(compId)
        ? f.competency_ids.filter((c) => c !== compId)
        : [...f.competency_ids, compId],
    }))
  }

  /** Build the AssignmentInput for this type, dropping the other type's fields. */
  const buildInput = useMemo(
    () =>
      (f: AssignmentFormState): AssignmentInput => {
        const shared: AssignmentInput = {
          assignment_type: type,
          title: f.title.trim(),
          description: f.description.trim() || null,
          age_min: f.age_min,
          age_max: f.age_max,
          duration_estimate: f.duration_estimate.trim() || null,
          materials: f.materials.trim() || null,
          visible_to_family: f.visible_to_family,
          library_status: f.add_to_library ? 'school_library' : 'private',
          status: f.status,
          dimension_ids: f.dimension_ids,
          competency_ids: f.competency_ids,
        }
        if (type === 'project') {
          return {
            ...shared,
            driving_question: f.driving_question.trim() || null,
            authentic_context: f.authentic_context.trim() || null,
            learner_voice: f.learner_voice.trim() || null,
            collaboration_type: f.collaboration_type,
            reflection_prompts: f.reflection_prompts.map((p) => p.trim()).filter(Boolean),
            pbl_phases: f.pbl_phases.map((p) => ({
              ...p,
              learning_goals: p.learning_goals.map((g) => g.trim()).filter(Boolean),
              key_activities: p.key_activities.map((a) => a.trim()).filter(Boolean),
              milestone: p.milestone?.trim() || null,
            })),
          }
        }
        return {
          ...shared,
          focus_area: f.focus_area.trim() || null,
          learning_intention: f.learning_intention.trim() || null,
          instructions: f.instructions.trim() || null,
          success_criteria: f.success_criteria.trim() || null,
          scaffolding_level: f.scaffolding_level,
          task_format: f.task_format,
        }
      },
    [type]
  )

  function validate(f: AssignmentFormState): string | null {
    if (!f.title.trim()) return 'Title is required'
    if (type === 'project' && !f.driving_question.trim()) return 'A driving question is required for projects'
    return null
  }

  async function submit(): Promise<{ data: Assignment | null; error: string | null }> {
    const v = validate(form)
    if (v) {
      setError(v)
      return { data: null, error: v }
    }
    setSaving(true)
    setError(null)
    const input = buildInput(form)
    const res = isEdit
      ? await updateAssignment(existing!.id, input)
      : await createAssignment({ ...input, school_id: schoolId, created_by: createdBy })
    setSaving(false)
    if (res.error) setError(res.error)
    return res
  }

  return {
    form,
    setField,
    updatePhase,
    toggleDimension,
    toggleCompetency,
    submit,
    saving,
    error,
    isEdit,
  }
}

/**
 * FocusedTaskForm.tsx
 *
 * Full form for assignment_type = 'focused_task'. Driven by useAssignmentForm;
 * shared fields come from assignmentFormShared.
 */
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'
import { useToast } from '../Toast'
import { useAssignmentFormData } from './useAssignmentFormData'
import { useAssignmentForm } from './useAssignmentForm'
import {
  inputCls,
  FieldLabel,
  DimensionCompetencyPicker,
  AgeRangeFields,
  PublishingFields,
} from './assignmentFormShared'
import type {
  Assignment,
  AssignmentWithRelations,
  ScaffoldingLevel,
  TaskFormat,
} from '../../lib/assignment-data'

interface Props {
  schoolId: string
  createdBy: string
  existing?: AssignmentWithRelations | null
  onSaved: (assignment: Assignment) => void
  onCancel?: () => void
}

const TASK_FORMATS: { value: TaskFormat; label: string }[] = [
  { value: 'written', label: 'Written' },
  { value: 'practical', label: 'Practical' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'creative', label: 'Creative' },
  { value: 'research', label: 'Research' },
  { value: 'observation', label: 'Observation' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'other', label: 'Other' },
]

const SCAFFOLD_LEVELS: { value: ScaffoldingLevel; label: string }[] = [
  { value: 'introductory', label: 'Introductory' },
  { value: 'developing', label: 'Developing' },
  { value: 'extending', label: 'Extending' },
]

export default function FocusedTaskForm({ schoolId, createdBy, existing, onSaved, onCancel }: Props) {
  const { toast } = useToast()
  const { dimensions, competenciesByDimension, loading } = useAssignmentFormData(schoolId)
  const { form, setField, toggleDimension, toggleCompetency, submit, saving, error, isEdit } =
    useAssignmentForm({ schoolId, createdBy, type: 'focused_task', existing, competenciesByDimension })

  async function handleSubmit() {
    const { data, error: err } = await submit()
    if (err || !data) {
      toast(err ?? 'Failed to save', 'error')
      return
    }
    toast(isEdit ? 'Task updated' : 'Task created', 'success')
    onSaved(data)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">{error}</div>}

      <div>
        <FieldLabel required>Title</FieldLabel>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="e.g. Multiplying two-digit numbers"
          maxLength={200}
          className={inputCls}
        />
      </div>

      <div>
        <FieldLabel hint="(what will the learner know or be able to do?)">Learning intention</FieldLabel>
        <textarea
          value={form.learning_intention}
          onChange={(e) => setField('learning_intention', e.target.value)}
          placeholder="By the end, the learner can…"
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <FieldLabel hint="(specific skill, concept, or practice)">Focus area</FieldLabel>
        <input
          type="text"
          value={form.focus_area}
          onChange={(e) => setField('focus_area', e.target.value)}
          placeholder="e.g. Partial-products method"
          className={inputCls}
        />
      </div>

      <div>
        <FieldLabel>Instructions</FieldLabel>
        <textarea
          value={form.instructions}
          onChange={(e) => setField('instructions', e.target.value)}
          placeholder="What should the learner do?"
          rows={3}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <FieldLabel>Success criteria</FieldLabel>
        <textarea
          value={form.success_criteria}
          onChange={(e) => setField('success_criteria', e.target.value)}
          placeholder="How will they (and you) know it's done well?"
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <FieldLabel>Task format</FieldLabel>
        <select
          value={form.task_format}
          onChange={(e) => setField('task_format', e.target.value as TaskFormat)}
          className={inputCls}
        >
          {TASK_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Scaffolding level</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {SCAFFOLD_LEVELS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setField('scaffolding_level', s.value)}
              className={clsx(
                'rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all',
                form.scaffolding_level === s.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <DimensionCompetencyPicker
        dimensions={dimensions}
        competenciesByDimension={competenciesByDimension}
        selectedDimensionIds={form.dimension_ids}
        selectedCompetencyIds={form.competency_ids}
        onToggleDimension={toggleDimension}
        onToggleCompetency={toggleCompetency}
      />

      <AgeRangeFields ageMin={form.age_min} ageMax={form.age_max} onChange={setField} />

      <div>
        <FieldLabel hint="(free text)">Duration</FieldLabel>
        <input
          type="text"
          value={form.duration_estimate}
          onChange={(e) => setField('duration_estimate', e.target.value)}
          placeholder="e.g. 2 lessons"
          className={inputCls}
        />
      </div>

      <PublishingFields
        visibleToFamily={form.visible_to_family}
        addToLibrary={form.add_to_library}
        status={form.status}
        onChangeVisible={(v) => setField('visible_to_family', v)}
        onChangeLibrary={(v) => setField('add_to_library', v)}
        onChangeStatus={(s) => setField('status', s)}
      />

      <div className="flex items-center justify-end gap-3 border-t border-bg-muted pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !form.title.trim()}
          className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </div>
  )
}

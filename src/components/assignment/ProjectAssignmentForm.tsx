/**
 * ProjectAssignmentForm.tsx
 *
 * Full form for assignment_type = 'project' (Project-Based Learning). Driven by
 * useAssignmentForm; shared fields come from assignmentFormShared.
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { Loader2, ChevronDown, HelpCircle } from 'lucide-react'
import { useToast } from '../Toast'
import { useAssignmentFormData } from './useAssignmentFormData'
import { useAssignmentForm } from './useAssignmentForm'
import {
  inputCls,
  FieldLabel,
  DimensionCompetencyPicker,
  AgeRangeFields,
  ReflectionPromptsField,
  CollaborationTypeField,
  PublishingFields,
} from './assignmentFormShared'
import type { Assignment, AssignmentWithRelations } from '../../lib/assignment-data'

interface Props {
  schoolId: string
  createdBy: string
  existing?: AssignmentWithRelations | null
  onSaved: (assignment: Assignment) => void
  onCancel?: () => void
}

export default function ProjectAssignmentForm({ schoolId, createdBy, existing, onSaved, onCancel }: Props) {
  const { toast } = useToast()
  const { dimensions, competenciesByDimension, loading } = useAssignmentFormData(schoolId)
  const { form, setField, updatePhase, toggleDimension, toggleCompetency, submit, saving, error, isEdit } =
    useAssignmentForm({ schoolId, createdBy, type: 'project', existing, competenciesByDimension })
  const [openPhase, setOpenPhase] = useState(0)

  async function handleSubmit() {
    const { data, error: err } = await submit()
    if (err || !data) {
      toast(err ?? 'Failed to save', 'error')
      return
    }
    toast(isEdit ? 'Project updated' : 'Project created', 'success')
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
          placeholder="e.g. Restoring Our Local Creek"
          maxLength={200}
          className={inputCls}
        />
      </div>

      <div>
        <FieldLabel required hint="(the open, provocative question learners investigate)">
          <span className="inline-flex items-center gap-1">
            Driving question
            <HelpCircle className="h-3.5 w-3.5 text-text-light" />
          </span>
        </FieldLabel>
        <textarea
          value={form.driving_question}
          onChange={(e) => setField('driving_question', e.target.value)}
          placeholder="e.g. How can we make our creek healthier for the animals that live there?"
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <FieldLabel hint="(real-world problem or community connection)">Authentic context</FieldLabel>
        <textarea
          value={form.authentic_context}
          onChange={(e) => setField('authentic_context', e.target.value)}
          placeholder="What real audience, place, or problem does this connect to?"
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>

      <div>
        <FieldLabel hint="(how learners have agency)">Learner voice &amp; choice</FieldLabel>
        <textarea
          value={form.learner_voice}
          onChange={(e) => setField('learner_voice', e.target.value)}
          placeholder="How do students shape the questions, methods, or product?"
          rows={2}
          className={inputCls + ' resize-none'}
        />
      </div>

      {/* PBL phases */}
      <div>
        <FieldLabel>PBL phases</FieldLabel>
        <div className="space-y-2">
          {form.pbl_phases.map((phase, i) => {
            const open = openPhase === i
            return (
              <div key={phase.phase} className="overflow-hidden rounded-xl border border-bg-muted">
                <button
                  type="button"
                  onClick={() => setOpenPhase(open ? -1 : i)}
                  className="flex w-full items-center justify-between bg-bg-card px-4 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold text-text">{phase.title}</span>
                  <ChevronDown className={clsx('h-4 w-4 text-text-light transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="space-y-2 border-t border-bg-muted bg-bg px-4 py-3">
                    <textarea
                      value={phase.description}
                      onChange={(e) => updatePhase(i, { description: e.target.value })}
                      placeholder="Phase description…"
                      rows={2}
                      className={inputCls + ' resize-none'}
                    />
                    <div>
                      <span className="mb-1 block text-xs font-medium text-text-muted">Learning goals (one per line)</span>
                      <textarea
                        value={phase.learning_goals.join('\n')}
                        onChange={(e) => updatePhase(i, { learning_goals: e.target.value.split('\n') })}
                        rows={2}
                        className={inputCls + ' resize-none'}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-text-muted">Key activities (one per line)</span>
                      <textarea
                        value={phase.key_activities.join('\n')}
                        onChange={(e) => updatePhase(i, { key_activities: e.target.value.split('\n') })}
                        rows={2}
                        className={inputCls + ' resize-none'}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-text-muted">Milestone</span>
                      <input
                        type="text"
                        value={phase.milestone ?? ''}
                        onChange={(e) => updatePhase(i, { milestone: e.target.value })}
                        placeholder="e.g. Field data collected and charted"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <ReflectionPromptsField prompts={form.reflection_prompts} onChange={(v) => setField('reflection_prompts', v)} />

      <CollaborationTypeField value={form.collaboration_type} onChange={(v) => setField('collaboration_type', v)} />

      <DimensionCompetencyPicker
        dimensions={dimensions}
        competenciesByDimension={competenciesByDimension}
        selectedDimensionIds={form.dimension_ids}
        selectedCompetencyIds={form.competency_ids}
        onToggleDimension={toggleDimension}
        onToggleCompetency={toggleCompetency}
      />

      <AgeRangeFields ageMin={form.age_min} ageMax={form.age_max} onChange={setField} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel hint="(free text)">Duration</FieldLabel>
          <input
            type="text"
            value={form.duration_estimate}
            onChange={(e) => setField('duration_estimate', e.target.value)}
            placeholder="e.g. 3 weeks"
            className={inputCls}
          />
        </div>
        <div>
          <FieldLabel hint="(optional)">Materials</FieldLabel>
          <input
            type="text"
            value={form.materials}
            onChange={(e) => setField('materials', e.target.value)}
            placeholder="e.g. test kits, clipboards"
            className={inputCls}
          />
        </div>
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
          {isEdit ? 'Save Changes' : 'Create Project'}
        </button>
      </div>
    </div>
  )
}

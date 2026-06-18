/**
 * assignmentFormShared.tsx
 *
 * Presentational field building-blocks shared by ProjectAssignmentForm and
 * FocusedTaskForm. State lives in the parent (useAssignmentForm); these are
 * controlled components. Styling matches ObservationForm / CompetencyEditModal.
 */
import { clsx } from 'clsx'
import { Plus, Minus } from 'lucide-react'
import { DimensionIcon } from '../student/DimensionIcon'
import type { Dimension, Competency } from '../../types/database'
import type { AssignmentStatus, CollaborationType } from '../../lib/assignment-data'

export const inputCls =
  'w-full rounded-xl border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100'

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <label className="mb-1 block text-sm font-medium text-text">
      {children}
      {required && <span className="ml-0.5 text-alert-500">*</span>}
      {hint && <span className="ml-1 text-xs font-normal text-text-light">{hint}</span>}
    </label>
  )
}

/** Accessible on/off switch with a label + optional description. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-bg-muted bg-bg-card px-4 py-3 text-left transition-colors hover:border-primary-200 disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium text-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-text-muted">{description}</span>}
      </span>
      <span
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary-500' : 'bg-bg-muted'
        )}
      >
        <span
          className={clsx(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </span>
    </button>
  )
}

/**
 * Dimensions multi-select (icon chips) + competencies for the selected
 * dimensions (checkboxes, grouped by dimension). Competencies of unselected
 * dimensions are hidden; the parent prunes their ids on deselect.
 */
export function DimensionCompetencyPicker({
  dimensions,
  competenciesByDimension,
  selectedDimensionIds,
  selectedCompetencyIds,
  onToggleDimension,
  onToggleCompetency,
}: {
  dimensions: Dimension[]
  competenciesByDimension: Map<string, Competency[]>
  selectedDimensionIds: string[]
  selectedCompetencyIds: string[]
  onToggleDimension: (id: string) => void
  onToggleCompetency: (id: string) => void
}) {
  const dimSet = new Set(selectedDimensionIds)
  const compSet = new Set(selectedCompetencyIds)
  const selectedDims = dimensions.filter((d) => dimSet.has(d.id))

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel hint="(tap to select)">Dimensions</FieldLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dimensions.map((dim) => {
            const selected = dimSet.has(dim.id)
            return (
              <button
                key={dim.id}
                type="button"
                onClick={() => onToggleDimension(dim.id)}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all',
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-bg-muted bg-bg-card hover:border-primary-200'
                )}
              >
                <DimensionIcon
                  name={dim.icon}
                  className={clsx('h-4 w-4 shrink-0', selected ? 'text-primary-600' : 'text-text-light')}
                />
                <span
                  className={clsx(
                    'text-xs font-medium leading-tight',
                    selected ? 'text-primary-700' : 'text-text-muted'
                  )}
                >
                  {dim.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDims.length > 0 && (
        <div>
          <FieldLabel hint="(optional — within the selected dimensions)">Competencies</FieldLabel>
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-bg-muted bg-bg p-3">
            {selectedDims.map((dim) => {
              const comps = competenciesByDimension.get(dim.id) ?? []
              return (
                <div key={dim.id}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-light">
                    {dim.name}
                  </p>
                  {comps.length === 0 ? (
                    <p className="text-xs text-text-light">No competencies in this dimension.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {comps.map((c) => {
                        const selected = compSet.has(c.id)
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onToggleCompetency(c.id)}
                            className={clsx(
                              'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                              selected
                                ? 'border-primary-500 bg-primary-500 text-white'
                                : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
                            )}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function AgeRangeFields({
  ageMin,
  ageMax,
  onChange,
}: {
  ageMin: number | null
  ageMax: number | null
  onChange: (field: 'age_min' | 'age_max', value: number | null) => void
}) {
  const parse = (v: string): number | null => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel hint="(years)">Age min</FieldLabel>
        <input
          type="number"
          min={1}
          max={18}
          value={ageMin ?? ''}
          onChange={(e) => onChange('age_min', parse(e.target.value))}
          className={inputCls}
          placeholder="e.g. 6"
        />
      </div>
      <div>
        <FieldLabel hint="(years)">Age max</FieldLabel>
        <input
          type="number"
          min={1}
          max={18}
          value={ageMax ?? ''}
          onChange={(e) => onChange('age_max', parse(e.target.value))}
          className={inputCls}
          placeholder="e.g. 9"
        />
      </div>
    </div>
  )
}

export function ReflectionPromptsField({
  prompts,
  onChange,
}: {
  prompts: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div>
      <FieldLabel hint="(optional)">Reflection prompts</FieldLabel>
      <div className="space-y-2">
        {prompts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={p}
              onChange={(e) => onChange(prompts.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="e.g. What surprised you about your findings?"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => onChange(prompts.filter((_, j) => j !== i))}
              className="shrink-0 rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-alert-600"
              aria-label="Remove prompt"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...prompts, ''])}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" /> Add prompt
        </button>
      </div>
    </div>
  )
}

export function CollaborationTypeField({
  value,
  onChange,
}: {
  value: CollaborationType
  onChange: (next: CollaborationType) => void
}) {
  const options: { value: CollaborationType; label: string }[] = [
    { value: 'individual', label: 'Individual' },
    { value: 'small_group', label: 'Small Group' },
    { value: 'whole_class', label: 'Whole Class' },
  ]
  return (
    <div>
      <FieldLabel>Collaboration</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all',
              value === o.value
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Visibility toggle + library toggle + Draft/Published status radio. */
export function PublishingFields({
  visibleToFamily,
  addToLibrary,
  status,
  onChangeVisible,
  onChangeLibrary,
  onChangeStatus,
}: {
  visibleToFamily: boolean
  addToLibrary: boolean
  status: AssignmentStatus
  onChangeVisible: (v: boolean) => void
  onChangeLibrary: (v: boolean) => void
  onChangeStatus: (s: AssignmentStatus) => void
}) {
  return (
    <div className="space-y-3">
      <Toggle
        checked={visibleToFamily}
        onChange={onChangeVisible}
        label="Visible to family"
        description="Families and learners can see this assignment and its observations."
      />
      <Toggle
        checked={addToLibrary}
        onChange={onChangeLibrary}
        label="Add to school library"
        description="Share with other educators at your school to reuse and appreciate."
      />
      <div>
        <FieldLabel>Status</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {(['draft', 'published'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeStatus(s)}
              className={clsx(
                'rounded-xl border-2 px-3 py-2 text-sm font-medium capitalize transition-all',
                status === s
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

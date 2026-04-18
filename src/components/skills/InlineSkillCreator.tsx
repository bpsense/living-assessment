import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { createSkillWithProgression, fetchSkillWithProgression } from '../../lib/skill-progression-data'
import {
  fetchSkillCategories,
  fetchDimensions,
  fetchSkillDomains,
} from '../../lib/skills-data'
import { supabase } from '../../lib/supabase'
import SmartSelect, { type SmartSelectOption } from '../SmartSelect'
import type { Skill, SkillProgressionStep, Dimension } from '../../types/database'

// ============================================================
// Types
// ============================================================

interface ProgressionEntry {
  id: string
  grade_level: string
  expectation: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (skill: Skill, step: SkillProgressionStep) => void
}

const GRADE_LEVELS = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

/** Map dimension category to a dot color */
const CATEGORY_COLORS: Record<string, string> = {
  'Academic': '#3b82f6',
  'Creative & Arts': '#a855f7',
  'Physical & Health': '#10b981',
  'Social & Emotional': '#f59e0b',
  'Cognitive': '#6366f1',
}

const inputCls =
  'w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400'
const labelCls = 'mb-1 block text-xs font-semibold text-text-light'

// ============================================================
// Component
// ============================================================

export default function InlineSkillCreator({ open, onClose, onCreated }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [domain, setDomain] = useState('')
  const [steps, setSteps] = useState<ProgressionEntry[]>([
    { id: crypto.randomUUID(), grade_level: '3', expectation: '' },
  ])
  const [saving, setSaving] = useState(false)

  // Dropdown data
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [categoryList, setCategoryList] = useState<string[]>([])
  const [skillDomainList, setSkillDomainList] = useState<string[]>([])

  // Load dropdown data when modal opens
  useEffect(() => {
    if (!open || !profile?.school_id) return
    const sid = profile.school_id
    Promise.all([
      fetchDimensions(sid),
      fetchSkillCategories(sid),
      fetchSkillDomains(sid),
    ]).then(([dims, cats, doms]) => {
      setDimensions(dims)
      setCategoryList(cats)
      setSkillDomainList(doms)
    }).catch(() => {
      // Non-critical — dropdowns just won't be pre-populated
    })
  }, [open, profile?.school_id])

  // Reset on open
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setCategory('')
      setDomain('')
      setSteps([{ id: crypto.randomUUID(), grade_level: '3', expectation: '' }])
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, saving])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Build domain options
  const domainOptions: SmartSelectOption[] = (() => {
    const dimNames = new Set(dimensions.map((d) => d.name))
    const fromDims: SmartSelectOption[] = dimensions.map((d) => ({
      value: d.name,
      label: d.name,
      color: CATEGORY_COLORS[d.category] || '#94a3b8',
      detail: d.category,
    }))
    const fromSkills: SmartSelectOption[] = skillDomainList
      .filter((n) => !dimNames.has(n))
      .map((n) => ({ value: n, label: n }))
    return [...fromDims, ...fromSkills]
  })()

  // Build category options
  const categoryOptions: SmartSelectOption[] = categoryList.map((c) => ({
    value: c,
    label: c,
  }))

  async function handleCreateDomain(input: string): Promise<string> {
    if (!profile?.school_id) throw new Error('No school')
    const { data, error } = await supabase
      .from('dimensions')
      .insert({
        school_id: profile.school_id,
        name: input.trim(),
        category: 'Academic',
        display_order: dimensions.length,
        is_active: true,
        visible_to_family: true,
      })
      .select('id, name')
      .single()
    if (error) throw error
    setDimensions((prev) => [...prev, data as unknown as Dimension])
    toast(`Domain "${data.name}" created`, 'success')
    return data.name
  }

  async function handleCreateCategory(input: string): Promise<string> {
    return input
  }

  function addStep() {
    // Find the first grade not already used
    const usedGrades = new Set(steps.map(s => s.grade_level))
    const nextGrade = GRADE_LEVELS.find(g => !usedGrades.has(g)) ?? 'K'
    setSteps([...steps, { id: crypto.randomUUID(), grade_level: nextGrade, expectation: '' }])
  }

  function removeStep(id: string) {
    if (steps.length <= 1) return
    setSteps(steps.filter(s => s.id !== id))
  }

  function updateStep(id: string, field: 'grade_level' | 'expectation', value: string) {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function handleSave() {
    if (!name.trim()) {
      toast('Skill name is required', 'error')
      return
    }
    const validSteps = steps.filter(s => s.expectation.trim())
    if (validSteps.length === 0) {
      toast('At least one progression step with an expectation is required', 'error')
      return
    }
    if (!profile?.school_id) return

    setSaving(true)
    try {
      const skillId = await createSkillWithProgression(
        {
          school_id: profile.school_id,
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          is_assessable: true,
          source_framework: 'custom',
          progression_domain: domain.trim() || null,
          created_by: profile.id,
        },
        validSteps.map(s => ({
          school_id: profile.school_id,
          grade_level: s.grade_level,
          expectation_description: s.expectation.trim(),
          example_tasks: null,
          prerequisite_step_id: null,
          competency_ids: [],
        }))
      )

      // Fetch the created skill with its first step
      const skillWithSteps = await fetchSkillWithProgression(skillId, profile.school_id)

      // Find the step to use (first one by default)
      const firstStep = skillWithSteps.steps?.[0]
      if (!firstStep) throw new Error('No progression step found')

      // Separate out the skill (without steps) for the callback
      const { steps: _steps, ...skill } = skillWithSteps

      toast('Skill created!', 'success')
      onCreated(skill, firstStep)
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create skill', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />

      {/* Panel */}
      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl sm:max-w-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text">Define New Skill</h2>
          <button
            onClick={() => !saving && onClose()}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className={labelCls}>
              Skill Name <span className="text-alert-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Multi-Digit Multiplication"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the skill"
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Domain & Category — smart dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <SmartSelect
              value={domain}
              onChange={setDomain}
              options={domainOptions}
              label="Domain"
              optional
              placeholder="Select domain…"
              allowCreate
              onCreateNew={handleCreateDomain}
              createPlaceholder="New domain…"
            />
            <SmartSelect
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              label="Category"
              optional
              placeholder="Select category…"
              allowCreate
              onCreateNew={handleCreateCategory}
              createPlaceholder="New category…"
            />
          </div>

          {/* Progression Steps */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelCls + ' mb-0'}>
                Grade-Level Expectations <span className="text-alert-500">*</span>
              </label>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50"
              >
                <Plus className="h-3 w-3" />
                Add Grade
              </button>
            </div>
            <p className="mb-3 text-[11px] text-text-muted">
              Define what mastery looks like at each grade level. Add at least one.
            </p>
            <div className="space-y-2">
              {steps.map((s) => (
                <div key={s.id} className="flex items-start gap-2">
                  <select
                    value={s.grade_level}
                    onChange={(e) => updateStep(s.id, 'grade_level', e.target.value)}
                    className="w-16 shrink-0 rounded-lg border border-bg-muted bg-bg px-2 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  >
                    {GRADE_LEVELS.map(g => (
                      <option key={g} value={g}>
                        {g === 'K' ? 'K' : `${g}`}
                      </option>
                    ))}
                  </select>
                  <input
                    value={s.expectation}
                    onChange={(e) => updateStep(s.id, 'expectation', e.target.value)}
                    placeholder={`What mastery looks like at Grade ${s.grade_level}`}
                    className={inputCls + ' flex-1'}
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(s.id)}
                      className="shrink-0 rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-4">
          <button
            onClick={() => !saving && onClose()}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create & Assign
          </button>
        </div>
      </div>
    </div>
  )
}

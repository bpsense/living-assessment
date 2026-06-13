import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import type { Competency, StepDescriptors } from '../../types/database'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  /** null = create mode */
  competency: Competency | null
  schoolId: string
  dimensionId: string
  /** standard labels already used in this dimension, for the datalist */
  standardLabels: string[]
  /** display_order to use when creating */
  nextOrder: number
  onSaved: () => void
}

// Age range the framework spans (1-16). Keys in step_descriptors are age numbers as strings.
const MIN_AGE = 1
const MAX_AGE = 16

// ============================================================
// Component
// ============================================================

export default function CompetencyEditModal({
  open,
  onClose,
  competency,
  schoolId,
  dimensionId,
  standardLabels,
  nextOrder,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const isEdit = competency !== null

  const [name, setName] = useState('')
  const [standardLabel, setStandardLabel] = useState('')
  const [objective, setObjective] = useState('')
  const [ageStart, setAgeStart] = useState(7)
  const [ageEnd, setAgeEnd] = useState(16)
  const [steps, setSteps] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate on open
  useEffect(() => {
    if (!open) return
    if (competency) {
      setName(competency.name)
      setStandardLabel(competency.standard_label ?? '')
      setObjective(competency.objective ?? '')
      setAgeStart(competency.age_band_start ?? 7)
      setAgeEnd(competency.age_band_end ?? 16)
      setSteps({ ...(competency.step_descriptors ?? {}) })
    } else {
      setName('')
      setStandardLabel('')
      setObjective('')
      setAgeStart(7)
      setAgeEnd(16)
      setSteps({})
    }
    setError(null)
  }, [open, competency])

  // Escape to close + body scroll lock
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  if (!open) return null

  const lo = Math.max(MIN_AGE, Math.min(ageStart, ageEnd))
  const hi = Math.min(MAX_AGE, Math.max(ageStart, ageEnd))
  const agesInBand: number[] = []
  for (let a = lo; a <= hi; a++) agesInBand.push(a)

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    if (lo > hi) {
      setError('Start age must be at or below end age')
      return
    }

    // Keep only descriptors within the chosen band, trimmed + non-empty.
    const cleanSteps: StepDescriptors = {}
    for (const a of agesInBand) {
      const v = (steps[String(a)] ?? '').trim()
      if (v) cleanSteps[String(a)] = v
    }

    setSaving(true)
    setError(null)

    const payload = {
      name: trimmedName,
      standard_label: standardLabel.trim() || null,
      objective: objective.trim() || null,
      age_band_start: lo,
      age_band_end: hi,
      step_descriptors: cleanSteps,
    }

    if (isEdit) {
      const { error: err } = await supabase
        .from('competencies')
        .update(payload)
        .eq('id', competency!.id)
      setSaving(false)
      if (err) return setError(err.message)
      toast('Competency updated', 'success')
    } else {
      const { error: err } = await supabase.from('competencies').insert({
        ...payload,
        school_id: schoolId,
        dimension_id: dimensionId,
        display_order: nextOrder,
        // user-created competencies get no BL. code, so the framework re-seed won't touch them
        code: null,
      })
      setSaving(false)
      if (err) return setError(err.message)
      toast('Competency added', 'success')
    }

    onSaved()
    onClose()
  }

  const inputCls =
    'w-full rounded-xl border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            {isEdit ? 'Edit Competency' : 'New Competency'}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Name <span className="text-alert-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reading Comprehension"
              maxLength={150}
              className={inputCls}
            />
          </div>

          {/* Standard label (group) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Standard group
              <span className="ml-1 text-xs font-normal text-text-light">(optional)</span>
            </label>
            <input
              type="text"
              list="competency-standard-labels"
              value={standardLabel}
              onChange={(e) => setStandardLabel(e.target.value)}
              placeholder="e.g. Reading and integrated literacy"
              maxLength={150}
              className={inputCls}
            />
            <datalist id="competency-standard-labels">
              {standardLabels.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Objective */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Objective
              <span className="ml-1 text-xs font-normal text-text-light">(optional)</span>
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What this competency is about..."
              rows={2}
              maxLength={500}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Age band */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Start age</label>
              <select value={ageStart} onChange={(e) => setAgeStart(Number(e.target.value))} className={inputCls}>
                {Array.from({ length: MAX_AGE }, (_, i) => i + 1).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">End age</label>
              <select value={ageEnd} onChange={(e) => setAgeEnd(Number(e.target.value))} className={inputCls}>
                {Array.from({ length: MAX_AGE }, (_, i) => i + 1).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-age "Achieving" descriptors */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              "Achieving" looks like, by age
              <span className="ml-1 text-xs font-normal text-text-light">
                (ages {lo}–{hi})
              </span>
            </label>
            <div className="space-y-1.5 rounded-xl border border-bg-muted bg-bg p-2">
              {agesInBand.map((a) => (
                <div key={a} className="flex items-start gap-2">
                  <span className="mt-2 w-8 shrink-0 text-right text-xs font-semibold text-text-muted">
                    {a}y
                  </span>
                  <textarea
                    value={steps[String(a)] ?? ''}
                    onChange={(e) => setSteps((p) => ({ ...p, [String(a)]: e.target.value }))}
                    placeholder={`What a ${a}-year-old achieving this looks like…`}
                    rows={1}
                    className="min-h-[2.25rem] w-full resize-y rounded-lg border border-bg-muted bg-bg-card px-3 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-100"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-bg-muted px-5 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Competency'}
          </button>
        </div>
      </div>
    </div>
  )
}

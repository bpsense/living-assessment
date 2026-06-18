import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Loader2, Link as LinkIcon, Minus, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { DimensionIcon } from '../student/DimensionIcon'
import { standardAgeForDate } from '../../lib/age-utils'
import { useCompetencyLevels } from '../../lib/competency-levels'
import type { Dimension, Competency, ObservationRating } from '../../types/database'

// Placeholder text per-dimension for the narrative textarea
const DIMENSION_PLACEHOLDERS: Record<string, string> = {
  'Language & Literacy':
    'Describe the reading, writing, or communication behaviors you observed...',
  'Mathematical Thinking':
    'Describe what mathematical reasoning or problem-solving you observed...',
  'Scientific Inquiry':
    'Describe the scientific thinking, experimentation, or reasoning you observed...',
  'Social Studies & Global Awareness':
    'Describe the cultural awareness, historical thinking, or civic understanding you observed...',
  'Creative Expression':
    'Describe the artistic, musical, or creative expression you observed...',
  'Physical Development & Wellness':
    'Describe the motor skills, physical activity, or health behaviors you observed...',
  'Social-Emotional Learning':
    'Describe the social interactions, emotional regulation, or empathy you observed...',
  'Critical Thinking & Problem Solving':
    'Describe the analytical thinking, reasoning, or problem-solving approach you observed...',
  'Communication & Collaboration':
    'Describe the teamwork, communication, or collaborative behaviors you observed...',
  'Self-Direction & Executive Function':
    'Describe the goal-setting, organization, or self-management you observed...',
}

function getPlaceholder(dimensionName: string | null): string {
  if (!dimensionName) return 'Describe what you observed...'
  return (
    DIMENSION_PLACEHOLDERS[dimensionName] ?? 'Describe what you observed...'
  )
}

// ============================================================
// Props
// ============================================================

export interface ObservationFormProps {
  studentId: string
  schoolId: string
  /** Pre-select dimension (from query param or context) */
  preselectedDimensionId?: string | null
  /** Compact layout for modal usage */
  compact?: boolean
  /** Called after successful save */
  onSaved?: () => void
}

// ============================================================
// Component
// ============================================================

export default function ObservationForm({
  studentId,
  schoolId,
  preselectedDimensionId,
  compact = false,
  onSaved,
}: ObservationFormProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { levels } = useCompetencyLevels()

  // Rating buttons: value 1–4 with school-customized name + descriptor.
  const ratingLevels = levels.map((lvl, i) => ({
    value: (i + 1) as ObservationRating,
    label: lvl.name,
    descriptor: lvl.descriptor,
  }))

  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selectedDimension, setSelectedDimension] = useState<string | null>(
    preselectedDimensionId ?? null
  )
  const [rating, setRating] = useState<ObservationRating | null>(null)
  const [notes, setNotes] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingDims, setLoadingDims] = useState(true)

  // Competency picker (age-appropriate competencies within the selected dimension)
  const [studentAge, setStudentAge] = useState<number | null>(null)
  /** Age step being assessed against. null = the learner's own age (default). */
  const [assessedAge, setAssessedAge] = useState<number | null>(null)
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [selectedCompetency, setSelectedCompetency] = useState<string | null>(null)
  const [loadingComps, setLoadingComps] = useState(false)

  // Fetch dimensions
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('dimensions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('display_order')
      setDimensions((data ?? []) as Dimension[])
      setLoadingDims(false)
    }
    load()
  }, [schoolId])

  // Update if preselected changes
  useEffect(() => {
    if (preselectedDimensionId) setSelectedDimension(preselectedDimensionId)
  }, [preselectedDimensionId])

  // Fetch the student's age (to filter competencies by age band)
  useEffect(() => {
    async function loadAge() {
      const { data } = await supabase
        .from('students')
        .select('date_of_birth')
        .eq('id', studentId)
        .single()
      // Default the assessed age to the standard the learner is held to this
      // school year (Dec-1 rule), not their raw current age. Educators can still
      // step ±3 for stretch / remedial assessment.
      setStudentAge(standardAgeForDate((data as { date_of_birth: string | null } | null)?.date_of_birth ?? null, new Date()))
    }
    loadAge()
  }, [studentId])

  // Fetch the selected dimension's competencies (all steps; filtered by age below)
  useEffect(() => {
    setSelectedCompetency(null)
    setAssessedAge(null) // reset step to "at age" when switching dimension
    if (!selectedDimension) {
      setCompetencies([])
      return
    }
    let cancelled = false
    setLoadingComps(true)
    async function loadComps() {
      const { data } = await supabase
        .from('competencies')
        .select('*')
        .eq('school_id', schoolId)
        .eq('dimension_id', selectedDimension)
        .order('display_order')
        .order('name')
      if (cancelled) return
      setCompetencies((data ?? []) as Competency[])
      setLoadingComps(false)
    }
    loadComps()
    return () => {
      cancelled = true
    }
  }, [selectedDimension, schoolId])

  // The age step being assessed (defaults to the learner's age). Steppable ±3 yrs.
  const effectiveAge = assessedAge ?? studentAge
  const stepLo = studentAge == null ? 1 : Math.max(1, studentAge - 3)
  const stepHi = studentAge == null ? 16 : Math.min(16, studentAge + 3)

  // Competencies applicable at the chosen step.
  const visibleComps =
    effectiveAge == null
      ? competencies
      : competencies.filter(
          (c) =>
            (c.age_band_start == null || c.age_band_start <= effectiveAge) &&
            (c.age_band_end == null || c.age_band_end >= effectiveAge)
        )

  function stepAssessedAge(next: number) {
    setAssessedAge(Math.max(stepLo, Math.min(stepHi, next)))
    setSelectedCompetency(null) // a new step is a different assessment
  }

  const selectedDimensionObj = dimensions.find((d) => d.id === selectedDimension)
  const selectedCompetencyObj = visibleComps.find((c) => c.id === selectedCompetency)
  // When a dimension has competencies, recording one is required; otherwise allow a dimension-level note.
  const needsCompetency = visibleComps.length > 0
  const canSave =
    !!selectedDimension &&
    !!rating &&
    !!profile &&
    !loadingComps &&
    (!needsCompetency || !!selectedCompetency)

  // Group competencies by their standard label (preserve display order)
  const competencyGroups: { label: string; items: Competency[] }[] = []
  for (const c of visibleComps) {
    const label = c.standard_label ?? 'Other'
    let g = competencyGroups.find((x) => x.label === label)
    if (!g) {
      g = { label, items: [] }
      competencyGroups.push(g)
    }
    g.items.push(c)
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)

    const notesWithEvidence = evidenceUrl
      ? `${notes}\n\nEvidence: ${evidenceUrl}`.trim()
      : notes || null

    const { error } = await supabase.from('observations').insert({
      school_id: schoolId,
      student_id: studentId,
      dimension_id: selectedDimension,
      competency_id: selectedCompetency,
      // Record the step assessed against (only meaningful with a competency).
      assessed_age: selectedCompetency ? effectiveAge : null,
      observer_id: profile!.id,
      rating: rating,
      notes: notesWithEvidence,
    })

    setSaving(false)

    if (error) {
      toast(`Failed to save: ${error.message}`, 'error')
      return
    }

    toast('Observation recorded successfully!')
    // Reset form
    setRating(null)
    setNotes('')
    setEvidenceUrl('')
    setSelectedCompetency(null)
    setAssessedAge(null)
    if (!preselectedDimensionId) setSelectedDimension(null)
    onSaved?.()
  }

  if (loadingDims) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className={clsx('space-y-5', compact && 'space-y-4')}>
      {/* ---- Dimension picker ---- */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-text">
          Select Dimension
        </label>
        <div
          className={clsx(
            'grid gap-2',
            compact
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
          )}
        >
          {dimensions.map((dim) => (
            <button
              key={dim.id}
              onClick={() => setSelectedDimension(dim.id)}
              className={clsx(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all',
                selectedDimension === dim.id
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-bg-muted bg-bg-card hover:border-primary-200 hover:bg-bg'
              )}
            >
              <DimensionIcon
                name={dim.icon}
                className={clsx(
                  'h-5 w-5',
                  selectedDimension === dim.id
                    ? 'text-primary-600'
                    : 'text-text-light'
                )}
              />
              <span
                className={clsx(
                  'text-[11px] font-medium leading-tight',
                  selectedDimension === dim.id
                    ? 'text-primary-700'
                    : 'text-text-muted'
                )}
              >
                {dim.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Competency picker (age-appropriate, within the selected dimension) ---- */}
      {selectedDimension && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-semibold text-text">Competency</label>
            {studentAge != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Assess at age</span>
                <div className="inline-flex items-center gap-0.5 rounded-lg border border-bg-muted bg-bg-card px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => stepAssessedAge((effectiveAge ?? studentAge) - 1)}
                    disabled={(effectiveAge ?? studentAge) <= stepLo}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text disabled:opacity-30"
                    aria-label="Assess at a younger age step"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2.25rem] text-center text-sm font-semibold text-text">
                    {effectiveAge}y
                  </span>
                  <button
                    type="button"
                    onClick={() => stepAssessedAge((effectiveAge ?? studentAge) + 1)}
                    disabled={(effectiveAge ?? studentAge) >= stepHi}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text disabled:opacity-30"
                    aria-label="Assess at an older age step"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span
                  className={clsx(
                    'text-[11px] font-medium',
                    effectiveAge === studentAge
                      ? 'text-text-light'
                      : (effectiveAge ?? 0) > studentAge
                        ? 'text-primary-600'
                        : 'text-accent-600'
                  )}
                >
                  {effectiveAge === studentAge
                    ? 'at age'
                    : (effectiveAge ?? 0) > studentAge
                      ? 'above age (stretch)'
                      : 'below age'}
                </span>
              </div>
            )}
          </div>

          {loadingComps ? (
            <div className="flex items-center gap-2 py-3 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading competencies…
            </div>
          ) : competencies.length === 0 ? (
            <p className="rounded-xl border border-dashed border-bg-muted px-4 py-3 text-xs text-text-muted">
              No competencies set up for this dimension yet — you can record a
              dimension-level observation, or add competencies in Settings → Dimensions.
            </p>
          ) : visibleComps.length === 0 ? (
            <p className="rounded-xl border border-dashed border-bg-muted px-4 py-3 text-xs text-text-muted">
              No competencies apply at age {effectiveAge}. Step to another age.
            </p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {competencyGroups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-light">
                    {g.label}
                  </p>
                  <div className="space-y-1.5">
                    {g.items.map((c) => {
                      const selected = selectedCompetency === c.id
                      const desc =
                        effectiveAge != null
                          ? c.step_descriptors?.[String(effectiveAge)]
                          : undefined
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCompetency(c.id)}
                          className={clsx(
                            'block w-full rounded-xl border-2 px-3 py-2 text-left transition-all',
                            selected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-bg-muted bg-bg-card hover:border-primary-200'
                          )}
                        >
                          <span
                            className={clsx(
                              'block text-sm font-medium',
                              selected ? 'text-primary-700' : 'text-text'
                            )}
                          >
                            {c.name}
                          </span>
                          {desc && (
                            <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
                              {desc}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Competency rating ---- */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-text">
          Level
          {selectedCompetencyObj && (
            <span className="ml-1 text-xs font-normal text-text-light">
              · {selectedCompetencyObj.name}
            </span>
          )}
        </label>
        <div className={clsx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
          {ratingLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => setRating(level.value)}
              className={clsx(
                'rounded-xl border-2 px-3 py-3 text-left transition-all',
                rating === level.value
                  ? 'border-primary-500 bg-primary-500 text-white shadow-sm'
                  : 'border-bg-muted bg-bg-card hover:border-primary-200'
              )}
            >
              <span
                className={clsx(
                  'block text-sm font-semibold',
                  rating === level.value ? 'text-white' : 'text-text'
                )}
              >
                {level.label}
              </span>
              <span
                className={clsx(
                  'mt-0.5 block text-[11px] leading-tight',
                  rating === level.value ? 'text-white/80' : 'text-text-muted'
                )}
              >
                {level.descriptor}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Narrative ---- */}
      <div>
        <label htmlFor="obs-notes" className="mb-2 block text-sm font-semibold text-text">
          Observation Notes
          <span className="ml-1 text-xs font-normal text-text-light">(optional)</span>
        </label>
        <textarea
          id="obs-notes"
          rows={compact ? 3 : 4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={getPlaceholder(selectedDimensionObj?.name ?? null)}
          className="w-full rounded-xl border border-bg-muted bg-bg px-4 py-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* ---- Evidence URL ---- */}
      <div>
        <label htmlFor="obs-evidence" className="mb-2 block text-sm font-semibold text-text">
          Evidence
          <span className="ml-1 text-xs font-normal text-text-light">(optional photo URL)</span>
        </label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            id="obs-evidence"
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-bg-muted bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {/* ---- Save ---- */}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className={clsx(
          'flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all',
          canSave && !saving
            ? 'bg-primary-500 shadow-sm hover:bg-primary-600'
            : 'cursor-not-allowed bg-text-light'
        )}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Saving...' : 'Save Observation'}
      </button>
    </div>
  )
}

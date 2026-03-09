import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { DimensionIcon } from '../student/DimensionIcon'
import type { Dimension, ObservationRating } from '../../types/database'

// ============================================================
// Rating level config
// ============================================================

interface RatingLevel {
  value: ObservationRating
  label: string
  descriptor: string
}

const RATING_LEVELS: RatingLevel[] = [
  { value: 1, label: 'Emerging', descriptor: 'Beginning to explore; needs significant support' },
  { value: 2, label: 'Developing', descriptor: 'Growing understanding; needs some scaffolding' },
  { value: 3, label: 'Achieving', descriptor: 'Applying skills with increasing independence' },
  { value: 4, label: 'Mastery', descriptor: 'Demonstrates strong, consistent mastery' },
]

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

  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selectedDimension, setSelectedDimension] = useState<string | null>(
    preselectedDimensionId ?? null
  )
  const [rating, setRating] = useState<ObservationRating | null>(null)
  const [notes, setNotes] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingDims, setLoadingDims] = useState(true)

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

  const selectedDimensionObj = dimensions.find((d) => d.id === selectedDimension)
  const canSave = selectedDimension && rating && profile

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

      {/* ---- Competency rating ---- */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-text">
          Competency Level
        </label>
        <div className={clsx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
          {RATING_LEVELS.map((level) => (
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

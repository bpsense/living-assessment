import { useState } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { Eye, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DimensionIcon } from './DimensionIcon'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { supabase } from '../../lib/supabase'
import type { DimensionScore } from '../../lib/student-data'

interface Props {
  score: DimensionScore
  studentId: string
  /** Required for click-to-rate (educator only) */
  schoolId?: string
  /** ISO date for back-dating observations, or null for "now" */
  observationDate?: string | null
  /** Label like "Mar 2025" when viewing a historical period */
  observationPeriodLabel?: string | null
  /** Called after a quick-rate observation is saved */
  onObservationCreated?: () => void
}

const COMPETENCY_LEVELS = [
  { label: 'Emerging', base: 1 },
  { label: 'Developing', base: 2 },
  { label: 'Achieving', base: 3 },
  { label: 'Mastery', base: 4 },
]

/** Given a segment base (1-4) and which third was clicked (0, 1, 2),
 *  return the precise rating value.
 *  third 0 → base - 0.67  (first third)
 *  third 1 → base - 0.33  (second third)
 *  third 2 → base          (full segment)
 */
function thirdToRating(base: number, third: number): number {
  if (base === 1) {
    // Emerging: 0.33, 0.67, 1.0
    return [0.33, 0.67, 1.0][third] ?? 1.0
  }
  // Other levels: e.g. base=3 → 2.33, 2.67, 3.0
  return [base - 0.67, base - 0.33, base][third] ?? base
}

/** Descriptive label for a precise rating value */
function ratingLabel(value: number): string {
  const segIndex = Math.min(Math.ceil(value), 4)
  const seg = COMPETENCY_LEVELS[segIndex - 1]
  if (!seg) return String(value)
  const fraction = value - (segIndex - 1)
  if (fraction <= 0.34) return `${seg.label} ⅓`
  if (fraction <= 0.67) return `${seg.label} ⅔`
  return seg.label
}

/** Snap a raw fill fraction (0-1) to the nearest third boundary
 *  so the bar always shows clean ⅓, ⅔, or full stops. */
function snapToThird(fraction: number): number {
  if (fraction <= 0) return 0
  if (fraction >= 1) return 1
  // 0.00–0.16 → 0, 0.17–0.50 → 0.333, 0.51–0.83 → 0.666, 0.84–1 → 1
  if (fraction < 0.17) return 0
  if (fraction < 0.50) return 1 / 3
  if (fraction < 0.84) return 2 / 3
  return 1
}

function CompetencyBar({
  level,
  onLevelClick,
}: {
  /** Current competency level 0-4, supports fractional values (e.g. 2.7) */
  level: number
  /** Called with precise rating value (e.g. 2.33, 2.67, 3.0) */
  onLevelClick?: (level: number) => void
}) {
  const isInteractive = !!onLevelClick

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {COMPETENCY_LEVELS.map((seg, i) => {
          const segIndex = i + 1 // 1-based

          // Calculate raw fill fraction for this segment
          let rawFraction: number
          if (level >= segIndex) {
            rawFraction = 1
          } else if (level > segIndex - 1) {
            rawFraction = level - (segIndex - 1)
          } else {
            rawFraction = 0
          }

          // Snap to nearest third so bars always show clean stops
          const fillFraction = snapToThird(rawFraction)

          if (isInteractive) {
            return (
              <button
                key={seg.label}
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const pct = x / rect.width
                  const third = pct < 0.333 ? 0 : pct < 0.666 ? 1 : 2
                  onLevelClick(thirdToRating(seg.base, third))
                }}
                title={`Rate as ${seg.label} (click position selects ⅓)`}
                className="relative h-3 flex-1 overflow-hidden rounded-full bg-bg-muted cursor-pointer hover:scale-y-150 hover:opacity-80 transition-all duration-150"
              >
                {/* Fill bar */}
                {fillFraction > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${fillFraction * 100}%` }}
                  />
                )}
                {/* Third divider lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  <div className="flex-1 border-r border-white/30" />
                  <div className="flex-1 border-r border-white/30" />
                  <div className="flex-1" />
                </div>
              </button>
            )
          }

          return (
            <div
              key={seg.label}
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-muted transition-colors"
            >
              {fillFraction > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${fillFraction * 100}%` }}
                />
              )}
              {/* Third divider lines (read-only bars too) */}
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1 border-r border-white/20" />
                <div className="flex-1 border-r border-white/20" />
                <div className="flex-1" />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        {COMPETENCY_LEVELS.map((seg, i) => {
          const segIndex = i + 1
          return (
            <span
              key={seg.label}
              className={clsx(
                'text-[9px] font-medium transition-colors duration-150',
                level >= segIndex ? 'text-primary-600' : 'text-text-light',
                isInteractive && 'cursor-pointer'
              )}
              onClick={isInteractive ? () => onLevelClick?.(seg.base) : undefined}
            >
              {seg.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function InterestDots({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-text-muted">Interest</span>
      {[1, 2, 3, 4, 5].map((dot) => (
        <div
          key={dot}
          className={clsx(
            'h-2.5 w-2.5 rounded-full transition-colors',
            dot <= filled ? 'bg-accent-500' : 'bg-bg-muted'
          )}
        />
      ))}
    </div>
  )
}

export default function DimensionCard({
  score,
  studentId,
  schoolId,
  observationDate,
  observationPeriodLabel,
  onObservationCreated,
}: Props) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { toast } = useToast()
  // Local level override — set immediately on click, persists until score prop changes
  const [localLevel, setLocalLevel] = useState<number | null>(null)
  const obs = score.latest_observation

  // Click-to-rate is only available for educators/admins with schoolId
  const canQuickRate = !!schoolId && !!profile && !!onObservationCreated

  // Whether we're viewing a historical period (not the current month)
  const isHistorical = !!observationPeriodLabel && !!observationDate

  // Competency supports fractional values (averages). No rounding — pass
  // the precise value to CompetencyBar for partial-fill display.
  const computedLevel = Math.min(Math.max(score.competency, 0), 4)
  const displayLevel = localLevel ?? computedLevel

  // Nearest discrete level name for the label pill
  const labelIndex = displayLevel > 0
    ? Math.min(Math.max(Math.round(displayLevel), 1), 4) - 1
    : -1

  function handleLevelClick(level: number) {
    if (!canQuickRate || !schoolId || !profile) return

    // Round to 2 decimal places to avoid floating point noise
    const ratingValue = Math.round(level * 100) / 100

    if (isHistorical) {
      // Historical: show the exact clicked level (not averaged)
      setLocalLevel(ratingValue)
    } else {
      // Current month: compute optimistic average
      const currentCount = score.current_month_observation_count
      const currentSum = score.competency * currentCount
      const optimisticAvg = currentCount > 0
        ? (currentSum + ratingValue) / (currentCount + 1)
        : ratingValue
      setLocalLevel(optimisticAvg)
    }

    // Fire-and-forget the insert, then refetch in background
    supabase
      .from('observations')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        dimension_id: score.dimension_id,
        observer_id: profile.id,
        rating: ratingValue,
        observed_at: observationDate ?? new Date().toISOString(),
        notes: observationPeriodLabel
          ? `Quick rating (${observationPeriodLabel})`
          : 'Quick rating from learner profile',
      })
      .then(({ error }) => {
        if (error) {
          // Revert on failure
          setLocalLevel(null)
          toast(`Failed to save: ${error.message}`, 'error')
        } else {
          const label = ratingLabel(ratingValue)
          toast(
            observationPeriodLabel
              ? `${score.dimension_name}: ${label} (${observationPeriodLabel})`
              : `${score.dimension_name}: ${label}`,
          )
          // Refetch data — once it arrives, the new score.competency
          // will match localLevel so the transition is seamless
          onObservationCreated?.()
        }
      })
  }

  // Clear local override when score prop catches up from refetch.
  // Use approximate equality since averages produce floating-point values.
  if (localLevel !== null && Math.abs(score.competency - localLevel) < 0.05) {
    queueMicrotask(() => setLocalLevel(null))
  }

  return (
    <div
      id={`dimension-${score.dimension_id}`}
      className="rounded-xl border border-bg-muted bg-bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <DimensionIcon name={score.icon} className="h-5 w-5 text-primary-500" />
          <div>
            <h3 className="text-sm font-semibold text-text">{score.dimension_name}</h3>
            <p className="text-[11px] text-text-muted">
              {score.current_month_observation_count > 0
                ? `${score.current_month_observation_count} this month`
                : `${score.observation_count} observation${score.observation_count !== 1 ? 's' : ''}`}
              {score.current_month_observation_count > 0 && score.observation_count > score.current_month_observation_count
                ? ` · ${score.observation_count} total`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
            {labelIndex >= 0
              ? `${COMPETENCY_LEVELS[labelIndex].label}${
                  score.current_month_observation_count > 1
                    ? ` (${displayLevel.toFixed(1)})`
                    : ''
                }`
              : '—'}
          </span>
          <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-bold text-accent-700">
            {score.interest > 0 ? score.interest.toFixed(1) : '—'}
          </span>
        </div>
      </div>

      {/* Competency bar — interactive for educators */}
      <div className="mb-3">
        <CompetencyBar
          level={displayLevel}
          onLevelClick={canQuickRate ? handleLevelClick : undefined}
        />
      </div>

      {/* Interest dots */}
      <div className="mb-3">
        <InterestDots value={score.interest} />
      </div>

      {/* Latest observation snippet */}
      {obs && (
        <div className="mb-3 rounded-lg bg-bg px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium text-text-light">
            {format(new Date(obs.observed_at), 'MMM d, yyyy')}
          </p>
          <p className="line-clamp-2 text-xs text-text-muted">
            {obs.notes?.slice(0, 100) ?? 'No notes recorded'}
            {obs.notes && obs.notes.length > 100 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            navigate(`/student/${studentId}/history?dimension=${score.dimension_id}`)
          }
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
        >
          <Eye className="h-3.5 w-3.5" />
          View History
        </button>
        <button
          onClick={() =>
            navigate(
              `/student/${studentId}/observe?dimension=${score.dimension_id}`
            )
          }
          className="flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add Observation
        </button>
      </div>
    </div>
  )
}

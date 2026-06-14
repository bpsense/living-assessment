/**
 * CompetencyDetailModal.tsx
 *
 * Click-through detail for a single competency on the Competency Snapshot.
 * Shows where the learner currently sits, the competency's age band, the full
 * observation history that feeds the position (recent observations weigh more),
 * and — for educators/admins — an inline form to record a new observation
 * against this competency without leaving the page.
 *
 * Replaces the old standards-based StandardDetailModal; this one reads/writes
 * the `observations` table directly (competency_id + assessed_age).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, Loader2, Minus, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import type { SnapshotRow } from '../../lib/competency-snapshot-data'
import { RECENT_WINDOW_DAYS, ZONE_LABEL, ZONE_TOKEN, type Trend } from '../../lib/competency-snapshot'
import {
  ASSESSMENT_LEVELS,
  formatLevel,
  type AssessmentLevel,
  type StandardAssessment,
} from '../../lib/standards-assignment-data'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'

interface Props {
  row: SnapshotRow
  dimensionId: string | null
  dimensionName: string | null
  studentId: string
  schoolId: string
  /** Learner's current age — recorded as the observation's assessed age. */
  learnerAge: number | null
  audience: 'educator' | 'family'
  /** observer_id -> display name, for history attribution. */
  observers: Map<string, string>
  onClose: () => void
  /** Called after a new observation is recorded so upstream data refreshes. */
  onObservationSaved?: () => void
}

const URL_REGEX = /https?:\/\/[^\s),]+/g

/** Within the snapshot's recency window — these observations drive the position. */
function isRecent(dateStr: string): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / 86_400_000 <= RECENT_WINDOW_DAYS
}

const LEVEL_TONE: Record<AssessmentLevel, { chip: string; dot: string }> = {
  emerging: { chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' },
  developing: { chip: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
  achieving: { chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  mastery: { chip: 'bg-purple-50 text-purple-700', dot: 'bg-purple-400' },
}

export default function CompetencyDetailModal({
  row,
  dimensionId,
  dimensionName,
  studentId,
  schoolId,
  learnerAge,
  audience,
  observers,
  onClose,
  onObservationSaved,
}: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)

  // Observations recorded within this modal session (optimistic; supplements
  // row.history until the parent refetch lands).
  const [extra, setExtra] = useState<StandardAssessment[]>([])
  const [level, setLevel] = useState<AssessmentLevel | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Assessed age — defaults to the learner's standard age; educators can step it
  // up/down (±3) to assess against an older or younger expectation. A success at
  // an older age reads as "above age expectation" even at a lower level.
  const standardAge = row.standardAge ?? learnerAge
  const ageLo = standardAge == null ? 1 : Math.max(1, standardAge - 3)
  const ageHi = standardAge == null ? 16 : Math.min(16, standardAge + 3)
  const [assessAge, setAssessAge] = useState<number | null>(standardAge)
  const assessDescRaw =
    assessAge != null ? (row.stepDescriptors?.[String(assessAge)] ?? '').trim() : ''
  const assessDesc = assessDescRaw && assessDescRaw !== 'N/A' ? assessDescRaw : null
  const ageRel = assessAge != null && standardAge != null ? assessAge - standardAge : 0

  // Recording needs a dimension (observations.dimension_id is NOT NULL); the
  // rare unassigned-competency case (no dimension) is view-only.
  const canRecord = audience === 'educator' && !!profile && dimensionId != null

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Full history, most-recent-first (row.history is asc), plus optimistic adds.
  const history = useMemo(() => {
    const combined = [...row.history, ...extra]
    return combined.sort(
      (a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime()
    )
  }, [row.history, extra])

  const competencyName = row.standard.code
  const objective =
    row.standard.description && row.standard.description !== competencyName
      ? row.standard.description
      : null
  const bandStart = row.standard.age_band_start
  const bandEnd = row.standard.age_band_end

  async function handleSave() {
    if (!canRecord || !level || saving) return
    setSaving(true)
    const rating = ASSESSMENT_LEVELS.indexOf(level) + 1
    const observedAt = new Date().toISOString()
    const { error } = await supabase.from('observations').insert({
      school_id: schoolId,
      student_id: studentId,
      dimension_id: dimensionId,
      competency_id: row.standard.id,
      assessed_age: assessAge,
      observer_id: profile!.id,
      rating,
      notes: notes.trim() || null,
      observed_at: observedAt,
    })
    setSaving(false)
    if (error) {
      toast(`Failed to save: ${error.message}`, 'error')
      return
    }
    // Optimistically reflect the new observation in this modal.
    setExtra((prev) => [
      ...prev,
      {
        id: `local-${observedAt}`,
        student_assignment_id: '',
        student_id: studentId,
        school_id: schoolId,
        standard_id: row.standard.id,
        level,
        notes: notes.trim() || null,
        assessor_id: profile!.id,
        assessed_at: observedAt,
        created_at: observedAt,
        assessed_age: assessAge,
      },
    ])
    setLevel(null)
    setNotes('')
    toast('Observation recorded — snapshot updated', 'success')
    onObservationSaved?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose()
      }}
    >
      <div
        ref={cardRef}
        className="glass-modal flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-bg-muted px-5 py-4">
          <div className="min-w-0">
            {dimensionName && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-500">
                {dimensionName}
              </p>
            )}
            <h3 className="text-base font-bold leading-snug text-text">{competencyName}</h3>
            {objective && <p className="mt-0.5 text-xs text-text-muted">{objective}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Age-specific expectation — what "Achieving" looks like at the
              standard age the learner is held to this school year. */}
          {row.stepDescriptor && (
            <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
                {row.standardAge != null
                  ? `Achieving at age ${row.standardAge}`
                  : 'Age-level expectation'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text">{row.stepDescriptor}</p>
            </div>
          )}

          {/* Position summary */}
          <div className="flex flex-wrap items-center gap-2">
            {row.isGhost ? (
              <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-medium text-text-muted">
                {row.history.length > 0 ? 'No assessment in the last 2 months' : 'Not yet assessed'}
              </span>
            ) : (
              <>
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    ZONE_TOKEN[row.zone].chip
                  )}
                >
                  {ZONE_LABEL[row.zone]}
                </span>
                {row.latest && (
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      LEVEL_TONE[row.latest.level].chip
                    )}
                  >
                    {formatLevel(row.latest.level)}
                  </span>
                )}
                {audience === 'educator' && <TrendBadge trend={row.trend} />}
              </>
            )}
            {bandStart != null && bandEnd != null && (
              <span className="ml-auto text-[11px] text-text-light">
                Ages {bandStart}–{bandEnd}
              </span>
            )}
          </div>

          {/* History */}
          <div className="mt-4">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-light">
              Observation history{history.length > 0 ? ` (${history.length})` : ''}
            </h4>
            {history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-bg-muted px-3 py-4 text-center text-xs text-text-muted">
                No observations yet.
                {canRecord ? ' Record the first one below.' : ''}
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <HistoryItem
                    key={h.id}
                    item={h}
                    standardAge={standardAge}
                    observerName={observers.get(h.assessor_id)}
                    showObserver={audience === 'educator'}
                    /* Only observations within the recency window drive the position. */
                    drivesPosition={isRecent(h.assessed_at)}
                  />
                ))}
              </ul>
            )}
            {history.some((h) => !isRecent(h.assessed_at)) && (
              <p className="mt-1.5 text-[10px] text-text-light">
                Only observations from the last 2 months (★) drive the current position; older
                ones are kept for history.
              </p>
            )}
          </div>
        </div>

        {/* Add observation (educators/admins) */}
        {canRecord && (
          <div className="border-t border-bg-muted bg-bg-card/60 px-5 py-4">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-light">
              Record an observation
            </h4>
            {standardAge != null && (
              <div className="mb-2 rounded-lg border border-bg-muted bg-bg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-text-muted">Assessing at age</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssessAge((a) => Math.max(ageLo, (a ?? standardAge) - 1))}
                      disabled={(assessAge ?? standardAge) <= ageLo}
                      className="rounded-md border border-bg-muted p-1 text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-40"
                      aria-label="Assess a year younger"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-text">{assessAge}</span>
                    <button
                      type="button"
                      onClick={() => setAssessAge((a) => Math.min(ageHi, (a ?? standardAge) + 1))}
                      disabled={(assessAge ?? standardAge) >= ageHi}
                      className="rounded-md border border-bg-muted p-1 text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-40"
                      aria-label="Assess a year older"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p
                  className={clsx(
                    'mt-1 text-[10px] font-medium',
                    ageRel > 0 ? 'text-primary-600' : ageRel < 0 ? 'text-accent-600' : 'text-text-light'
                  )}
                >
                  {ageRel > 0
                    ? `↑ Above the ${standardAge}yo standard — a success here reads as above age expectation`
                    : ageRel < 0
                      ? `↓ Below the ${standardAge}yo standard`
                      : `At the ${standardAge}yo standard`}
                </p>
                {assessDesc && (
                  <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{assessDesc}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {ASSESSMENT_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={clsx(
                    'rounded-lg border px-1 py-1.5 text-[11px] font-semibold capitalize transition-colors',
                    level === lv
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : 'border-bg-muted bg-bg text-text-muted hover:border-primary-300'
                  )}
                >
                  {formatLevel(lv)}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional note or evidence link…"
              className="mt-2 w-full resize-none rounded-lg border border-bg-muted bg-bg px-3 py-2 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!level || saving}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save observation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === 'up')
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success-600">
        <ArrowUp className="h-3.5 w-3.5" /> improving
      </span>
    )
  if (trend === 'down')
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent-600">
        <ArrowDown className="h-3.5 w-3.5" /> dipping
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-text-light">
      <ArrowRight className="h-3.5 w-3.5" /> steady
    </span>
  )
}

function HistoryItem({
  item,
  standardAge,
  observerName,
  showObserver,
  drivesPosition,
}: {
  item: StandardAssessment
  standardAge: number | null
  observerName: string | undefined
  showObserver: boolean
  drivesPosition: boolean
}) {
  const aa = item.assessed_age
  const aboveStd = aa != null && standardAge != null && aa > standardAge
  const belowStd = aa != null && standardAge != null && aa < standardAge
  const urls = item.notes ? item.notes.match(URL_REGEX) ?? [] : []
  const cleanNotes = item.notes ? item.notes.replace(URL_REGEX, '').trim() : ''
  return (
    <li className="rounded-lg border border-bg-muted bg-bg px-3 py-2">
      <div className="flex items-center gap-2 text-[10px]">
        {drivesPosition && (
          <span className="text-primary-400" title="Drives the current position" aria-hidden>
            ★
          </span>
        )}
        <span className="font-medium text-text-muted">
          {format(new Date(item.assessed_at), 'MMM d, yyyy')}
        </span>
        {aa != null && (
          <span
            className={clsx(
              'rounded px-1 py-0.5 text-[9px] font-semibold',
              aboveStd
                ? 'bg-primary-50 text-primary-700'
                : belowStd
                  ? 'bg-accent-50 text-accent-700'
                  : 'bg-bg-muted text-text-muted'
            )}
            title={
              standardAge != null && aa !== standardAge
                ? `Assessed against the age-${aa} expectation (standard is age ${standardAge})`
                : `Assessed at the age-${aa} standard`
            }
          >
            age {aa}
            {aboveStd ? ' ↑' : belowStd ? ' ↓' : ''}
          </span>
        )}
        {showObserver && (
          <>
            <span className="text-text-light">·</span>
            <span className="truncate text-text-light">{observerName ?? 'Unknown'}</span>
          </>
        )}
        <span
          className={clsx(
            'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
            LEVEL_TONE[item.level].chip
          )}
        >
          {formatLevel(item.level)}
        </span>
      </div>
      {cleanNotes && (
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{cleanNotes}</p>
      )}
      {urls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {urls.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded bg-primary-50 px-1.5 py-0.5 text-[9px] font-medium text-primary-600 transition-colors hover:bg-primary-100"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Evidence {urls.length > 1 ? idx + 1 : ''}
            </a>
          ))}
        </div>
      )}
    </li>
  )
}

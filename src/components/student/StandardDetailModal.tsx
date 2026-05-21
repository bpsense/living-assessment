/**
 * StandardDetailModal.tsx
 *
 * Click-through detail view for a single standard on the Competency Snapshot.
 * Read-only: shows the standard, where the learner currently sits on the
 * spectrum, the age-expectation text (from matching competency when
 * available), full assessment history, and parent assignments.
 */
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Loader2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import {
  getStandardDetail,
  type StandardDetail,
  type SnapshotRow,
} from '../../lib/competency-snapshot-data'
import {
  ZONE_LABEL,
  ZONE_TOKEN,
  type Trend,
} from '../../lib/competency-snapshot'
import { formatLevel, type AssessmentLevel } from '../../lib/standards-assignment-data'

interface Props {
  open: boolean
  onClose: () => void
  studentId: string
  schoolId: string
  /** The row from the snapshot — provides position context immediately while
   *  the deeper fetch (history + competency + assignments) is in flight. */
  row: SnapshotRow | null
  /** Educator mode shows assessor names + notes; family mode hides those. */
  audience: 'educator' | 'family'
  /** Optional override for "now" — used by tests; defaults to current time. */
  now?: Date
}

export default function StandardDetailModal({
  open,
  onClose,
  studentId,
  schoolId,
  row,
  audience,
}: Props) {
  const [detail, setDetail] = useState<StandardDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Close on escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !row) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getStandardDetail({ studentId, schoolId, standardId: row.standard.id })
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load detail')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, row, studentId, schoolId])

  if (!open || !row) return null

  const tone = ZONE_TOKEN[row.zone]
  const ageBand =
    row.standard.age_band_start !== null && row.standard.age_band_end !== null
      ? `Ages ${row.standard.age_band_start}–${row.standard.age_band_end}`
      : 'No age band set'

  // Fixed-size modal centered in the viewport. Header is sticky at the
  // top of the modal; the body scrolls internally. The backdrop never
  // scrolls, and the page underneath is untouched.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Standard detail"
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-bg-card shadow-2xl"
        style={{ height: 'min(80vh, 720px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixed at the top, doesn't scroll. */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-bg-muted p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-text-muted">
                {row.standard.code}
              </span>
              <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', tone.chip)}>
                {ZONE_LABEL[row.zone]}
              </span>
              <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                {ageBand}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-text">
              {row.standard.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-bg-muted hover:text-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body — only this section scrolls. */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* Spectrum mini-bar */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Current position
            </h3>
            <MiniSpectrumBar row={row} />
          </section>

          {/* Age expectation (from competency match if present) */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              What "at age expectation" looks like
            </h3>
            {loading && !detail ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : detail?.competency ? (
              <AgeExpectation
                competency={detail.competency}
                learnerAgeBand={[row.standard.age_band_start, row.standard.age_band_end]}
              />
            ) : (
              <p className="text-sm text-text">{row.standard.description}</p>
            )}
          </section>

          {/* Assessment history */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Assessment history
            </h3>
            {detail?.history && detail.history.length > 0 ? (
              <ul className="space-y-2">
                {detail.history.map((h, i) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-1 rounded-lg border border-bg-muted bg-bg-card/60 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <LevelChip level={h.level} />
                      <span className="text-xs text-text-muted">
                        {format(new Date(h.assessed_at), 'PP')}
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-600">
                          Most recent
                        </span>
                      )}
                      {audience === 'educator' && detail.assessors[h.assessor_id] && (
                        <span className="text-xs text-text-light">
                          · {detail.assessors[h.assessor_id]}
                        </span>
                      )}
                    </div>
                    {h.notes && audience === 'educator' && (
                      <p className="text-sm text-text-muted">{h.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : row.isGhost ? (
              <p className="text-sm text-text-muted">
                Not yet assessed. This standard is age-appropriate, so it
                appears as a placeholder in the snapshot.
              </p>
            ) : (
              <p className="text-sm text-text-muted">No assessments recorded.</p>
            )}
          </section>

          {/* Assignments this standard was assessed under for this learner. */}
          {detail?.assignments && detail.assignments.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {audience === 'family'
                  ? 'Where this came up'
                  : 'Assignments covering this standard'}
              </h3>
              <p className="mb-2 text-[11px] text-text-light">
                {audience === 'family'
                  ? 'Activities where this skill was checked.'
                  : 'Active or completed assignments tagged with this standard for this learner.'}
              </p>
              <ul className="space-y-1.5">
                {detail.assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline gap-2 rounded-lg border border-bg-muted bg-bg-card/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-text">{a.title}</span>
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                      {a.status}
                    </span>
                    {audience === 'educator' && a.description && (
                      <span className="text-xs text-text-muted">— {a.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trend (educator only) */}
          {audience === 'educator' && detail?.history && detail.history.length >= 2 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Trend
              </h3>
              <TrendBlurb row={row} />
            </section>
          )}

          {error && (
            <p className="rounded-md bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function MiniSpectrumBar({ row }: { row: SnapshotRow }) {
  const isUntimed = row.zone === 'untimed'
  return (
    <div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-accent-100 via-sky-100 to-primary-100">
        {!isUntimed && (
          <div
            className={clsx(
              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow',
              ZONE_TOKEN[row.zone].dot,
              'h-4 w-4'
            )}
            style={{ left: `${row.barPercent}%` }}
            aria-label={`Position: ${row.zone}`}
          />
        )}
        {/* Zone tick marks */}
        <div className="pointer-events-none absolute inset-0 flex">
          <div className="h-full w-1/3 border-r border-white/60" />
          <div className="h-full w-1/3 border-r border-white/60" />
          <div className="h-full w-1/3" />
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 text-[10px] font-medium uppercase tracking-wide">
        <span className="text-left text-accent-700">Below</span>
        <span className="text-center text-sky-700">At age level</span>
        <span className="text-right text-primary-700">Above</span>
      </div>
      {row.spectrumScore !== null && (
        <p className="mt-1 text-[11px] text-text-muted">
          Spectrum score: {row.spectrumScore.toFixed(2)} / 5.00 — weighted
          across recent assessments, with band shift applied.
        </p>
      )}
    </div>
  )
}

function AgeExpectation({
  competency,
  learnerAgeBand,
}: {
  competency: NonNullable<StandardDetail['competency']>
  learnerAgeBand: [number | null, number | null]
}) {
  const stepKeys = Object.keys(competency.step_descriptors ?? {})
  const ageStr =
    learnerAgeBand[0] !== null && learnerAgeBand[1] !== null
      ? `for ages ${learnerAgeBand[0]}–${learnerAgeBand[1]}`
      : ''
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">{competency.name}</p>
      {competency.objective && (
        <p className="text-sm text-text-muted">{competency.objective}</p>
      )}
      {stepKeys.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-bg-muted bg-bg-card/60 p-3 text-sm">
          {stepKeys.map((k) => (
            <li key={k}>
              <span className="mr-2 inline-block rounded bg-bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-text-muted">
                {k}
              </span>
              <span>{competency.step_descriptors[k]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-text-light">
          Per-level descriptors not yet authored for this standard {ageStr}.
        </p>
      )}
    </div>
  )
}

function LevelChip({ level }: { level: AssessmentLevel }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', LEVEL_TONE[level])}>
      {formatLevel(level)}
    </span>
  )
}

const LEVEL_TONE: Record<AssessmentLevel, string> = {
  emerging: 'bg-alert-50 text-alert-600',
  developing: 'bg-accent-50 text-accent-700',
  achieving: 'bg-success-50 text-success-600',
  mastery: 'bg-primary-100 text-primary-800',
}

function TrendBlurb({ row }: { row: SnapshotRow }) {
  if (row.history.length < 2) return null
  const prior = row.history[row.history.length - 2]
  const latest = row.history[row.history.length - 1]
  const trend: Trend = row.trend
  return (
    <p className="flex items-center gap-2 text-sm text-text-muted">
      <TrendIcon trend={trend} />
      {trend === 'up' && (
        <>
          Moved from <strong>{formatLevel(prior.level)}</strong> to{' '}
          <strong>{formatLevel(latest.level)}</strong>{' '}
          {formatDistanceToNow(new Date(latest.assessed_at), { addSuffix: true })}.
        </>
      )}
      {trend === 'down' && (
        <>
          Slipped from <strong>{formatLevel(prior.level)}</strong> to{' '}
          <strong>{formatLevel(latest.level)}</strong>{' '}
          {formatDistanceToNow(new Date(latest.assessed_at), { addSuffix: true })}.
        </>
      )}
      {trend === 'flat' && (
        <>Holding at <strong>{formatLevel(latest.level)}</strong>.</>
      )}
    </p>
  )
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <ArrowUp className="h-4 w-4 text-success-600" />
  if (trend === 'down') return <ArrowDown className="h-4 w-4 text-alert-600" />
  return <ArrowRight className="h-4 w-4 text-text-light" />
}

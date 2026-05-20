/**
 * CompetencySnapshot.tsx
 *
 * "Where this learner stands today" — a current-position read of the
 * standards pipeline, sibling to the amoeba (which shows growth over time).
 *
 * One shared component with two audience modes:
 *   - educator: assessed dates, notes, trend arrows, dense layout
 *   - family:   plain-language labels, no notes, simplified tooltips
 *
 * Both modes share the same data layer and position rule. No writes.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import {
  buildCompetencySnapshot,
  type CompetencySnapshot as Snapshot,
  type DomainGroup,
  type SnapshotRow,
} from '../../lib/competency-snapshot-data'
import {
  POSITION_LABEL,
  POSITION_SHORT,
  POSITION_TOKEN,
  type Position,
  type Trend,
} from '../../lib/competency-snapshot'
import { formatLevel } from '../../lib/standards-assignment-data'
import { supabase } from '../../lib/supabase'
import type {
  Dimension,
  DimensionStandard,
  Standard,
} from '../../types/database'
import type { StandardAssessment } from '../../lib/standards-assignment-data'
import { DimensionIcon } from './DimensionIcon'

export type SnapshotAudience = 'educator' | 'family'

interface Props {
  studentId: string
  schoolId: string
  studentFirstName: string
  dateOfBirth: string | null
  audience: SnapshotAudience
  /** Optional pre-loaded data (lets the parent page reuse fetches). */
  prefetched?: {
    dimensions: Dimension[]
    dimensionStandards: DimensionStandard[]
    standardAssessments: StandardAssessment[]
  }
}

export default function CompetencySnapshot({
  studentId,
  schoolId,
  studentFirstName,
  dateOfBirth,
  audience,
  prefetched,
}: Props) {
  const [standards, setStandards] = useState<Standard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const familyView = audience === 'family'

  // Standards are framework-bounded — one school fetch is enough.
  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data, error } = await supabase
        .from('standards')
        .select(
          'id, framework_id, school_id, code, description, grade_level, parent_id, display_order, visible_to_family, age_band_start, age_band_end, created_at, updated_at'
        )
        .eq('school_id', schoolId)
        .order('display_order')
      if (cancelled) return
      if (error) {
        setError(error.message)
        return
      }
      setStandards((data ?? []) as Standard[])
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [schoolId])

  const snapshot: Snapshot | null = useMemo(() => {
    if (!standards || !prefetched) return null
    return buildCompetencySnapshot({
      student: { id: studentId, school_id: schoolId, date_of_birth: dateOfBirth },
      dimensions: prefetched.dimensions,
      dimensionStandards: prefetched.dimensionStandards,
      standards,
      assessments: prefetched.standardAssessments,
      familyView,
    })
  }, [standards, prefetched, studentId, schoolId, dateOfBirth, familyView])

  // ---------- Loading / Error / Empty ----------
  if (snapshot === null || !prefetched) {
    return (
      <Shell title="Competency Snapshot">
        <div className="flex items-center justify-center py-6">
          {error ? (
            <p className="text-sm text-alert-600">Could not load snapshot: {error}</p>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
          )}
        </div>
      </Shell>
    )
  }

  const hasAnything =
    snapshot.groups.length > 0 || snapshot.unassigned.length > 0

  if (!hasAnything) {
    return (
      <Shell title="Competency Snapshot">
        <EmptyState audience={audience} firstName={studentFirstName} />
      </Shell>
    )
  }

  // ---------- Header copy ----------
  const subtitle =
    audience === 'family'
      ? `Where ${studentFirstName} is right now, on each standard, compared to their age. The amoeba above shows how this has changed over time.`
      : `Latest position per standard, relative to age. Append-only data; the amoeba above is the growth view.`

  return (
    <Shell title="Competency Snapshot" subtitle={subtitle}>
      <TotalsStrip totals={snapshot.totals} />

      <div className="mt-4 space-y-3">
        {snapshot.groups.map((group) => (
          <DomainPanel
            key={group.dimension.id}
            group={group}
            audience={audience}
          />
        ))}

        {snapshot.unassigned.length > 0 && (
          <UnassignedPanel rows={snapshot.unassigned} audience={audience} />
        )}
      </div>

      {snapshot.learnerAge === null && (
        <p className="mt-3 text-xs text-text-muted">
          Add a date of birth to surface age-relative positions; current view
          shows assessed standards without an age comparison.
        </p>
      )}
    </Shell>
  )
}

// ============================================================
// Shell
// ============================================================

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="glass-card p-5">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-text">{title}</h2>
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function EmptyState({
  audience,
  firstName,
}: {
  audience: SnapshotAudience
  firstName: string
}) {
  if (audience === 'family') {
    return (
      <p className="text-sm text-text-muted">
        {firstName} hasn't been assessed on any standards yet. Once educators
        record assessments, this view will show where {firstName} stands today
        on each standard.
      </p>
    )
  }
  return (
    <p className="text-sm text-text-muted">
      No standards assessments or age-appropriate ghost rows to display. Once
      you assess a standard on an active assignment or the school maps standards
      to dimensions, the snapshot will populate here.
    </p>
  )
}

// ============================================================
// Totals strip
// ============================================================

function TotalsStrip({ totals }: { totals: Record<Position, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {(['building', 'at', 'ahead', 'untimed'] as const).map((p) => {
        if (totals[p] === 0) return null
        return (
          <span
            key={p}
            className={clsx(
              'rounded-full px-2.5 py-1 font-medium',
              POSITION_TOKEN[p].chip
            )}
          >
            <span className="opacity-70">{POSITION_SHORT[p]}:</span>{' '}
            <span>{totals[p]}</span>
          </span>
        )
      })}
    </div>
  )
}

// ============================================================
// Domain panel (summary + expand)
// ============================================================

function DomainPanel({
  group,
  audience,
}: {
  group: DomainGroup
  audience: SnapshotAudience
}) {
  const [open, setOpen] = useState(false)
  const { dimension, rows, counts, untimed } = group

  const totalAssessed = rows.filter((r) => !r.isGhost).length
  const ghostCount = rows.filter((r) => r.isGhost).length

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <DimensionIcon name={dimension.icon} className="h-4 w-4 shrink-0 text-primary-500" />
          <span className="truncate font-semibold text-text">{dimension.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <TallyChips counts={counts} ghostCount={ghostCount} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>

      <ProportionBar counts={counts} ghostCount={ghostCount} totalAssessed={totalAssessed} />

      {open && (
        <div className="border-t border-bg-muted p-4">
          <PositionBar rows={rows} audience={audience} />
          {untimed.length > 0 && (
            <UntimedRows rows={untimed} audience={audience} />
          )}
        </div>
      )}
    </div>
  )
}

function TallyChips({
  counts,
  ghostCount,
}: {
  counts: Record<Position, number>
  ghostCount: number
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <Tally n={counts.ahead} label="ahead" tone="ahead" />
      <Tally n={counts.at} label="at age level" tone="at" />
      <Tally n={counts.building} label="building" tone="building" />
      {ghostCount > 0 && (
        <span className="hidden text-text-light sm:inline">· {ghostCount} not yet assessed</span>
      )}
    </div>
  )
}

function Tally({
  n,
  label,
  tone,
}: {
  n: number
  label: string
  tone: Position
}) {
  if (n === 0) return null
  return (
    <span className={clsx('rounded-full px-1.5 py-0.5 font-medium', POSITION_TOKEN[tone].chip)}>
      {n} <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

function ProportionBar({
  counts,
  ghostCount,
  totalAssessed,
}: {
  counts: Record<Position, number>
  ghostCount: number
  totalAssessed: number
}) {
  // Use only assessed rows for the proportion bar; ghost rows render as a
  // muted trailing segment so families can see "more to come".
  const total = Math.max(1, totalAssessed + ghostCount)
  const pct = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="mx-4 mb-3 flex h-1.5 overflow-hidden rounded-full bg-bg-muted">
      <div className={clsx('h-full', POSITION_TOKEN.building.bar)} style={{ width: pct(counts.building) }} />
      <div className={clsx('h-full', POSITION_TOKEN.at.bar)} style={{ width: pct(counts.at) }} />
      <div className={clsx('h-full', POSITION_TOKEN.ahead.bar)} style={{ width: pct(counts.ahead) }} />
      <div className="h-full bg-bg-muted" style={{ width: pct(ghostCount) }} />
    </div>
  )
}

// ============================================================
// Position bar (the visual: BUILDING ← AT → AHEAD)
// ============================================================

function PositionBar({
  rows,
  audience,
}: {
  rows: SnapshotRow[]
  audience: SnapshotAudience
}) {
  // Each zone gets 1/3 of the track. Markers within a zone stack vertically
  // to avoid collisions; horizontal offset within zone is a stable hash of
  // the standard code so the layout doesn't churn between renders.
  const zones: { key: Position; rows: SnapshotRow[] }[] = [
    { key: 'building', rows: rows.filter((r) => r.position === 'building') },
    { key: 'at', rows: rows.filter((r) => r.position === 'at') },
    { key: 'ahead', rows: rows.filter((r) => r.position === 'ahead') },
  ]

  return (
    <div>
      {/* Zone labels */}
      <div className="mb-1 grid grid-cols-3 text-[10px] font-medium uppercase tracking-wide">
        <span className="text-left text-accent-700">{POSITION_LABEL.building}</span>
        <span className="text-center text-sky-700">{POSITION_LABEL.at}</span>
        <span className="text-right text-primary-700">{POSITION_LABEL.ahead}</span>
      </div>

      {/* The track */}
      <div className="relative grid grid-cols-3 rounded-lg border border-bg-muted bg-gradient-to-r from-accent-50 via-sky-50 to-primary-50">
        {zones.map((zone) => (
          <div
            key={zone.key}
            className="flex flex-wrap items-center justify-center gap-1 px-2 py-3 min-h-[64px]"
          >
            {zone.rows.length === 0 ? (
              <span className="text-[10px] text-text-light">—</span>
            ) : (
              zone.rows.map((row) => (
                <Marker key={row.standard.id} row={row} audience={audience} />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Marker({ row, audience }: { row: SnapshotRow; audience: SnapshotAudience }) {
  const tone = POSITION_TOKEN[row.position]
  const isGhost = row.isGhost
  const tooltip = buildTooltip(row, audience)
  const levelLabel = row.latest ? formatLevel(row.latest.level) : 'Not assessed'

  return (
    <span
      title={tooltip}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        isGhost
          ? 'border-dashed border-text-light bg-bg-card/40 text-text-muted'
          : `border-transparent ${tone.chip}`
      )}
    >
      <span className="font-mono">{row.standard.code}</span>
      {!isGhost && <span>·</span>}
      {!isGhost && <span>{levelLabel}</span>}
      {!isGhost && audience === 'educator' && <TrendIcon trend={row.trend} />}
    </span>
  )
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <ArrowUp className="h-3 w-3" aria-label="trending up" />
  if (trend === 'down') return <ArrowDown className="h-3 w-3" aria-label="trending down" />
  return <ArrowRight className="h-3 w-3 opacity-60" aria-label="flat" />
}

function buildTooltip(row: SnapshotRow, audience: SnapshotAudience): string {
  const parts: string[] = []
  parts.push(`${row.standard.code} — ${row.standard.description}`)
  if (row.standard.age_band_start !== null && row.standard.age_band_end !== null) {
    parts.push(
      `Ages ${row.standard.age_band_start}–${row.standard.age_band_end}`
    )
  }
  if (row.latest) {
    parts.push(`${formatLevel(row.latest.level)}`)
    if (audience === 'educator') {
      parts.push(`Last assessed ${format(new Date(row.latest.assessed_at), 'PP')}`)
      parts.push(`Trend: ${row.trend}`)
      if (row.latest.notes) parts.push(`Notes: ${row.latest.notes}`)
    } else {
      parts.push(
        `Last update ${formatDistanceToNow(new Date(row.latest.assessed_at), { addSuffix: true })}`
      )
    }
  } else {
    parts.push('Not yet assessed')
  }
  return parts.join('\n')
}

// ============================================================
// Untimed + Unassigned
// ============================================================

function UntimedRows({ rows, audience }: { rows: SnapshotRow[]; audience: SnapshotAudience }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-light">
        Untimed (no age band on standard)
      </p>
      <div className="flex flex-wrap gap-1">
        {rows.map((row) => (
          <Marker key={row.standard.id} row={row} audience={audience} />
        ))}
      </div>
    </div>
  )
}

function UnassignedPanel({
  rows,
  audience,
}: {
  rows: SnapshotRow[]
  audience: SnapshotAudience
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-dashed border-bg-muted bg-bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-text-muted">
          Unassigned ({rows.length})
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted" />
        )}
      </button>
      {open && (
        <div className="border-t border-bg-muted p-4">
          <p className="mb-2 text-xs text-text-muted">
            These standards aren't yet mapped to a learning dimension, so they
            don't roll up to the amoeba.
          </p>
          <div className="flex flex-wrap gap-1">
            {rows.map((row) => (
              <Marker key={row.standard.id} row={row} audience={audience} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

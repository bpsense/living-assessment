/**
 * CompetencySnapshot.tsx
 *
 * Current-position view of the standards pipeline, sibling to the amoeba
 * (which shows growth over time).
 *
 * v2 layout:
 *  - Default: domain summary rows with stacked proportion strip.
 *  - Expanded: a single continuous gradient bar per domain. Each assessed
 *    standard is a marker placed at its computed spectrum percent (left =
 *    below age expectation, center = at age, right = above). Markers are
 *    clickable; the click opens a StandardDetailModal.
 *
 * Two audience modes share one data layer + one rule.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  buildCompetencySnapshot,
  type CompetencySnapshot as Snapshot,
  type DomainGroup,
  type SnapshotRow,
} from '../../lib/competency-snapshot-data'
import {
  ZONE_LABEL,
  ZONE_SHORT,
  ZONE_TOKEN,
  type Zone,
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
import StandardDetailModal from './StandardDetailModal'
import { setStudentSnapshotVisibility } from '../../lib/snapshot-visibility'
import { useToast } from '../Toast'

export type SnapshotAudience = 'educator' | 'family'

interface Props {
  studentId: string
  schoolId: string
  studentFirstName: string
  dateOfBirth: string | null
  audience: SnapshotAudience
  /** Current value of students.family_snapshot_visible. Drives the educator
   *  header toggle; ignored for family audience (gating happens upstream). */
  familyVisible?: boolean
  /** Called after the educator toggles family visibility so the page can
   *  refetch the student record. */
  onChangedVisibility?: () => void
  /** Called after an educator records an ad-hoc observation from the
   *  standard-detail modal so upstream data can refresh. */
  onObservationSaved?: () => void
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
  familyVisible = true,
  onChangedVisibility,
  onObservationSaved,
  prefetched,
}: Props) {
  const [standards, setStandards] = useState<Standard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<SnapshotRow | null>(null)
  const [togglingVis, setTogglingVis] = useState(false)
  const familyView = audience === 'family'
  const { toast } = useToast()

  async function handleToggleVisibility() {
    if (togglingVis) return
    setTogglingVis(true)
    const next = !familyVisible
    const { error } = await setStudentSnapshotVisibility(studentId, next)
    setTogglingVis(false)
    if (error) {
      toast(error, 'error')
      return
    }
    toast(
      next
        ? `Snapshot now visible to ${studentFirstName}'s family`
        : `Snapshot hidden from ${studentFirstName}'s family`,
      'success'
    )
    onChangedVisibility?.()
  }

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

  const headerAction =
    audience === 'educator' ? (
      <VisibilityToggle
        visible={familyVisible}
        busy={togglingVis}
        onClick={handleToggleVisibility}
      />
    ) : null

  if (snapshot === null || !prefetched) {
    return (
      <Shell title="Competency Snapshot" action={headerAction}>
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
      <Shell title="Competency Snapshot" action={headerAction}>
        <EmptyState audience={audience} firstName={studentFirstName} />
      </Shell>
    )
  }

  const subtitle =
    audience === 'family'
      ? `Where ${studentFirstName} stands today on each standard, weighted toward the most recent assessments. The amoeba above shows how this has changed over time.`
      : `Spectrum position per standard. Weighted across recent assessments (90-day half-life) with a band shift applied. Click a marker for full detail.`

  return (
    <Shell title="Competency Snapshot" subtitle={subtitle} action={headerAction}>
      <TotalsStrip totals={snapshot.totals} />

      <div className="mt-4 space-y-3">
        {snapshot.groups.map((group) => (
          <DomainPanel
            key={group.dimension.id}
            group={group}
            audience={audience}
            onRowClick={setOpenRow}
          />
        ))}

        {snapshot.unassigned.length > 0 && (
          <UnassignedPanel
            rows={snapshot.unassigned}
            audience={audience}
            onRowClick={setOpenRow}
          />
        )}
      </div>

      {snapshot.learnerAge === null && (
        <p className="mt-3 text-xs text-text-muted">
          Add a date of birth to surface age-relative positions; current view
          shows assessed standards as untimed.
        </p>
      )}

      <StandardDetailModal
        open={openRow !== null}
        onClose={() => setOpenRow(null)}
        studentId={studentId}
        schoolId={schoolId}
        row={openRow}
        audience={audience}
        onObservationSaved={onObservationSaved}
      />
    </Shell>
  )
}

function VisibilityToggle({
  visible,
  busy,
  onClick,
}: {
  visible: boolean
  busy: boolean
  onClick: () => void
}) {
  const Icon = visible ? Eye : EyeOff
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        visible
          ? 'border-success-200 bg-success-50 text-success-700 hover:bg-success-100'
          : 'border-bg-muted bg-bg-muted/60 text-text-muted hover:bg-bg-muted'
      )}
      title={
        visible
          ? 'Snapshot is visible to family — click to hide'
          : 'Snapshot is hidden from family — click to show'
      }
      aria-pressed={visible}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {visible ? 'Family can see' : 'Hidden from family'}
    </button>
  )
}

// ============================================================
// Shell + Empty
// ============================================================

function Shell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="glass-card p-5">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-bold text-text">{title}</h2>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
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
        record assessments, this view will show where {firstName} stands today.
      </p>
    )
  }
  return (
    <p className="text-sm text-text-muted">
      No standards assessments or age-appropriate ghost rows to display. Once
      you assess a standard on an active assignment or the school maps
      standards to dimensions, the snapshot will populate here.
    </p>
  )
}

// ============================================================
// Totals strip
// ============================================================

function TotalsStrip({ totals }: { totals: Record<Zone, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {(['below', 'at', 'above', 'untimed'] as const).map((z) => {
        if (totals[z] === 0) return null
        return (
          <span
            key={z}
            className={clsx('rounded-full px-2.5 py-1 font-medium', ZONE_TOKEN[z].chip)}
          >
            <span className="opacity-70">{ZONE_SHORT[z]}:</span>{' '}
            <span>{totals[z]}</span>
          </span>
        )
      })}
    </div>
  )
}

// ============================================================
// Domain panel
// ============================================================

function DomainPanel({
  group,
  audience,
  onRowClick,
}: {
  group: DomainGroup
  audience: SnapshotAudience
  onRowClick: (row: SnapshotRow) => void
}) {
  const [open, setOpen] = useState(false)
  const { dimension, rows, counts, untimed } = group

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

      <ProportionBar counts={counts} ghostCount={ghostCount} />

      {open && (
        <div className="border-t border-bg-muted p-4">
          <SpectrumBar rows={rows} audience={audience} onRowClick={onRowClick} />
          {untimed.length > 0 && (
            <UntimedRows rows={untimed} audience={audience} onRowClick={onRowClick} />
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
  counts: Record<Zone, number>
  ghostCount: number
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <Tally n={counts.below} label="below" zone="below" />
      <Tally n={counts.at} label="at age level" zone="at" />
      <Tally n={counts.above} label="above" zone="above" />
      {ghostCount > 0 && (
        <span className="hidden text-text-light sm:inline">· {ghostCount} not yet assessed</span>
      )}
    </div>
  )
}

function Tally({ n, label, zone }: { n: number; label: string; zone: Zone }) {
  if (n === 0) return null
  return (
    <span className={clsx('rounded-full px-1.5 py-0.5 font-medium', ZONE_TOKEN[zone].chip)}>
      {n} <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

function ProportionBar({
  counts,
  ghostCount,
}: {
  counts: Record<Zone, number>
  ghostCount: number
}) {
  const total = Math.max(1, counts.below + counts.at + counts.above + ghostCount)
  const pct = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="mx-4 mb-3 flex h-1.5 overflow-hidden rounded-full bg-bg-muted">
      <div className={clsx('h-full', ZONE_TOKEN.below.dot)} style={{ width: pct(counts.below) }} />
      <div className={clsx('h-full', ZONE_TOKEN.at.dot)} style={{ width: pct(counts.at) }} />
      <div className={clsx('h-full', ZONE_TOKEN.above.dot)} style={{ width: pct(counts.above) }} />
      <div className="h-full bg-bg-muted" style={{ width: pct(ghostCount) }} />
    </div>
  )
}

// ============================================================
// Continuous spectrum bar
// ============================================================

function SpectrumBar({
  rows,
  audience,
  onRowClick,
}: {
  rows: SnapshotRow[]
  audience: SnapshotAudience
  onRowClick: (row: SnapshotRow) => void
}) {
  // Cluster markers into vertical lanes so they don't visually overlap when
  // their barPercent values are close. A new lane is opened whenever a marker
  // would sit within `LANE_GAP` of an earlier marker in the same lane.
  const lanes = useMemo(() => layoutLanes(rows), [rows])

  return (
    <div>
      <div className="mb-1 grid grid-cols-3 text-[10px] font-medium uppercase tracking-wide">
        <span className="text-left text-accent-700">{ZONE_LABEL.below}</span>
        <span className="text-center text-sky-700">{ZONE_LABEL.at}</span>
        <span className="text-right text-primary-700">{ZONE_LABEL.above}</span>
      </div>

      <div
        className="relative rounded-lg border border-bg-muted bg-gradient-to-r from-accent-50 via-sky-50 to-primary-50"
        style={{ minHeight: 24 + lanes.length * 28, paddingBottom: 8, paddingTop: 8 }}
      >
        {/* Vertical guides at the zone boundaries */}
        <div className="pointer-events-none absolute inset-0 flex">
          <div className="h-full w-1/3 border-r border-white/70" />
          <div className="h-full w-1/3 border-r border-white/70" />
          <div className="h-full w-1/3" />
        </div>

        {/* Markers */}
        {lanes.map((lane, laneIdx) =>
          lane.map((row) => (
            <Marker
              key={row.standard.id}
              row={row}
              top={8 + laneIdx * 28}
              audience={audience}
              onClick={() => onRowClick(row)}
            />
          ))
        )}
      </div>
    </div>
  )
}

const LANE_GAP_PERCENT = 14 // minimum horizontal spacing between markers in a lane

function layoutLanes(rows: SnapshotRow[]): SnapshotRow[][] {
  const sorted = [...rows].sort((a, b) => a.barPercent - b.barPercent)
  const lanes: SnapshotRow[][] = []
  for (const row of sorted) {
    let placed = false
    for (const lane of lanes) {
      const last = lane[lane.length - 1]
      if (row.barPercent - last.barPercent >= LANE_GAP_PERCENT) {
        lane.push(row)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([row])
  }
  return lanes
}

function Marker({
  row,
  top,
  audience,
  onClick,
}: {
  row: SnapshotRow
  top: number
  audience: SnapshotAudience
  onClick: () => void
}) {
  const tone = ZONE_TOKEN[row.zone]
  const isGhost = row.isGhost
  const levelLabel = row.latest ? formatLevel(row.latest.level) : 'Not assessed'
  // Decide anchoring so markers near the edges stay inside the track.
  const align: 'start' | 'center' | 'end' =
    row.barPercent < 15 ? 'start' : row.barPercent > 85 ? 'end' : 'center'
  const translate =
    align === 'start' ? '0%' : align === 'end' ? '-100%' : '-50%'

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${row.standard.code} — ${row.standard.description}`}
      className={clsx(
        'absolute inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-transform hover:scale-105',
        isGhost
          ? 'border-dashed border-text-light bg-bg-card/50 text-text-muted'
          : `border-transparent ${tone.chip}`
      )}
      style={{
        left: `${row.barPercent}%`,
        top,
        transform: `translate(${translate}, 0)`,
      }}
    >
      <span className="font-mono">{row.standard.code}</span>
      {!isGhost && <span aria-hidden>·</span>}
      {!isGhost && <span>{levelLabel}</span>}
      {!isGhost && audience === 'educator' && <TrendIcon trend={row.trend} />}
    </button>
  )
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <ArrowUp className="h-3 w-3" aria-label="trending up" />
  if (trend === 'down') return <ArrowDown className="h-3 w-3" aria-label="trending down" />
  return <ArrowRight className="h-3 w-3 opacity-60" aria-label="flat" />
}

// ============================================================
// Untimed + Unassigned
// ============================================================

function UntimedRows({
  rows,
  audience,
  onRowClick,
}: {
  rows: SnapshotRow[]
  audience: SnapshotAudience
  onRowClick: (row: SnapshotRow) => void
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-light">
        Untimed (no age band on standard)
      </p>
      <div className="flex flex-wrap gap-1">
        {rows.map((row) => (
          <UntimedChip
            key={row.standard.id}
            row={row}
            audience={audience}
            onClick={() => onRowClick(row)}
          />
        ))}
      </div>
    </div>
  )
}

function UntimedChip({
  row,
  audience,
  onClick,
}: {
  row: SnapshotRow
  audience: SnapshotAudience
  onClick: () => void
}) {
  const levelLabel = row.latest ? formatLevel(row.latest.level) : 'Not assessed'
  return (
    <button
      type="button"
      onClick={onClick}
      title={row.standard.description}
      className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted hover:bg-bg-card"
    >
      <span className="font-mono">{row.standard.code}</span>
      <span aria-hidden>·</span>
      <span>{levelLabel}</span>
      {audience === 'educator' && row.latest && <TrendIcon trend={row.trend} />}
    </button>
  )
}

function UnassignedPanel({
  rows,
  audience,
  onRowClick,
}: {
  rows: SnapshotRow[]
  audience: SnapshotAudience
  onRowClick: (row: SnapshotRow) => void
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
              <UntimedChip
                key={row.standard.id}
                row={row}
                audience={audience}
                onClick={() => onRowClick(row)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

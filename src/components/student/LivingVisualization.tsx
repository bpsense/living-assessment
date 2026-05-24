/**
 * LivingVisualization.tsx
 * Combined "living assessment" view:
 * - Amoeba blob chart showing competency & interest
 * - Timeline playback for viewing growth over time
 * - Legend explaining the dual indicators
 *
 * Snapshot state is owned by the parent (StudentProfile) so that
 * both the blob chart and dimension cards can respond to timeline scrubbing.
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { History, TrendingUp, Maximize2, X } from 'lucide-react'
import type { DimensionScore } from '../../lib/student-data'
import type { Snapshot } from '../../lib/living-data'
import type { Observation } from '../../types/database'
import { interpolateScores, decayDimensionScores } from '../../lib/living-data'
import LivingBlob from './LivingBlob'
import TimelinePlayback from './TimelinePlayback'

// US grade for a given age (age 5 = K, age 6 = G1, …). Used only to annotate
// the age label so educators can map between the two conventions at a glance.
function gradeForAge(ageYears: number): string {
  if (ageYears <= 4) return 'PreK'
  if (ageYears === 5) return 'K'
  const g = ageYears - 5
  return g >= 1 && g <= 12 ? `G${g}` : `${ageYears}yo`
}

// ── Smooth animation hook ────────────────────────────────────────
// Uses requestAnimationFrame to interpolate between DimensionScore[]
// states, creating fluid organic morphing instead of discrete jumps.

function useAnimatedScores(
  target: DimensionScore[],
  durationMs: number = 1000
): DimensionScore[] {
  const [displayed, setDisplayed] = useState<DimensionScore[]>(target)
  const displayedRef = useRef<DimensionScore[]>(target)
  const rafRef = useRef<number>(0)
  const prevTargetRef = useRef<DimensionScore[]>(target)

  useEffect(() => {
    // Skip if same reference (no actual change)
    if (target === prevTargetRef.current) return

    // Capture where we currently are (mid-animation or settled)
    const from = displayedRef.current
    prevTargetRef.current = target

    // If lengths don't match or empty, snap immediately
    if (target.length === 0 || from.length !== target.length) {
      displayedRef.current = target
      setDisplayed(target)
      return
    }

    const startTime = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    function tick(now: number) {
      const elapsed = now - startTime
      const rawT = Math.min(elapsed / durationMs, 1)
      // Linear interpolation — during continuous playback the transitions
      // chain back-to-back so any ease-in-out would create micro-pauses
      // at each snapshot boundary. Linear keeps constant fluid motion.
      const interpolated = interpolateScores(from, target, rawT)
      displayedRef.current = interpolated
      setDisplayed(interpolated)

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Snap to exact target at the end
        displayedRef.current = target
        setDisplayed(target)
        rafRef.current = 0
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  return displayed
}

// ── Age-rollover squeeze hook ───────────────────────────────────
// Detects when playback crosses an age boundary (the snapshot for the
// student's birthday month) and drives a 1→0 animation of the ring squeeze.

function useAgeTransition(
  snapshots: Snapshot[],
  snapshotIdx: number | null,
  playing: boolean
): { squeezeProgress: number; transitionLabel: string | null } {
  const [squeezeProgress, setSqueezeProgress] = useState(0)
  const [transitionLabel, setTransitionLabel] = useState<string | null>(null)
  const rafRef = useRef<number>(0)
  const prevIdxRef = useRef<number | null>(null)

  useEffect(() => {
    if (snapshotIdx === null || snapshots.length === 0) {
      // Clear any lingering state
      setSqueezeProgress(0)
      setTransitionLabel(null)
      return
    }

    const snap = snapshots[Math.min(snapshotIdx, snapshots.length - 1)]
    const prevIdx = prevIdxRef.current
    prevIdxRef.current = snapshotIdx

    // Only trigger when advancing forward to an age-rollover snapshot
    if (
      !snap?.isAgeRollover ||
      prevIdx === null ||
      snapshotIdx <= prevIdx
    ) {
      // Not a transition — if we were animating, cancel and clear
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      setSqueezeProgress(0)
      setTransitionLabel(null)
      return
    }

    // Start the squeeze animation
    const label = `Turning ${snap.ageYears} · ${gradeForAge(snap.ageYears)}`
    setTransitionLabel(label)
    setSqueezeProgress(1)

    // Two-phase choreography in LivingBlob (shrink → emerge) needs more
    // airtime than the prior single-phase squeeze.
    const duration = playing ? 2800 : 1600
    const startTime = performance.now()

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    let cancelled = false

    function tick(now: number) {
      if (cancelled) return
      const elapsed = now - startTime
      const rawT = Math.min(elapsed / duration, 1)
      // Ease-out: fast start, slow finish
      const eased = 1 - (1 - rawT) * (1 - rawT)
      const progress = 1 - eased

      setSqueezeProgress(progress)

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setSqueezeProgress(0)
        setTransitionLabel(null)
        rafRef.current = 0
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      setSqueezeProgress(0)
      setTransitionLabel(null)
    }
  }, [snapshotIdx, snapshots, playing])

  return { squeezeProgress, transitionLabel }
}

interface Props {
  /** Current dimension scores (the "now" snapshot) */
  dimensionScores: DimensionScore[]
  /** Pre-built historical snapshots (built by parent) */
  snapshots: Snapshot[]
  /** Currently selected snapshot index, or null */
  snapshotIdx: number | null
  /** Callback when the user scrubs the timeline */
  onSnapshotChange: (idx: number) => void
  /** Whether the timeline panel is visible */
  showTimeline: boolean
  /** Toggle timeline visibility */
  onToggleTimeline: () => void
  /** Controlled playback state */
  playing?: boolean
  /** Callback when playback state changes */
  onPlayingChange?: (playing: boolean) => void
  /** Callback when a dimension label/dot is clicked */
  onDimensionClick?: (dimensionId: string) => void
  /** Simplified mode for parent/family view */
  familyView?: boolean
  /** All observations for this student (for dot popup) */
  observations?: Observation[]
  /** Map of observer_id -> full_name */
  observers?: Map<string, string>
}

export default function LivingVisualization({
  dimensionScores,
  snapshots,
  snapshotIdx,
  onSnapshotChange,
  showTimeline,
  onToggleTimeline,
  playing,
  onPlayingChange,
  onDimensionClick,
  familyView = false,
  observations,
  observers,
}: Props) {
  // Baseline age = age at the earliest snapshot. Used to compute the
  // cumulative per-birthday rescale applied to displayed competency values
  // (see decayDimensionScores in living-data.ts).
  const baselineAge = snapshots[0]?.ageYears ?? 0

  // Determine which scores to display (discrete target). Apply the age-rescale
  // decay so that what was "Achieving" at age 6 reads as "Developing" at age 7 —
  // the rubric got harder, so the same observed performance lands a tier lower.
  // For the live (no-timeline) view, decay against the latest snapshot's age.
  const displayScores = useMemo(() => {
    const usingTimeline =
      showTimeline && snapshotIdx !== null && snapshots.length > 0
    if (!usingTimeline) {
      const latestAge = snapshots[snapshots.length - 1]?.ageYears
      if (latestAge == null) return dimensionScores
      return decayDimensionScores(dimensionScores, latestAge, baselineAge)
    }
    const idx = Math.min(snapshotIdx!, snapshots.length - 1)
    const snap = snapshots[idx]
    const raw = snap?.dimensionScores ?? dimensionScores
    return snap ? decayDimensionScores(raw, snap.ageYears, baselineAge) : raw
  }, [showTimeline, snapshotIdx, snapshots, dimensionScores, baselineAge])

  // Smooth animation: interpolate toward displayScores.
  // Duration is intentionally ~12% longer than the play interval (1250ms)
  // so each animation is still in-flight when the next snapshot arrives —
  // the hook seamlessly redirects from wherever it is, eliminating any gap.
  const animatedScores = useAnimatedScores(displayScores, 1400)

  // Age-rollover squeeze animation
  const { squeezeProgress, transitionLabel } = useAgeTransition(
    snapshots,
    snapshotIdx,
    playing ?? false
  )

  // Current age label — always shows during timeline playback. Age-first,
  // grade-in-parens for educators who think in grades. E.g. "7y 4m · G2".
  const currentGradeLabel = useMemo(() => {
    if (!showTimeline || snapshotIdx === null || snapshots.length === 0) return undefined
    const idx = Math.min(snapshotIdx, snapshots.length - 1)
    const snap = snapshots[idx]
    if (!snap) return undefined
    return `${snap.ageYears}y ${snap.ageMonths}m · ${gradeForAge(snap.ageYears)}`
  }, [showTimeline, snapshotIdx, snapshots])

  // Filter observations to those visible at the current snapshot date
  const snapshotObservations = useMemo(() => {
    if (!observations || !showTimeline || snapshotIdx === null || snapshots.length === 0) {
      return observations ?? []
    }
    const idx = Math.min(snapshotIdx, snapshots.length - 1)
    const snapshot = snapshots[idx]
    if (!snapshot) return observations ?? []

    // End of the snapshot month is the cutoff
    const d = new Date(snapshot.date)
    const cutoff = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)

    return observations.filter(
      (o) => new Date(o.observed_at).getTime() <= cutoff.getTime()
    )
  }, [observations, showTimeline, snapshotIdx, snapshots])

  // Is the user viewing historical data (not the latest)?
  const isHistorical =
    showTimeline &&
    snapshotIdx !== null &&
    snapshotIdx < snapshots.length - 1

  // ── Expanded (fullscreen) modal state ──
  const [expanded, setExpanded] = useState(false)

  const openExpanded = useCallback(() => setExpanded(true), [])
  const closeExpanded = useCallback(() => setExpanded(false), [])

  // Lock body scroll & Escape to close when expanded
  useEffect(() => {
    if (!expanded) return
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  return (
    <div className="space-y-4">
      {/* ── Header with title and timeline toggle ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text">
            {familyView ? 'Growth Profile' : 'SproutMap'}
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {familyView
              ? 'Watch how your child\'s skills and interests evolve over time.'
              : 'Competency and interest mapped across all dimensions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {snapshots.length > 0 && (
            <button
              onClick={onToggleTimeline}
              className={
                showTimeline
                  ? 'flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100'
                  : 'flex items-center gap-1.5 rounded-lg border border-bg-muted px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text'
              }
            >
              <History className="h-3.5 w-3.5" />
              {showTimeline ? 'Hide Timeline' : 'Show Growth'}
            </button>
          )}

          <button
            onClick={openExpanded}
            className="flex items-center gap-1.5 rounded-lg border border-bg-muted px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            title="Expand visualisation"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand</span>
          </button>
        </div>
      </div>

      {/* ── Expanded fullscreen modal ──
          Portaled to document.body so position:fixed isn't trapped by an
          ancestor with backdrop-filter / transform / filter (e.g. the
          surrounding .glass-card on StudentProfile), which would otherwise
          turn the modal's containing block into the card itself instead of
          the viewport. */}
      {expanded && createPortal(
        <ExpandedBlobModal
          animatedScores={animatedScores}
          snapshotObservations={snapshotObservations}
          observers={observers}
          onDimensionClick={onDimensionClick}
          familyView={familyView}
          showTimeline={showTimeline}
          snapshots={snapshots}
          snapshotIdx={snapshotIdx}
          onSnapshotChange={onSnapshotChange}
          playing={playing}
          onPlayingChange={onPlayingChange}
          isHistorical={isHistorical}
          onClose={closeExpanded}
          ringSqueezeProgress={squeezeProgress}
          gradeTransitionLabel={transitionLabel ?? undefined}
          currentGradeLabel={currentGradeLabel}
        />,
        document.body
      )}

      {/* ── Historical data banner ── */}
      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-2">
          <TrendingUp className="h-4 w-4 text-accent-600" />
          <span className="text-xs font-medium text-accent-700">
            Viewing historical snapshot — not current data
          </span>
          <button
            onClick={() => {
              onPlayingChange?.(false)
              onSnapshotChange(snapshots.length - 1)
            }}
            className="ml-auto text-xs font-semibold text-accent-600 hover:text-accent-700"
          >
            Jump to now →
          </button>
        </div>
      )}

      {/* ── Blob chart with side legend ── */}
      <div className="flex items-center justify-center gap-6">
        {/* Chart — uses animated scores for smooth morphing */}
        <div className="min-w-0 flex-1 flex justify-center">
          <LivingBlob
            dimensionScores={animatedScores}
            size={familyView ? 600 : 740}
            showLabels
            showLevelLabels={!familyView}
            onDimensionClick={onDimensionClick}
            observations={snapshotObservations}
            observers={observers}
            ringSqueezeProgress={squeezeProgress}
            gradeTransitionLabel={transitionLabel ?? undefined}
            currentGradeLabel={currentGradeLabel}
          />
        </div>

        {/* Side legend */}
        <div className="hidden shrink-0 flex-col gap-5 self-center md:flex" style={{ minWidth: 160 }}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-[#0D7377] shadow-sm" />
              <span className="text-sm font-semibold text-text">Competency</span>
            </div>
            <p className="pl-[22px] text-xs leading-relaxed text-text-muted">
              Educator-assessed skill level across each dimension
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-[#D4943A] shadow-sm" />
              <span className="text-sm font-semibold text-text">Interest</span>
            </div>
            <p className="pl-[22px] text-xs leading-relaxed text-text-muted">
              Learner-reported curiosity and engagement
            </p>
          </div>
          <div className="mt-1 border-t border-bg-muted pt-4 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-light">Levels</p>
            {(['Emerging', 'Developing', 'Achieving', 'Exceeding'] as const).map((level, i) => (
              <div key={level} className="flex items-center gap-2">
                {level === 'Exceeding' ? (
                  <span
                    className="inline-block h-2 w-5 rounded-sm border border-[#D8D4CA]"
                    style={{ background: 'transparent' }}
                  />
                ) : (
                  <span
                    className="inline-block h-2 w-5 rounded-sm"
                    style={{
                      background: ['rgba(180,175,160,0.50)', 'rgba(200,196,184,0.35)', 'rgba(220,216,206,0.22)'][i],
                    }}
                  />
                )}
                <span className="text-xs text-text-muted">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact legend for mobile (below chart) */}
      <div className="flex items-center justify-center gap-6 md:hidden">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-full bg-[#0D7377]" />
          <span className="font-medium">Competency</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-full bg-[#D4943A]" />
          <span className="font-medium">Interest</span>
        </span>
      </div>

      {/* ── Family-friendly insight cards ── */}
      {familyView && displayScores.length > 0 && (
        <FamilyInsights scores={displayScores} />
      )}

      {/* ── Timeline playback ── */}
      {showTimeline && snapshots.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-4">
          <TimelinePlayback
            snapshots={snapshots}
            currentIndex={snapshotIdx ?? snapshots.length - 1}
            onChange={onSnapshotChange}
            playing={playing}
            onPlayingChange={onPlayingChange}
          />
        </div>
      )}
    </div>
  )
}

// ── Expanded fullscreen blob modal ─────────────────────────────

function ExpandedBlobModal({
  animatedScores,
  snapshotObservations,
  observers,
  onDimensionClick,
  familyView,
  showTimeline,
  snapshots,
  snapshotIdx,
  onSnapshotChange,
  playing,
  onPlayingChange,
  isHistorical,
  onClose,
  ringSqueezeProgress,
  gradeTransitionLabel,
  currentGradeLabel,
}: {
  animatedScores: DimensionScore[]
  snapshotObservations: Observation[]
  observers?: Map<string, string>
  onDimensionClick?: (dimensionId: string) => void
  familyView: boolean
  showTimeline: boolean
  snapshots: Snapshot[]
  snapshotIdx: number | null
  onSnapshotChange: (idx: number) => void
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
  isHistorical: boolean
  onClose: () => void
  ringSqueezeProgress?: number
  gradeTransitionLabel?: string | null
  currentGradeLabel?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div>
          <h2 className="text-lg font-bold text-text">
            {familyView ? 'Growth Profile' : 'SproutMap'}
          </h2>
          <p className="text-xs text-text-muted">
            {familyView
              ? 'Your child\'s skills and interests across all dimensions.'
              : 'Competency and interest mapped across all dimensions.'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-xs font-medium text-text-muted shadow-sm transition-colors hover:bg-bg-muted hover:text-text"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>

      {/* Historical banner */}
      {isHistorical && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-2 sm:mx-8">
          <TrendingUp className="h-4 w-4 text-accent-600" />
          <span className="text-xs font-medium text-accent-700">
            Viewing historical snapshot — not current data
          </span>
          <button
            onClick={() => {
              onPlayingChange?.(false)
              onSnapshotChange(snapshots.length - 1)
            }}
            className="ml-auto text-xs font-semibold text-accent-600 hover:text-accent-700"
          >
            Jump to now →
          </button>
        </div>
      )}

      {/* Main content area — blob + legend */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-8 overflow-hidden px-5 sm:px-8">
        {/* Blob — takes available space */}
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          <div className="h-full w-full max-w-[min(90vh,90vw)]">
            <LivingBlob
              dimensionScores={animatedScores}
              size={900}
              showLabels
              showLevelLabels={!familyView}
              onDimensionClick={onDimensionClick}
              observations={snapshotObservations}
              observers={observers}
              className="h-full w-full"
              ringSqueezeProgress={ringSqueezeProgress}
              gradeTransitionLabel={gradeTransitionLabel ?? undefined}
            currentGradeLabel={currentGradeLabel}
            />
          </div>
        </div>

        {/* Side legend — visible on wider screens */}
        <div className="hidden shrink-0 flex-col gap-5 self-center lg:flex" style={{ minWidth: 180 }}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full bg-[#0D7377] shadow-sm" />
              <span className="text-sm font-semibold text-text">Competency</span>
            </div>
            <p className="pl-[24px] text-xs leading-relaxed text-text-muted">
              Educator-assessed skill level across each dimension
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full bg-[#D4943A] shadow-sm" />
              <span className="text-sm font-semibold text-text">Interest</span>
            </div>
            <p className="pl-[24px] text-xs leading-relaxed text-text-muted">
              Learner-reported curiosity and engagement
            </p>
          </div>
          <div className="mt-1 border-t border-bg-muted pt-4 space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-light">Levels</p>
            {(['Emerging', 'Developing', 'Achieving', 'Exceeding'] as const).map((level, i) => (
              <div key={level} className="flex items-center gap-2">
                {level === 'Exceeding' ? (
                  <span
                    className="inline-block h-2.5 w-6 rounded-sm border border-[#D8D4CA]"
                    style={{ background: 'transparent' }}
                  />
                ) : (
                  <span
                    className="inline-block h-2.5 w-6 rounded-sm"
                    style={{
                      background: ['rgba(180,175,160,0.50)', 'rgba(200,196,184,0.35)', 'rgba(220,216,206,0.22)'][i],
                    }}
                  />
                )}
                <span className="text-sm text-text-muted">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact mobile legend — visible below lg */}
      <div className="flex items-center justify-center gap-6 py-2 lg:hidden">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-full bg-[#0D7377]" />
          <span className="font-medium">Competency</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-block h-3 w-3 rounded-full bg-[#D4943A]" />
          <span className="font-medium">Interest</span>
        </span>
      </div>

      {/* Timeline playback at the bottom */}
      {showTimeline && snapshots.length > 0 && (
        <div className="mx-5 mb-5 glass-card p-4 sm:mx-8">
          <TimelinePlayback
            snapshots={snapshots}
            currentIndex={snapshotIdx ?? snapshots.length - 1}
            onChange={onSnapshotChange}
            playing={playing}
            onPlayingChange={onPlayingChange}
          />
        </div>
      )}
    </div>
  )
}

// ── Family-friendly insight summary ────────────────────────────

function FamilyInsights({ scores }: { scores: DimensionScore[] }) {
  const withData = scores.filter((s) => s.competency > 0 || s.interest > 0)
  if (withData.length === 0) return null

  // Find strongest, most interested, and biggest gap
  const strongest = [...withData].sort((a, b) => b.competency - a.competency)[0]
  const mostInterested = [...withData].sort((a, b) => b.interest - a.interest)[0]

  // Growth opportunity: high interest but lower competency
  const growthOp = [...withData]
    .filter((d) => d.interest >= 2.5 && d.competency < d.interest)
    .sort((a, b) => (b.interest - b.competency) - (a.interest - a.competency))[0]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {strongest && (
        <InsightCard
          emoji="⭐"
          title="Strongest Area"
          dimension={strongest.dimension_name}
          detail={`Competency ${strongest.competency.toFixed(1)} / 4`}
          color="primary"
        />
      )}
      {mostInterested && (
        <InsightCard
          emoji="💡"
          title="Most Interested In"
          dimension={mostInterested.dimension_name}
          detail={`Interest ${mostInterested.interest.toFixed(1)} / 5`}
          color="accent"
        />
      )}
      {growthOp && (
        <InsightCard
          emoji="🌱"
          title="Growth Opportunity"
          dimension={growthOp.dimension_name}
          detail="High curiosity, building skill"
          color="success"
        />
      )}
    </div>
  )
}

function InsightCard({
  emoji,
  title,
  dimension,
  detail,
  color,
}: {
  emoji: string
  title: string
  dimension: string
  detail: string
  color: 'primary' | 'accent' | 'success'
}) {
  const bgMap = {
    primary: 'bg-primary-50',
    accent: 'bg-accent-50',
    success: 'bg-success-50',
  }
  const textMap = {
    primary: 'text-primary-700',
    accent: 'text-accent-700',
    success: 'text-success-600',
  }

  return (
    <div className={`rounded-lg ${bgMap[color]} px-4 py-3`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <span>{emoji}</span>
        {title}
      </div>
      <p className={`mt-1 text-sm font-semibold ${textMap[color]}`}>{dimension}</p>
      <p className="mt-0.5 text-[11px] text-text-light">{detail}</p>
    </div>
  )
}

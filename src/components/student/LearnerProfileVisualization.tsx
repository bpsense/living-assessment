import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react'

import LearnerProfileBlob from './LearnerProfileBlob'
import {
  computeSnapshot,
  computeTimeline,
  loadVisualizationDataset,
  type VisualizationDataset,
  type VisualizationSnapshot,
} from '../../lib/learner-profile-vis-data'

interface Props {
  studentId: string
  schoolId: string
}

type View = 'snapshot' | 'timeline'

const PLAYBACK_INTERVAL_MS = 700
const TRAIL_WINDOW = 6

export default function LearnerProfileVisualization({ studentId, schoolId }: Props) {
  const [dataset, setDataset] = useState<VisualizationDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<View>('snapshot')
  const [timelineIdx, setTimelineIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Load dataset
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadVisualizationDataset({ studentId, schoolId })
      .then((d) => {
        if (!cancelled) setDataset(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load visualization')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [studentId, schoolId])

  // Derived: timeline + current snapshot.
  const timeline: VisualizationSnapshot[] = useMemo(() => {
    if (!dataset) return []
    return computeTimeline(dataset)
  }, [dataset])

  const snapshotNow: VisualizationSnapshot | null = useMemo(() => {
    if (!dataset) return null
    return computeSnapshot(dataset, new Date())
  }, [dataset])

  // Clamp timeline index when timeline length changes.
  useEffect(() => {
    if (timeline.length === 0) {
      setTimelineIdx(0)
      return
    }
    setTimelineIdx((prev) => Math.min(prev, timeline.length - 1))
  }, [timeline.length])

  // Default the timeline cursor to the most recent snapshot.
  const initializedTimelineIdx = useRef(false)
  useEffect(() => {
    if (initializedTimelineIdx.current || timeline.length === 0) return
    initializedTimelineIdx.current = true
    setTimelineIdx(timeline.length - 1)
  }, [timeline.length])

  // Playback ticker.
  useEffect(() => {
    if (!playing || view !== 'timeline' || timeline.length === 0) return
    const id = window.setInterval(() => {
      setTimelineIdx((prev) => {
        const next = prev + 1
        if (next >= timeline.length) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, PLAYBACK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [playing, view, timeline.length])

  const togglePlay = useCallback(() => {
    if (timeline.length === 0) return
    // If at end, restart from beginning.
    if (timelineIdx >= timeline.length - 1) {
      setTimelineIdx(0)
    }
    setPlaying((p) => !p)
  }, [timelineIdx, timeline.length])

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-600">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    )
  }

  if (!dataset || dataset.domains.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-bg-muted bg-bg-card px-6 py-10 text-center">
        <p className="text-sm text-text-muted">
          No Learner Profile domains are configured for this school yet.
        </p>
      </div>
    )
  }

  const activeSnapshot: VisualizationSnapshot =
    view === 'timeline' && timeline[timelineIdx]
      ? timeline[timelineIdx]
      : (snapshotNow ?? timeline[timeline.length - 1])

  const trail =
    view === 'timeline'
      ? timeline.slice(Math.max(0, timelineIdx - TRAIL_WINDOW), timelineIdx)
      : []

  const centerLabel =
    activeSnapshot.ageYears !== null
      ? `Age ${activeSnapshot.ageYears}`
      : 'Age unknown'

  const totalAssessed = activeSnapshot.domains.reduce(
    (sum, d) => sum + d.assessedSkillCount,
    0
  )
  const totalCanvas = activeSnapshot.domains.reduce(
    (sum, d) => sum + d.canvasSkills,
    0
  )

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-bg-muted bg-bg p-0.5 text-xs font-medium">
          <button
            onClick={() => setView('snapshot')}
            className={clsx(
              'rounded-lg px-3 py-1.5 transition-colors',
              view === 'snapshot'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            )}
          >
            Snapshot
          </button>
          <button
            onClick={() => setView('timeline')}
            className={clsx(
              'rounded-lg px-3 py-1.5 transition-colors',
              view === 'timeline'
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            )}
          >
            Timeline
          </button>
        </div>
        <div className="text-xs text-text-light">
          {totalAssessed} / {totalCanvas} skill{totalCanvas === 1 ? '' : 's'} assessed
          {' · '}
          {formatDateLabel(activeSnapshot.date)}
        </div>
      </div>

      {/* Blob */}
      <div className="flex justify-center">
        <LearnerProfileBlob
          domains={dataset.domains}
          snapshot={activeSnapshot}
          trail={trail}
          centerLabel={centerLabel}
        />
      </div>

      {/* Timeline controls */}
      {view === 'timeline' && timeline.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-bg-muted bg-bg-card px-3 py-2">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm transition-colors hover:bg-primary-600"
            aria-label={playing ? 'Pause playback' : 'Play playback'}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, timeline.length - 1)}
            value={timelineIdx}
            onChange={(e) => {
              setPlaying(false)
              setTimelineIdx(Number(e.target.value))
            }}
            className="flex-1 accent-primary-500"
            aria-label="Timeline scrubber"
          />
          <div className="flex flex-col items-end text-[11px] text-text-light">
            <span className="font-medium text-text-muted">
              {formatDateLabel(activeSnapshot.date)}
            </span>
            <span>
              {timelineIdx + 1} / {timeline.length}
            </span>
          </div>
        </div>
      )}

      {/* Domain legend / per-domain totals */}
      <ul className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
        {dataset.domains.map((d) => {
          const state = activeSnapshot.domains.find((s) => s.domainId === d.id)
          return (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-lg border border-bg-muted bg-bg-card px-2 py-1.5"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color ?? '#94A3B8' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-text" style={{ fontSize: 11 }}>{d.name}</p>
                <p className="text-text-light" style={{ fontSize: 10 }}>
                  {state?.assessedSkillCount ?? 0} / {state?.canvasSkills ?? 0} skills
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

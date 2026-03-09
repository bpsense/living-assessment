/**
 * TimelinePlayback.tsx
 * Timeline scrubber with:
 * - Period selector buttons (3 months, 6 months, 1 year, All time)
 * - Play/pause with looping
 * - Evolving date label during playback
 * - Dot markers for each snapshot
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import type { Snapshot } from '../../lib/living-data'

interface Props {
  snapshots: Snapshot[]
  currentIndex: number
  onChange: (index: number) => void
  /** Controlled playing state (optional — uses internal state if omitted) */
  playing?: boolean
  /** Callback when playing state changes (required when `playing` is provided) */
  onPlayingChange?: (playing: boolean) => void
  className?: string
}

type Period = '3m' | '6m' | '1y' | 'all'

const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: '3m', label: '3 Mo', months: 3 },
  { key: '6m', label: '6 Mo', months: 6 },
  { key: '1y', label: '1 Yr', months: 12 },
  { key: 'all', label: 'All', months: Infinity },
]

const PLAY_INTERVAL_MS = 1250 // matches animation duration for seamless continuous motion
const END_PAUSE_MS = 2000 // pause at "current" before looping

export default function TimelinePlayback({
  snapshots,
  currentIndex,
  onChange,
  playing: controlledPlaying,
  onPlayingChange,
  className,
}: Props) {
  const [internalPlaying, setInternalPlaying] = useState(false)
  const playing = controlledPlaying ?? internalPlaying
  const setPlaying = onPlayingChange ?? setInternalPlaying
  const [period, setPeriod] = useState<Period>('all')
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter snapshots by selected period
  const { filteredSnapshots, startOffset } = useMemo(() => {
    if (period === 'all') {
      return { filteredSnapshots: snapshots, startOffset: 0 }
    }

    const periodConfig = PERIODS.find((p) => p.key === period)!
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - periodConfig.months, 1)

    let startIdx = 0
    for (let i = 0; i < snapshots.length; i++) {
      if (new Date(snapshots[i].date) >= cutoff) {
        startIdx = i
        break
      }
    }

    return {
      filteredSnapshots: snapshots.slice(startIdx),
      startOffset: startIdx,
    }
  }, [snapshots, period])

  const total = filteredSnapshots.length
  // Map the global currentIndex to the filtered view
  const filteredIndex = Math.max(0, Math.min(currentIndex - startOffset, total - 1))

  // Use a ref to track current filtered index for the interval
  const idxRef = useRef(filteredIndex)
  idxRef.current = filteredIndex

  // Auto-advance when playing (loops back to start with pause at end)
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearTimeout(intervalRef.current)
      intervalRef.current = null
      return
    }

    function scheduleNext() {
      const next = idxRef.current + 1
      if (next >= total) {
        // Reached the end — pause for 2 seconds, then loop
        intervalRef.current = setTimeout(() => {
          onChange(startOffset)
          intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)
        }, END_PAUSE_MS)
      } else {
        onChange(next + startOffset)
        intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)
      }
    }

    // Start first tick
    intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [playing, total, startOffset, onChange])

  // Stop playing on unmount
  useEffect(() => () => setPlaying(false), [])

  const handlePlay = useCallback(() => {
    if (filteredIndex >= total - 1) {
      // At end, restart from beginning
      onChange(startOffset)
    }
    setPlaying(true)
  }, [filteredIndex, total, startOffset, onChange])

  const handlePeriodChange = useCallback(
    (p: Period) => {
      setPlaying(false)
      setPeriod(p)
      // Jump to start of new period
      if (p === 'all') {
        onChange(0)
      } else {
        const periodConfig = PERIODS.find((x) => x.key === p)!
        const now = new Date()
        const cutoff = new Date(now.getFullYear(), now.getMonth() - periodConfig.months, 1)
        let startIdx = 0
        for (let i = 0; i < snapshots.length; i++) {
          if (new Date(snapshots[i].date) >= cutoff) {
            startIdx = i
            break
          }
        }
        onChange(startIdx)
      }
    },
    [snapshots, onChange]
  )

  if (total <= 1) return null

  const current = filteredSnapshots[filteredIndex]
  const progress = total > 1 ? (filteredIndex / (total - 1)) * 100 : 0

  return (
    <div className={clsx('space-y-3', className)}>
      {/* ── Period selector + date label ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Period pills */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePeriodChange(p.key)}
              className={clsx(
                'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                period === p.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-bg hover:text-text'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Current date — large, prominent during playback */}
        <div
          className={clsx(
            'flex items-center gap-1.5 transition-all',
            playing ? 'scale-105' : ''
          )}
        >
          <Calendar className="h-3.5 w-3.5 text-text-light" />
          <span
            className={clsx(
              'font-semibold transition-all',
              playing ? 'text-base text-primary-600' : 'text-sm text-text'
            )}
          >
            {current?.label ?? '—'}
          </span>
        </div>
      </div>

      {/* ── Controls + slider ── */}
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={() => (playing ? setPlaying(false) : handlePlay())}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm transition-colors hover:bg-primary-600"
          title={playing ? 'Pause' : 'Play timeline'}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </button>

        {/* Slider track area */}
        <div className="relative flex-1">
          {/* Background track */}
          <div className="h-1.5 rounded-full bg-bg-muted" />

          {/* Filled progress */}
          <div
            className={clsx(
              'absolute inset-y-0 left-0 rounded-full bg-primary-400',
              playing ? 'transition-all duration-1000 ease-linear' : 'transition-all duration-300 ease-out'
            )}
            style={{ width: `${progress}%`, height: '6px' }}
          />

          {/* Dot markers */}
          <div className="absolute inset-x-0 top-0 flex items-center" style={{ height: '6px' }}>
            {filteredSnapshots.map((snap, i) => {
              const left = total > 1 ? (i / (total - 1)) * 100 : 50
              const isActive = i === filteredIndex
              return (
                <button
                  key={snap.date}
                  onClick={() => {
                    setPlaying(false)
                    onChange(i + startOffset)
                  }}
                  className={clsx(
                    'absolute -translate-x-1/2 rounded-full transition-all duration-200',
                    isActive
                      ? 'h-4 w-4 -top-[5px] border-2 border-white bg-primary-500 shadow-md'
                      : 'h-2 w-2 -top-[1px] bg-primary-200 hover:bg-primary-400'
                  )}
                  style={{ left: `${left}%` }}
                  title={snap.label}
                />
              )
            })}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            setPlaying(false)
            onChange(startOffset)
          }}
          className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          title="Reset to start"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Date range labels ── */}
      <div className="flex justify-between px-11 text-[10px] text-text-light">
        <span>{filteredSnapshots[0]?.label}</span>
        {total > 2 && (
          <span>{filteredSnapshots[Math.floor(total / 2)]?.label}</span>
        )}
        <span>{filteredSnapshots[total - 1]?.label}</span>
      </div>

      {/* ── Loop indicator ── */}
      {playing && (
        <div className="flex items-center justify-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400" />
          <span className="text-[10px] font-medium text-text-light">
            Looping {PERIODS.find((p) => p.key === period)?.label ?? 'All'}
          </span>
        </div>
      )}
    </div>
  )
}

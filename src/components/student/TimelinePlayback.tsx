/**
 * TimelinePlayback.tsx
 * Timeline scrubber with:
 * - School-year buttons (e.g. "22/23", "23/24", "24/25", "25/26")
 *   School year = August of one year → June of the next
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

// ============================================================
// School year helpers
// ============================================================

/** A school year spans Aug 1 of `startYear` through Jul 31 of `startYear + 1`. */
interface SchoolYear {
  /** Short label, e.g. "24/25" */
  label: string
  /** Full label, e.g. "2024–2025" */
  fullLabel: string
  /** Unique key */
  key: string
  /** Calendar year the school year starts (August) */
  startYear: number
  /** Aug 1 of start year */
  startDate: Date
  /** Jul 31 of next year */
  endDate: Date
}

/**
 * Given a date, return the school year it falls in.
 * Aug-Dec → that year is the start year.
 * Jan-Jul → previous year is the start year.
 */
function schoolYearOf(d: Date): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
}

function buildSchoolYear(startYear: number): SchoolYear {
  const endYear = startYear + 1
  const shortStart = String(startYear).slice(-2)
  const shortEnd = String(endYear).slice(-2)
  return {
    label: `${shortStart}/${shortEnd}`,
    fullLabel: `${startYear}–${endYear}`,
    key: `${startYear}`,
    startYear,
    startDate: new Date(startYear, 7, 1), // Aug 1
    endDate: new Date(endYear, 6, 31, 23, 59, 59, 999), // Jul 31
  }
}

/**
 * Derive the list of school years that have data in the snapshots.
 * Always includes the current school year.
 */
function deriveSchoolYears(snapshots: Snapshot[]): SchoolYear[] {
  if (snapshots.length === 0) return []

  const yearsWithData = new Set<number>()
  for (const snap of snapshots) {
    const d = new Date(snap.date)
    yearsWithData.add(schoolYearOf(d))
  }

  // Always include current school year
  yearsWithData.add(schoolYearOf(new Date()))

  const sorted = [...yearsWithData].sort((a, b) => a - b)
  return sorted.map(buildSchoolYear)
}

// ============================================================
// Constants
// ============================================================

const PLAY_INTERVAL_MS = 1250
const END_PAUSE_MS = 2000

// ============================================================
// Component
// ============================================================

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
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive school years from snapshot data
  const schoolYears = useMemo(() => deriveSchoolYears(snapshots), [snapshots])
  // Default to "all" so the full multi-year timeline plays from the start
  const [selectedYear, setSelectedYear] = useState<string | 'all'>('all')

  // Update selected year when school years change (e.g. data loads)
  useEffect(() => {
    if (schoolYears.length <= 1) {
      setSelectedYear('all')
    } else if (selectedYear === 'all') {
      // Keep "all" if user chose it
    } else {
      // Ensure the selected year still exists
      const exists = schoolYears.some((sy) => sy.key === selectedYear)
      if (!exists) setSelectedYear('all')
    }
  }, [schoolYears])

  // Filter snapshots by selected school year
  const { filteredSnapshots, startOffset } = useMemo(() => {
    if (selectedYear === 'all') {
      return { filteredSnapshots: snapshots, startOffset: 0 }
    }

    const sy = schoolYears.find((y) => y.key === selectedYear)
    if (!sy) return { filteredSnapshots: snapshots, startOffset: 0 }

    let startIdx = 0
    for (let i = 0; i < snapshots.length; i++) {
      if (new Date(snapshots[i].date) >= sy.startDate) {
        startIdx = i
        break
      }
    }

    let endIdx = snapshots.length
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (new Date(snapshots[i].date) <= sy.endDate) {
        endIdx = i + 1
        break
      }
    }

    return {
      filteredSnapshots: snapshots.slice(startIdx, endIdx),
      startOffset: startIdx,
    }
  }, [snapshots, selectedYear, schoolYears])

  const total = filteredSnapshots.length
  const filteredIndex = Math.max(0, Math.min(currentIndex - startOffset, total - 1))

  const idxRef = useRef(filteredIndex)
  idxRef.current = filteredIndex

  // Auto-advance when playing
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearTimeout(intervalRef.current)
      intervalRef.current = null
      return
    }

    function scheduleNext() {
      const next = idxRef.current + 1
      if (next >= total) {
        intervalRef.current = setTimeout(() => {
          onChange(startOffset)
          intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)
        }, END_PAUSE_MS)
      } else {
        onChange(next + startOffset)
        intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)
      }
    }

    intervalRef.current = setTimeout(scheduleNext, PLAY_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [playing, total, startOffset, onChange])

  // Stop playing on unmount
  useEffect(() => () => setPlaying(false), [])

  const handlePlay = useCallback(() => {
    if (filteredIndex >= total - 1) {
      onChange(startOffset)
    }
    setPlaying(true)
  }, [filteredIndex, total, startOffset, onChange])

  const handleYearChange = useCallback(
    (yearKey: string | 'all') => {
      setPlaying(false)
      setSelectedYear(yearKey)

      if (yearKey === 'all') {
        onChange(0)
        return
      }

      const sy = schoolYears.find((y) => y.key === yearKey)
      if (!sy) return

      let startIdx = 0
      for (let i = 0; i < snapshots.length; i++) {
        if (new Date(snapshots[i].date) >= sy.startDate) {
          startIdx = i
          break
        }
      }
      onChange(startIdx)
    },
    [snapshots, schoolYears, onChange]
  )

  if (total <= 1) return null

  const current = filteredSnapshots[filteredIndex]
  const progress = total > 1 ? (filteredIndex / (total - 1)) * 100 : 0

  return (
    <div className={clsx('space-y-3', className)}>
      {/* ── School year selector + date label ── */}
      <div className="flex items-center justify-between gap-3">
        {/* School year pills */}
        <div className="flex flex-wrap gap-1">
          {schoolYears.map((sy) => (
            <button
              key={sy.key}
              onClick={() => handleYearChange(sy.key)}
              className={clsx(
                'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                selectedYear === sy.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-bg hover:text-text'
              )}
              title={sy.fullLabel}
            >
              {sy.label}
            </button>
          ))}
          {schoolYears.length > 1 && (
            <button
              onClick={() => handleYearChange('all')}
              className={clsx(
                'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                selectedYear === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-bg hover:text-text'
              )}
            >
              All
            </button>
          )}
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
              const isGradeTransition = snap.isAgeRollover
              const transitionTitle = isGradeTransition && snap.prevAgeYears != null
                ? `${snap.label} — new school year, age ${snap.standardAge} standard (rubric advanced)`
                : snap.label
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
                      ? 'h-4 w-4 -top-[5px] border-2 border-white shadow-md'
                      : isGradeTransition
                        ? 'h-3 w-3 -top-[3px] hover:scale-125'
                        : 'h-2 w-2 -top-[1px] hover:bg-primary-400',
                    isActive
                      ? (isGradeTransition ? 'bg-amber-500' : 'bg-primary-500')
                      : isGradeTransition
                        ? 'bg-amber-400 border border-amber-500'
                        : 'bg-primary-200'
                  )}
                  style={{ left: `${left}%` }}
                  title={transitionTitle}
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
            Looping{' '}
            {selectedYear === 'all'
              ? 'All'
              : schoolYears.find((y) => y.key === selectedYear)?.label ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}

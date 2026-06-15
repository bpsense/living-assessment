/**
 * competency-levels.ts
 *
 * The single reference point for competency-level DISPLAY labels across the app.
 *
 * The level *keys* (`emerging/developing/achieving/mastery`), the numeric scale
 * (observations.rating 0.33–4.0), and the bucketing thresholds are fixed and live
 * here once. Only the display *names* and *descriptors* are school-customizable,
 * stored in `schools.settings.competency_levels`. Labels are resolved at display
 * time from the numeric rating, so historical observations always render with the
 * school's current words.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useActiveSchoolId } from './school-context'
import {
  ASSESSMENT_LEVELS,
  formatLevel,
  type AssessmentLevel,
} from './standards-assignment-data'
import type { CompetencyLevelConfig } from '../types/database'

export type { CompetencyLevelConfig }

/** Built-in defaults (index 0 → score 1 … index 3 → score 4). */
export const DEFAULT_COMPETENCY_LEVELS: CompetencyLevelConfig[] = [
  { name: 'Emerging', descriptor: 'Beginning to explore; needs significant support' },
  { name: 'Developing', descriptor: 'Growing understanding; needs some scaffolding' },
  { name: 'Achieving', descriptor: 'Applying skills with increasing independence' },
  { name: 'Mastery', descriptor: 'Demonstrates strong, consistent mastery' },
]

/** Convenience: just the default names, for prop defaults on leaf components. */
export const DEFAULT_COMPETENCY_LABELS = DEFAULT_COMPETENCY_LEVELS.map((l) => l.name)

// ── Pure score → level helpers (the one place display thresholds live) ──

/** Bucket a continuous score into a level index 0–3, or -1 for "no data" (score <= 0). */
export function scoreToLevelIndex(score: number): number {
  if (score <= 0) return -1
  if (score < 1.5) return 0
  if (score < 2.5) return 1
  if (score < 3.5) return 2
  return 3
}

/** Bucket a continuous score into a stable level key, or null for "no data". */
export function scoreToLevelKey(score: number): AssessmentLevel | null {
  const idx = scoreToLevelIndex(score)
  return idx < 0 ? null : ASSESSMENT_LEVELS[idx]
}

/** Resolve a level name by index against a (school or default) level config. */
export function labelForIndex(levels: CompetencyLevelConfig[], index: number): string {
  return levels[index]?.name ?? DEFAULT_COMPETENCY_LEVELS[index]?.name ?? ''
}

/** Resolve a level name from a continuous score. Empty string for "no data". */
export function labelForScore(levels: CompetencyLevelConfig[], score: number): string {
  const idx = scoreToLevelIndex(score)
  return idx < 0 ? '' : labelForIndex(levels, idx)
}

/** Resolve a level name from a stable level key. Falls back to capitalized key. */
export function labelForKey(levels: CompetencyLevelConfig[], key: AssessmentLevel): string {
  const idx = ASSESSMENT_LEVELS.indexOf(key)
  return idx < 0 ? formatLevel(key) : labelForIndex(levels, idx)
}

/** Merge stored (possibly partial/empty) config over the defaults, always length 4. */
export function mergeCompetencyLevels(stored: unknown): CompetencyLevelConfig[] {
  const arr = Array.isArray(stored) ? (stored as Partial<CompetencyLevelConfig>[]) : []
  return DEFAULT_COMPETENCY_LEVELS.map((def, i) => ({
    name: arr[i]?.name?.trim() || def.name,
    descriptor: arr[i]?.descriptor?.trim() || def.descriptor,
  }))
}

// ── App-wide hook (mirrors src/lib/department-label.ts) ──

const LEVELS_CHANGED = 'competency-levels-changed'

/** Notify all useCompetencyLevels() hooks to re-fetch. */
export function notifyCompetencyLevelsChanged() {
  window.dispatchEvent(new Event(LEVELS_CHANGED))
}

// Module-level cache so bulk consumers (blob popups, grids) don't each refetch.
const cache = new Map<string, CompetencyLevelConfig[]>()
// In-flight requests, so many components mounting at once share ONE query.
const inflight = new Map<string, Promise<CompetencyLevelConfig[]>>()

async function loadLevels(schoolId: string): Promise<CompetencyLevelConfig[]> {
  const cached = cache.get(schoolId)
  if (cached) return cached
  const existing = inflight.get(schoolId)
  if (existing) return existing

  const promise = (async () => {
    try {
      const { data } = await supabase
        .from('schools')
        .select('settings')
        .eq('id', schoolId)
        .single()
      const settings = (data?.settings ?? {}) as Record<string, unknown>
      const merged = mergeCompetencyLevels(settings.competency_levels)
      cache.set(schoolId, merged)
      return merged
    } finally {
      inflight.delete(schoolId)
    }
  })()

  inflight.set(schoolId, promise)
  return promise
}

export interface UseCompetencyLevels {
  /** The 4 level configs (name + descriptor), defaults merged in. */
  levels: CompetencyLevelConfig[]
  /** Just the names, index 0–3. */
  labels: string[]
  loading: boolean
  labelForIndex: (index: number) => string
  labelForScore: (score: number) => string
  labelForKey: (key: AssessmentLevel) => string
}

/**
 * Returns the school's competency level config (names + descriptors), defaulting
 * to DEFAULT_COMPETENCY_LEVELS. Re-fetches when notifyCompetencyLevelsChanged() fires.
 */
export function useCompetencyLevels(): UseCompetencyLevels {
  const schoolId = useActiveSchoolId()
  const [levels, setLevels] = useState<CompetencyLevelConfig[]>(
    () => (schoolId && cache.get(schoolId)) || DEFAULT_COMPETENCY_LEVELS
  )
  const [loading, setLoading] = useState(() => !(schoolId && cache.has(schoolId)))
  const [revision, setRevision] = useState(0)

  const fetchLevels = useCallback(() => {
    if (!schoolId) {
      setLevels(DEFAULT_COMPETENCY_LEVELS)
      setLoading(false)
      return
    }

    const cached = cache.get(schoolId)
    if (cached) {
      setLevels(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    loadLevels(schoolId).then((merged) => {
      if (cancelled) return
      setLevels(merged)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [schoolId, revision])

  useEffect(() => fetchLevels(), [fetchLevels])

  // Re-fetch when another component saves new labels.
  useEffect(() => {
    const handler = () => {
      cache.clear()
      setRevision((r) => r + 1)
    }
    window.addEventListener(LEVELS_CHANGED, handler)
    return () => window.removeEventListener(LEVELS_CHANGED, handler)
  }, [])

  return {
    levels,
    labels: levels.map((l) => l.name),
    loading,
    labelForIndex: useCallback((index: number) => labelForIndex(levels, index), [levels]),
    labelForScore: useCallback((score: number) => labelForScore(levels, score), [levels]),
    labelForKey: useCallback((key: AssessmentLevel) => labelForKey(levels, key), [levels]),
  }
}

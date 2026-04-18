import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { School } from '../types/database'

export interface PlatformKPIs {
  totalSchools: number
  totalUsers: number
  totalLearners: number
  observationsLast30d: number
  observationsLast7d: number
  activeEducators7d: number
  observationsByDay: number[]
}

export interface SchoolRow {
  school: School
  learnerCount: number
  educatorCount: number
  classroomCount: number
  observationsLast30d: number
  lastActivityAt: string | null
}

export interface ActivityItem {
  id: string
  schoolId: string
  schoolName: string
  observerName: string
  dimensionName: string
  observedAt: string
}

export interface SystemDashboardData {
  loading: boolean
  error: string | null
  kpis: PlatformKPIs
  schoolRows: SchoolRow[]
  recentActivity: ActivityItem[]
  staleSchools: SchoolRow[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function emptyData(): SystemDashboardData {
  return {
    loading: true,
    error: null,
    kpis: {
      totalSchools: 0,
      totalUsers: 0,
      totalLearners: 0,
      observationsLast30d: 0,
      observationsLast7d: 0,
      activeEducators7d: 0,
      observationsByDay: [],
    },
    schoolRows: [],
    recentActivity: [],
    staleSchools: [],
  }
}

export function useSystemDashboard(allSchools: School[], enabled: boolean): SystemDashboardData {
  const [state, setState] = useState<SystemDashboardData>(emptyData)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))

      try {
        const since30d = daysAgoIso(30)
        const since7d = daysAgoIso(7)

        const [
          usersRes,
          learnersRes,
          obs30Res,
          obs7Res,
          obsTrendRes,
          recentActivityRes,
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase
            .from('observations')
            .select('id', { count: 'exact', head: true })
            .gte('observed_at', since30d),
          supabase
            .from('observations')
            .select('id, observer_id', { count: 'exact' })
            .gte('observed_at', since7d),
          supabase
            .from('observations')
            .select('observed_at')
            .gte('observed_at', since30d)
            .order('observed_at', { ascending: true }),
          supabase
            .from('observations')
            .select(`
              id, observed_at, school_id,
              dimension:dimensions(name),
              observer:profiles!observations_observer_id_fkey(full_name)
            `)
            .order('observed_at', { ascending: false })
            .limit(15),
        ])

        // Active educators (distinct observer_id from last 7d observations)
        const activeEducators = new Set(
          ((obs7Res.data ?? []) as Array<{ observer_id: string | null }>)
            .map((o) => o.observer_id)
            .filter((v): v is string => !!v),
        ).size

        // Bucket observations into 30 daily counts
        const buckets = new Array(30).fill(0) as number[]
        const start = Date.now() - 30 * DAY_MS
        for (const row of (obsTrendRes.data ?? []) as Array<{ observed_at: string }>) {
          const t = new Date(row.observed_at).getTime()
          const idx = Math.min(29, Math.max(0, Math.floor((t - start) / DAY_MS)))
          buckets[idx] += 1
        }

        // Per-school stats (sequential per-school batched in parallel)
        const schoolRows: SchoolRow[] = await Promise.all(
          allSchools.map(async (school) => {
            const [learners, educators, classrooms, obs30, lastObs] = await Promise.all([
              supabase
                .from('students')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', school.id),
              supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', school.id)
                .eq('role', 'educator'),
              supabase
                .from('classrooms')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', school.id),
              supabase
                .from('observations')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', school.id)
                .gte('observed_at', since30d),
              supabase
                .from('observations')
                .select('observed_at')
                .eq('school_id', school.id)
                .order('observed_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            ])
            return {
              school,
              learnerCount: learners.count ?? 0,
              educatorCount: educators.count ?? 0,
              classroomCount: classrooms.count ?? 0,
              observationsLast30d: obs30.count ?? 0,
              lastActivityAt: (lastObs.data as { observed_at: string } | null)?.observed_at ?? null,
            }
          }),
        )

        const schoolNameMap = new Map(allSchools.map((s) => [s.id, s.name]))
        type RecentRow = {
          id: string
          observed_at: string
          school_id: string
          dimension: { name: string } | { name: string }[] | null
          observer: { full_name: string } | { full_name: string }[] | null
        }
        const recentActivity: ActivityItem[] = ((recentActivityRes.data ?? []) as RecentRow[]).map((r) => {
          const dim = Array.isArray(r.dimension) ? r.dimension[0] : r.dimension
          const obs = Array.isArray(r.observer) ? r.observer[0] : r.observer
          return {
            id: r.id,
            schoolId: r.school_id,
            schoolName: schoolNameMap.get(r.school_id) ?? 'Unknown',
            observerName: obs?.full_name ?? 'Someone',
            dimensionName: dim?.name ?? 'a dimension',
            observedAt: r.observed_at,
          }
        })

        const staleSchools = schoolRows.filter((row) => {
          if (!row.lastActivityAt) return true
          return Date.now() - new Date(row.lastActivityAt).getTime() > 30 * DAY_MS
        })

        if (cancelled) return
        setState({
          loading: false,
          error: null,
          kpis: {
            totalSchools: allSchools.length,
            totalUsers: usersRes.count ?? 0,
            totalLearners: learnersRes.count ?? 0,
            observationsLast30d: obs30Res.count ?? 0,
            observationsLast7d: obs7Res.count ?? 0,
            activeEducators7d: activeEducators,
            observationsByDay: buckets,
          },
          schoolRows,
          recentActivity,
          staleSchools,
        })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load platform metrics'
        setState((s) => ({ ...s, loading: false, error: message }))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [enabled, allSchools])

  return state
}

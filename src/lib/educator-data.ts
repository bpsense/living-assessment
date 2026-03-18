/**
 * educator-data.ts
 * Data hooks for the admin-facing educator management pages.
 * - useEducatorList: all educators in the school with summary stats
 * - useEducatorProfile: single educator with monthly stats, student breakdown, classroom assignment
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  Profile,
  Classroom,
  Observation,
  Student,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface EducatorSummary {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  classrooms: { id: string; name: string }[]
  observations_this_month: number
  total_observations: number
}

export interface MonthlyObsStat {
  /** e.g. "Mar 2026" */
  month: string
  /** ISO date for sorting */
  date: string
  count: number
}

export interface StudentObsStat {
  student_id: string
  student_name: string
  classroom_name: string
  observation_count: number
  last_observed_at: string | null
}

export interface ObservationWithContext {
  id: string
  observed_at: string
  rating: number
  notes: string | null
  student_name: string
  dimension_name: string
}

export interface EducatorListData {
  educators: EducatorSummary[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export interface EducatorProfileData {
  educator: Profile | null
  classrooms: Classroom[]
  allClassrooms: Classroom[]
  monthlyStats: MonthlyObsStat[]
  studentStats: StudentObsStat[]
  recentObservations: ObservationWithContext[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// ============================================================
// Educator list hook (admin page)
// ============================================================

export function useEducatorList(schoolId: string | undefined): EducatorListData {
  const [educators, setEducators] = useState<EducatorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!schoolId) return

    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      try {
        // 1. All educators in school
        const { data: profilesData, error: profilesErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('school_id', schoolId)
          .eq('role', 'educator')
          .order('full_name')
          .limit(1000)

        if (profilesErr) throw new Error(profilesErr.message)
        if (cancelled) return

        const profiles = (profilesData ?? []) as Profile[]
        if (profiles.length === 0) {
          setEducators([])
          return
        }

        const educatorIds = profiles.map((p) => p.id)

        // 2. Classroom assignments + classroom names
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('educator_id, classroom_id')
          .in('educator_id', educatorIds)

        const ecRows = (ecData ?? []) as { educator_id: string; classroom_id: string }[]
        const classroomIds = [...new Set(ecRows.map((r) => r.classroom_id))]

        let classroomMap = new Map<string, string>()
        if (classroomIds.length > 0) {
          const { data: classrooms } = await supabase
            .from('classrooms')
            .select('id, name')
            .in('id', classroomIds)

          for (const c of (classrooms ?? []) as { id: string; name: string }[]) {
            classroomMap.set(c.id, c.name)
          }
        }

        // Build educator → classrooms map
        const educatorClassrooms = new Map<string, { id: string; name: string }[]>()
        for (const row of ecRows) {
          const arr = educatorClassrooms.get(row.educator_id) ?? []
          const name = classroomMap.get(row.classroom_id)
          if (name) arr.push({ id: row.classroom_id, name })
          educatorClassrooms.set(row.educator_id, arr)
        }

        // 3. Observation counts (12-month lookback)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        const { data: obsData } = await supabase
          .from('observations')
          .select('id, observer_id, observed_at')
          .in('observer_id', educatorIds)
          .gte('observed_at', twelveMonthsAgo.toISOString())

        const observations = (obsData ?? []) as { id: string; observer_id: string; observed_at: string }[]

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

        const totalByEducator = new Map<string, number>()
        const monthByEducator = new Map<string, number>()

        for (const obs of observations) {
          totalByEducator.set(obs.observer_id, (totalByEducator.get(obs.observer_id) ?? 0) + 1)
          if (new Date(obs.observed_at).getTime() >= monthStart) {
            monthByEducator.set(obs.observer_id, (monthByEducator.get(obs.observer_id) ?? 0) + 1)
          }
        }

        // Build summary list
        if (!cancelled) {
          setEducators(
            profiles.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              email: p.email,
              avatar_url: p.avatar_url,
              classrooms: educatorClassrooms.get(p.id) ?? [],
              observations_this_month: monthByEducator.get(p.id) ?? 0,
              total_observations: totalByEducator.get(p.id) ?? 0,
            }))
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load educators')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [schoolId, fetchCount])

  return { educators, loading, error, refetch }
}

// ============================================================
// Educator profile hook (admin detail page)
// ============================================================

export function useEducatorProfile(educatorId: string | undefined): EducatorProfileData {
  const [educator, setEducator] = useState<Profile | null>(null)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [allClassrooms, setAllClassrooms] = useState<Classroom[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyObsStat[]>([])
  const [studentStats, setStudentStats] = useState<StudentObsStat[]>([])
  const [recentObservations, setRecentObservations] = useState<ObservationWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!educatorId) return

    let cancelled = false
    const isInitial = fetchCount === 0
    if (isInitial) setLoading(true)
    setError(null)

    async function fetchAll() {
      try {
        // 1. Educator profile
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', educatorId)
          .single()

        if (profileErr) throw new Error(profileErr.message)
        if (cancelled) return

        const profile = profileData as Profile
        setEducator(profile)

        // 2. Parallel fetches
        const [ecRes, allClassroomsRes, obsRes, dimensionsRes] = await Promise.all([
          // Assigned classrooms
          supabase
            .from('educator_classrooms')
            .select('classroom_id')
            .eq('educator_id', educatorId),
          // All school classrooms
          supabase
            .from('classrooms')
            .select('*')
            .eq('school_id', profile.school_id)
            .order('name'),
          // All observations by this educator
          supabase
            .from('observations')
            .select('*')
            .eq('observer_id', educatorId)
            .order('observed_at', { ascending: false }),
          // Dimensions for observation context
          supabase
            .from('dimensions')
            .select('id, name')
            .eq('school_id', profile.school_id),
        ])

        if (cancelled) return

        const allRooms = (allClassroomsRes.data ?? []) as Classroom[]
        setAllClassrooms(allRooms)

        // Map assigned classrooms
        const assignedIds = new Set(
          (ecRes.data ?? []).map((r) => (r as { classroom_id: string }).classroom_id)
        )
        setClassrooms(allRooms.filter((c) => assignedIds.has(c.id)))

        const observations = (obsRes.data ?? []) as Observation[]
        const dimMap = new Map(
          ((dimensionsRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
        )

        // 3. Monthly stats (last 12 months)
        const now = new Date()
        const monthlyMap = new Map<string, number>()

        // Initialize 12 months
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthlyMap.set(key, 0)
        }

        for (const obs of observations) {
          const d = new Date(obs.observed_at)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (monthlyMap.has(key)) {
            monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
          }
        }

        setMonthlyStats(
          Array.from(monthlyMap.entries()).map(([key, count]) => {
            const [y, m] = key.split('-')
            const d = new Date(Number(y), Number(m) - 1, 1)
            return {
              month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              date: key,
              count,
            }
          })
        )

        // 4. Student stats — need student names + classroom names
        const studentIds = [...new Set(observations.map((o) => o.student_id))]
        let studentMap = new Map<string, { name: string; classroom_id: string }>()

        if (studentIds.length > 0) {
          const [studentsDataRes, scDataRes] = await Promise.all([
            supabase
              .from('students')
              .select('id, first_name, last_name, classroom_id')
              .in('id', studentIds),
            supabase
              .from('student_classrooms')
              .select('student_id, classroom_id')
              .in('student_id', studentIds)
              .eq('is_primary', true),
          ])

          for (const s of ((studentsDataRes.data ?? []) as Pick<Student, 'id' | 'first_name' | 'last_name' | 'classroom_id'>[])) {
            // Use primary classroom from junction table if available, fall back to students.classroom_id
            const primarySc = ((scDataRes.data ?? []) as { student_id: string; classroom_id: string }[])
              .find((sc) => sc.student_id === s.id)
            studentMap.set(s.id, {
              name: `${s.first_name} ${s.last_name}`,
              classroom_id: primarySc?.classroom_id ?? s.classroom_id,
            })
          }
        }

        if (cancelled) return

        const classroomNameMap = new Map(allRooms.map((c) => [c.id, c.name]))

        // Group observations by student
        const byStudent = new Map<string, { count: number; lastAt: string | null }>()
        for (const obs of observations) {
          const existing = byStudent.get(obs.student_id) ?? { count: 0, lastAt: null }
          existing.count++
          if (!existing.lastAt || obs.observed_at > existing.lastAt) {
            existing.lastAt = obs.observed_at
          }
          byStudent.set(obs.student_id, existing)
        }

        setStudentStats(
          Array.from(byStudent.entries())
            .map(([sid, stats]) => {
              const info = studentMap.get(sid)
              return {
                student_id: sid,
                student_name: info?.name ?? 'Unknown',
                classroom_name: info?.classroom_id
                  ? classroomNameMap.get(info.classroom_id) ?? 'Unknown'
                  : 'Unknown',
                observation_count: stats.count,
                last_observed_at: stats.lastAt,
              }
            })
            .sort((a, b) => b.observation_count - a.observation_count)
        )

        // 5. Recent observations (first 20) with context
        setRecentObservations(
          observations.slice(0, 20).map((obs) => ({
            id: obs.id,
            observed_at: obs.observed_at,
            rating: obs.rating,
            notes: obs.notes,
            student_name: studentMap.get(obs.student_id)?.name ?? 'Unknown',
            dimension_name: dimMap.get(obs.dimension_id) ?? 'Unknown',
          }))
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load educator profile')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [educatorId, fetchCount])

  return {
    educator,
    classrooms,
    allClassrooms,
    monthlyStats,
    studentStats,
    recentObservations,
    loading,
    error,
    refetch,
  }
}

// ============================================================
// Classroom assignment helpers (admin-only, protected by RLS)
// ============================================================

export async function assignClassroom(
  educatorId: string,
  classroomId: string,
  schoolId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('educator_classrooms').insert({
    educator_id: educatorId,
    classroom_id: classroomId,
    school_id: schoolId,
  })
  return { error: error?.message ?? null }
}

export async function unassignClassroom(
  educatorId: string,
  classroomId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('educator_classrooms')
    .delete()
    .eq('educator_id', educatorId)
    .eq('classroom_id', classroomId)
  return { error: error?.message ?? null }
}

// ============================================================
// Invite educator (admin-only) — calls server-side Edge Function
// ============================================================

/**
 * Invite a new educator to the platform.
 *
 * Calls the `invite-educator` Edge Function which uses the service-role
 * key to create the user server-side. This avoids the security issue of
 * client-side signUp with a random password and keeps the admin's session
 * untouched.
 */
export async function inviteEducator(
  email: string,
  fullName: string,
  schoolId: string
): Promise<{ error: string | null }> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'invite-educator',
      {
        body: { email, full_name: fullName, school_id: schoolId },
      }
    )

    if (fnError) {
      return { error: fnError.message }
    }

    if (data?.error) {
      return { error: data.error }
    }

    return { error: null }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to invite educator',
    }
  }
}

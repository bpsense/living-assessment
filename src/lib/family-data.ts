/**
 * family-data.ts
 * Data hooks for family (parent) account management.
 * - useFamilyList: all parent accounts in the school with linked students
 * - inviteFamily: create a family account via edge function
 * - linkStudentByCode: parent self-links to a student via family code
 * - regenerateFamilyCode: admin/educator resets a student's code
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { Profile } from '../types/database'

// ============================================================
// Types
// ============================================================

export interface LinkedStudent {
  id: string
  first_name: string
  last_name: string
  classroom_name: string
}

export interface FamilySummary {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  linked_students: LinkedStudent[]
  created_at: string
}

export interface FamilyListData {
  families: FamilySummary[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// ============================================================
// Linked parents for a student (shown in SIS section)
// ============================================================

export interface LinkedParent {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export function useLinkedParents(studentId: string | undefined) {
  const [parents, setParents] = useState<LinkedParent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) { setLoading(false); return }

    let cancelled = false

    async function fetch() {
      setLoading(true)
      const { data: links } = await supabase
        .from('parent_students')
        .select('parent_id')
        .eq('student_id', studentId)

      if (cancelled || !links || links.length === 0) {
        if (!cancelled) { setParents([]); setLoading(false) }
        return
      }

      const parentIds = links.map((l: { parent_id: string }) => l.parent_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', parentIds)

      if (!cancelled) {
        setParents((profiles ?? []) as LinkedParent[])
        setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [studentId])

  return { parents, loading }
}

// ============================================================
// Family list hook (admin page)
// ============================================================

export function useFamilyList(schoolId: string | undefined): FamilyListData {
  const [families, setFamilies] = useState<FamilySummary[]>([])
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
        // 1. All parent profiles in school
        const { data: profilesData, error: profilesErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('school_id', schoolId)
          .eq('role', 'parent')
          .order('full_name')
          .limit(1000)

        if (profilesErr) throw new Error(profilesErr.message)
        if (cancelled) return

        const profiles = (profilesData ?? []) as Profile[]
        if (profiles.length === 0) {
          setFamilies([])
          return
        }

        const parentIds = profiles.map((p) => p.id)

        // 2. Parent-student links
        const { data: linksData } = await supabase
          .from('parent_students')
          .select('parent_id, student_id')
          .in('parent_id', parentIds)

        const links = (linksData ?? []) as { parent_id: string; student_id: string }[]
        const studentIds = [...new Set(links.map((l) => l.student_id))]

        // 3. Student names + classroom IDs (via junction table)
        const studentMap = new Map<string, { first_name: string; last_name: string; classroom_id: string }>()
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

          const primaryClassrooms = new Map(
            ((scDataRes.data ?? []) as { student_id: string; classroom_id: string }[])
              .map((sc) => [sc.student_id, sc.classroom_id])
          )

          for (const s of (studentsDataRes.data ?? []) as { id: string; first_name: string; last_name: string; classroom_id: string }[]) {
            studentMap.set(s.id, {
              first_name: s.first_name,
              last_name: s.last_name,
              classroom_id: primaryClassrooms.get(s.id) ?? s.classroom_id,
            })
          }
        }

        // 4. Classroom names
        const classroomIds = [...new Set(Array.from(studentMap.values()).map((s) => s.classroom_id))]
        const classroomMap = new Map<string, string>()
        if (classroomIds.length > 0) {
          const { data: classrooms } = await supabase
            .from('classrooms')
            .select('id, name')
            .in('id', classroomIds)

          for (const c of (classrooms ?? []) as { id: string; name: string }[]) {
            classroomMap.set(c.id, c.name)
          }
        }

        // 5. Build parent → linked students map
        const parentStudents = new Map<string, LinkedStudent[]>()
        for (const link of links) {
          const student = studentMap.get(link.student_id)
          if (!student) continue
          const arr = parentStudents.get(link.parent_id) ?? []
          arr.push({
            id: link.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            classroom_name: classroomMap.get(student.classroom_id) ?? '',
          })
          parentStudents.set(link.parent_id, arr)
        }

        if (!cancelled) {
          setFamilies(
            profiles.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              email: p.email,
              avatar_url: p.avatar_url,
              linked_students: parentStudents.get(p.id) ?? [],
              created_at: p.created_at,
            }))
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load families')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [schoolId, fetchCount])

  return { families, loading, error, refetch }
}

// ============================================================
// Invite family member (admin-only) — calls Edge Function
// ============================================================

export async function inviteFamily(
  email: string,
  fullName: string,
  schoolId: string
): Promise<{ error: string | null }> {
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'invite-family',
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
      error: err instanceof Error ? err.message : 'Failed to invite family member',
    }
  }
}

// ============================================================
// Link student by family code (parent self-service)
// ============================================================

export async function linkStudentByCode(
  code: string
): Promise<{ error: string | null; studentId: string | null }> {
  const { data, error } = await supabase.rpc('link_student_by_code', {
    p_code: code.trim().toUpperCase(),
  })

  if (error) return { error: error.message, studentId: null }
  if (data?.error) return { error: data.error, studentId: null }
  return { error: null, studentId: data?.student_id ?? null }
}

// ============================================================
// Link student by student number (parent self-service)
// ============================================================

export async function linkStudentByNumber(
  studentNumber: string
): Promise<{ error: string | null; studentId: string | null }> {
  const { data, error } = await supabase.rpc('link_student_by_number', {
    p_number: studentNumber.trim(),
  })

  if (error) return { error: error.message, studentId: null }
  if (data?.error) return { error: data.error, studentId: null }
  return { error: null, studentId: data?.student_id ?? null }
}

// ============================================================
// Regenerate a student's family code (admin/educator)
// ============================================================

export async function regenerateFamilyCode(
  studentId: string
): Promise<{ error: string | null; newCode: string | null }> {
  const { data, error } = await supabase.rpc('regenerate_family_code', {
    p_student_id: studentId,
  })

  if (error) return { error: error.message, newCode: null }
  return { error: null, newCode: data }
}

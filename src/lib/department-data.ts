/**
 * department-data.ts
 * Data hook for the department admin dashboard.
 * Fetches classrooms, students, observations, and families
 * for the departments the user administers.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { Classroom, Student } from '../types/database'

// ============================================================
// Types
// ============================================================

export interface DepartmentSummary {
  id: string
  name: string
  classrooms: ClassroomSummary[]
  student_count: number
  observation_count: number
  family_count: number
}

export interface ClassroomSummary {
  id: string
  name: string
  grade_level: string | null
  student_count: number
  observation_count: number
}

export interface DepartmentDashboardData {
  departments: DepartmentSummary[]
  recentObservations: {
    id: string
    observed_at: string
    student_name: string
    classroom_name: string
    dimension_name: string
    rating: number
  }[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// ============================================================
// Hook
// ============================================================

export function useDepartmentDashboard(
  departmentIds: string[],
  schoolId: string | undefined
): DepartmentDashboardData {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([])
  const [recentObservations, setRecentObservations] = useState<DepartmentDashboardData['recentObservations']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (departmentIds.length === 0 || !schoolId) {
      setDepartments([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      try {
        // 1. Fetch department names
        const { data: deptData, error: deptErr } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', departmentIds)
          .order('name')

        if (deptErr) throw new Error(deptErr.message)
        if (cancelled) return

        const depts = (deptData ?? []) as { id: string; name: string }[]

        // 2. Fetch classrooms in these departments
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .eq('school_id', schoolId)
          .in('department_id', departmentIds)
          .order('name')

        const classrooms = (classroomData ?? []) as Classroom[]
        const classroomIds = classrooms.map((c) => c.id)

        if (classroomIds.length === 0) {
          if (!cancelled) {
            setDepartments(depts.map((d) => ({
              id: d.id,
              name: d.name,
              classrooms: [],
              student_count: 0,
              observation_count: 0,
              family_count: 0,
            })))
            setRecentObservations([])
          }
          return
        }

        // 3. Fetch students, observations, parent links, and dimensions in parallel
        const [studentsRes, obsRes, parentLinksRes, dimensionsRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, first_name, last_name, classroom_id')
            .in('classroom_id', classroomIds),
          supabase
            .from('observations')
            .select('id, student_id, observed_at, dimension_id, rating')
            .eq('school_id', schoolId)
            .order('observed_at', { ascending: false })
            .limit(500),
          supabase
            .from('parent_students')
            .select('parent_id, student_id'),
          supabase
            .from('dimensions')
            .select('id, name')
            .eq('school_id', schoolId),
        ])

        if (cancelled) return

        const students = (studentsRes.data ?? []) as Pick<Student, 'id' | 'first_name' | 'last_name' | 'classroom_id'>[]
        const studentIds = new Set(students.map((s) => s.id))
        const studentMap = new Map(students.map((s) => [s.id, s]))
        const classroomMap = new Map(classrooms.map((c) => [c.id, c]))
        const dimMap = new Map(
          ((dimensionsRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
        )

        // Filter observations to only those for our students
        const allObs = ((obsRes.data ?? []) as {
          id: string
          student_id: string
          observed_at: string
          dimension_id: string
          rating: number
        }[]).filter((o) => studentIds.has(o.student_id))

        // Count observations per student
        const obsPerStudent = new Map<string, number>()
        for (const obs of allObs) {
          obsPerStudent.set(obs.student_id, (obsPerStudent.get(obs.student_id) ?? 0) + 1)
        }

        // Count parents per student (for our students only)
        const parentLinks = ((parentLinksRes.data ?? []) as { parent_id: string; student_id: string }[])
          .filter((pl) => studentIds.has(pl.student_id))
        const familyIdsByDept = new Map<string, Set<string>>()

        // Build department summaries
        const deptSummaries: DepartmentSummary[] = depts.map((dept) => {
          const deptClassrooms = classrooms.filter((c) => c.department_id === dept.id)
          const deptClassroomIds = new Set(deptClassrooms.map((c) => c.id))
          const deptStudents = students.filter((s) => deptClassroomIds.has(s.classroom_id))
          const deptStudentIds = new Set(deptStudents.map((s) => s.id))

          // Count observations
          let obsCount = 0
          for (const sid of deptStudentIds) {
            obsCount += obsPerStudent.get(sid) ?? 0
          }

          // Count unique families
          const familyIds = new Set<string>()
          for (const pl of parentLinks) {
            if (deptStudentIds.has(pl.student_id)) {
              familyIds.add(pl.parent_id)
            }
          }
          familyIdsByDept.set(dept.id, familyIds)

          const classroomSummaries: ClassroomSummary[] = deptClassrooms.map((room) => {
            const roomStudents = deptStudents.filter((s) => s.classroom_id === room.id)
            let roomObs = 0
            for (const s of roomStudents) {
              roomObs += obsPerStudent.get(s.id) ?? 0
            }
            return {
              id: room.id,
              name: room.name,
              grade_level: room.grade_level,
              student_count: roomStudents.length,
              observation_count: roomObs,
            }
          })

          return {
            id: dept.id,
            name: dept.name,
            classrooms: classroomSummaries,
            student_count: deptStudents.length,
            observation_count: obsCount,
            family_count: familyIds.size,
          }
        })

        // Build recent observations list (top 20)
        const recent = allObs.slice(0, 20).map((obs) => {
          const student = studentMap.get(obs.student_id)
          const classroom = student ? classroomMap.get(student.classroom_id) : null
          return {
            id: obs.id,
            observed_at: obs.observed_at,
            student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
            classroom_name: classroom?.name ?? 'Unknown',
            dimension_name: dimMap.get(obs.dimension_id) ?? 'Unknown',
            rating: obs.rating,
          }
        })

        if (!cancelled) {
          setDepartments(deptSummaries)
          setRecentObservations(recent)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load department data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [departmentIds.join(','), schoolId, fetchCount])

  return { departments, recentObservations, loading, error, refetch }
}

import { useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { Dimension, Student } from '../types/database'
import type { DimensionScore } from './student-data'

// ============================================================
// Types
// ============================================================

export interface ClassroomAnalysis {
  summary: string
  trends: { title: string; detail: string; dimension_name?: string | null }[]
  clusters: {
    dimension_name: string
    students: string[]
    rationale: string
    suggested_focus: string
  }[]
  outliers: { student_name: string; concern: string; recommended_action: string }[]
}

interface AnalysisState {
  analysis: ClassroomAnalysis | null
  loading: boolean
  error: string | null
  cached: boolean
  generatedAt: string | null
}

const INITIAL_STATE: AnalysisState = {
  analysis: null,
  loading: false,
  error: null,
  cached: false,
  generatedAt: null,
}

// ============================================================
// Helpers
// ============================================================

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

// ============================================================
// Hook
// ============================================================

export function useClassroomAnalysis(
  classroomId: string | undefined,
  schoolId: string | undefined,
  classroomName: string,
  gradeLevel: string | null,
  dimensions: Dimension[],
  students: Student[],
  studentScoresMap: Map<string, DimensionScore[]>
) {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE)

  const generate = useCallback(async () => {
    if (!classroomId || !schoolId) return
    if (students.length === 0) {
      setState((p) => ({ ...p, error: 'No active learners to analyze yet.' }))
      return
    }

    setState((p) => ({ ...p, loading: true, error: null }))

    try {
      const payloadStudents = students.map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        grade_level: s.grade_level,
        age: ageFromDob(s.date_of_birth),
        scores: (studentScoresMap.get(s.id) ?? []).map((sc) => ({
          dimension_id: sc.dimension_id,
          dimension_name: sc.dimension_name,
          competency: sc.competency,
          interest: sc.interest,
        })),
      }))

      const { data, error } = await supabase.functions.invoke('classroom-analysis', {
        body: {
          classroom_id: classroomId,
          school_id: schoolId,
          classroom_name: classroomName,
          grade_level: gradeLevel,
          dimensions: dimensions.map((d) => ({ id: d.id, name: d.name })),
          students: payloadStudents,
        },
      })

      if (error) throw error

      setState({
        analysis: data.analysis ?? null,
        loading: false,
        error: null,
        cached: data.cached ?? false,
        generatedAt: data.generated_at ?? null,
      })
    } catch (err) {
      setState((p) => ({
        ...p,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to generate analysis',
      }))
    }
  }, [classroomId, schoolId, classroomName, gradeLevel, dimensions, students, studentScoresMap])

  return { ...state, generate }
}

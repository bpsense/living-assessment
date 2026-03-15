/**
 * StudentSkillsSection.tsx
 * Shows a student's skill assignment history on their profile page.
 * Groups by domain, shows active and completed assignments, and
 * highlights above-grade work.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '../Toast'
import { fetchStudentSkillAssignments } from '../../lib/skill-assignment-data'
import { gradeToOrdinal } from '../../lib/skills-data'
import type { StudentSkillAssignmentWithStudent } from '../../types/database'
import {
  Loader2,
  Target,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { clsx } from 'clsx'

interface StudentSkillsSectionProps {
  studentId: string
  studentGrade: string | null
}

// Rating label/colors matching the grading UI
const SCORE_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'Emerging', color: 'bg-amber-100 text-amber-700' },
  2: { label: 'Developing', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Achieving', color: 'bg-emerald-100 text-emerald-700' },
  4: { label: 'Mastery', color: 'bg-purple-100 text-purple-700' },
}

export default function StudentSkillsSection({
  studentId,
  studentGrade,
}: StudentSkillsSectionProps) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<StudentSkillAssignmentWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchStudentSkillAssignments(studentId)
      setAssignments(data)
    } catch {
      toast('Failed to load skill history', 'error')
    } finally {
      setLoading(false)
    }
  }, [studentId, toast])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  // Split into active and completed
  const active = useMemo(
    () => assignments.filter((a) => a.status !== 'graded'),
    [assignments]
  )
  const completed = useMemo(
    () => assignments.filter((a) => a.status === 'graded'),
    [assignments]
  )


  if (loading) {
    return (
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-text">Skills</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
        </div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-text">Skills</h2>
        </div>
        <p className="text-sm text-text-muted">No skill assignments yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-emerald-500" />
        <h2 className="text-lg font-bold text-text">Skills</h2>
        <span className="text-xs text-text-muted">
          {active.length} active, {completed.length} completed
        </span>
      </div>

      {/* Active assignments */}
      {active.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
            Active
          </h3>
          <div className="space-y-2">
            {active.map((a) => (
              <SkillAssignmentRow
                key={a.id}
                assignment={a}
                studentGrade={studentGrade}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed assignments */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide hover:text-text transition-colors"
          >
            {showCompleted ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-2">
              {completed.map((a) => (
                <SkillAssignmentRow
                  key={a.id}
                  assignment={a}
                  studentGrade={studentGrade}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-component: single assignment row
// ============================================================

function SkillAssignmentRow({
  assignment,
  studentGrade,
}: {
  assignment: StudentSkillAssignmentWithStudent
  studentGrade: string | null
}) {
  const step = assignment.step
  const stepGrade = step?.grade_level ?? ''
  const isAbove = studentGrade && stepGrade
    ? gradeToOrdinal(stepGrade) > gradeToOrdinal(studentGrade)
    : false
  const isBelow = studentGrade && stepGrade
    ? gradeToOrdinal(stepGrade) < gradeToOrdinal(studentGrade)
    : false

  const scoreInt = assignment.score ? Math.round(assignment.score) : null
  const scoreConfig = scoreInt ? SCORE_CONFIG[scoreInt] ?? null : null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-bg-muted px-3 py-2.5">
      {/* Status icon */}
      {assignment.status === 'graded' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-primary-400" />
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">
            {step?.expectation_description
              ? step.expectation_description.slice(0, 80) + (step.expectation_description.length > 80 ? '...' : '')
              : 'Skill assignment'}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
          <span>Grade {stepGrade}</span>
          {isAbove && (
            <span className="flex items-center gap-0.5 text-purple-600">
              <ArrowUpRight className="h-2.5 w-2.5" />
              above
            </span>
          )}
          {isBelow && (
            <span className="flex items-center gap-0.5 text-amber-600">
              <ArrowDownLeft className="h-2.5 w-2.5" />
              below
            </span>
          )}
          {assignment.notes && (
            <span className="truncate">{assignment.notes}</span>
          )}
        </div>
      </div>

      {/* Score badge */}
      {scoreConfig && (
        <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', scoreConfig.color)}>
          {scoreInt} - {scoreConfig.label}
        </span>
      )}
    </div>
  )
}

/**
 * SkillGrading.tsx
 * Grading interface for discrete skill assignments.
 * Shows each student with their step level, score input (1-4 scale),
 * and notes field. Handles batch save with above-grade indicators.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  fetchSkillAssignment,
  gradeSkillAssignment,
} from '../../lib/skill-assignment-data'
import { gradeToOrdinal } from '../../lib/skills-data'
import type {
  SkillAssignmentWithDetails,
} from '../../types/database'
import {
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

// ============================================================
// Rating scale
// ============================================================

const RATING_OPTIONS = [
  { value: 1, label: 'Emerging', shortLabel: '1', color: 'bg-amber-100 text-amber-700 ring-amber-300' },
  { value: 2, label: 'Developing', shortLabel: '2', color: 'bg-blue-100 text-blue-700 ring-blue-300' },
  { value: 3, label: 'Achieving', shortLabel: '3', color: 'bg-emerald-100 text-emerald-700 ring-emerald-300' },
  { value: 4, label: 'Mastery', shortLabel: '4', color: 'bg-purple-100 text-purple-700 ring-purple-300' },
]

interface GradeRow {
  studentAssignmentId: string
  studentName: string
  studentGrade: string
  stepGrade: string
  isAboveGrade: boolean
  isBelowGrade: boolean
  existingScore: number | null
  existingNotes: string | null
  status: string
  score: number | null
  notes: string
  saved: boolean
  saving: boolean
  error: string | null
}

// ============================================================
// Main component
// ============================================================

export default function SkillGrading() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { toast } = useToast()

  const [assignment, setAssignment] = useState<SkillAssignmentWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<GradeRow[]>([])
  const [batchSaving, setBatchSaving] = useState(false)

  // Load assignment
  const loadAssignment = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await fetchSkillAssignment(id)
      setAssignment(data)

      // Build grading rows
      setRows(
        data.student_assignments.map((sa) => {
          const studentGrade = sa.student?.grade_level ?? ''
          const stepGrade = sa.step?.grade_level ?? ''
          const above = stepGrade && studentGrade
            ? gradeToOrdinal(stepGrade) > gradeToOrdinal(studentGrade)
            : false
          const below = stepGrade && studentGrade
            ? gradeToOrdinal(stepGrade) < gradeToOrdinal(studentGrade)
            : false

          return {
            studentAssignmentId: sa.id,
            studentName: `${sa.student?.first_name ?? ''} ${sa.student?.last_name ?? ''}`.trim(),
            studentGrade,
            stepGrade,
            isAboveGrade: above,
            isBelowGrade: below,
            existingScore: sa.score,
            existingNotes: sa.notes,
            status: sa.status,
            score: sa.score,
            notes: sa.notes ?? '',
            saved: sa.status === 'graded',
            saving: false,
            error: null,
          }
        })
      )
    } catch {
      toast('Failed to load assignment', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    loadAssignment()
  }, [loadAssignment])

  // Update a row's score
  function setRowScore(idx: number, score: number | null) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, score, saved: false } : r))
    )
  }

  // Update a row's notes
  function setRowNotes(idx: number, notes: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, notes, saved: false } : r))
    )
  }

  // Save all grades
  async function handleBatchSave() {
    if (!profile) return

    const toSave = rows.filter((r) => r.score !== null && !r.saved)
    if (toSave.length === 0) {
      toast('No unsaved grades', 'error')
      return
    }

    setBatchSaving(true)
    let successCount = 0
    let errorCount = 0

    for (const row of toSave) {
      const idx = rows.indexOf(row)
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, saving: true, error: null } : r))
      )

      const result = await gradeSkillAssignment(
        row.studentAssignmentId,
        row.score!,
        row.notes || null,
        profile.id
      )

      if (result.success) {
        successCount++
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, saving: false, saved: true, status: 'graded' } : r))
        )
      } else {
        errorCount++
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, saving: false, error: result.error ?? 'Failed' } : r))
        )
      }
    }

    setBatchSaving(false)

    if (errorCount === 0) {
      toast(`${successCount} grade${successCount !== 1 ? 's' : ''} saved`, 'success')
    } else {
      toast(`${successCount} saved, ${errorCount} failed`, 'error')
    }
  }

  // Stats
  const gradedCount = rows.filter((r) => r.saved || r.status === 'graded').length
  const totalCount = rows.length
  const unsavedCount = rows.filter((r) => r.score !== null && !r.saved).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-alert-400" />
        <p className="mt-4 text-text-muted">Assignment not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-medium text-primary-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Assignment info card */}
      <div className="mb-6 rounded-xl border border-bg-muted bg-bg-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-text">
              {assignment.title ?? assignment.skill?.name ?? 'Skill Assignment'}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {assignment.skill?.name}
              {assignment.assigned_step && ` \u2022 Grade ${assignment.assigned_step.grade_level}`}
            </p>
            {assignment.assigned_step?.expectation_description && (
              <p className="mt-2 text-xs text-text-muted italic">
                &ldquo;{assignment.assigned_step.expectation_description}&rdquo;
              </p>
            )}
          </div>
          <div className="text-right text-xs text-text-muted">
            {assignment.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}
              </div>
            )}
            <div className="mt-1">
              {gradedCount}/{totalCount} graded
            </div>
          </div>
        </div>

        {/* Reference: what each score means */}
        <div className="mt-4 flex gap-2">
          {RATING_OPTIONS.map((r) => (
            <span
              key={r.value}
              className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-medium', r.color)}
            >
              {r.value} = {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Grading table */}
      <div className="overflow-hidden rounded-xl border border-bg-muted bg-bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-muted bg-bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">Level</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">Notes</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted w-16">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-muted">
            {rows.map((row, idx) => (
              <tr key={row.studentAssignmentId} className="transition-colors hover:bg-bg-muted/20">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-text">{row.studentName}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-text">Grade {row.stepGrade}</span>
                    {row.isAboveGrade && (
                      <span className="flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        <ArrowUpRight className="h-2.5 w-2.5" />
                        above
                      </span>
                    )}
                    {row.isBelowGrade && (
                      <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <ArrowDownLeft className="h-2.5 w-2.5" />
                        below
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {RATING_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRowScore(idx, row.score === r.value ? null : r.value)}
                        className={clsx(
                          'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all',
                          row.score === r.value
                            ? `${r.color} ring-2`
                            : 'bg-bg-muted text-text-light hover:bg-bg-muted/80'
                        )}
                      >
                        {r.value}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => setRowNotes(idx, e.target.value)}
                    placeholder="Feedback..."
                    className="w-full rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {row.saving ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary-400" />
                  ) : row.error ? (
                    <span title={row.error}>
                      <AlertCircle className="mx-auto h-4 w-4 text-alert-500" />
                    </span>
                  ) : row.saved ? (
                    <CheckCircle2 className="mx-auto h-4 w-4 text-success-500" />
                  ) : row.score !== null ? (
                    <span className="text-[10px] font-medium text-primary-500">unsaved</span>
                  ) : (
                    <span className="text-[10px] text-text-light">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Above-grade info */}
      {rows.some((r) => r.isAboveGrade) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-purple-50 px-4 py-3">
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
          <p className="text-xs text-purple-700">
            Students marked &ldquo;above&rdquo; are working above their grade level.
            Scores of 1 or 2 will be excluded from dimension averages (they won&apos;t be
            penalized for attempting harder work). Scores of 3 or 4 will count.
          </p>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-text-muted">
          {unsavedCount > 0
            ? `${unsavedCount} unsaved grade${unsavedCount !== 1 ? 's' : ''}`
            : 'All grades saved'}
        </span>
        <button
          onClick={handleBatchSave}
          disabled={batchSaving || unsavedCount === 0}
          className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50"
        >
          {batchSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Grades
            </>
          )}
        </button>
      </div>
    </div>
  )
}

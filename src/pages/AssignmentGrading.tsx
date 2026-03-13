import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { fetchAssignment, type AssignmentWithDetails } from '../lib/assignment-data'
import {
  saveGrading,
  fetchExistingScores,
  getStepDescriptor,
  type GradingPayload,
} from '../lib/grading-data'
import type { Competency, Student, CompetencyScoreRow } from '../types/database'
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  User,
  BookOpen,
  Tag,
} from 'lucide-react'

// ============================================================
// Rating segment config (matches DimensionCard)
// ============================================================

const SEGMENTS = [
  { label: 'Emerging', base: 1 },
  { label: 'Developing', base: 2 },
  { label: 'Achieving', base: 3 },
  { label: 'Mastery', base: 4 },
]

function thirdToRating(base: number, third: number): number {
  if (third === 0) return base - 0.67
  if (third === 1) return base - 0.33
  return base
}

function snapToThird(fraction: number): number {
  if (fraction <= 0) return 0
  if (fraction >= 1) return 1
  if (fraction < 0.22) return 0
  if (fraction < 0.55) return 1 / 3
  if (fraction < 0.88) return 2 / 3
  return 1
}

// ============================================================
// Rating bar component
// ============================================================

function RatingBar({
  score,
  onRate,
}: {
  score: number | null
  onRate: (value: number) => void
}) {
  const level = score ?? 0

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {SEGMENTS.map((seg, i) => {
          const segIndex = i + 1
          let rawFraction: number
          if (level >= segIndex) rawFraction = 1
          else if (level > segIndex - 1) rawFraction = level - (segIndex - 1)
          else rawFraction = 0
          const fillFraction = snapToThird(rawFraction)

          return (
            <button
              key={seg.label}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const pct = x / rect.width
                const third = pct < 0.333 ? 0 : pct < 0.666 ? 1 : 2
                onRate(thirdToRating(seg.base, third))
              }}
              title={`${seg.label} (click position selects \u2153)`}
              className="relative h-4 flex-1 overflow-hidden rounded-full bg-bg-muted cursor-pointer hover:scale-y-125 transition-all duration-150"
            >
              {fillFraction > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${fillFraction * 100}%` }}
                />
              )}
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1 border-r border-white/30" />
                <div className="flex-1 border-r border-white/30" />
                <div className="flex-1" />
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex justify-between">
        {SEGMENTS.map((seg) => (
          <span key={seg.label} className="text-[9px] text-text-light">{seg.label}</span>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Student grading card
// ============================================================

function StudentGradingCard({
  student,
  competencies,
  studentAssignmentId,
  studentAssignmentStatus,
  existingScores,
  onGraded,
  profile,
}: {
  student: Student
  competencies: Competency[]
  studentAssignmentId: string
  studentAssignmentStatus: string
  existingScores: CompetencyScoreRow[]
  onGraded: () => void
  profile: { id: string; school_id: string }
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [scores, setScores] = useState<Map<string, number>>(new Map())
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const isGraded = studentAssignmentStatus === 'graded'

  // Init from existing scores
  useEffect(() => {
    const map = new Map<string, number>()
    for (const s of existingScores) {
      map.set(s.competency_id, s.score)
    }
    setScores(map)
  }, [existingScores])

  async function handleSave() {
    if (scores.size === 0) {
      toast('Please rate at least one competency', 'error')
      return
    }

    setSaving(true)
    try {
      const payload: GradingPayload = {
        studentAssignmentId,
        studentId: student.id,
        schoolId: profile.school_id,
        scores: Array.from(scores.entries()).map(([competencyId, score]) => ({
          competencyId,
          score,
        })),
        qualitativeFeedback: feedback,
        gradedBy: profile.id,
      }

      await saveGrading(payload)
      toast(`Graded ${student.first_name}`, 'success')
      onGraded()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <User className="h-4 w-4 text-primary-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            {student.first_name} {student.last_name}
          </p>
          <p className="text-xs text-text-light">
            {student.grade_level ? `Grade ${student.grade_level}` : 'No grade set'}
            {isGraded && ' — Graded'}
          </p>
        </div>
        {isGraded && <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />}
        {expanded
          ? <ChevronDown className="h-4 w-4 text-text-light shrink-0" />
          : <ChevronRight className="h-4 w-4 text-text-light shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-bg-muted px-4 py-4 space-y-4">
          {/* Competency ratings */}
          {competencies.map((comp) => {
            const descriptor = getStepDescriptor(comp, student.grade_level)
            const currentScore = scores.get(comp.id) ?? null

            return (
              <div key={comp.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-primary-700">{comp.code}</span>
                  <span className="text-xs font-medium text-text">{comp.name}</span>
                </div>
                {descriptor && (
                  <p className="text-[11px] leading-relaxed text-text-muted bg-bg rounded px-2 py-1.5">
                    <span className="font-medium">
                      Step {student.grade_level || '1'} descriptor:
                    </span>{' '}
                    {descriptor}
                  </p>
                )}
                <RatingBar
                  score={currentScore}
                  onRate={(v) => {
                    setScores((prev) => {
                      const next = new Map(prev)
                      next.set(comp.id, v)
                      return next
                    })
                  }}
                />
                {currentScore !== null && (
                  <p className="text-[10px] text-text-light text-right">
                    {currentScore.toFixed(2)}
                  </p>
                )}
              </div>
            )
          })}

          {/* Qualitative feedback */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Qualitative Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Describe the student's work, strengths, areas for growth..."
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || scores.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isGraded ? 'Update Grades' : 'Save Grades'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

export default function AssignmentGrading() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { toast } = useToast()

  const [assignment, setAssignment] = useState<AssignmentWithDetails | null>(null)
  const [allScores, setAllScores] = useState<Map<string, CompetencyScoreRow[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const a = await fetchAssignment(id)
      setAssignment(a)

      // Load existing scores for all student assignments
      const scoreMap = new Map<string, CompetencyScoreRow[]>()
      for (const sa of a.student_assignments) {
        const scores = await fetchExistingScores(sa.id)
        scoreMap.set(sa.id, scores)
      }
      setAllScores(scoreMap)
    } catch {
      toast('Failed to load assignment', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  if (!assignment || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-text-muted">Assignment not found.</p>
      </div>
    )
  }

  const competencies = assignment.competencies.map((ac) => ac.competency)
  const gradedCount = assignment.student_assignments.filter((sa) => sa.status === 'graded').length
  const totalStudents = assignment.student_assignments.length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/assignments"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Assignments
        </Link>

        <h1 className="text-xl font-bold text-text">{assignment.title}</h1>

        {assignment.description && (
          <p className="mt-1 text-sm text-text-muted">{assignment.description}</p>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {competencies.length} competenc{competencies.length !== 1 ? 'ies' : 'y'}
          </span>
          <span>
            {gradedCount}/{totalStudents} graded
          </span>
        </div>

        {assignment.skills && assignment.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {assignment.skills.map((as) => (
              <span
                key={as.skill_id}
                className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
              >
                <Tag className="h-2.5 w-2.5" />
                {as.skill.name}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-success-500 transition-all duration-500"
            style={{
              width: `${totalStudents > 0 ? (gradedCount / totalStudents) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Student cards */}
      <div className="space-y-3">
        {assignment.student_assignments.map((sa) => (
          <StudentGradingCard
            key={sa.id}
            student={sa.student}
            competencies={competencies}
            studentAssignmentId={sa.id}
            studentAssignmentStatus={sa.status}
            existingScores={allScores.get(sa.id) || []}
            onGraded={loadData}
            profile={{ id: profile.id, school_id: profile.school_id }}
          />
        ))}
      </div>
    </div>
  )
}

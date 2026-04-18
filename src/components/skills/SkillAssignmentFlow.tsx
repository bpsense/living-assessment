/**
 * SkillAssignmentFlow.tsx
 * Multi-step assignment creation flow triggered from the Skill Browser.
 * Steps: 1) Skill & Level, 2) Student Selection, 3) Details, 4) Confirm
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { useActiveSchoolId } from '../../lib/school-context'
import { useToast } from '../Toast'
import { supabase } from '../../lib/supabase'
import { createSkillAssignment } from '../../lib/skill-assignment-data'
import { getProgressionLadder, isAboveGrade, getGradeZone } from '../../lib/skill-progression-data'
import type {
  Skill,
  SkillProgressionStep,
  SkillAssignmentInsert,
  GradeZone,
} from '../../types/database'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  User,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react'
import { clsx } from 'clsx'

// ============================================================
// Types
// ============================================================

interface SkillAssignmentFlowProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** Pre-selected skill and step from browser */
  initialSkill?: Skill | null
  initialStep?: SkillProgressionStep | null
  /** Optional classroom ID to pre-select */
  classroomId?: string
}

interface StudentRow {
  id: string
  first_name: string
  last_name: string
  grade_level: string | null
  selected: boolean
  /** The step this student will work on (may differ from default) */
  overrideStepId: string | null
}

interface ClassroomOption {
  id: string
  name: string
  grade_level: string | null
}

type Step = 1 | 2 | 3 | 4

const ZONE_COLORS: Record<GradeZone, string> = {
  remediation: 'text-amber-600',
  current: 'text-emerald-600',
  extension: 'text-purple-600',
}

// ============================================================
// Main component
// ============================================================

export default function SkillAssignmentFlow({
  open,
  onClose,
  onCreated,
  initialSkill,
  initialStep,
  classroomId,
}: SkillAssignmentFlowProps) {
  const { profile } = useAuth()
  const schoolId = useActiveSchoolId()
  const { toast } = useToast()

  // Step navigation
  const [step, setStep] = useState<Step>(1)

  // Step 1: Skill & Level
  const [selectedSkill] = useState<Skill | null>(initialSkill ?? null)
  const [selectedStepId, setSelectedStepId] = useState(initialStep?.id ?? '')
  const [ladder, setLadder] = useState<SkillProgressionStep[]>([])
  const [ladderLoading, setLadderLoading] = useState(false)

  // Step 2: Students
  const [assignmentType, setAssignmentType] = useState<'class' | 'individual'>('class')
  const [selectedClassroomId, setSelectedClassroomId] = useState(classroomId ?? '')
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  // Step 3: Details
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Step 4: Submit
  const [submitting, setSubmitting] = useState(false)

  // Current step object
  const selectedStepObj = useMemo(
    () => ladder.find((s) => s.id === selectedStepId) ?? initialStep ?? null,
    [ladder, selectedStepId, initialStep]
  )

  // Load progression ladder
  useEffect(() => {
    if (!open || !selectedSkill || !schoolId) return

    async function loadLadder() {
      setLadderLoading(true)
      try {
        const steps = await getProgressionLadder(selectedSkill!.id, schoolId!)
        setLadder(steps)
        // Ensure selected step is in ladder
        if (initialStep && steps.some((s) => s.id === initialStep.id)) {
          setSelectedStepId(initialStep.id)
        } else if (steps.length > 0) {
          setSelectedStepId(steps[0].id)
        }
      } catch {
        toast('Failed to load skill progression', 'error')
      } finally {
        setLadderLoading(false)
      }
    }

    loadLadder()
  }, [open, selectedSkill, schoolId, initialStep, toast])

  // Load classrooms
  useEffect(() => {
    if (!open || !profile) return

    async function loadClassrooms() {
      // For educators, fetch their assigned classrooms
      const { data: ecData } = await supabase
        .from('educator_classrooms')
        .select('classroom_id')
        .eq('educator_id', profile!.id)

      const classroomIds = (ecData ?? []).map((r: { classroom_id: string }) => r.classroom_id)
      if (classroomIds.length === 0) {
        setClassrooms([])
        return
      }

      const { data } = await supabase
        .from('classrooms')
        .select('id, name, grade_level')
        .in('id', classroomIds)
        .order('name')

      setClassrooms((data ?? []) as ClassroomOption[])
    }

    loadClassrooms()
  }, [open, profile])

  // Load students when classroom changes
  const loadStudents = useCallback(async () => {
    if (!selectedClassroomId) {
      setStudents([])
      return
    }
    setStudentsLoading(true)
    try {
      const { data: scData } = await supabase
        .from('student_classrooms')
        .select('student_id')
        .eq('classroom_id', selectedClassroomId)
        .eq('status', 'active')

      const studentIds = (scData ?? []).map((r: { student_id: string }) => r.student_id)
      if (studentIds.length === 0) {
        setStudents([])
        return
      }

      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level')
        .in('id', studentIds)
        .order('last_name')

      setStudents(
        (data ?? []).map((s: { id: string; first_name: string; last_name: string; grade_level: string | null }) => ({
          ...s,
          selected: assignmentType === 'class',
          overrideStepId: null,
        }))
      )
    } catch {
      toast('Failed to load students', 'error')
    } finally {
      setStudentsLoading(false)
    }
  }, [selectedClassroomId, assignmentType, toast])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // Toggle student selection
  function toggleStudent(studentId: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, selected: !s.selected } : s))
    )
  }

  // Select/deselect all
  function toggleAll(selected: boolean) {
    setStudents((prev) => prev.map((s) => ({ ...s, selected })))
  }

  // Override a student's step
  function setStudentStep(studentId: string, stepId: string | null) {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, overrideStepId: stepId } : s))
    )
  }

  // Selected students
  const selectedStudents = students.filter((s) => s.selected)

  // Submit
  async function handleSubmit() {
    if (!profile || !schoolId || !selectedSkill || !selectedStepId) return

    setSubmitting(true)
    try {
      const data: SkillAssignmentInsert = {
        school_id: schoolId,
        classroom_id: selectedClassroomId || null,
        skill_id: selectedSkill.id,
        assigned_step_id: selectedStepId,
        assigned_by: profile.id,
        assignment_type: assignmentType,
        title: title || null,
        instructions: instructions || null,
        due_date: dueDate || null,
        status: 'active',
      }

      await createSkillAssignment(data, selectedStudents.map((s) => s.id))

      toast('Skill assignment created', 'success')
      onCreated?.()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create assignment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1)
      setTitle('')
      setInstructions('')
      setDueDate('')
      setStudents([])
    }
  }, [open])

  if (!open) return null

  // Determine if current step can proceed
  const canProceed: Record<Step, boolean> = {
    1: !!selectedStepId && !!selectedSkill,
    2: selectedStudents.length > 0,
    3: true,
    4: !submitting,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass-modal relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-text">Assign Skill</h2>
            <p className="text-xs text-text-muted">Step {step} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-3">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-primary-500' : 'bg-bg-muted'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Skill & Level Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text">Selected Skill</h3>
                <p className="mt-1 text-sm text-text-muted">{selectedSkill?.name ?? 'No skill selected'}</p>
              </div>

              {ladderLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
                </div>
              ) : (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-text">Select Grade Level</h3>
                  <div className="space-y-1">
                    {ladder.map((ladderStep) => (
                      <label
                        key={ladderStep.id}
                        className={clsx(
                          'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                          selectedStepId === ladderStep.id
                            ? 'bg-primary-50 ring-1 ring-primary-300'
                            : 'hover:bg-bg-muted'
                        )}
                      >
                        <input
                          type="radio"
                          name="step"
                          value={ladderStep.id}
                          checked={selectedStepId === ladderStep.id}
                          onChange={() => setSelectedStepId(ladderStep.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-text">
                            Grade {ladderStep.grade_level}
                          </span>
                          <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                            {ladderStep.expectation_description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Student Selection */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Assignment type toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAssignmentType('class')}
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    assignmentType === 'class'
                      ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-bg-muted text-text-muted hover:text-text'
                  )}
                >
                  <Users className="h-4 w-4" />
                  Class-wide
                </button>
                <button
                  onClick={() => setAssignmentType('individual')}
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    assignmentType === 'individual'
                      ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-bg-muted text-text-muted hover:text-text'
                  )}
                >
                  <User className="h-4 w-4" />
                  Individual
                </button>
              </div>

              {/* Classroom picker */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Classroom</label>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="">Select classroom...</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.grade_level ? `(Grade ${c.grade_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student list */}
              {studentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
                </div>
              ) : students.length === 0 && selectedClassroomId ? (
                <p className="py-4 text-center text-sm text-text-muted">No students in this classroom.</p>
              ) : students.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-text">
                      Students ({selectedStudents.length}/{students.length})
                    </span>
                    <button
                      onClick={() => toggleAll(selectedStudents.length < students.length)}
                      className="text-xs font-medium text-primary-600 hover:underline"
                    >
                      {selectedStudents.length < students.length ? 'Select all' : 'Deselect all'}
                    </button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-bg-muted">
                    {students.map((student) => {
                      const studentGrade = student.grade_level ?? ''
                      const effectiveStepId = student.overrideStepId ?? selectedStepId
                      const effectiveStep = ladder.find((s) => s.id === effectiveStepId)
                      const zone = effectiveStep
                        ? getGradeZone(effectiveStep.grade_level, studentGrade)
                        : 'current'
                      return (
                        <div
                          key={student.id}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2 transition-colors',
                            student.selected ? 'bg-primary-50/50' : 'hover:bg-bg-muted/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={student.selected}
                            onChange={() => toggleStudent(student.id)}
                            className="shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-text">
                              {student.first_name} {student.last_name}
                            </span>
                            <span className="ml-2 text-xs text-text-light">
                              Grade {student.grade_level ?? '?'}
                            </span>
                          </div>
                          {/* Zone badge */}
                          {student.selected && (
                            <span className={clsx('text-[10px] font-medium', ZONE_COLORS[zone])}>
                              {zone === 'extension' && '↑ Above'}
                              {zone === 'remediation' && '↓ Below'}
                              {zone === 'current' && '● At grade'}
                            </span>
                          )}
                          {/* Step override for differentiation */}
                          {student.selected && ladder.length > 1 && (
                            <select
                              value={student.overrideStepId ?? ''}
                              onChange={(e) => setStudentStep(student.id, e.target.value || null)}
                              className="w-24 rounded border border-bg-muted bg-bg px-1.5 py-1 text-[11px] text-text focus:border-primary-400 focus:outline-none"
                              title="Override step level"
                            >
                              <option value="">Default</option>
                              {ladder.map((ls) => (
                                <option key={ls.id} value={ls.id}>
                                  Grade {ls.grade_level}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Title <span className="text-text-light">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selectedSkill?.name ?? 'Skill assignment'}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Instructions</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  placeholder="Instructions for the learner..."
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Due Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text">Assignment Summary</h3>

              <div className="rounded-lg border border-bg-muted bg-bg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Skill</span>
                  <span className="font-medium text-text">{selectedSkill?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Grade Level</span>
                  <span className="font-medium text-text">
                    Grade {selectedStepObj?.grade_level ?? '?'}
                  </span>
                </div>
                {selectedStepObj && (
                  <div className="text-sm">
                    <span className="text-text-muted">Expectation:</span>
                    <p className="mt-1 text-xs text-text">{selectedStepObj.expectation_description}</p>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Type</span>
                  <span className="font-medium text-text capitalize">{assignmentType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Students</span>
                  <span className="font-medium text-text">{selectedStudents.length}</span>
                </div>
                {dueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Due Date</span>
                    <span className="font-medium text-text">{dueDate}</span>
                  </div>
                )}
              </div>

              {/* Above/below grade warnings */}
              {selectedStudents.some((s) => {
                const effStep = ladder.find((ls) => ls.id === (s.overrideStepId ?? selectedStepId))
                return effStep && isAboveGrade(effStep.grade_level, s.grade_level ?? '')
              }) && (
                <div className="flex items-start gap-2 rounded-lg bg-purple-50 px-3 py-2">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                  <p className="text-xs text-purple-700">
                    Some students will receive above-grade work. Scores below 3 will be excluded
                    from their dimension averages to avoid penalizing stretch work.
                  </p>
                </div>
              )}

              {/* Student breakdown */}
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="py-1 text-left font-medium">Student</th>
                      <th className="py-1 text-left font-medium">Grade</th>
                      <th className="py-1 text-left font-medium">Step</th>
                      <th className="py-1 text-left font-medium">Zone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bg-muted">
                    {selectedStudents.map((s) => {
                      const effStepId = s.overrideStepId ?? selectedStepId
                      const effStep = ladder.find((ls) => ls.id === effStepId)
                      const zone = effStep
                        ? getGradeZone(effStep.grade_level, s.grade_level ?? '')
                        : 'current'

                      return (
                        <tr key={s.id}>
                          <td className="py-1.5 text-text">{s.first_name} {s.last_name}</td>
                          <td className="py-1.5 text-text-muted">{s.grade_level ?? '?'}</td>
                          <td className="py-1.5 text-text-muted">{effStep?.grade_level ?? '?'}</td>
                          <td className={clsx('py-1.5 font-medium capitalize', ZONE_COLORS[zone])}>
                            {zone}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between border-t border-bg-muted px-6 py-4">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : onClose()}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canProceed[step]}
              className="flex items-center gap-1 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Assignment
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

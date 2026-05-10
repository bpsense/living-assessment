/**
 * ClassroomActiveAssignments.tsx
 *
 * Educator's classroom view: a list of active standards-driven assignments.
 * Pick one → see the roster of assigned students → pick a student → assess
 * each standard on that student's snapshot, with notes + per-student files.
 *
 * Hangs off the Classroom page; does not modify the existing legacy
 * AssignmentLibrarySection.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Loader2,
  Plus,
  Sparkles,
  UserCircle2,
} from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '../Toast'
import {
  completeAssignment,
  getActiveAssignmentsForClassroom,
  getStudentRosterForAssignment,
  type StudentAssignmentView,
} from '../../lib/standards-assignment-data'
import AssignProjectModal from '../assignment/AssignProjectModal'
import AssessStudentPanel from '../assignment/AssessStudentPanel'
import type { Assignment, Standard, Student } from '../../types/database'

interface Props {
  classroomId: string
  classroomName: string
}

type AssignmentRow = Assignment & {
  student_count: number
  standards_count: number
}

interface RosterEntry {
  student_assignment_id: string
  student: Student
  is_personalized: boolean
  standards: Standard[]
}

export default function ClassroomActiveAssignments({ classroomId, classroomName }: Props) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getActiveAssignmentsForClassroom(classroomId)
      setAssignments(rows)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load assignments', 'error')
    } finally {
      setLoading(false)
    }
  }, [classroomId, toast])

  useEffect(() => { void loadAssignments() }, [loadAssignments])

  const loadRoster = useCallback(async (assignmentId: string) => {
    setRosterLoading(true)
    try {
      const rows = await getStudentRosterForAssignment(assignmentId)
      setRoster(rows)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load roster', 'error')
    } finally {
      setRosterLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!activeId) {
      setRoster([])
      setActiveStudentId(null)
      return
    }
    void loadRoster(activeId)
    setActiveStudentId(null)
  }, [activeId, loadRoster])

  async function handleComplete(assignmentId: string) {
    if (!confirm('Mark this assignment as completed? It will be removed from "Assigned to Me" for all students.')) return
    try {
      await completeAssignment(assignmentId)
      toast('Marked complete', 'success')
      setActiveId(null)
      void loadAssignments()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to mark complete', 'error')
    }
  }

  // Active student → build a StudentAssignmentView for AssessStudentPanel
  const activeRosterEntry = roster.find((r) => r.student.id === activeStudentId) ?? null
  const activeAssignment = assignments.find((a) => a.id === activeId) ?? null

  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-text">Active Assignments</h2>
          {!loading && (
            <span className="text-xs text-text-muted">
              {assignments.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAssign(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Assign new
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
        </div>
      ) : !activeId ? (
        // ====== Assignment list ======
        assignments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-bg-muted bg-bg-card px-4 py-6 text-center text-sm text-text-muted">
            No active assignments. Use "Assign new" to start.
          </p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="cursor-pointer rounded-xl border border-bg-muted bg-bg-card px-3.5 py-3 transition-colors hover:bg-bg-muted/40"
                onClick={() => setActiveId(a.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-text truncate">{a.title}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {a.student_count} student{a.student_count === 1 ? '' : 's'} · {a.standards_count} standard{a.standards_count === 1 ? '' : 's'}
                      {a.due_date && ` · due ${format(new Date(a.due_date), 'MMM d')}`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : !activeStudentId ? (
        // ====== Student roster within assignment ======
        <div>
          <button
            onClick={() => setActiveId(null)}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to assignments
          </button>
          <h3 className="mb-1 text-sm font-semibold text-text">{activeAssignment?.title}</h3>
          {activeAssignment?.description && (
            <p className="mb-2 text-xs text-text-muted">{activeAssignment.description}</p>
          )}

          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-text-muted">Pick a student to assess:</span>
            <button
              onClick={() => activeId && handleComplete(activeId)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-emerald-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark complete
            </button>
          </div>

          {rosterLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            </div>
          ) : (
            <ul className="space-y-1.5">
              {roster.map((r) => (
                <li
                  key={r.student.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-bg-muted bg-bg-card px-3 py-2 hover:bg-bg-muted/40"
                  onClick={() => setActiveStudentId(r.student.id)}
                >
                  <UserCircle2 className="h-5 w-5 text-text-light" />
                  <span className="flex-1 text-sm text-text">
                    {r.student.first_name} {r.student.last_name}
                  </span>
                  {r.is_personalized && (
                    <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                      <Sparkles className="h-3 w-3" />
                      Personalized
                    </span>
                  )}
                  <span className="text-[11px] text-text-light">
                    {r.standards.length} standard{r.standards.length === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // ====== Assess panel ======
        <div>
          <button
            onClick={() => setActiveStudentId(null)}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to roster
          </button>
          {activeRosterEntry && activeAssignment && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-text">
                {activeRosterEntry.student.first_name} {activeRosterEntry.student.last_name}
                <span className="ml-2 text-xs font-normal text-text-muted">— {activeAssignment.title}</span>
              </h3>
              <AssessStudentPanel
                studentAssignment={toView(activeRosterEntry, activeAssignment)}
                onSaved={() => { /* keep panel open for additional ratings */ }}
              />
            </div>
          )}
        </div>
      )}

      <AssignProjectModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onCreated={() => void loadAssignments()}
        prefilledClassroom={{ id: classroomId, name: classroomName }}
      />
    </section>
  )
}

function toView(entry: RosterEntry, a: AssignmentRow): StudentAssignmentView {
  return {
    student_assignment_id: entry.student_assignment_id,
    assignment_id: a.id,
    student_id: entry.student.id,
    status: 'assigned',
    title: a.title,
    description: a.description,
    due_date: a.due_date,
    assignment_status: a.status,
    assignment_type: a.assignment_type,
    classroom_id: a.classroom_id,
    teacher_id: a.teacher_id,
    school_id: a.school_id,
    is_personalized: entry.is_personalized,
    standards: entry.standards,
  }
}

/**
 * LearnerAssignmentsSection.tsx
 *
 * "Assigned to Me" — the active list of standards-driven projects on a
 * learner's profile. Educators see action buttons; family view sees a
 * read-only list filtered to family-visible standards (filter is enforced
 * server-side via RLS on assignment_standard_assessments).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Loader2, Pencil, Plus, Sparkles } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import {
  getActiveAssignmentsForStudent,
  type StudentAssignmentView,
} from '../../lib/standards-assignment-data'
import { useToast } from '../Toast'
import AssignProjectModal from '../assignment/AssignProjectModal'
import PersonalizeAssignmentModal from '../assignment/PersonalizeAssignmentModal'

interface Props {
  student: { id: string; first_name: string; last_name: string; school_id: string }
  /** Family view hides write actions and uses softer copy. */
  familyView?: boolean
  /** Educator role only — shows the "Assign new" button. */
  canAssign?: boolean
}

export default function LearnerAssignmentsSection({
  student,
  familyView = false,
  canAssign = false,
}: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<StudentAssignmentView[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [personalizing, setPersonalizing] = useState<StudentAssignmentView | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getActiveAssignmentsForStudent(student.id)
      setItems(rows)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load assignments', 'error')
    } finally {
      setLoading(false)
    }
  }, [student.id, toast])

  useEffect(() => { void load() }, [load])

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        // Due-first, then by title
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        if (a.due_date) return -1
        if (b.due_date) return 1
        return a.title.localeCompare(b.title)
      }),
    [items]
  )

  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-text">
            {familyView ? `What ${student.first_name} is working on` : 'Assigned to Me'}
          </h2>
          {!loading && (
            <span className="text-xs text-text-muted">
              {sorted.length} active
            </span>
          )}
        </div>
        {canAssign && !familyView && (
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Assign new
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bg-muted bg-bg-card px-4 py-6 text-center text-sm text-text-muted">
          {familyView
            ? `No active projects right now.`
            : 'No active assignments. Use “Assign new” to add one.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((it) => (
            <AssignmentRow
              key={it.student_assignment_id}
              item={it}
              familyView={familyView}
              onPersonalize={() => setPersonalizing(it)}
            />
          ))}
        </ul>
      )}

      {/* Modals (educator only) */}
      {!familyView && (
        <>
          <AssignProjectModal
            open={showAssign}
            onClose={() => setShowAssign(false)}
            onCreated={() => void load()}
            prefilledStudent={{
              id: student.id,
              first_name: student.first_name,
              last_name: student.last_name,
            }}
          />
          {personalizing && (
            <PersonalizeAssignmentModal
              open={!!personalizing}
              studentAssignment={personalizing}
              schoolId={student.school_id}
              onClose={() => setPersonalizing(null)}
              onSaved={() => {
                setPersonalizing(null)
                void load()
              }}
            />
          )}
        </>
      )}
    </section>
  )
}

function AssignmentRow({
  item,
  familyView,
  onPersonalize,
}: {
  item: StudentAssignmentView
  familyView: boolean
  onPersonalize: () => void
}) {
  const dueLabel = item.due_date ? formatDistanceToNow(new Date(item.due_date), { addSuffix: true }) : null
  const dueExact = item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : null
  const isOverdue = item.due_date ? new Date(item.due_date).getTime() < Date.now() : false

  return (
    <li className="rounded-xl border border-bg-muted bg-bg-card px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text truncate">{item.title}</h3>
            {item.is_personalized && (
              <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                <Sparkles className="h-3 w-3" />
                Personalized
              </span>
            )}
            {item.status === 'graded' && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Graded
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.description}</p>
          )}
          {item.standards.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.standards.slice(0, 6).map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted"
                  title={s.description}
                >
                  {s.code}
                </span>
              ))}
              {item.standards.length > 6 && (
                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                  +{item.standards.length - 6}
                </span>
              )}
            </div>
          )}
          {dueLabel && (
            <p
              className={clsx(
                'mt-2 text-[11px]',
                isOverdue ? 'text-alert-600' : 'text-text-light'
              )}
              title={dueExact ?? undefined}
            >
              Due {dueLabel}
            </p>
          )}
        </div>

        {!familyView && (
          <button
            onClick={onPersonalize}
            className="shrink-0 rounded-lg border border-bg-muted bg-bg-card p-1.5 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            title="Personalize for this student"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  )
}

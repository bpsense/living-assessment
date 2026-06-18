/**
 * StudentAssignmentsSection.tsx
 *
 * The "Assignments" section on a learner's profile. Educator/admin view shows
 * every assignment with a per-student family-visibility toggle; family/learner
 * view shows only assignments that resolve visible (gated at the data layer via
 * fetchStudentAssignments(studentId, true), not just hidden in the UI).
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ClipboardList, ChevronDown, Eye, EyeOff, Loader2, ExternalLink } from 'lucide-react'
import { useToast } from '../Toast'
import { setStudentAssignmentVisibility } from '../../lib/assignment-visibility'
import {
  fetchStudentAssignments,
  fetchAssignmentObservations,
  type StudentAssignmentWithMeta,
  type AssignmentObservation,
  type StudentAssignmentStatus,
} from '../../lib/assignment-data'
import { formatLevel, type AssessmentLevel } from '../../lib/standards-assignment-data'

const LEVEL_BADGE: Record<AssessmentLevel, string> = {
  emerging: 'bg-alert-50 text-alert-700 border-alert-200',
  developing: 'bg-caution-50 text-caution-700 border-caution-200',
  achieving: 'bg-primary-50 text-primary-700 border-primary-200',
  mastery: 'bg-success-50 text-success-700 border-success-200',
}
const STATUS_BADGE: Record<StudentAssignmentStatus, string> = {
  assigned: 'bg-bg-muted text-text-muted',
  in_progress: 'bg-caution-50 text-caution-700',
  complete: 'bg-success-50 text-success-700',
  archived: 'bg-bg-muted text-text-light',
}

interface Props {
  studentId: string
  /** Family/learner view: only visible assignments + no management controls. */
  familyView: boolean
}

export default function StudentAssignmentsSection({ studentId, familyView }: Props) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState<StudentAssignmentWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [obs, setObs] = useState<Record<string, (AssignmentObservation & { observer_name: string | null })[]>>({})
  const [busyVis, setBusyVis] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchStudentAssignments(studentId, familyView))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [studentId, familyView])

  useEffect(() => {
    load()
  }, [load])

  async function toggleExpand(saId: string) {
    if (expanded === saId) {
      setExpanded(null)
      return
    }
    setExpanded(saId)
    if (!obs[saId]) {
      try {
        const rows = await fetchAssignmentObservations(saId)
        setObs((o) => ({ ...o, [saId]: rows }))
      } catch {
        setObs((o) => ({ ...o, [saId]: [] }))
      }
    }
  }

  async function toggleVisibility(sa: StudentAssignmentWithMeta) {
    setBusyVis(sa.id)
    const { error } = await setStudentAssignmentVisibility(sa.id, !sa.resolved_visible_to_family)
    setBusyVis(null)
    if (error) return toast(error, 'error')
    await load()
  }

  // Hide the section entirely for families when there's nothing visible.
  if (!loading && items.length === 0 && familyView) return null

  return (
    <section>
      <div className="glass-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-text">
          <ClipboardList className="h-5 w-5 text-primary-500" />
          Assignments
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          {familyView ? 'Projects and tasks shared with your family.' : 'Projects and tasks assigned to this learner.'}
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-bg-muted px-4 py-6 text-center text-sm text-text-muted">
            No assignments yet.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((sa) => {
              const isOpen = expanded === sa.id
              return (
                <div key={sa.id} className="overflow-hidden rounded-xl border border-bg-muted">
                  <div className="flex items-center gap-2 bg-bg-card px-4 py-3">
                    <button onClick={() => toggleExpand(sa.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={clsx('h-4 w-4 shrink-0 text-text-light transition-transform', isOpen && 'rotate-180')} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text">{sa.assignment_title}</span>
                        <span className="text-[11px] capitalize text-text-muted">
                          {sa.assignment_type.replace('_', ' ')}
                          {' · '}assigned {new Date(sa.assigned_at).toLocaleDateString()}
                          {sa.due_date && ` · due ${new Date(sa.due_date).toLocaleDateString()}`}
                        </span>
                      </span>
                    </button>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_BADGE[sa.status])}>
                      {sa.status.replace('_', ' ')}
                    </span>
                    <span className="shrink-0 text-[11px] text-text-light">{sa.observation_count} obs</span>
                    {!familyView && (
                      <>
                        <button
                          onClick={() => toggleVisibility(sa)}
                          disabled={busyVis === sa.id}
                          title={sa.resolved_visible_to_family ? 'Visible to family — click to hide' : 'Hidden from family — click to show'}
                          className="shrink-0 rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
                        >
                          {sa.resolved_visible_to_family ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => navigate(`/assignments/${sa.assignment_id}`)}
                          title="Open roster"
                          className="shrink-0 rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {isOpen && (
                    <div className="border-t border-bg-muted bg-bg px-4 py-3">
                      {!obs[sa.id] ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                        </div>
                      ) : obs[sa.id].length === 0 ? (
                        <p className="py-2 text-center text-xs text-text-muted">No observations recorded.</p>
                      ) : (
                        <div className="space-y-2">
                          {obs[sa.id].map((o) => (
                            <div key={o.id} className="rounded-lg border border-bg-muted bg-bg-card p-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', LEVEL_BADGE[o.level])}>
                                  {formatLevel(o.level)}
                                </span>
                                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] capitalize text-text-muted">
                                  {o.observation_type}
                                </span>
                                <span className="ml-auto text-[11px] text-text-light">
                                  {new Date(o.observed_at).toLocaleDateString()}
                                </span>
                              </div>
                              {o.notes && <p className="mt-1 text-sm text-text">{o.notes}</p>}
                              {o.observer_name && <p className="mt-0.5 text-[11px] text-text-light">— {o.observer_name}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

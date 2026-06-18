/**
 * Assignments.tsx  (route: /assignments)
 *
 * Role-adaptive home for the "Assignments" sidebar item:
 *  - staff (canEdit): the school's assignments, each linking to its roster
 *    detail, plus New + a link to the shared Library.
 *  - learner: their own assigned work (visible only).
 *  - parent: links to each child's profile, where the Assignments tab lives.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Loader2, Plus, BookOpen, ChevronRight } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { usePageAccess } from '../lib/role-permissions'
import { supabase } from '../lib/supabase'
import { DimensionIcon } from '../components/student/DimensionIcon'
import { useAssignmentFormData } from '../components/assignment/useAssignmentFormData'
import AssignmentFormModal from '../components/assignment/AssignmentFormModal'
import {
  fetchSchoolAssignments,
  fetchStudentAssignments,
  type AssignmentWithRelations,
  type StudentAssignmentWithMeta,
  type StudentAssignmentStatus,
} from '../lib/assignment-data'

const STATUS_BADGE: Record<StudentAssignmentStatus, string> = {
  assigned: 'bg-bg-muted text-text-muted',
  in_progress: 'bg-caution-50 text-caution-700',
  complete: 'bg-success-50 text-success-700',
  archived: 'bg-bg-muted text-text-light',
}

export default function Assignments() {
  const { profile } = useAuth()
  const { role } = useAccessControl()
  const { canEdit } = usePageAccess('assignments')
  const navigate = useNavigate()
  const schoolId = profile?.school_id
  const { dimensions } = useAssignmentFormData(canEdit ? schoolId : undefined)

  const [staffItems, setStaffItems] = useState<AssignmentWithRelations[]>([])
  const [myItems, setMyItems] = useState<StudentAssignmentWithMeta[]>([])
  const [children, setChildren] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        if (canEdit && schoolId) {
          const rows = await fetchSchoolAssignments(schoolId, {})
          if (!cancelled) setStaffItems(rows)
        } else if (role === 'learner' && profile?.student_id) {
          const rows = await fetchStudentAssignments(profile.student_id, true)
          if (!cancelled) setMyItems(rows)
        } else if (role === 'parent' && profile) {
          const { data } = await supabase
            .from('parent_students')
            .select('student:students(id, first_name, last_name, preferred_name)')
            .eq('parent_id', profile.id)
          type Row = { student: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null }
          const kids = ((data ?? []) as unknown as Row[])
            .map((r) => r.student)
            .filter((s): s is NonNullable<Row['student']> => !!s)
            .map((s) => ({ id: s.id, name: `${s.preferred_name || s.first_name} ${s.last_name}`.trim() }))
          if (!cancelled) setChildren(kids)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canEdit, schoolId, role, profile])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Assignments</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/assignment-library')}
              className="flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
            >
              <BookOpen className="h-4 w-4" /> Library
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        )}
      </div>

      {/* ---- STAFF ---- */}
      {canEdit ? (
        staffItems.length === 0 ? (
          <EmptyState text="No assignments yet. Create one to get started." />
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staffItems.map((a) => {
              const dims = dimensions.filter((d) => a.dimension_ids.includes(d.id))
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/assignments/${a.id}`)}
                  className="glass-card flex flex-col gap-2 p-4 text-left transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium capitalize text-primary-700">
                      {a.assignment_type.replace('_', ' ')}
                    </span>
                    {a.status === 'draft' && (
                      <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-light">
                        Draft
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold leading-snug text-text">{a.title}</h3>
                  {dims.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {dims.map((d) => (
                        <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] text-text-muted">
                          <DimensionIcon name={d.icon} className="h-3 w-3" />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )
      ) : role === 'parent' ? (
        /* ---- PARENT ---- */
        children.length === 0 ? (
          <EmptyState text="No children linked to your account yet." />
        ) : (
          <div className="mt-5 space-y-2">
            <p className="text-sm text-text-muted">View each child's assignments on their profile.</p>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/student/${c.id}`)}
                className="glass-card flex w-full items-center justify-between p-4 text-left transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-semibold text-text">{c.name}</span>
                <ChevronRight className="h-4 w-4 text-text-light" />
              </button>
            ))}
          </div>
        )
      ) : (
        /* ---- LEARNER ---- */
        myItems.length === 0 ? (
          <EmptyState text="You have no assignments yet." />
        ) : (
          <div className="mt-5 space-y-2">
            {myItems.map((sa) => (
              <div key={sa.id} className="glass-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{sa.assignment_title}</p>
                  <p className="text-[11px] capitalize text-text-muted">
                    {sa.assignment_type.replace('_', ' ')}
                    {sa.due_date && ` · due ${new Date(sa.due_date).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_BADGE[sa.status])}>
                  {sa.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {showNew && schoolId && profile && (
        <AssignmentFormModal
          open={showNew}
          onClose={() => setShowNew(false)}
          schoolId={schoolId}
          createdBy={profile.id}
          onSaved={(a) => {
            setShowNew(false)
            navigate(`/assignments/${a.id}`)
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="mt-8 rounded-2xl border border-dashed border-bg-muted px-4 py-12 text-center text-sm text-text-muted">
      {text}
    </p>
  )
}

/**
 * AssignmentLibrary.tsx  (route: /assignment-library)
 *
 * Shared school library of assignments. Educators/admins browse, filter, sort
 * by appreciation, "Use" (assign) or "Edit" (creator/admin). Gated by
 * usePageAccess('assignment_library').
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { Loader2, Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { usePageAccess } from '../lib/role-permissions'
import { useToast } from '../components/Toast'
import { DimensionIcon } from '../components/student/DimensionIcon'
import { useAssignmentFormData } from '../components/assignment/useAssignmentFormData'
import AssignmentLibraryCard from '../components/assignment/AssignmentLibraryCard'
import AssignModal from '../components/assignment/AssignModal'
import AssignmentFormModal from '../components/assignment/AssignmentFormModal'
import {
  fetchSchoolAssignments,
  fetchMyGratitude,
  toggleGratitude,
  type AssignmentType,
  type AssignmentWithRelations,
} from '../lib/assignment-data'

export default function AssignmentLibrary() {
  const { profile } = useAuth()
  const { role } = useAccessControl()
  const { canView } = usePageAccess('assignment_library')
  const { toast } = useToast()
  const schoolId = profile?.school_id
  const { dimensions, competenciesByDimension } = useAssignmentFormData(schoolId)

  const [items, setItems] = useState<AssignmentWithRelations[]>([])
  const [gratified, setGratified] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | AssignmentType>('all')
  const [dimIds, setDimIds] = useState<string[]>([])
  const [compIds, setCompIds] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'gratitude' | 'recent'>('gratitude')

  const [useTarget, setUseTarget] = useState<{ id: string; title: string } | null>(null)
  const [editTarget, setEditTarget] = useState<AssignmentWithRelations | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const rows = await fetchSchoolAssignments(schoolId, {
        libraryStatus: 'school_library',
        assignmentType: type === 'all' ? undefined : type,
        dimensionIds: dimIds.length ? dimIds : undefined,
        competencyIds: compIds.length ? compIds : undefined,
        sortBy,
      })
      setItems(rows)
      if (profile) setGratified(await fetchMyGratitude(rows.map((r) => r.id), profile.id))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load library', 'error')
    } finally {
      setLoading(false)
    }
  }, [schoolId, type, dimIds, compIds, sortBy, profile, toast])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const visible = useMemo(
    () =>
      search.trim()
        ? items.filter((a) => a.title.toLowerCase().includes(search.trim().toLowerCase()))
        : items,
    [items, search]
  )

  async function handleToggleGratitude(a: AssignmentWithRelations) {
    if (!profile) return
    const wasGratified = gratified.has(a.id)
    // Optimistic
    setGratified((s) => {
      const next = new Set(s)
      if (wasGratified) next.delete(a.id)
      else next.add(a.id)
      return next
    })
    setItems((rows) =>
      rows.map((r) => (r.id === a.id ? { ...r, gratitude_count: r.gratitude_count + (wasGratified ? -1 : 1) } : r))
    )
    const { count, error } = await toggleGratitude(a.id, profile.id)
    if (error) {
      // Revert
      setGratified((s) => {
        const next = new Set(s)
        if (wasGratified) next.add(a.id)
        else next.delete(a.id)
        return next
      })
      setItems((rows) => rows.map((r) => (r.id === a.id ? { ...r, gratitude_count: a.gratitude_count } : r)))
      toast(error, 'error')
      return
    }
    setItems((rows) => rows.map((r) => (r.id === a.id ? { ...r, gratitude_count: count } : r)))
  }

  function toggleDim(id: string) {
    setDimIds((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
    // drop competencies of a removed dimension
    if (dimIds.includes(id)) {
      const removed = new Set((competenciesByDimension.get(id) ?? []).map((c) => c.id))
      setCompIds((c) => c.filter((x) => !removed.has(x)))
    }
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Lock className="h-8 w-8 text-text-light" />
        <p className="text-sm text-text-muted">You don't have access to the Assignment Library.</p>
      </div>
    )
  }

  const selectedDims = dimensions.filter((d) => dimIds.includes(d.id))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold text-text">Assignment Library</h1>
      <p className="mt-1 text-sm text-text-muted">Reusable assignments shared across your school.</p>

      {/* Filter bar */}
      <div className="mt-5 space-y-3 rounded-2xl border border-bg-muted bg-bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="min-w-[180px] flex-1 rounded-xl border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'all' | AssignmentType)}
            className="rounded-xl border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:outline-none"
          >
            <option value="all">All types</option>
            <option value="project">Project</option>
            <option value="focused_task">Focused Task</option>
          </select>
          <div className="flex gap-1 rounded-xl bg-bg-muted p-1">
            {(['gratitude', 'recent'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  sortBy === s ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
                )}
              >
                {s === 'gratitude' ? 'Most Appreciated' : 'Recently Added'}
              </button>
            ))}
          </div>
        </div>

        {/* Dimension chips */}
        <div className="flex flex-wrap gap-1.5">
          {dimensions.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDim(d.id)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                dimIds.includes(d.id)
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-bg-muted bg-bg text-text-muted hover:border-primary-200'
              )}
            >
              <DimensionIcon name={d.icon} className="h-3 w-3" />
              {d.name}
            </button>
          ))}
        </div>

        {/* Competency chips for selected dimensions */}
        {selectedDims.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedDims.flatMap((d) => competenciesByDimension.get(d.id) ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setCompIds((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  compIds.includes(c.id)
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-bg-muted bg-bg text-text-muted hover:border-primary-200'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-bg-muted px-4 py-12 text-center text-sm text-text-muted">
          No assignments in the library match these filters.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((a) => (
            <AssignmentLibraryCard
              key={a.id}
              assignment={a}
              dimensions={dimensions}
              gratified={gratified.has(a.id)}
              canEdit={a.created_by === profile?.id || role === 'admin'}
              onToggleGratitude={() => handleToggleGratitude(a)}
              onUse={() => setUseTarget({ id: a.id, title: a.title })}
              onEdit={() => setEditTarget(a)}
            />
          ))}
        </div>
      )}

      {/* Use → assign (class mode; pick a class in the modal) */}
      {useTarget && schoolId && (
        <AssignModal
          open={!!useTarget}
          onClose={() => setUseTarget(null)}
          mode="class"
          schoolId={schoolId}
          preselectedAssignment={useTarget}
        />
      )}

      {/* Edit */}
      {editTarget && schoolId && profile && (
        <AssignmentFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          schoolId={schoolId}
          createdBy={profile.id}
          existing={editTarget}
          onSaved={() => {
            setEditTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

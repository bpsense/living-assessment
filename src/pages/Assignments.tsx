import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import {
  fetchAssignments,
  deleteAssignment,
  type AssignmentWithDetails,
} from '../lib/assignment-data'
import { createTemplateFromAssignment } from '../lib/assignment-template-data'
import CreateAssignmentModal from '../components/assignment/CreateAssignmentModal'
import AssignmentLibrarySection from '../components/assignment/AssignmentLibrarySection'
import {
  Plus,
  Loader2,
  BookOpen,
  Calendar,
  Users,
  User,
  Trash2,
  ClipboardList,
  ChevronRight,
  Search,
  Tag,
  Library,
  Save,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-bg-muted text-text-light' },
  active: { label: 'Active', color: 'bg-primary-50 text-primary-700' },
  completed: { label: 'Completed', color: 'bg-success-50 text-success-700' },
}

type Tab = 'active' | 'library'

export default function Assignments() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [savingToLibrary, setSavingToLibrary] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const loadAssignments = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const data = await fetchAssignments(profile.school_id, {
        teacherId: profile.role === 'educator' ? profile.id : undefined,
        status: statusFilter || undefined,
      })
      setAssignments(data)
    } catch {
      toast('Failed to load assignments', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, profile?.id, profile?.role, statusFilter, toast])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  async function handleDelete(a: AssignmentWithDetails) {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return
    setDeleting(a.id)
    try {
      await deleteAssignment(a.id)
      toast('Assignment deleted', 'success')
      loadAssignments()
    } catch {
      toast('Failed to delete', 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleSaveToLibrary(a: AssignmentWithDetails) {
    if (!profile) return
    setSavingToLibrary(a.id)
    try {
      await createTemplateFromAssignment(a.id, profile.school_id, profile.id)
      toast(`"${a.title}" saved to library`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save to library', 'error')
    } finally {
      setSavingToLibrary(null)
    }
  }

  const isStaff = profile?.role === 'educator' || profile?.role === 'admin'

  const filtered = assignments.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.teacher_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Assignments</h1>
          <p className="mt-1 text-sm text-text-muted">
            Create, manage, and reuse competency-linked assignments.
          </p>
        </div>
        {activeTab === 'active' && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            New Assignment
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-bg-muted p-1">
        <button
          onClick={() => setActiveTab('active')}
          className={clsx(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'active'
              ? 'bg-bg-card text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          )}
        >
          <ClipboardList className="h-4 w-4" />
          Active Assignments
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={clsx(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'library'
              ? 'bg-bg-card text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          )}
        >
          <Library className="h-4 w-4" />
          Assignment Library
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'active' && (
        <>
          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assignments..."
                className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
                <ClipboardList className="h-7 w-7 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">
                  {search ? 'No matching assignments' : 'No assignments yet'}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {search
                    ? 'Try a different search term.'
                    : 'Create your first assignment to start tracking competency growth.'}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
                >
                  <Plus className="h-4 w-4" />
                  New Assignment
                </button>
              )}
            </div>
          )}

          {/* Assignment list */}
          {!loading && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((a) => {
                const gradedCount = a.student_assignments.filter(
                  (sa) => sa.status === 'graded'
                ).length
                const totalStudents = a.student_assignments.length
                const statusConfig = STATUS_LABELS[a.status] || STATUS_LABELS.draft

                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 rounded-xl border border-bg-muted bg-bg-card px-4 py-4 transition-colors hover:border-primary-200"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                      <BookOpen className="h-5 w-5 text-primary-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text truncate">{a.title}</p>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            statusConfig.color
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                        {a.assignment_type === 'class' ? (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Class
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> Individual
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {a.competencies.length} competenc{a.competencies.length !== 1 ? 'ies' : 'y'}
                        </span>
                        <span>
                          {gradedCount}/{totalStudents} graded
                        </span>
                        {a.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(a.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      {a.skills && a.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {a.skills.map((as) => (
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
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Save to Library */}
                      {isStaff && (
                        <button
                          onClick={() => handleSaveToLibrary(a)}
                          disabled={savingToLibrary === a.id}
                          className="rounded-lg p-2 text-text-light transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                          title="Save to Library"
                        >
                          {savingToLibrary === a.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Save className="h-4 w-4" />}
                        </button>
                      )}
                      <Link
                        to={`/assignment/${a.id}`}
                        className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      {(a.teacher_id === profile?.id || profile?.role === 'admin') && (
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={deleting === a.id}
                          className="rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600 disabled:opacity-50"
                        >
                          {deleting === a.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <CreateAssignmentModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={loadAssignments}
          />
        </>
      )}

      {activeTab === 'library' && <AssignmentLibrarySection />}
    </div>
  )
}

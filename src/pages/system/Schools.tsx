import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Building2, Plus, Users, School, UserCheck, Loader2, Archive, ArchiveRestore } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { School as SchoolType } from '../../types/database'

interface SchoolStats {
  school: SchoolType
  studentCount: number
  classroomCount: number
  educatorCount: number
}

export default function Schools() {
  const { setActiveSchool } = useAuth()
  const navigate = useNavigate()
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [stats, setStats] = useState<Record<string, SchoolStats>>({})
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSchoolName, setNewSchoolName] = useState('')
  const [newSchoolSlug, setNewSchoolSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function loadSchools() {
    setLoadingSchools(true)
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('name')
    if (!error) setSchools((data as SchoolType[]) ?? [])
    setLoadingSchools(false)
  }

  useEffect(() => {
    loadSchools()
  }, [])

  useEffect(() => {
    async function loadStats() {
      if (schools.length === 0) return
      setLoadingStats(true)
      const result: Record<string, SchoolStats> = {}
      for (const school of schools) {
        const [students, classrooms, educators] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
          supabase.from('classrooms').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'educator'),
        ])
        result[school.id] = {
          school,
          studentCount: students.count ?? 0,
          classroomCount: classrooms.count ?? 0,
          educatorCount: educators.count ?? 0,
        }
      }
      setStats(result)
      setLoadingStats(false)
    }
    loadStats()
  }, [schools])

  function handleSchoolClick(school: SchoolType) {
    if (school.archived_at) return
    setActiveSchool(school.id)
    navigate('/')
  }

  async function handleCreateSchool(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const slug = newSchoolSlug || newSchoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { error } = await supabase.from('schools').insert({
      name: newSchoolName,
      slug,
    })

    if (error) {
      setCreateError(error.message)
      setCreating(false)
      return
    }

    // Refresh — reload the page to refetch allSchools in auth context
    window.location.reload()
  }

  async function handleArchive(school: SchoolType) {
    const confirmed = window.confirm(
      `Archive "${school.name}"? It will be hidden from the school switcher and rosters, but no data will be deleted. You can restore it later.`,
    )
    if (!confirmed) return
    setBusyId(school.id)
    setActionError(null)
    const { data: userRes } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('schools')
      .update({ archived_at: new Date().toISOString(), archived_by: userRes.user?.id ?? null })
      .eq('id', school.id)
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    // Reload so the auth context's allSchools (used by the switcher) refreshes too
    window.location.reload()
  }

  async function handleUnarchive(school: SchoolType) {
    setBusyId(school.id)
    setActionError(null)
    const { error } = await supabase
      .from('schools')
      .update({ archived_at: null, archived_by: null })
      .eq('id', school.id)
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    window.location.reload()
  }

  const activeSchools = schools.filter((s) => !s.archived_at)
  const archivedSchools = schools.filter((s) => s.archived_at)
  const visibleSchools = showArchived ? archivedSchools : activeSchools

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Schools</h1>
          <p className="mt-1 text-sm text-text-muted">
            {activeSchools.length} active
            {archivedSchools.length > 0 && ` · ${archivedSchools.length} archived`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          Add School
        </button>
      </div>

      {/* Active / Archived tabs */}
      {archivedSchools.length > 0 && (
        <div className="mb-4 flex gap-2 border-b border-bg-muted">
          <button
            onClick={() => setShowArchived(false)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              !showArchived ? 'border-primary-500 text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Active ({activeSchools.length})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              showArchived ? 'border-primary-500 text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Archived ({archivedSchools.length})
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-alert-500/30 bg-alert-500/10 px-4 py-2 text-sm text-alert-500">
          {actionError}
        </div>
      )}

      {/* Create school form */}
      {showCreateForm && (
        <div className="mb-6 glass-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-text">Create New School</h2>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">School Name</label>
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="e.g., Westside Elementary"
                required
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Slug (URL identifier)</label>
              <input
                type="text"
                value={newSchoolSlug}
                onChange={(e) => setNewSchoolSlug(e.target.value)}
                placeholder="auto-generated from name"
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            {createError && (
              <p className="text-sm text-alert-500">{createError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !newSchoolName.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create School
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-bg-muted px-4 py-2 text-sm font-medium text-text hover:bg-bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loadingSchools ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading schools...
        </div>
      ) : visibleSchools.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-text-muted">
          {showArchived ? 'No archived schools.' : 'No schools yet.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSchools.map((school) => {
            const s = stats[school.id]
            const isArchived = !!school.archived_at
            return (
              <div key={school.id} className={`glass-card p-5 ${isArchived ? 'opacity-75' : ''}`}>
                <button
                  onClick={() => handleSchoolClick(school)}
                  disabled={isArchived}
                  className={`block w-full text-left ${isArchived ? 'cursor-default' : ''}`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                      <Building2 className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-text">{school.name}</h3>
                      <p className="text-xs text-text-light">{school.slug}</p>
                    </div>
                    {isArchived && (
                      <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                        Archived
                      </span>
                    )}
                  </div>

                  {loadingStats ? (
                    <div className="flex items-center gap-2 text-xs text-text-light">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading stats...
                    </div>
                  ) : s ? (
                    <div className="flex gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {s.studentCount} learners
                      </span>
                      <span className="flex items-center gap-1">
                        <School className="h-3.5 w-3.5" /> {s.classroomCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" /> {s.educatorCount}
                      </span>
                    </div>
                  ) : null}
                </button>

                <div className="mt-4 border-t border-bg-muted pt-3">
                  {isArchived ? (
                    <button
                      onClick={() => handleUnarchive(school)}
                      disabled={busyId === school.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      {busyId === school.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      )}
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchive(school)}
                      disabled={busyId === school.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-alert-500 disabled:opacity-50"
                    >
                      {busyId === school.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

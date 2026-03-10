import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Building2, Plus, Users, School, UserCheck, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { School as SchoolType } from '../../types/database'

interface SchoolStats {
  school: SchoolType
  studentCount: number
  classroomCount: number
  educatorCount: number
}

export default function Schools() {
  const { allSchools, setActiveSchool } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Record<string, SchoolStats>>({})
  const [loadingStats, setLoadingStats] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSchoolName, setNewSchoolName] = useState('')
  const [newSchoolSlug, setNewSchoolSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Load stats for all schools on mount
  useState(() => {
    async function loadStats() {
      setLoadingStats(true)
      const result: Record<string, SchoolStats> = {}
      for (const school of allSchools) {
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
  })

  function handleSchoolClick(schoolId: string) {
    setActiveSchool(schoolId)
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Schools</h1>
          <p className="mt-1 text-sm text-text-muted">
            {allSchools.length} school{allSchools.length !== 1 ? 's' : ''} in the platform
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

      {/* Create school form */}
      {showCreateForm && (
        <div className="mb-6 rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
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

      {/* School cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allSchools.map((school) => {
          const s = stats[school.id]
          return (
            <button
              key={school.id}
              onClick={() => handleSchoolClick(school.id)}
              className="rounded-xl border border-bg-muted bg-bg-card p-5 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <Building2 className="h-5 w-5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-text">{school.name}</h3>
                  <p className="text-xs text-text-light">{school.slug}</p>
                </div>
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
          )
        })}
      </div>
    </div>
  )
}

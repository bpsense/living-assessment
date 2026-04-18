import { useAuth } from '../../lib/auth'
import { Building2, Users, UserCheck, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function SystemDashboard() {
  const { allSchools, setActiveSchool } = useAuth()
  const navigate = useNavigate()

  function handleSchoolClick(schoolId: string) {
    setActiveSchool(schoolId)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">System Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          Managing {allSchools.length} school{allSchools.length !== 1 ? 's' : ''} across the platform
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Building2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">{allSchools.length}</p>
              <p className="text-xs text-text-muted">Schools</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100">
              <Users className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Total Learners</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100">
              <UserCheck className="h-5 w-5 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">—</p>
              <p className="text-xs text-text-muted">Total Educators</p>
            </div>
          </div>
        </div>
      </div>

      {/* School list */}
      <div className="glass-card">
        <div className="border-b border-bg-muted px-5 py-3">
          <h2 className="font-semibold text-text">Schools</h2>
        </div>
        <div className="divide-y divide-bg-muted">
          {allSchools.map((school) => (
            <button
              key={school.id}
              onClick={() => handleSchoolClick(school.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100">
                  <Building2 className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-text">{school.name}</p>
                  <p className="text-xs text-text-light">{school.slug}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-light" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  useEducatorDashboard,
  useParentDashboard,
  useAdminDashboard,
} from '../lib/dashboard-data'
import EducatorDashboard from '../components/dashboard/EducatorDashboard'
import ParentDashboard from '../components/dashboard/ParentDashboard'
import AdminDashboard from '../components/dashboard/AdminDashboard'
import SystemDashboard from './system/SystemDashboard'
import LearnerProfile from './LearnerProfile'

// ============================================================
// Role-specific wrappers (each calls its own data hook)
// ============================================================

function EducatorView() {
  const { profile, viewAsUserId, viewAsUserName } = useAuth()
  const data = useEducatorDashboard(profile, viewAsUserId ?? undefined)

  if (data.loading) return <DashboardSkeleton />
  if (data.error) return <DashboardError message={data.error} />

  return (
    <EducatorDashboard
      data={data}
      userName={viewAsUserName ?? profile?.full_name ?? 'Educator'}
    />
  )
}

function ParentView() {
  const { profile, viewAsUserId, viewAsUserName } = useAuth()
  const data = useParentDashboard(profile, viewAsUserId ?? undefined)

  if (data.loading) return <DashboardSkeleton />
  if (data.error) return <DashboardError message={data.error} />

  return (
    <ParentDashboard
      data={data}
      userName={viewAsUserName ?? profile?.full_name ?? 'Family'}
    />
  )
}

function AdminView() {
  const { profile } = useAuth()
  const data = useAdminDashboard(profile)

  if (data.loading) return <DashboardSkeleton />
  if (data.error) return <DashboardError message={data.error} />

  return <AdminDashboard data={data} />
}

// ============================================================
// Shared loading / error states
// ============================================================

function DashboardSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-text-muted">Loading your dashboard...</p>
      </div>
    </div>
  )
}

function DashboardError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-text">
          Something went wrong
        </p>
        <p className="mt-1 text-sm text-text-muted">{message}</p>
      </div>
    </div>
  )
}

/**
 * Shown when the user is authenticated but no profile was found.
 * Offers a retry (calls ensure_user_setup RPC) and a sign-out button.
 */
function ProfileSetupNeeded() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  async function handleRetry() {
    setRetrying(true)
    setRetryError(null)
    try {
      const { error } = await supabase.rpc('ensure_user_setup')
      if (error) {
        setRetryError(error.message)
      } else {
        // Reload the page to re-trigger profile fetch
        window.location.reload()
      }
    } catch {
      setRetryError('Could not create profile. Make sure migrations have been applied.')
    }
    setRetrying(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-accent-500" />
        <h2 className="mt-3 text-lg font-semibold text-text">
          Account Setup Required
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Your profile couldn't be loaded
          {user?.email ? <> for <strong className="text-text">{user.email}</strong></> : ''}.
          This usually means the database migrations haven't been applied yet.
        </p>

        {retryError && (
          <div className="mt-3 rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
            {retryError}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-bg-muted p-4 text-left text-xs text-text-muted">
          <p className="mb-2 font-semibold text-text">Run in Supabase SQL Editor:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Open your Supabase Dashboard → SQL Editor</li>
            <li>Run migration <code className="rounded bg-bg px-1 py-0.5 text-primary-700">009_fix_ensure_user_setup.sql</code></li>
            <li>Click "Retry Setup" below or sign out and sign back in</li>
          </ol>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry Setup
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-bg-muted bg-bg-card px-5 py-2.5 text-sm font-medium text-text hover:bg-bg-muted"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main page – delegates to the right view
// ============================================================

export default function Dashboard() {
  const { profile, loading, user, isSystemAdmin, activeSchoolId, isImpersonating } = useAuth()

  // Still checking auth / fetching profile
  if (loading) {
    return <DashboardSkeleton />
  }

  // Authenticated but no profile — show setup instructions
  if (user && !profile) {
    return <ProfileSetupNeeded />
  }

  // Not authenticated (shouldn't happen if ProtectedRoute works)
  if (!profile) {
    return <DashboardSkeleton />
  }

  // System admin home = the All-Schools system dashboard, but only when they
  // haven't entered a school or stepped into a user's view.
  if (isSystemAdmin && activeSchoolId === null && !isImpersonating) {
    return <SystemDashboard />
  }

  // Otherwise render the dashboard for the EFFECTIVE role — so impersonation
  // (profile is swapped to the impersonated user) and a system admin browsing a
  // specific school (profile.role = their own admin role) both resolve here.
  switch (profile.role) {
    case 'admin':
      return <AdminView />
    case 'parent':
      return <ParentView />
    case 'learner':
      return <LearnerProfile />
    case 'educator':
    default:
      return <EducatorView />
  }
}

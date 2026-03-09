import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Loader2, ShieldX } from 'lucide-react'
import type { UserRole } from '../types/database'

interface Props {
  children: React.ReactNode
  requiredRole?: UserRole
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, profile, actualRole, loading, isSystemAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // System admins can access any admin-required route
  if (requiredRole && actualRole !== requiredRole && !isSystemAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-alert-50">
            <ShieldX className="h-8 w-8 text-alert-500" />
          </div>
          <h1 className="text-xl font-bold text-text">Access Denied</h1>
          <p className="mt-2 text-sm text-text-muted">
            You don't have permission to view this page.
          </p>
          <p className="mt-1 text-xs text-text-light">
            Required role: <span className="font-medium">{requiredRole}</span>
            {profile && <> &middot; Your role: <span className="font-medium">{profile.role}</span></>}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

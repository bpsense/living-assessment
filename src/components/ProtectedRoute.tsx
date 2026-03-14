import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useDepartmentLabel } from '../lib/department-label'
import { Loader2, ShieldX } from 'lucide-react'
import type { UserRole, AccessLevel } from '../types/database'

function useAccessLevelLabels(): Record<number, string> {
  const { singular } = useDepartmentLabel()
  return {
    1: 'Learner',
    2: 'Family',
    3: 'Educator',
    4: `${singular} Admin`,
    5: 'School Admin',
    6: 'System Admin',
  }
}

interface Props {
  children: React.ReactNode
  /** Requires this exact role (system admins always pass) — legacy, prefer minAccessLevel */
  requiredRole?: UserRole
  /** Minimum numeric access level required (6=sysadmin → 1=learner) */
  minAccessLevel?: AccessLevel
  /** Also allow department admins to access this route */
  allowDepartmentAdmin?: boolean
  /** Also allow parents to access this route */
  allowParent?: boolean
}

export default function ProtectedRoute({
  children,
  requiredRole,
  minAccessLevel,
  allowDepartmentAdmin,
  allowParent,
}: Props) {
  const { user, profile, actualRole, loading, isSystemAdmin, isDepartmentAdmin, accessLevel } = useAuth()
  const ACCESS_LEVEL_LABELS = useAccessLevelLabels()

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

  // New: numeric access level check
  if (minAccessLevel && accessLevel < minAccessLevel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-alert-50">
            <ShieldX className="h-8 w-8 text-alert-500" />
          </div>
          <h1 className="text-xl font-bold text-text">Access Denied</h1>
          <p className="mt-2 text-sm text-text-muted">
            You don&apos;t have permission to view this page.
          </p>
          <p className="mt-1 text-xs text-text-light">
            Required: <span className="font-medium">{ACCESS_LEVEL_LABELS[minAccessLevel] ?? `Level ${minAccessLevel}`}</span>
            {profile && <> &middot; Your level: <span className="font-medium">{ACCESS_LEVEL_LABELS[accessLevel] ?? `Level ${accessLevel}`}</span></>}
          </p>
        </div>
      </div>
    )
  }

  // Legacy: role-based check (backward compatible)
  if (requiredRole && actualRole !== requiredRole && !isSystemAdmin) {
    // Check if department admin is allowed
    if (allowDepartmentAdmin && isDepartmentAdmin) {
      return <>{children}</>
    }
    // Check if parent is allowed
    if (allowParent && actualRole === 'parent') {
      return <>{children}</>
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-alert-50">
            <ShieldX className="h-8 w-8 text-alert-500" />
          </div>
          <h1 className="text-xl font-bold text-text">Access Denied</h1>
          <p className="mt-2 text-sm text-text-muted">
            You don&apos;t have permission to view this page.
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

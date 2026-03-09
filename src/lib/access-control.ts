/**
 * access-control.ts
 * Centralized access control hook for role-based visibility.
 * All permission checks in one place for consistency.
 */

import { useAuth } from './auth'
import type { UserRole } from '../types/database'

export interface AccessControl {
  /** The effective role (may be overridden by viewAsRole) */
  role: UserRole
  /** The user's actual role from the database */
  actualRole: UserRole | null
  isSystemAdmin: boolean
  isDepartmentAdmin: boolean
  departmentAdminIds: string[]
  /** Can create/edit/delete students */
  canEditStudents: boolean
  /** Can create/edit/delete classrooms */
  canEditClassrooms: boolean
  /** Can view all students in the school (not scoped) */
  canViewAllStudents: boolean
  /** Can view the school profile page */
  canViewSchoolProfile: boolean
  /** Can edit school profile fields */
  canEditSchoolProfile: boolean
  /** Can view the families page */
  canViewFamilies: boolean
  /** Can invite users */
  canInviteUsers: boolean
  /** Can manage dimensions */
  canManageDimensions: boolean
  /** Can manage standards */
  canManageStandards: boolean
  /** Is the current view read-only (e.g., parent or impersonation) */
  isReadOnly: boolean
  /** Format a student name based on role privacy rules */
  formatStudentName: (firstName: string, lastName: string) => string
}

export function useAccessControl(): AccessControl {
  const {
    profile,
    actualRole,
    isSystemAdmin,
    isDepartmentAdmin,
    departmentAdminIds,
    viewAsUserId,
  } = useAuth()

  const role = profile?.role ?? 'educator'
  const isImpersonating = !!viewAsUserId

  // Admin-level = school admin or system admin
  const isAdminLevel = role === 'admin' || isSystemAdmin

  return {
    role,
    actualRole,
    isSystemAdmin,
    isDepartmentAdmin,
    departmentAdminIds,

    canEditStudents: isAdminLevel || role === 'educator',
    canEditClassrooms: isAdminLevel,
    canViewAllStudents: isAdminLevel,
    canViewSchoolProfile: true, // All roles can view (with filtering)
    canEditSchoolProfile: isAdminLevel,
    canViewFamilies: isAdminLevel || isDepartmentAdmin,
    canInviteUsers: isAdminLevel,
    canManageDimensions: isAdminLevel,
    canManageStandards: isAdminLevel,
    isReadOnly: role === 'parent' || isImpersonating,

    formatStudentName: (firstName: string, lastName: string) => {
      // Parents see "First L." for privacy
      if (role === 'parent') {
        return `${firstName} ${lastName.charAt(0)}.`
      }
      return `${firstName} ${lastName}`
    },
  }
}

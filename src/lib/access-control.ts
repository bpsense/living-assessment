/**
 * access-control.ts
 * Centralized access control hook for role-based visibility.
 * Uses numeric AccessLevel (6=sysadmin → 1=learner) for hierarchy checks.
 */

import { useAuth } from './auth'
import type { UserRole, AccessLevel } from '../types/database'

export interface AccessControl {
  /** The effective role (may be overridden by viewAsRole) */
  role: UserRole
  /** The user's actual role from the database */
  actualRole: UserRole | null
  /** Numeric access level of the ACTUAL user: 6=sysadmin, 5=school_admin, 4=dept_admin, 3=educator, 2=parent, 1=learner */
  accessLevel: AccessLevel
  /** Access level of the role being VIEWED — equals accessLevel unless impersonating */
  effectiveAccessLevel: AccessLevel
  isSystemAdmin: boolean
  isDepartmentAdmin: boolean
  departmentAdminIds: string[]
  /** Can create/edit/delete students */
  canEditStudents: boolean
  /** Can create/edit/delete classrooms */
  canEditClassrooms: boolean
  /** Can view all students in the school (not scoped) */
  canViewAllStudents: boolean
  /** Can import students via CSV (location/dept admin and up) */
  canImportStudents: boolean
  /** Can export reports — class CSV + per-student report (location/dept admin and up) */
  canExportReports: boolean
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
  /** Can manage (CRUD) other users */
  canManageUsers: boolean
  /** Can deactivate/reactivate users */
  canDeactivateUsers: boolean
  /** Can change user roles */
  canChangeRoles: boolean
  /** Can use the "View As" role switcher */
  canViewAsOtherRole: boolean
  /** Is the current view read-only (e.g., parent, learner, or impersonation) */
  isReadOnly: boolean
  /** Check if user can manage a target at the given access level */
  canManageUser: (targetLevel: AccessLevel) => boolean
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
    accessLevel,
    effectiveAccessLevel,
    isImpersonating,
  } = useAuth()

  const role = profile?.role ?? 'educator'
  // While impersonating, the view is read-only (writes would run as the actual
  // user, not the impersonated one), so every WRITE affordance is suppressed.
  // VIEW affordances follow the impersonated role's level so the screen matches
  // what that user would actually see.
  const canWrite = !isImpersonating

  return {
    role,
    actualRole,
    accessLevel,
    effectiveAccessLevel,
    isSystemAdmin,
    isDepartmentAdmin,
    departmentAdminIds,

    // ---- WRITE affordances: suppressed while impersonating ----
    canEditStudents: canWrite && effectiveAccessLevel >= 3,
    canEditClassrooms: canWrite && effectiveAccessLevel >= 5,
    canImportStudents: canWrite && effectiveAccessLevel >= 4,
    canEditSchoolProfile: canWrite && effectiveAccessLevel >= 5,
    canInviteUsers: canWrite && effectiveAccessLevel >= 4,
    canManageDimensions: canWrite && effectiveAccessLevel >= 5,
    canManageStandards: canWrite && effectiveAccessLevel >= 5,
    canManageUsers: canWrite && effectiveAccessLevel >= 4,
    canDeactivateUsers: canWrite && effectiveAccessLevel >= 4,
    canChangeRoles: canWrite && effectiveAccessLevel >= 4,

    // ---- VIEW affordances: follow the role being viewed ----
    canViewAllStudents: effectiveAccessLevel >= 4,
    canExportReports: effectiveAccessLevel >= 4,
    canViewSchoolProfile: true,
    canViewFamilies: effectiveAccessLevel >= 4,

    // Only the ACTUAL user's level decides whether the view-as switcher exists.
    canViewAsOtherRole: accessLevel >= 5,
    // Parent, learner, or any impersonation = read-only.
    isReadOnly: effectiveAccessLevel <= 2 || isImpersonating,

    canManageUser: (targetLevel: AccessLevel) => effectiveAccessLevel > targetLevel,

    formatStudentName: (firstName: string, lastName: string) => {
      // Parents and learners see "First L." for privacy
      if (role === 'parent' || role === 'learner') {
        return `${firstName} ${lastName.charAt(0)}.`
      }
      return `${firstName} ${lastName}`
    },
  }
}

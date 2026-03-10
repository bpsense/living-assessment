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
  /** Numeric access level: 6=sysadmin, 5=school_admin, 4=dept_admin, 3=educator, 2=parent, 1=learner */
  accessLevel: AccessLevel
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
    viewAsUserId,
    accessLevel,
  } = useAuth()

  const role = profile?.role ?? 'educator'
  const isImpersonating = !!viewAsUserId

  return {
    role,
    actualRole,
    accessLevel,
    isSystemAdmin,
    isDepartmentAdmin,
    departmentAdminIds,

    // Level 3+ (educator and up) can edit students
    canEditStudents: accessLevel >= 3,
    // Level 5+ (school admin and up) can edit classrooms
    canEditClassrooms: accessLevel >= 5,
    // Level 4+ (dept admin and up) can view all students (within their scope)
    canViewAllStudents: accessLevel >= 4,
    // Everyone can view school profile (with filtering)
    canViewSchoolProfile: true,
    // Level 5+ (school admin and up) can edit school profile
    canEditSchoolProfile: accessLevel >= 5,
    // Level 4+ (dept admin and up) can view families
    canViewFamilies: accessLevel >= 4,
    // Level 4+ (dept admin and up) can invite users
    canInviteUsers: accessLevel >= 4,
    // Level 5+ (school admin and up) can manage dimensions
    canManageDimensions: accessLevel >= 5,
    // Level 5+ (school admin and up) can manage standards
    canManageStandards: accessLevel >= 5,
    // Level 4+ (dept admin and up) can manage users
    canManageUsers: accessLevel >= 4,
    // Level 4+ can deactivate users below them
    canDeactivateUsers: accessLevel >= 4,
    // Level 4+ (dept admin and up) can change roles of users below them
    canChangeRoles: accessLevel >= 4,
    // Level 5+ can use view-as
    canViewAsOtherRole: accessLevel >= 5,
    // Parent, learner, or impersonation mode = read-only
    isReadOnly: accessLevel <= 2 || isImpersonating,

    canManageUser: (targetLevel: AccessLevel) => accessLevel > targetLevel,

    formatStudentName: (firstName: string, lastName: string) => {
      // Parents and learners see "First L." for privacy
      if (role === 'parent' || role === 'learner') {
        return `${firstName} ${lastName.charAt(0)}.`
      }
      return `${firstName} ${lastName}`
    },
  }
}

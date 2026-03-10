import { useAuth } from './auth'

/**
 * Returns the effective school ID for data queries.
 * - For system admins: returns their currently selected school (or undefined for "All" view)
 * - For regular users: returns their profile's school_id
 */
export function useActiveSchoolId(): string | undefined {
  const { profile, isSystemAdmin, activeSchoolId } = useAuth()
  if (isSystemAdmin && activeSchoolId) return activeSchoolId
  return profile?.school_id
}

/**
 * Returns true when the system admin is viewing the "All Schools" aggregate view
 * (i.e. no specific school is selected).
 */
export function useIsAllSchoolsView(): boolean {
  const { isSystemAdmin, activeSchoolId } = useAuth()
  return isSystemAdmin && activeSchoolId === null
}

/**
 * user-management.ts
 * CRUD hooks for user management: list, edit, deactivate, change role.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Profile, UserRole, AccessLevel } from '../types/database'

export interface ManagedUser extends Profile {
  school_name: string | null
  is_system_admin: boolean
  is_department_admin: boolean
  department_names: string[]
  department_ids: string[]
  classroom_names: string[]
  /** Computed access level for this user */
  computed_access_level: AccessLevel
}

/** Compute access level for a user row */
function computeAccessLevel(
  role: UserRole,
  isSysAdmin: boolean,
  isDeptAdmin: boolean
): AccessLevel {
  if (isSysAdmin) return 6
  if (role === 'admin') return 5
  if (role === 'educator') return isDeptAdmin ? 4 : 3
  if (role === 'parent') return 2
  if (role === 'learner') return 1
  return 1
}

interface UserFilters {
  schoolId?: string | null
  role?: UserRole | null
  search?: string
  includeInactive?: boolean
  /** When provided, scope results to only users within these department IDs (for dept admins) */
  departmentIds?: string[]
}

export function useUserManagement(filters: UserFilters = {}) {
  const { accessLevel, isSystemAdmin, profile } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // ── Department scoping: compute visible user IDs when dept admin ──
      let scopedUserIds: string[] | null = null
      if (filters.departmentIds && filters.departmentIds.length > 0) {
        // 1. Get classrooms in the caller's departments
        const { data: deptClassrooms } = await supabase
          .from('classrooms')
          .select('id')
          .in('department_id', filters.departmentIds)

        const classroomIds = (deptClassrooms ?? []).map((c: { id: string }) => c.id)

        if (classroomIds.length === 0) {
          // No classrooms in these departments — show empty list
          setUsers([])
          setLoading(false)
          return
        }

        // 2. Get educators assigned to those classrooms
        const { data: educatorRows } = await supabase
          .from('educator_classrooms')
          .select('educator_id')
          .in('classroom_id', classroomIds)

        const educatorIds = [...new Set((educatorRows ?? []).map(
          (e: { educator_id: string }) => e.educator_id
        ))]

        // 3. Get students in those classrooms
        const { data: studentRows } = await supabase
          .from('students')
          .select('id')
          .in('classroom_id', classroomIds)

        const studentIds = (studentRows ?? []).map((s: { id: string }) => s.id)

        // 4. Get parents linked to those students
        let parentIds: string[] = []
        if (studentIds.length > 0) {
          const { data: parentRows } = await supabase
            .from('parent_students')
            .select('parent_id')
            .in('student_id', studentIds)

          parentIds = [...new Set((parentRows ?? []).map(
            (p: { parent_id: string }) => p.parent_id
          ))]
        }

        // 5. Get learner profiles linked to those students
        let learnerProfileIds: string[] = []
        if (studentIds.length > 0) {
          const { data: learnerProfiles } = await supabase
            .from('profiles')
            .select('id')
            .in('student_id', studentIds)

          learnerProfileIds = (learnerProfiles ?? []).map((l: { id: string }) => l.id)
        }

        // Combine all visible user IDs (include the caller themselves)
        const allVisibleIds = new Set([...educatorIds, ...parentIds, ...learnerProfileIds])
        if (profile?.id) allVisibleIds.add(profile.id)
        scopedUserIds = [...allVisibleIds]

        if (scopedUserIds.length === 0) {
          setUsers([])
          setLoading(false)
          return
        }
      }

      // Base query: profiles with school name
      let query = supabase
        .from('profiles')
        .select(`
          *,
          schools!inner(name)
        `)
        .order('full_name')

      // Apply department scoping if computed
      if (scopedUserIds) {
        query = query.in('id', scopedUserIds)
      }

      // Filter by school unless system admin viewing all
      if (filters.schoolId) {
        query = query.eq('school_id', filters.schoolId)
      } else if (!isSystemAdmin && profile?.school_id) {
        query = query.eq('school_id', profile.school_id)
      }

      // Filter by role
      if (filters.role) {
        query = query.eq('role', filters.role)
      }

      // Filter by active status
      if (!filters.includeInactive) {
        query = query.eq('is_active', true)
      }

      // Search by name or email
      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      const { data: profilesData, error: profilesError } = await query

      if (profilesError) {
        setError(profilesError.message)
        setUsers([])
        return
      }

      if (!profilesData || profilesData.length === 0) {
        setUsers([])
        return
      }

      // Fetch system admin status for all users
      const userIds = profilesData.map((p: { id: string }) => p.id)
      const { data: sysAdmins } = await supabase
        .from('system_admins')
        .select('user_id')
        .in('user_id', userIds)

      const sysAdminSet = new Set((sysAdmins ?? []).map((s: { user_id: string }) => s.user_id))

      // Fetch department admin status
      const { data: deptAdmins } = await supabase
        .from('department_admins')
        .select('user_id, department_id, departments(name)')
        .in('user_id', userIds)

      const deptAdminMap = new Map<string, { id: string; name: string }[]>()
      for (const da of deptAdmins ?? []) {
        const uid = (da as { user_id: string }).user_id
        const deptId = (da as { department_id: string }).department_id
        const deptName = (da as unknown as { departments: { name: string } | null }).departments?.name
        if (!deptAdminMap.has(uid)) deptAdminMap.set(uid, [])
        if (deptId && deptName) deptAdminMap.get(uid)!.push({ id: deptId, name: deptName })
      }

      // Fetch classroom assignments for educators
      const educatorIds = profilesData
        .filter((p: { role: string }) => p.role === 'educator')
        .map((p: { id: string }) => p.id)

      const classroomMap = new Map<string, string[]>()
      if (educatorIds.length > 0) {
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('educator_id, classrooms(name)')
          .in('educator_id', educatorIds)

        for (const ec of ecData ?? []) {
          const eid = (ec as { educator_id: string }).educator_id
          const cName = (ec as unknown as { classrooms: { name: string } | null }).classrooms?.name
          if (!classroomMap.has(eid)) classroomMap.set(eid, [])
          if (cName) classroomMap.get(eid)!.push(cName)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: ManagedUser[] = profilesData.map((p: any) => {
        const isSysAdmin = sysAdminSet.has(p.id)
        const isDeptAdmin = deptAdminMap.has(p.id)
        return {
          ...p,
          school_name: p.schools?.name ?? null,
          is_system_admin: isSysAdmin,
          is_department_admin: isDeptAdmin && (deptAdminMap.get(p.id)?.length ?? 0) > 0,
          department_names: (deptAdminMap.get(p.id) ?? []).map(d => d.name),
          department_ids: (deptAdminMap.get(p.id) ?? []).map(d => d.id),
          classroom_names: classroomMap.get(p.id) ?? [],
          computed_access_level: computeAccessLevel(p.role, isSysAdmin, isDeptAdmin),
        }
      })

      // System admins only appear in the "All Schools" view (no school filter).
      // They oversee all schools and aren't "inside" any specific one.
      const isAllSchoolsView = isSystemAdmin && !filters.schoolId
      setUsers(isAllSchoolsView ? mapped : mapped.filter(u => !u.is_system_admin))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [filters.schoolId, filters.role, filters.search, filters.includeInactive, filters.departmentIds, isSystemAdmin, profile?.school_id, profile?.id])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  /** Update a user's profile (name, email) */
  const updateProfile = useCallback(async (userId: string, updates: { full_name?: string; email?: string }) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [fetchUsers])

  /** Change a user's role */
  const changeRole = useCallback(async (userId: string, newRole: UserRole) => {
    // Client-side validation: can only manage users below your level
    const targetUser = users.find(u => u.id === userId)
    if (targetUser && targetUser.computed_access_level >= accessLevel) {
      return { error: 'Cannot change role of a user at or above your access level' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [users, accessLevel, fetchUsers])

  /** Deactivate a user (soft delete) */
  const deactivateUser = useCallback(async (userId: string) => {
    const targetUser = users.find(u => u.id === userId)
    if (targetUser && targetUser.computed_access_level >= accessLevel) {
      return { error: 'Cannot deactivate a user at or above your access level' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [users, accessLevel, fetchUsers])

  /** Reactivate a user */
  const reactivateUser = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId)

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [fetchUsers])

  /** Assign a user as department admin */
  const assignToDepartment = useCallback(async (userId: string, departmentId: string, schoolId: string) => {
    const { error } = await supabase
      .from('department_admins')
      .upsert({ user_id: userId, department_id: departmentId, school_id: schoolId }, { onConflict: 'user_id,department_id' })

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [fetchUsers])

  /** Remove department admin assignment */
  const removeFromDepartment = useCallback(async (userId: string, departmentId: string) => {
    const { error } = await supabase
      .from('department_admins')
      .delete()
      .eq('user_id', userId)
      .eq('department_id', departmentId)

    if (!error) await fetchUsers()
    return { error: error?.message ?? null }
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    refresh: fetchUsers,
    updateProfile,
    changeRole,
    deactivateUser,
    reactivateUser,
    assignToDepartment,
    removeFromDepartment,
  }
}

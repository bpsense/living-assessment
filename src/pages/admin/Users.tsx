/**
 * Users.tsx — Unified user management page.
 * System admins: see all users across schools.
 * School admins: see all users in their school.
 * Dept admins: see educators/families/learners in their department scope.
 */

import { useState, useCallback } from 'react'
import {
  Users as UsersIcon,
  Search,
  UserX,
  UserCheck,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Shield,
  MapPin,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAccessControl } from '../../lib/access-control'
import { useUserManagement, type ManagedUser } from '../../lib/user-management'
import { useActiveSchoolId } from '../../lib/school-context'
import type { UserRole, AccessLevel } from '../../types/database'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'educator', label: 'Educator' },
  { value: 'parent', label: 'Family' },
  { value: 'learner', label: 'Learner' },
]

const ACCESS_LEVEL_LABELS: Record<number, string> = {
  1: 'Learner',
  2: 'Family',
  3: 'Educator',
  4: 'Dept Admin',
  5: 'School Admin',
  6: 'System Admin',
}

const ACCESS_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-accent-50 text-accent-700',
  3: 'bg-blue-50 text-blue-700',
  4: 'bg-purple-50 text-purple-700',
  5: 'bg-primary-50 text-primary-700',
  6: 'bg-alert-50 text-alert-700',
}

export default function UsersPage() {
  const { isSystemAdmin, allSchools } = useAuth()
  const { accessLevel, canChangeRoles, canDeactivateUsers, canManageUser } = useAccessControl()
  const activeSchoolId = useActiveSchoolId() ?? null

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Editing state
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('educator')

  const {
    users,
    loading,
    error,
    updateProfile,
    changeRole,
    deactivateUser,
    reactivateUser,
  } = useUserManagement({
    schoolId: activeSchoolId,
    role: roleFilter,
    search: search || undefined,
    includeInactive: showInactive,
  })

  const handleDeactivate = useCallback(async (userId: string) => {
    setActionLoading(userId)
    setActionError(null)
    const result = await deactivateUser(userId)
    if (result.error) setActionError(result.error)
    setActionLoading(null)
  }, [deactivateUser])

  const handleReactivate = useCallback(async (userId: string) => {
    setActionLoading(userId)
    setActionError(null)
    const result = await reactivateUser(userId)
    if (result.error) setActionError(result.error)
    setActionLoading(null)
  }, [reactivateUser])

  const startEditing = (user: ManagedUser) => {
    setEditingUser(user.id)
    setEditName(user.full_name)
    setEditRole(user.role)
  }

  const cancelEditing = () => {
    setEditingUser(null)
    setEditName('')
  }

  const saveEditing = useCallback(async (user: ManagedUser) => {
    setActionLoading(user.id)
    setActionError(null)

    // Update name if changed
    if (editName !== user.full_name) {
      const result = await updateProfile(user.id, { full_name: editName })
      if (result.error) {
        setActionError(result.error)
        setActionLoading(null)
        return
      }
    }

    // Update role if changed
    if (editRole !== user.role) {
      const result = await changeRole(user.id, editRole)
      if (result.error) {
        setActionError(result.error)
        setActionLoading(null)
        return
      }
    }

    setEditingUser(null)
    setActionLoading(null)
  }, [editName, editRole, updateProfile, changeRole])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">User Management</h1>
        <p className="mt-1 text-sm text-text-muted">
          {isSystemAdmin && !activeSchoolId
            ? 'All users across all schools'
            : 'Manage users in this school'}
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-bg-muted bg-bg-card py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
          />
        </div>

        {/* Role filter */}
        <div className="relative">
          <select
            value={roleFilter ?? ''}
            onChange={(e) => setRoleFilter(e.target.value ? (e.target.value as UserRole) : null)}
            className="appearance-none rounded-lg border border-bg-muted bg-bg-card py-2 pl-3 pr-8 text-sm text-text focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        </div>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-bg-muted text-primary-500 focus:ring-primary-300"
          />
          Show inactive
        </label>
      </div>

      {/* Error banner */}
      {(error || actionError) && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error || actionError}
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UsersIcon className="mb-3 h-12 w-12 text-text-light" />
          <h3 className="text-lg font-semibold text-text">No users found</h3>
          <p className="mt-1 text-sm text-text-muted">
            {search ? 'Try a different search term' : 'No users match the current filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-muted bg-bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-muted bg-bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Name</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Email</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Role</th>
                {isSystemAdmin && !activeSchoolId && (
                  <th className="px-4 py-3 text-left font-medium text-text-muted">School</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-text-muted">Access Level</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-muted">
              {users.map((user) => {
                const isEditing = editingUser === user.id
                const canManage = canManageUser(user.computed_access_level)
                const isLoading = actionLoading === user.id

                return (
                  <tr key={user.id} className={`transition-colors hover:bg-bg-muted/30 ${!user.is_active ? 'opacity-60' : ''}`}>
                    {/* Name */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-primary-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-text">{user.full_name}</p>
                            {user.department_names.length > 0 && (
                              <p className="flex items-center gap-1 text-xs text-text-light">
                                <MapPin className="h-3 w-3" />
                                {user.department_names.join(', ')}
                              </p>
                            )}
                            {user.classroom_names.length > 0 && (
                              <p className="text-xs text-text-light">
                                {user.classroom_names.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-text-muted">{user.email}</td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {isEditing && canChangeRoles ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="rounded border border-primary-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-300"
                        >
                          {ROLE_OPTIONS.filter(opt => {
                            // Only show roles below the current user's level
                            const optLevel = opt.value === 'admin' ? 5 : opt.value === 'educator' ? 3 : opt.value === 'parent' ? 2 : 1
                            return optLevel < accessLevel
                          }).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize">{user.role}</span>
                      )}
                    </td>

                    {/* School (only for cross-school view) */}
                    {isSystemAdmin && !activeSchoolId && (
                      <td className="px-4 py-3 text-text-muted">{user.school_name ?? '—'}</td>
                    )}

                    {/* Access Level */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ACCESS_LEVEL_COLORS[user.computed_access_level] ?? 'bg-gray-100 text-gray-600'}`}>
                        {user.is_system_admin && <Shield className="h-3 w-3" />}
                        {ACCESS_LEVEL_LABELS[user.computed_access_level] ?? `Level ${user.computed_access_level}`}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? 'bg-success-50 text-success-700' : 'bg-alert-50 text-alert-700'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isLoading ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary-500" />
                      ) : canManage ? (
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEditing(user)}
                                className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="rounded px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-muted"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(user)}
                                className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                              >
                                Edit
                              </button>
                              {canDeactivateUsers && (
                                user.is_active ? (
                                  <button
                                    onClick={() => handleDeactivate(user.id)}
                                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-alert-600 hover:bg-alert-50"
                                  >
                                    <UserX className="h-3 w-3" />
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReactivate(user.id)}
                                    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-success-600 hover:bg-success-50"
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    Reactivate
                                  </button>
                                )
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-text-light">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!loading && users.length > 0 && (
        <p className="text-xs text-text-light">
          Showing {users.length} user{users.length !== 1 ? 's' : ''}
          {showInactive ? ' (including inactive)' : ''}
        </p>
      )}
    </div>
  )
}

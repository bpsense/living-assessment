/**
 * Users.tsx — Unified user management page.
 * System admins: see all users across schools.
 * School admins: see all users in their school.
 * Dept admins: see educators/families/learners in their department scope.
 *
 * Features:
 * - Invite new users at any role (admin, educator, parent, learner)
 * - Inline editing of name and role
 * - Department admin assignment / removal for educators
 * - Deactivate / reactivate users
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Users as UsersIcon,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Shield,
  X,
  Plus,
  KeyRound,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAccessControl } from '../../lib/access-control'
import { useUserManagement, type ManagedUser } from '../../lib/user-management'
import { useActiveSchoolId } from '../../lib/school-context'
import { useDepartmentLabel } from '../../lib/department-label'
import { inviteUser } from '../../lib/invite-user'
import { adminResetPassword } from '../../lib/reset-password'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../types/database'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'School Admin' },
  { value: 'educator', label: 'Educator' },
  { value: 'parent', label: 'Family' },
  { value: 'learner', label: 'Learner' },
]

// Dynamic labels — level 4 label is set in the component via useDepartmentLabel()
const BASE_ACCESS_LEVEL_LABELS: Record<number, string> = {
  1: 'Learner',
  2: 'Family',
  3: 'Educator',
  4: 'Dept Admin', // overridden dynamically
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

/** Minimum access level required to invite a given role */
function minLevelToInvite(role: UserRole): number {
  return role === 'admin' ? 5 : 4
}

export default function UsersPage() {
  const { isSystemAdmin, allSchools, departmentAdminIds, accessLevel: authAccessLevel } = useAuth()
  const { accessLevel, canInviteUsers, canChangeRoles, canDeactivateUsers, canManageUser } = useAccessControl()
  const activeSchoolId = useActiveSchoolId() ?? null
  const { singular: deptSingular } = useDepartmentLabel()
  const ACCESS_LEVEL_LABELS: Record<number, string> = { ...BASE_ACCESS_LEVEL_LABELS, 4: `${deptSingular} Admin` }

  // ── Filters ──────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  // ── Action state ─────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Editing state ────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('educator')

  // ── Invite form state ────────────────────────────────────
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('educator')
  const [inviteDeptId, setInviteDeptId] = useState<string>('')
  const [inviteSchoolId, setInviteSchoolId] = useState<string>('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // ── Learner invite state ───────────────────────────────
  const [learnerLinkMode, setLearnerLinkMode] = useState<'existing' | 'new'>('existing')
  const [inviteStudentId, setInviteStudentId] = useState<string>('')
  const [inviteClassroomId, setInviteClassroomId] = useState<string>('')
  const [unlinkedStudents, setUnlinkedStudents] = useState<{ id: string; first_name: string; last_name: string; classroom_name: string | null }[]>([])
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  // True when system admin is on "All Schools" view — invite is for system admins only
  const isAllSchoolsInvite = isSystemAdmin && !activeSchoolId

  // ── Department data (for invite form + inline management) ──
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [deptDropdownUser, setDeptDropdownUser] = useState<string | null>(null)

  const {
    users,
    loading,
    error,
    refresh,
    updateProfile,
    changeRole,
    deactivateUser,
    reactivateUser,
    assignToDepartment,
    removeFromDepartment,
  } = useUserManagement({
    schoolId: activeSchoolId,
    role: roleFilter,
    search: search || undefined,
    includeInactive: showInactive,
    departmentIds: authAccessLevel === 4 ? departmentAdminIds : undefined,
  })

  // Fetch departments for the current school
  useEffect(() => {
    const schoolId = activeSchoolId
    if (!schoolId) { setDepartments([]); return }
    supabase
      .from('departments')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name')
      .then(({ data }) => setDepartments(data ?? []))
  }, [activeSchoolId])

  // Fetch classrooms + unlinked students when learner role is selected
  useEffect(() => {
    const schoolId = activeSchoolId
    if (!schoolId || inviteRole !== 'learner') {
      setUnlinkedStudents([])
      setClassrooms([])
      return
    }

    // Fetch classrooms
    supabase
      .from('classrooms')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name')
      .then(({ data }) => setClassrooms(data ?? []))

    // Fetch students that don't have a linked learner account
    // A student is "unlinked" if no profile has student_id pointing to it
    const fetchUnlinked = async () => {
      // Get all student IDs that are already linked to profiles
      const { data: linkedProfiles } = await supabase
        .from('profiles')
        .select('student_id')
        .eq('school_id', schoolId)
        .not('student_id', 'is', null)

      const linkedIds = (linkedProfiles ?? []).map(p => p.student_id).filter(Boolean) as string[]

      // Get students NOT in that list
      let query = supabase
        .from('students')
        .select('id, first_name, last_name, classroom:classrooms(name)')
        .eq('school_id', schoolId)
        .eq('student_status', 'active')
        .order('last_name')

      if (linkedIds.length > 0) {
        // Supabase doesn't have a direct "not in" for arrays > 0 items,
        // but we can filter client-side for now
      }

      const { data: students } = await query

      const filtered = (students ?? [])
        .filter(s => !linkedIds.includes(s.id))
        .map(s => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          classroom_name: (s.classroom as any)?.name ?? null,
        }))

      setUnlinkedStudents(filtered)
    }

    fetchUnlinked()
  }, [activeSchoolId, inviteRole])

  // ── Handlers ─────────────────────────────────────────────

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

    if (editName !== user.full_name) {
      const result = await updateProfile(user.id, { full_name: editName })
      if (result.error) { setActionError(result.error); setActionLoading(null); return }
    }

    if (editRole !== user.role) {
      const result = await changeRole(user.id, editRole)
      if (result.error) { setActionError(result.error); setActionLoading(null); return }
    }

    setEditingUser(null)
    setActionLoading(null)
  }, [editName, editRole, updateProfile, changeRole])

  const handleInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const effectiveSchoolId = activeSchoolId || inviteSchoolId
    if (!effectiveSchoolId || !inviteName.trim() || !inviteEmail.trim()) return

    setInviting(true)
    setActionError(null)
    setInviteSuccess(null)

    const { error: err } = await inviteUser({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      schoolId: effectiveSchoolId,
      role: isAllSchoolsInvite ? 'admin' : inviteRole,
      departmentId: !isAllSchoolsInvite && inviteRole === 'admin' && inviteDeptId ? inviteDeptId : undefined,
      isSystemAdmin: isAllSchoolsInvite || undefined,
      studentId: !isAllSchoolsInvite && inviteRole === 'learner' && learnerLinkMode === 'existing' && inviteStudentId ? inviteStudentId : undefined,
      classroomId: !isAllSchoolsInvite && inviteRole === 'learner' && learnerLinkMode === 'new' && inviteClassroomId ? inviteClassroomId : undefined,
    })

    if (err) {
      setActionError(err)
    } else {
      const roleLabel = isAllSchoolsInvite ? 'System Admin' : (ROLE_OPTIONS.find(o => o.value === inviteRole)?.label ?? inviteRole)
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()} as ${roleLabel}`)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('educator')
      setInviteDeptId('')
      setInviteSchoolId('')
      setInviteStudentId('')
      setInviteClassroomId('')
      setLearnerLinkMode('existing')
      setStudentSearch('')
      setShowInvite(false)
      refresh()
    }
    setInviting(false)
  }, [activeSchoolId, inviteSchoolId, isAllSchoolsInvite, inviteName, inviteEmail, inviteRole, inviteDeptId, learnerLinkMode, inviteStudentId, inviteClassroomId, refresh])

  const handleAssignDept = useCallback(async (userId: string, deptId: string) => {
    if (!activeSchoolId) return
    setActionLoading(userId)
    setActionError(null)
    const result = await assignToDepartment(userId, deptId, activeSchoolId)
    if (result.error) setActionError(result.error)
    setDeptDropdownUser(null)
    setActionLoading(null)
  }, [activeSchoolId, assignToDepartment])

  const handleRemoveDept = useCallback(async (userId: string, deptId: string) => {
    setActionLoading(userId)
    setActionError(null)
    const result = await removeFromDepartment(userId, deptId)
    if (result.error) setActionError(result.error)
    setActionLoading(null)
  }, [removeFromDepartment])

  // ── Password reset ──────────────────────────────────────
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const handleResetPassword = useCallback(async (userId: string, userName: string) => {
    setActionLoading(userId)
    setActionError(null)
    setResetSuccess(null)

    const { error: err, email } = await adminResetPassword(userId)
    if (err) {
      setActionError(err)
    } else {
      setResetSuccess(`Password reset email sent to ${email ?? userName}`)
    }
    setActionLoading(null)
  }, [])

  // Roles the current user can invite
  const inviteRoleOptions = ROLE_OPTIONS.filter(opt => accessLevel >= minLevelToInvite(opt.value))

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">User Management</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isSystemAdmin && !activeSchoolId
              ? 'All users across all schools'
              : 'Manage users in this school'}
          </p>
        </div>
        {(canInviteUsers && activeSchoolId) || isAllSchoolsInvite ? (
          <button
            onClick={() => { setShowInvite(v => !v); setInviteSuccess(null); setActionError(null) }}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            {showInvite ? <ChevronUp className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showInvite ? 'Close' : isAllSchoolsInvite ? 'Invite System Admin' : 'Invite User'}
          </button>
        ) : null}
      </div>

      {/* ── Invite form ─────────────────────────────────────── */}
      {showInvite && (activeSchoolId || isAllSchoolsInvite) && (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-text">
            {isAllSchoolsInvite ? 'Invite New System Admin' : 'Invite New User'}
          </h2>
          <div className={`grid gap-4 sm:grid-cols-2 ${isAllSchoolsInvite ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {/* Full Name */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Full Name</label>
              <input
                type="text"
                required
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="jane@school.edu"
                className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
              />
            </div>

            {/* School picker (All Schools invite) */}
            {isAllSchoolsInvite && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Home School</label>
                <div className="relative">
                  <select
                    required
                    value={inviteSchoolId}
                    onChange={e => setInviteSchoolId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 pr-8 text-sm text-text focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                  >
                    <option value="">Select a school…</option>
                    {allSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                </div>
              </div>
            )}

            {/* Role selector (school-scoped invite only) */}
            {!isAllSchoolsInvite && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Role</label>
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={e => { setInviteRole(e.target.value as UserRole); setInviteDeptId('') }}
                    className="w-full appearance-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 pr-8 text-sm text-text focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                  >
                    {inviteRoleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                </div>
              </div>
            )}

            {/* Department picker (only for educators in school-scoped invite) */}
            {!isAllSchoolsInvite && inviteRole === 'admin' && departments.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  {deptSingular} <span className="font-normal text-text-light">(optional — makes them {deptSingular} Admin)</span>
                </label>
                <div className="relative">
                  <select
                    value={inviteDeptId}
                    onChange={e => setInviteDeptId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 pr-8 text-sm text-text focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                  >
                    <option value="">No {deptSingular.toLowerCase()}</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                </div>
              </div>
            )}
          </div>

          {/* Learner linking options (only for learner role) */}
          {!isAllSchoolsInvite && inviteRole === 'learner' && (
            <div className="mt-4 rounded-lg border border-bg-muted bg-bg p-4">
              <p className="mb-3 text-xs font-semibold text-text">Link to Learner Record</p>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setLearnerLinkMode('existing'); setInviteClassroomId('') }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    learnerLinkMode === 'existing'
                      ? 'bg-primary-500 text-white'
                      : 'bg-bg-muted text-text-muted hover:bg-bg-muted/80'
                  }`}
                >
                  Link to Existing Learner
                </button>
                <button
                  type="button"
                  onClick={() => { setLearnerLinkMode('new'); setInviteStudentId('') }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    learnerLinkMode === 'new'
                      ? 'bg-primary-500 text-white'
                      : 'bg-bg-muted text-text-muted hover:bg-bg-muted/80'
                  }`}
                >
                  Create New Learner
                </button>
              </div>

              {learnerLinkMode === 'existing' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Select Learner <span className="font-normal text-text-light">(learners without a linked account)</span>
                  </label>
                  {unlinkedStudents.length === 0 ? (
                    <p className="text-xs text-text-light italic">All learners already have linked accounts</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search learners..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="mb-2 w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                      />
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-bg-muted bg-bg-card">
                        {unlinkedStudents
                          .filter(s => {
                            if (!studentSearch) return true
                            const q = studentSearch.toLowerCase()
                            return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
                          })
                          .map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setInviteStudentId(s.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted ${
                                inviteStudentId === s.id ? 'bg-primary-50 text-primary-700' : 'text-text'
                              }`}
                            >
                              <span className="font-medium">{s.first_name} {s.last_name}</span>
                              {s.classroom_name && (
                                <span className="text-[10px] text-text-light">{s.classroom_name}</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Classroom <span className="font-normal text-text-light">(a learner record will be auto-created)</span>
                  </label>
                  {classrooms.length === 0 ? (
                    <p className="text-xs text-text-light italic">No classrooms available</p>
                  ) : (
                    <div className="relative">
                      <select
                        value={inviteClassroomId}
                        onChange={e => setInviteClassroomId(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-bg-muted bg-bg-card px-3 py-2 pr-8 text-sm text-text focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                      >
                        <option value="">Select a classroom…</option>
                        {classrooms.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={inviting || !inviteName.trim() || !inviteEmail.trim() || (isAllSchoolsInvite && !inviteSchoolId)}
              className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send Invite
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Success banners ────────────────────────────────── */}
      {inviteSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
          <UserCheck className="h-4 w-4 shrink-0" />
          {inviteSuccess}
          <button onClick={() => setInviteSuccess(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {resetSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <KeyRound className="h-4 w-4 shrink-0" />
          {resetSuccess}
          <button onClick={() => setResetSuccess(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Filters bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
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

      {/* ── Error banner ───────────────────────────────────── */}
      {(error || actionError) && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error || actionError}
          {actionError && (
            <button onClick={() => setActionError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Users table ────────────────────────────────────── */}
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
                <th className="px-4 py-3 text-left font-medium text-text-muted">School</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">{deptSingular}</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-muted">
              {users.map((user) => {
                const isEditing = editingUser === user.id
                const canManage = canManageUser(user.computed_access_level)
                const isLoading = actionLoading === user.id
                const isSchoolAdmin = user.role === 'admin'
                const showDeptDropdown = deptDropdownUser === user.id
                const unassignedDepts = departments.filter(d => !user.department_ids.includes(d.id))

                return (
                  <tr key={user.id} className={`transition-colors hover:bg-bg-muted/30 ${!user.is_active ? 'opacity-40 grayscale' : ''}`}>
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
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${user.is_active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-medium ${user.is_active ? 'text-text' : 'text-text-light line-through'}`}>
                              {user.full_name}
                            </p>
                            {/* Classroom names for regular educators (not dept admins) */}
                            {(user.role === 'educator') && user.classroom_names.length > 0 && user.department_names.length === 0 && (
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

                    {/* Role (merged with access level) */}
                    <td className="px-4 py-3">
                      {isEditing && canChangeRoles && canManage ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="rounded border border-primary-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-300"
                        >
                          {ROLE_OPTIONS.filter(opt => {
                            const optLevel = opt.value === 'admin' ? 5 : opt.value === 'educator' ? 3 : opt.value === 'parent' ? 2 : 1
                            return optLevel < accessLevel
                          }).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ACCESS_LEVEL_COLORS[user.computed_access_level] ?? 'bg-gray-100 text-gray-600'}`}>
                          {user.is_system_admin && <Shield className="h-3 w-3" />}
                          {ACCESS_LEVEL_LABELS[user.computed_access_level] ?? `Level ${user.computed_access_level}`}
                        </span>
                      )}
                    </td>

                    {/* School */}
                    <td className="px-4 py-3 text-text-muted">{user.is_system_admin ? 'All Schools' : (user.school_name ?? '—')}</td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      {isSchoolAdmin && user.department_names.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {user.department_ids.map((deptId, i) => (
                            <span key={deptId} className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                              {user.department_names[i]}
                              {canChangeRoles && canManage && (
                                <button
                                  onClick={() => handleRemoveDept(user.id, deptId)}
                                  className="ml-0.5 rounded-full p-0.5 hover:bg-purple-200"
                                  title={`Remove from ${user.department_names[i]}`}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </span>
                          ))}
                          {/* Add department button */}
                          {canChangeRoles && canManage && unassignedDepts.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => setDeptDropdownUser(showDeptDropdown ? null : user.id)}
                                className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-500 hover:bg-purple-100"
                                title={`Add ${deptSingular.toLowerCase()}`}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                              {showDeptDropdown && (
                                <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-bg-muted bg-bg-card py-1 shadow-lg">
                                  {unassignedDepts.map(d => (
                                    <button
                                      key={d.id}
                                      onClick={() => handleAssignDept(user.id, d.id)}
                                      className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-bg-muted"
                                    >
                                      {d.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : isSchoolAdmin && canChangeRoles && canManage && departments.length > 0 ? (
                        <div className="relative">
                          <button
                            onClick={() => setDeptDropdownUser(showDeptDropdown ? null : user.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-700"
                            title={`Assign to ${deptSingular.toLowerCase()}`}
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                          {showDeptDropdown && (
                            <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-bg-muted bg-bg-card py-1 shadow-lg">
                              {departments.map(d => (
                                <button
                                  key={d.id}
                                  onClick={() => handleAssignDept(user.id, d.id)}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-bg-muted"
                                >
                                  {d.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-light">—</span>
                      )}
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
                              <button
                                onClick={() => handleResetPassword(user.id, user.full_name)}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                                title="Send password reset email"
                              >
                                <KeyRound className="h-3 w-3" />
                                Reset PW
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

      {/* ── Summary ────────────────────────────────────────── */}
      {!loading && users.length > 0 && (
        <p className="text-xs text-text-light">
          Showing {users.length} user{users.length !== 1 ? 's' : ''}
          {showInactive ? ' (including inactive)' : ''}
        </p>
      )}
    </div>
  )
}

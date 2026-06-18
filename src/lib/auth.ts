import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, UserRole, AccessLevel, School } from '../types/database'

export interface AuthState {
  user: User | null
  profile: Profile | null
  /** The user's actual role from the database (not affected by viewAsRole) */
  actualRole: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>
  /** True when the user arrived via a password-reset link and needs to set a new password */
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  /** Override the active role for demo/testing — null means use real role */
  viewAsRole: UserRole | null
  setViewAsRole: (role: UserRole | null) => void
  /** The impersonated user's profile ID (read-only view) */
  viewAsUserId: string | null
  /** Display name for the impersonated user */
  viewAsUserName: string | null
  /** Set the view-as role and optionally impersonate a specific user */
  setViewAs: (role: UserRole | null, userId?: string | null, userName?: string | null) => void
  /** Whether the authenticated user is a system admin */
  isSystemAdmin: boolean
  /** Department IDs where the user is a department admin */
  departmentAdminIds: string[]
  /** Whether the user is a department admin for at least one department */
  isDepartmentAdmin: boolean
  /** The currently active school context (for system admins switching schools). Null = "All Schools" view */
  activeSchoolId: string | null
  /** Set the active school (system admin only). Pass null for "All Schools" view */
  setActiveSchool: (schoolId: string | null) => void
  /** List of all schools (populated only for system admins) */
  allSchools: School[]
  /** Numeric access level of the ACTUAL user: 6=sysadmin … 1=learner (unaffected by impersonation) */
  accessLevel: AccessLevel
  /** Access level of the role currently being VIEWED — equals accessLevel unless impersonating */
  effectiveAccessLevel: AccessLevel
  /** True when viewing as another role and/or impersonating a specific user */
  isImpersonating: boolean
  /** The actual authenticated user's id (never swapped by impersonation) */
  actualUserId: string | null
}

/** sessionStorage key for the system-admin view context (active school + impersonation). */
const VIEW_CTX_KEY = 'sproutmap.viewctx'

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [rawProfile, setRawProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null)
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null)
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null)
  /**
   * Departments the IMPERSONATED user (viewAsUserId) admins. Loaded when the
   * impersonated user is an educator, so `isDepartmentAdmin` reflects the
   * person being viewed-as instead of the actual viewer.
   */
  const [viewAsDepartmentAdminIds, setViewAsDepartmentAdminIds] = useState<string[]>([])
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [departmentAdminIds, setDepartmentAdminIds] = useState<string[]>([])
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null)
  const [allSchools, setAllSchools] = useState<School[]>([])
  /**
   * When impersonating a SPECIFIC user, this holds that user's full profile so
   * `profile` reflects their identity (id, school_id, student_id, role) — not
   * just an overridden role. Null for role-only view-as or no impersonation.
   */
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null)
  /** Gates persistence until the saved view context has been restored once. */
  const [restored, setRestored] = useState(false)

  // The effective profile the rest of the app renders against.
  const profile = useMemo(() => {
    if (!rawProfile) return null
    // Full identity swap when impersonating a specific user (their profile loaded).
    if (viewAsUserId && impersonatedProfile && impersonatedProfile.id === viewAsUserId) {
      return impersonatedProfile
    }
    let p = rawProfile
    // Role-only view-as (e.g. the "Admin" pill, no specific user).
    if (viewAsRole && viewAsRole !== rawProfile.role) {
      p = { ...p, role: viewAsRole }
    }
    // System admin browsing a specific school (no impersonation).
    if (isSystemAdmin && activeSchoolId && activeSchoolId !== rawProfile.school_id) {
      p = { ...p, school_id: activeSchoolId }
    }
    return p
  }, [rawProfile, viewAsRole, viewAsUserId, impersonatedProfile, isSystemAdmin, activeSchoolId])

  /**
   * Try to fetch the profile. If it doesn't exist, call the
   * ensure_user_setup RPC to create it (handles the case where
   * the trigger didn't fire, e.g. migration not applied yet).
   */
  const fetchProfile = useCallback(async (userId: string) => {
    // First attempt — direct query
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setRawProfile(data as Profile)

      // Parallel checks: system admin + department admin
      const [sysAdminRes, deptAdminRes] = await Promise.all([
        supabase
          .from('system_admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('department_admins')
          .select('department_id')
          .eq('user_id', userId),
      ])

      const isSysAdmin = !!sysAdminRes.data
      setIsSystemAdmin(isSysAdmin)

      const deptIds = (deptAdminRes.data ?? []).map((d: { department_id: string }) => d.department_id)
      setDepartmentAdminIds(deptIds)

      if (isSysAdmin) {
        // Fetch active (non-archived) schools for the switcher
        const { data: schools } = await supabase
          .from('schools')
          .select('*')
          .is('archived_at', null)
          .order('name')
        setAllSchools((schools as School[]) ?? [])
        // Default to "All Schools" view — system admins start at the platform overview
        setActiveSchoolId(null)
      }
      return
    }

    console.warn('Profile not found, attempting ensure_user_setup RPC...')

    // Fallback — call RPC to create profile + classroom assignments
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_user_setup')

      if (rpcError) {
        console.error('ensure_user_setup RPC failed:', rpcError.message)
        // One more attempt: maybe the function doesn't exist but the profile
        // was just created by the trigger between our first query and now
        const { data: retryData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (retryData) {
          setRawProfile(retryData as Profile)
        } else {
          setRawProfile(null)
        }
        return
      }

      // RPC returns the profile as JSONB
      if (rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
        setRawProfile(rpcData as unknown as Profile)
      } else {
        // Final retry from the table
        const { data: retryData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        setRawProfile(retryData ? (retryData as Profile) : null)
      }
    } catch (err) {
      console.error('Unexpected error in profile setup:', err)
      setRawProfile(null)
    }
  }, [])

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)

        // Detect password-recovery flow — user clicked the reset link in their email
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true)
        }

        if (currentUser) {
          // Don't await — prevents blocking updateUser/signIn resolution
          fetchProfile(currentUser.id).finally(() => setLoading(false))
        } else {
          setRawProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('signOut API call failed, clearing local state anyway:', err)
    }
    // Always clear local state — even if the API call threw
    setUser(null)
    setRawProfile(null)
    setIsPasswordRecovery(false)
    setViewAsRole(null)
    setViewAsUserId(null)
    setViewAsUserName(null)
    setImpersonatedProfile(null)
    setIsSystemAdmin(false)
    setActiveSchoolId(null)
    setAllSchools([])
    try { sessionStorage.removeItem(VIEW_CTX_KEY) } catch { /* ignore */ }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setIsPasswordRecovery(false)
    }
    return { error }
  }, [])

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false)
  }, [])

  const setViewAs = useCallback((role: UserRole | null, userId?: string | null, userName?: string | null) => {
    setViewAsRole(role)
    setViewAsUserId(userId ?? null)
    setViewAsUserName(userName ?? null)
    setViewAsDepartmentAdminIds([])

    if (!userId) {
      // Role-only view-as (or exit) — no specific identity to load.
      setImpersonatedProfile(null)
      return
    }

    // Load the impersonated user's full profile so the app renders as THEM, and
    // pin the active school to theirs (so "be a user" and the school context agree).
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = data as Profile
          setImpersonatedProfile(p)
          if (p.school_id) setActiveSchoolId(p.school_id)
        }
      })

    if (role === 'educator') {
      supabase
        .from('department_admins')
        .select('department_id')
        .eq('user_id', userId)
        .then(({ data }) => {
          setViewAsDepartmentAdminIds(
            (data ?? []).map((d: { department_id: string }) => d.department_id)
          )
        })
    }
  }, [])

  const setActiveSchool = useCallback((schoolId: string | null) => {
    setActiveSchoolId(schoolId)
    // Deliberately switching schools clears any impersonation (the impersonated
    // user belongs to the previous school).
    setViewAsRole(null)
    setViewAsUserId(null)
    setViewAsUserName(null)
    setViewAsDepartmentAdminIds([])
    setImpersonatedProfile(null)
  }, [])

  // Restore the saved view context (active school + impersonation) once, after
  // the real profile + sysadmin status are known. System admins only.
  useEffect(() => {
    if (restored || loading || !rawProfile) return
    if (!isSystemAdmin) {
      setRestored(true)
      return
    }
    try {
      const raw = sessionStorage.getItem(VIEW_CTX_KEY)
      if (raw) {
        const ctx = JSON.parse(raw) as {
          activeSchoolId?: string | null
          viewAsRole?: UserRole | null
          viewAsUserId?: string | null
          viewAsUserName?: string | null
        }
        if (ctx.activeSchoolId) setActiveSchoolId(ctx.activeSchoolId)
        if (ctx.viewAsUserId) {
          setViewAs(ctx.viewAsRole ?? null, ctx.viewAsUserId, ctx.viewAsUserName ?? null)
        } else if (ctx.viewAsRole) {
          setViewAsRole(ctx.viewAsRole)
        }
      }
    } catch {
      /* ignore malformed context */
    }
    setRestored(true)
  }, [restored, loading, rawProfile, isSystemAdmin, setViewAs])

  // Persist the view context so navigation + reloads keep "as user X in school Y".
  useEffect(() => {
    if (!restored) return
    try {
      if (activeSchoolId || viewAsRole || viewAsUserId) {
        sessionStorage.setItem(
          VIEW_CTX_KEY,
          JSON.stringify({ activeSchoolId, viewAsRole, viewAsUserId, viewAsUserName })
        )
      } else {
        sessionStorage.removeItem(VIEW_CTX_KEY)
      }
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [restored, activeSchoolId, viewAsRole, viewAsUserId, viewAsUserName])

  const actualRole = rawProfile?.role ?? null
  const actualUserId = rawProfile?.id ?? user?.id ?? null
  // When impersonating a specific user, reflect THEIR dept admin status.
  // Otherwise fall through to the actual viewer's status.
  const isDepartmentAdmin = viewAsUserId
    ? viewAsDepartmentAdminIds.length > 0
    : departmentAdminIds.length > 0

  const accessLevel: AccessLevel = useMemo(() => {
    if (isSystemAdmin) return 6
    if (actualRole === 'admin') return isDepartmentAdmin ? 4 : 5
    if (actualRole === 'educator') return 3
    if (actualRole === 'parent') return 2
    if (actualRole === 'learner') return 1
    return 1 as AccessLevel
  }, [isSystemAdmin, actualRole, isDepartmentAdmin])

  // The role/level currently being VIEWED. Equals the actual values unless the
  // user is impersonating another role or a specific user.
  const effectiveRole: UserRole = profile?.role ?? actualRole ?? 'educator'
  const isImpersonating = !!viewAsUserId || (!!viewAsRole && viewAsRole !== actualRole)
  const effectiveAccessLevel: AccessLevel = useMemo(() => {
    if (!isImpersonating) return accessLevel
    if (effectiveRole === 'admin') return 5
    if (effectiveRole === 'educator') return isDepartmentAdmin ? 4 : 3
    if (effectiveRole === 'parent') return 2
    if (effectiveRole === 'learner') return 1
    return 1 as AccessLevel
  }, [isImpersonating, effectiveRole, isDepartmentAdmin, accessLevel])

  return {
    user,
    profile,
    actualRole,
    loading,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    isPasswordRecovery,
    clearPasswordRecovery,
    viewAsRole,
    setViewAsRole,
    viewAsUserId,
    viewAsUserName,
    setViewAs,
    isSystemAdmin,
    departmentAdminIds,
    isDepartmentAdmin,
    activeSchoolId,
    setActiveSchool,
    allSchools,
    accessLevel,
    effectiveAccessLevel,
    isImpersonating,
    actualUserId,
  }
}

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, UserRole, School } from '../types/database'

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
}

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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [departmentAdminIds, setDepartmentAdminIds] = useState<string[]>([])
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null)
  const [allSchools, setAllSchools] = useState<School[]>([])

  // Override profile fields based on viewAsRole and active school context
  const profile = useMemo(() => {
    if (!rawProfile) return null
    let p = rawProfile
    // Override role for view-as mode
    if (viewAsRole && viewAsRole !== rawProfile.role) {
      p = { ...p, role: viewAsRole }
    }
    // Override school_id when system admin views a specific school
    if (isSystemAdmin && activeSchoolId && activeSchoolId !== rawProfile.school_id) {
      p = { ...p, school_id: activeSchoolId }
    }
    return p
  }, [rawProfile, viewAsRole, isSystemAdmin, activeSchoolId])

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
        // Fetch all schools for the switcher
        const { data: schools } = await supabase
          .from('schools')
          .select('*')
          .order('name')
        setAllSchools((schools as School[]) ?? [])
        // Default to user's own school
        setActiveSchoolId(data.school_id)
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
    setIsSystemAdmin(false)
    setActiveSchoolId(null)
    setAllSchools([])
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
  }, [])

  const setActiveSchool = useCallback((schoolId: string | null) => {
    setActiveSchoolId(schoolId)
    // Clear impersonation when switching schools
    setViewAsRole(null)
    setViewAsUserId(null)
    setViewAsUserName(null)
  }, [])

  const actualRole = rawProfile?.role ?? null
  const isDepartmentAdmin = departmentAdminIds.length > 0

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
  }
}

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, UserRole } from '../types/database'

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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // When viewAsRole is set, return a profile copy with the overridden role
  const profile = useMemo(() => {
    if (!rawProfile) return null
    if (!viewAsRole || viewAsRole === rawProfile.role) return rawProfile
    return { ...rawProfile, role: viewAsRole }
  }, [rawProfile, viewAsRole])

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

  const actualRole = rawProfile?.role ?? null

  return { user, profile, actualRole, loading, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, isPasswordRecovery, clearPasswordRecovery, viewAsRole, setViewAsRole }
}

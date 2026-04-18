import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { GraduationCap, Loader2, Lock, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { user, loading: authLoading, isPasswordRecovery, updatePassword, clearPasswordRecovery } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // If the user arrives here without a PASSWORD_RECOVERY event,
  // wait briefly for onAuthStateChange to fire before redirecting.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Redirect to login if not in recovery flow (after waiting for auth)
  useEffect(() => {
    if (waited && !authLoading && !isPasswordRecovery && !success) {
      navigate('/login', { replace: true })
    }
  }, [waited, authLoading, isPasswordRecovery, success, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await updatePassword(password)
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  // Show loading while auth is initializing
  if (authLoading || (!waited && !isPasswordRecovery)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text">Living Assessment</h1>
          <p className="mt-1 text-sm text-text-muted">Set your new password</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
                <CheckCircle className="h-6 w-6 text-success-600" />
              </div>
              <h2 className="text-lg font-semibold text-text">Password updated!</h2>
              <p className="mt-2 text-sm text-text-muted">
                Your password has been set successfully. You can now sign in.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearPasswordRecovery()
                  navigate('/login', { replace: true })
                }}
                className="mt-4 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Create a new password</h2>
                <p className="mt-1 text-sm text-text-muted">
                  {user?.email ? (
                    <>Setting password for <strong className="text-text">{user.email}</strong></>
                  ) : (
                    'Enter your new password below.'
                  )}
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-text">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-text">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Set password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

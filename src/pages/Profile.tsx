import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { User, Mail, Shield, Lock, Loader2, CheckCircle } from 'lucide-react'

export default function Profile() {
  const { user, profile, updatePassword } = useAuth()
  const { toast } = useToast()

  const [_currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await updatePassword(newPassword)
      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        toast('Password updated successfully.', 'success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const roleLabel = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : '—'

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-text">Profile</h1>

      {/* Account info */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text">Account Information</h2>

        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-text-light" />
          <div>
            <p className="text-xs text-text-muted">Name</p>
            <p className="text-sm font-medium text-text">{profile?.full_name || '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-text-light" />
          <div>
            <p className="text-xs text-text-muted">Email</p>
            <p className="text-sm font-medium text-text">{user?.email || '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-text-light" />
          <div>
            <p className="text-xs text-text-muted">Role</p>
            <p className="text-sm font-medium text-text">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text mb-4">Change Password</h2>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-600">
            <CheckCircle className="h-4 w-4" />
            Password updated successfully.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
            {error}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-text">
              Confirm New Password
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
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  )
}

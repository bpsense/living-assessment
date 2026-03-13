import { useState } from 'react'
import { X, UserPlus, Loader2 } from 'lucide-react'
import { inviteUser } from '../../lib/invite-user'

interface Props {
  student: { id: string; school_id: string; first_name: string; last_name: string }
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function InviteLearnerModal({ student, open, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState(`${student.first_name} ${student.last_name}`)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !fullName.trim()) return

    setInviting(true)
    setError(null)

    const { error: err } = await inviteUser({
      email: email.trim(),
      fullName: fullName.trim(),
      schoolId: student.school_id,
      role: 'learner',
      studentId: student.id,
    })

    if (err) {
      setError(err)
      setInviting(false)
    } else {
      setSuccess(true)
      setInviting(false)
      // Brief delay so user sees success, then close
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1200)
    }
  }

  function handleClose() {
    setEmail('')
    setFullName(`${student.first_name} ${student.last_name}`)
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-bg-card p-6 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-bg-secondary hover:text-text-secondary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Invite Learner</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Send an invitation for <span className="font-medium">{student.first_name} {student.last_name}</span> to create a login account.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-center">
            <UserPlus className="mx-auto mb-2 h-6 w-6 text-success-600" />
            <p className="text-sm font-medium text-success-700">Invitation sent!</p>
            <p className="mt-1 text-xs text-success-600">
              They'll receive an email to set up their account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="learner@email.com"
                className="w-full rounded-lg border border-bg-muted bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-alert-50 p-2 text-xs text-alert-700">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Send Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { X, Loader2, UserPlus } from 'lucide-react'
import { linkStudentByNumber } from '../../lib/family-data'

interface Props {
  onClose: () => void
  onLinked: () => void
}

export default function LinkStudentModal({ onClose, onLinked }: Props) {
  const [studentNumber, setStudentNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = studentNumber.trim()
    if (!trimmed) {
      setError('Please enter a learner number.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { error: linkError } = await linkStudentByNumber(trimmed)

      if (linkError) {
        setError(linkError)
        return
      }

      onLinked()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link learner')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-lg font-semibold text-text">Add a Learner</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <p className="text-sm text-text-muted">
            Enter your child's learner number to link them to your account.
            You can find this on their school documents or by contacting the school.
          </p>

          {error && (
            <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="student-number"
              className="mb-1 block text-sm font-medium text-text"
            >
              Learner Number
            </label>
            <input
              id="student-number"
              type="text"
              required
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="e.g. Kx7mNp3Q"
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2.5 text-center text-lg font-mono tracking-widest text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || studentNumber.trim().length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Link Learner
          </button>
        </form>
      </div>
    </div>
  )
}

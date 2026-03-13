import { useState } from 'react'
import { X, Send, Loader2, Info } from 'lucide-react'
import type { LearnerAssignment } from '../../lib/learner-assignments-data'
import { submitAssignment } from '../../lib/learner-assignments-data'

interface Props {
  assignment: LearnerAssignment
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

export default function SubmitAssignmentModal({ assignment, open, onClose, onSubmitted }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const title = assignment.assignment?.title || 'Untitled Assignment'

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await submitAssignment(assignment.id)
      onSubmitted()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to submit assignment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-bg-card p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-bg-secondary hover:text-text-secondary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Submit Assignment
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Are you sure you want to submit <span className="font-medium">{title}</span>?
          </p>
        </div>

        {/* Assignment details */}
        {assignment.assignment?.description && (
          <div className="mb-4 rounded-lg bg-bg-secondary p-3">
            <p className="text-sm text-text-secondary line-clamp-3">
              {assignment.assignment.description}
            </p>
          </div>
        )}

        {/* Info box */}
        <div className="mb-4 flex gap-2 rounded-lg bg-blue-50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-xs text-blue-700">
            Once submitted, your educator will review and mark this complete.
            Your assignment will remain in its current column until then.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-alert-50 p-3 text-sm text-alert-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

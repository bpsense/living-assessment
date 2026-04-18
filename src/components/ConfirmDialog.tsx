import { useEffect } from 'react'
import { clsx } from 'clsx'
import { X, Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, loading])

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="glass-scrim absolute inset-0"
        onClick={loading ? undefined : onClose}
      />

      {/* Panel */}
      <div className="glass-modal relative z-10 w-full max-w-md rounded-2xl p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + Title */}
        <div className="mb-4 flex items-start gap-3">
          <div
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              confirmVariant === 'danger' ? 'bg-alert-50' : 'bg-primary-50'
            )}
          >
            <AlertTriangle
              className={clsx(
                'h-5 w-5',
                confirmVariant === 'danger'
                  ? 'text-alert-500'
                  : 'text-primary-500'
              )}
            />
          </div>
          <div className="min-w-0 pt-1.5">
            <h3 className="text-base font-bold text-text">{title}</h3>
          </div>
        </div>

        {/* Message */}
        <p className="mb-6 text-sm leading-relaxed text-text-muted">{message}</p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-70',
              confirmVariant === 'danger'
                ? 'bg-alert-500 hover:bg-alert-600'
                : 'bg-primary-500 hover:bg-primary-600'
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

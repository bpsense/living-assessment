import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

// ============================================================
// Toast types
// ============================================================

export type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ============================================================
// Individual toast
// ============================================================

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(item.id), 200)
    }, 3500)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])

  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        item.variant === 'success'
          ? 'border-success-500/20 bg-bg-card text-text'
          : 'border-alert-500/20 bg-bg-card text-text'
      )}
    >
      {item.variant === 'success' ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success-500" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0 text-alert-500" />
      )}
      <p className="flex-1 text-sm font-medium">{item.message}</p>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(() => onDismiss(item.id), 200)
        }}
        className="shrink-0 rounded-lg p-0.5 text-text-light transition-colors hover:text-text"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ============================================================
// Provider + container
// ============================================================

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6">
        {toasts.map((item) => (
          <ToastNotification key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

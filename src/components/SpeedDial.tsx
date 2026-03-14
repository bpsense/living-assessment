import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { clsx } from 'clsx'

export interface SpeedDialAction {
  icon: ReactNode
  label: string
  onClick: () => void
  /** Tailwind bg colour class for the action button (defaults to bg-primary-500) */
  color?: string
}

interface Props {
  actions: SpeedDialAction[]
}

export default function SpeedDial({ actions }: Props) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, close])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
          onClick={close}
        />
      )}

      {/* Action buttons (stacked above FAB) */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col-reverse items-end gap-3 md:bottom-6 md:right-6">
        {/* Main FAB toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-95',
            open
              ? 'bg-text-muted text-white hover:bg-text'
              : 'bg-primary-500 text-white hover:scale-105 hover:bg-primary-600'
          )}
          title={open ? 'Close' : 'Quick actions'}
        >
          <div
            className={clsx(
              'transition-transform duration-200',
              open && 'rotate-45'
            )}
          >
            <Plus className="h-6 w-6" />
          </div>
        </button>

        {/* Action items */}
        {open &&
          actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                close()
                action.onClick()
              }}
              className={clsx(
                'flex items-center gap-3 rounded-full py-2.5 pl-4 pr-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95',
                'animate-in fade-in slide-in-from-bottom-2',
                action.color || 'bg-primary-500 hover:bg-primary-600'
              )}
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
            >
              <span>{action.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                {action.icon}
              </span>
            </button>
          ))}
      </div>
    </>
  )
}

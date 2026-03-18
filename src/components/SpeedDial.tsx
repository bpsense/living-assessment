import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { Plus, X } from 'lucide-react'

export interface SpeedDialAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: string
}

interface Props {
  actions: SpeedDialAction[]
}

export default function SpeedDial({ actions }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // If only one action, render as simple button
  if (actions.length === 1) {
    const action = actions[0]
    return (
      <button
        onClick={action.onClick}
        className={clsx(
          'fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6',
          action.color ?? 'bg-primary-500 hover:bg-primary-600'
        )}
        title={action.label}
      >
        {action.icon}
      </button>
    )
  }

  return (
    <div ref={containerRef} className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6">
      {/* Actions */}
      <div
        className={clsx(
          'absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-200',
          open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
        )}
      >
        {actions.map((action, i) => (
          <div key={i} className="flex items-center justify-end gap-2">
            <span
              className={clsx(
                'whitespace-nowrap rounded-lg bg-text px-2.5 py-1 text-xs font-medium text-white shadow-lg transition-all duration-200',
                open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
              )}
              style={{ transitionDelay: open ? `${i * 50}ms` : '0ms' }}
            >
              {action.label}
            </span>
            <button
              onClick={() => { action.onClick(); setOpen(false) }}
              className={clsx(
                'flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110',
                action.color ?? 'bg-primary-500 hover:bg-primary-600',
                open ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              )}
              style={{ transitionDelay: open ? `${i * 50}ms` : '0ms' }}
              title={action.label}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-all duration-200 hover:bg-primary-600',
          open && 'rotate-45'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  )
}

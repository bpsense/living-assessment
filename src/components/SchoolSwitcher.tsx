import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { ChevronDown, Building2, Globe } from 'lucide-react'
import { clsx } from 'clsx'

export default function SchoolSwitcher() {
  const { allSchools, activeSchoolId, setActiveSchool } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeSchool = allSchools.find((s) => s.id === activeSchoolId)
  const label = activeSchool?.name ?? 'All Schools'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
      >
        {activeSchool ? (
          <Building2 className="h-3.5 w-3.5 text-primary-500" />
        ) : (
          <Globe className="h-3.5 w-3.5 text-primary-500" />
        )}
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-bg-muted bg-bg-card shadow-lg">
          {/* All Schools option */}
          <button
            onClick={() => { setActiveSchool(null); setOpen(false) }}
            className={clsx(
              'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-bg-muted',
              activeSchoolId === null && 'bg-primary-50 text-primary-700 font-medium'
            )}
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span>All Schools</span>
          </button>

          <div className="border-t border-bg-muted" />

          {/* School list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {allSchools.map((school) => (
              <button
                key={school.id}
                onClick={() => { setActiveSchool(school.id); setOpen(false) }}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted',
                  activeSchoolId === school.id && 'bg-primary-50 text-primary-700 font-medium'
                )}
              >
                <Building2 className="h-4 w-4 shrink-0 text-text-light" />
                <span className="truncate">{school.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import {
  Eye,
  ClipboardList,
  ChevronDown,
  Filter,
} from 'lucide-react'
import type { TimelineEntry } from '../../lib/student-data'
import type { Dimension } from '../../types/database'
import { INTEREST_ENABLED } from '../../lib/features'

interface Props {
  entries: TimelineEntry[]
  dimensions: Dimension[]
  pageSize?: number
}

type TypeFilter = 'all' | 'observation' | 'interest_survey'

export default function Timeline({ entries, dimensions, pageSize = 10 }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dimensionFilter, setDimensionFilter] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    // While interest surveys are hidden, drop interest-survey entries entirely.
    let result = INTEREST_ENABLED
      ? entries
      : entries.filter((e) => e.type !== 'interest_survey')
    if (typeFilter !== 'all') {
      result = result.filter((e) => e.type === typeFilter)
    }
    if (dimensionFilter) {
      result = result.filter((e) => e.dimension_id === dimensionFilter)
    }
    return result
  }, [entries, typeFilter, dimensionFilter])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 rounded-lg border border-bg-muted px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted md:hidden"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </button>

        <div
          className={clsx(
            'flex flex-wrap items-center gap-2',
            showFilters ? 'flex' : 'hidden md:flex'
          )}
        >
          {/* Type chips */}
          {((INTEREST_ENABLED
            ? ['all', 'observation', 'interest_survey']
            : ['all', 'observation']) as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === t
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-700'
              )}
            >
              {t === 'all'
                ? 'All'
                : t === 'observation'
                  ? 'Observations'
                  : 'Interest Surveys'}
            </button>
          ))}

          {/* Dimension selector */}
          <select
            value={dimensionFilter ?? ''}
            onChange={(e) =>
              setDimensionFilter(e.target.value || null)
            }
            className="rounded-full border border-bg-muted bg-bg-card px-3 py-1 text-xs font-medium text-text-muted focus:border-primary-400 focus:outline-none"
          >
            <option value="">All dimensions</option>
            {dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-text-light">
          {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Entries */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-light">
          No timeline entries match your filters.
        </p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-bg-muted md:left-5" />

          {visible.map((entry) => (
            <div key={entry.id} className="relative flex gap-3 py-3 md:gap-4">
              {/* Icon dot */}
              <div
                className={clsx(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-10 md:w-10',
                  entry.type === 'observation'
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-accent-100 text-accent-600'
                )}
              >
                {entry.type === 'observation' ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-text">
                    {entry.type === 'observation' ? 'Observation' : 'Interest Survey'}
                  </span>
                  {entry.dimension_name && (
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                      {entry.dimension_name}
                    </span>
                  )}
                  {entry.rating && (
                    <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      {entry.rating}/5
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-light">
                  <span>{format(new Date(entry.date), 'MMM d, yyyy · h:mm a')}</span>
                  {entry.observer_name && <span>by {entry.observer_name}</span>}
                </div>

                {entry.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                    {entry.notes.slice(0, 120)}
                    {entry.notes.length > 120 ? '...' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + pageSize)}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-bg-muted py-2 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted"
        >
          <ChevronDown className="h-4 w-4" />
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}

/**
 * AssignmentLibraryCard.tsx
 *
 * A single card in the Assignment Library grid: title, type, dimension icons,
 * age/duration, creator, gratitude (heart toggle), and Use / Edit actions.
 * Gratitude is optimistically toggled by the parent.
 */
import { clsx } from 'clsx'
import { Heart, Pencil, Clock, Users as UsersIcon } from 'lucide-react'
import { DimensionIcon } from '../student/DimensionIcon'
import type { Dimension } from '../../types/database'
import type { AssignmentWithRelations } from '../../lib/assignment-data'

interface Props {
  assignment: AssignmentWithRelations
  dimensions: Dimension[]
  gratified: boolean
  canEdit: boolean
  onToggleGratitude: () => void
  onUse: () => void
  onEdit: () => void
}

export default function AssignmentLibraryCard({
  assignment,
  dimensions,
  gratified,
  canEdit,
  onToggleGratitude,
  onUse,
  onEdit,
}: Props) {
  const dims = dimensions.filter((d) => assignment.dimension_ids.includes(d.id))
  const ageLabel =
    assignment.age_min != null && assignment.age_max != null
      ? `Ages ${assignment.age_min}–${assignment.age_max}`
      : assignment.age_min != null
        ? `Ages ${assignment.age_min}+`
        : null

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium capitalize text-primary-700">
          {assignment.assignment_type.replace('_', ' ')}
        </span>
        <button
          onClick={onToggleGratitude}
          className={clsx(
            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
            gratified ? 'text-rose-500' : 'text-text-light hover:text-rose-400'
          )}
          aria-pressed={gratified}
          title={gratified ? 'Remove appreciation' : 'Appreciate this assignment'}
        >
          <Heart className={clsx('h-4 w-4', gratified && 'fill-current')} />
          {assignment.gratitude_count}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold leading-snug text-text">{assignment.title}</h3>
        {assignment.description && (
          <p className="mt-1 line-clamp-2 text-xs text-text-muted">{assignment.description}</p>
        )}
      </div>

      {dims.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dims.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] text-text-muted"
            >
              <DimensionIcon name={d.icon} className="h-3 w-3" />
              {d.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-light">
        {ageLabel && (
          <span className="flex items-center gap-1">
            <UsersIcon className="h-3 w-3" />
            {ageLabel}
          </span>
        )}
        {assignment.duration_estimate && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {assignment.duration_estimate}
          </span>
        )}
        {assignment.created_by_name && <span>by {assignment.created_by_name}</span>}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          onClick={onUse}
          className="flex-1 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
        >
          Use This Assignment
        </button>
        {canEdit && (
          <button
            onClick={onEdit}
            className="rounded-lg border border-bg-muted bg-bg-card p-2 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

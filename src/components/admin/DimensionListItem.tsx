import { clsx } from 'clsx'
import { GripVertical, Pencil, Archive, ArchiveRestore, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DimensionIcon } from '../student/DimensionIcon'
import type { Dimension } from '../../types/database'

// ============================================================
// Category badge colors
// ============================================================

const CATEGORY_STYLES: Record<string, string> = {
  Academic: 'bg-primary-50 text-primary-700',
  'Creative & Arts': 'bg-purple-50 text-purple-700',
  'Physical & Health': 'bg-emerald-50 text-emerald-700',
  'Social & Emotional': 'bg-amber-50 text-amber-700',
  Cognitive: 'bg-sky-50 text-sky-700',
}

// ============================================================
// Props
// ============================================================

export interface DimensionWithCount extends Dimension {
  observation_count: number
}

interface Props {
  dimension: DimensionWithCount
  onEdit: (dim: Dimension) => void
  onDeactivate: (dim: Dimension) => void
  onReactivate: (dim: Dimension) => void
  onToggleFamilyVisibility: (dim: Dimension) => void
  /** When provided, shows a chevron that expands the dimension's competencies. */
  onToggleExpand?: () => void
  expanded?: boolean
  /** Competency count badge (omitted if undefined). */
  competencyCount?: number
}

// ============================================================
// Component
// ============================================================

export default function DimensionListItem({
  dimension,
  onEdit,
  onDeactivate,
  onReactivate,
  onToggleFamilyVisibility,
  onToggleExpand,
  expanded,
  competencyCount,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dimension.id,
    disabled: !dimension.is_active,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isActive = dimension.is_active
  const categoryStyle = CATEGORY_STYLES[dimension.category] ?? 'bg-bg-muted text-text-muted'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-3 rounded-xl border bg-bg-card px-3 py-3 transition-shadow',
        isDragging
          ? 'z-10 border-primary-300 shadow-lg'
          : 'border-bg-muted shadow-sm',
        !isActive && 'opacity-50'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={clsx(
          'shrink-0 rounded p-0.5 text-text-light transition-colors',
          isActive
            ? 'cursor-grab hover:text-text active:cursor-grabbing'
            : 'cursor-not-allowed'
        )}
        tabIndex={isActive ? 0 : -1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Expand competencies */}
      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="shrink-0 rounded p-0.5 text-text-light transition-colors hover:text-text"
          aria-label={expanded ? 'Collapse competencies' : 'Expand competencies'}
          aria-expanded={expanded}
        >
          <ChevronRight
            className={clsx('h-4 w-4 transition-transform', expanded && 'rotate-90')}
          />
        </button>
      )}

      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        <DimensionIcon name={dimension.icon} className="h-4.5 w-4.5 text-primary-600" />
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{dimension.name}</p>
        {dimension.description && (
          <p className="truncate text-xs text-text-muted">{dimension.description}</p>
        )}
      </div>

      {/* Category badge */}
      <span
        className={clsx(
          'hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline-block',
          categoryStyle
        )}
      >
        {dimension.category}
      </span>

      {/* Competency count */}
      {competencyCount !== undefined && (
        <span
          className="hidden shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 sm:inline-block"
          title={`${competencyCount} competenc${competencyCount !== 1 ? 'ies' : 'y'}`}
        >
          {competencyCount} comp
        </span>
      )}

      {/* Observation count */}
      <span
        className="hidden shrink-0 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted sm:inline-block"
        title={`${dimension.observation_count} observation${dimension.observation_count !== 1 ? 's' : ''} recorded`}
      >
        {dimension.observation_count} obs
      </span>

      {/* Family visibility toggle */}
      {isActive && (
        <button
          onClick={() => onToggleFamilyVisibility(dimension)}
          className={clsx(
            'shrink-0 rounded-lg p-2 transition-colors',
            dimension.visible_to_family
              ? 'text-primary-500 hover:bg-primary-50 hover:text-primary-600'
              : 'text-text-light hover:bg-bg-muted hover:text-text-muted'
          )}
          title={dimension.visible_to_family ? 'Visible to families — click to hide' : 'Hidden from families — click to show'}
        >
          {dimension.visible_to_family ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Edit button */}
      <button
        onClick={() => onEdit(dimension)}
        className="shrink-0 rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
        title="Edit dimension"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {/* Deactivate / Reactivate */}
      {isActive ? (
        <button
          onClick={() => onDeactivate(dimension)}
          className="shrink-0 rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
          title="Deactivate dimension"
        >
          <Archive className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={() => onReactivate(dimension)}
          className="shrink-0 rounded-lg p-2 text-text-light transition-colors hover:bg-success-50 hover:text-success-500"
          title="Reactivate dimension"
        >
          <ArchiveRestore className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, parseISO } from 'date-fns'
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  User,
} from 'lucide-react'
import type { LearnerAssignment, KanbanColumn } from '../../lib/learner-assignments-data'

interface Props {
  assignment: LearnerAssignment
  column: KanbanColumn
  onSubmit: (assignment: LearnerAssignment) => void
}

export default function AssignmentCard({ assignment, column, onSubmit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isComplete = column === 'complete'
  const isSubmitted = !!assignment.submitted_at
  const isOverdue =
    assignment.assignment?.due_date && isPast(parseISO(assignment.assignment.due_date)) && !isComplete

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: assignment.id,
    disabled: isComplete,
    data: { assignment, column },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const a = assignment.assignment

  const competencyCount = a?.assignment_competencies?.length || 0
  const skillCount = a?.assignment_skills?.length || 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-bg-card rounded-xl border shadow-soft-sm ${
        isDragging ? 'shadow-soft-lg ring-2 ring-primary-300' : ''
      } ${isComplete ? 'opacity-80' : ''}`}
    >
      {/* Drag handle + header */}
      <div className="flex items-start gap-2 p-3 pb-2">
        {!isComplete && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab text-text-muted hover:text-text-secondary active:cursor-grabbing"
            tabIndex={-1}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h4 className="text-sm font-medium text-text-primary line-clamp-2">
            {a?.title || 'Untitled Assignment'}
          </h4>

          {/* Type badge + due date */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Assignment type */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                a?.assignment_type === 'class'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-purple-50 text-purple-700'
              }`}
            >
              {a?.assignment_type === 'class' ? (
                <Users className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              {a?.assignment_type === 'class' ? 'Class' : 'Individual'}
            </span>

            {/* Due date */}
            {a?.due_date && (
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  isOverdue ? 'font-medium text-alert-600' : 'text-text-muted'
                }`}
              >
                <Clock className="h-3 w-3" />
                {format(parseISO(a.due_date), 'MMM d')}
                {isOverdue && ' (overdue)'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {isSubmitted && !isComplete && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            Awaiting Review
          </span>
        )}
        {isSubmitted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
            <CheckCircle2 className="h-3 w-3" />
            Submitted
          </span>
        )}
        {isComplete && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </span>
        )}
        {column === 'blocked' && !isComplete && (
          <span className="inline-flex items-center gap-1 rounded-full bg-alert-50 px-2 py-0.5 text-xs font-medium text-alert-700">
            <AlertCircle className="h-3 w-3" />
            Blocked
          </span>
        )}

        {/* Competency / skill counts */}
        {competencyCount > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-text-muted">
            {competencyCount} competenc{competencyCount === 1 ? 'y' : 'ies'}
          </span>
        )}
        {skillCount > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-text-muted">
            {skillCount} skill{skillCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t px-3 py-2 text-xs text-text-secondary">
          {a?.description && (
            <p className="mb-2 whitespace-pre-line">{a.description}</p>
          )}
          {competencyCount > 0 && (
            <div className="mb-1">
              <span className="font-medium">Competencies:</span>{' '}
              {a.assignment_competencies.map((ac) => ac.competency?.code || ac.competency_id).join(', ')}
            </div>
          )}
          {skillCount > 0 && (
            <div>
              <span className="font-medium">Skills:</span>{' '}
              {a.assignment_skills.map((s) => s.skill?.name || s.skill_id).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> More
            </>
          )}
        </button>

        {!isComplete && !isSubmitted && (
          <button
            onClick={() => onSubmit(assignment)}
            className="flex items-center gap-1 rounded-lg bg-primary-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-600 transition-colors"
          >
            <Send className="h-3 w-3" />
            Submit
          </button>
        )}
      </div>
    </div>
  )
}

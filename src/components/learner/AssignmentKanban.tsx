import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { Inbox } from 'lucide-react'
import AssignmentCard from './AssignmentCard'
import SubmitAssignmentModal from './SubmitAssignmentModal'
import {
  getKanbanGroups,
  updateLearnerColumn,
  type LearnerAssignment,
  type KanbanColumn,
} from '../../lib/learner-assignments-data'
import type { LearnerColumn } from '../../types/database'

// ============================================================
// Column styling
// ============================================================

const COLUMN_STYLES: Record<KanbanColumn, { bg: string; border: string; headerBg: string }> = {
  on_deck: { bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-100' },
  researching: { bg: 'bg-blue-50/50', border: 'border-blue-200', headerBg: 'bg-blue-100' },
  actively_exploring: { bg: 'bg-amber-50/50', border: 'border-amber-200', headerBg: 'bg-amber-100' },
  blocked: { bg: 'bg-red-50/50', border: 'border-red-200', headerBg: 'bg-red-100' },
  complete: { bg: 'bg-green-50/50', border: 'border-green-200', headerBg: 'bg-green-100' },
}

// ============================================================
// Droppable Column
// ============================================================

function KanbanColumnContainer({
  column,
  label,
  items,
  onSubmit,
}: {
  column: KanbanColumn
  label: string
  items: LearnerAssignment[]
  onSubmit: (a: LearnerAssignment) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column })
  const style = COLUMN_STYLES[column]

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] w-64 shrink-0 flex-col rounded-xl border ${style.border} ${style.bg} ${
        isOver ? 'ring-2 ring-primary-300 ring-offset-1' : ''
      } transition-shadow`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between rounded-t-xl ${style.headerBg} px-3 py-2`}>
        <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-text-muted">
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 p-2">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8 text-center">
              <p className="text-xs text-text-muted">
                {column === 'complete' ? 'No completed assignments yet' : 'Drag assignments here'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <AssignmentCard
                key={item.id}
                assignment={item}
                column={column}
                onSubmit={onSubmit}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ============================================================
// Main Kanban
// ============================================================

interface Props {
  assignments: LearnerAssignment[]
  onUpdate: () => void
}

export default function AssignmentKanban({ assignments, onUpdate }: Props) {
  const [activeCard, setActiveCard] = useState<LearnerAssignment | null>(null)
  const [submitTarget, setSubmitTarget] = useState<LearnerAssignment | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const groups = getKanbanGroups(assignments)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const card = assignments.find((a) => a.id === active.id) || null
    setActiveCard(card)
  }, [assignments])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCard(null)
      const { active, over } = event
      if (!over) return

      const targetColumn = over.id as KanbanColumn

      // Don't allow dropping on "complete" — must go through submit flow
      if (targetColumn === 'complete') return

      const card = assignments.find((a) => a.id === active.id)
      if (!card) return

      // Skip if already in this column
      if (card.learner_column === targetColumn) return

      // Skip if card is already complete (submitted_at + graded_at)
      if (card.submitted_at && card.graded_at) return

      try {
        await updateLearnerColumn(card.id, targetColumn as LearnerColumn, card.status)
        onUpdate()
      } catch (err) {
        console.error('Failed to update kanban column:', err)
        // Revert handled by onUpdate refetch
        onUpdate()
      }
    },
    [assignments, onUpdate]
  )

  const handleSubmitRequest = useCallback((assignment: LearnerAssignment) => {
    setSubmitTarget(assignment)
  }, [])

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-bg-secondary py-12">
        <Inbox className="mb-3 h-10 w-10 text-text-muted" />
        <p className="text-sm font-medium text-text-muted">No assignments yet</p>
        <p className="mt-1 text-xs text-text-muted">Check back soon!</p>
      </div>
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {groups.map((group) => (
            <KanbanColumnContainer
              key={group.column}
              column={group.column}
              label={group.label}
              items={group.items}
              onSubmit={handleSubmitRequest}
            />
          ))}
        </div>

        {/* Drag overlay — floating card that follows cursor */}
        <DragOverlay modifiers={[restrictToWindowEdges]}>
          {activeCard ? (
            <div className="w-60 opacity-90">
              <AssignmentCard
                assignment={activeCard}
                column={activeCard.learner_column}
                onSubmit={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Submit modal */}
      {submitTarget && (
        <SubmitAssignmentModal
          assignment={submitTarget}
          open={!!submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSubmitted={onUpdate}
        />
      )}
    </>
  )
}

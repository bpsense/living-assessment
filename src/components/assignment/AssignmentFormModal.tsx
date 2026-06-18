/**
 * AssignmentFormModal.tsx
 *
 * Modal shell around the create/edit forms. Create mode shows the type selector
 * first; edit mode opens straight into the matching form. Reused by the Library
 * (Edit) and the Assignments index (New).
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import AssignmentTypeSelector from './AssignmentTypeSelector'
import ProjectAssignmentForm from './ProjectAssignmentForm'
import FocusedTaskForm from './FocusedTaskForm'
import type { Assignment, AssignmentType, AssignmentWithRelations } from '../../lib/assignment-data'

interface Props {
  open: boolean
  onClose: () => void
  schoolId: string
  createdBy: string
  /** null/undefined = create mode. */
  existing?: AssignmentWithRelations | null
  onSaved: (assignment: Assignment) => void
}

export default function AssignmentFormModal({ open, onClose, schoolId, createdBy, existing, onSaved }: Props) {
  const [createType, setCreateType] = useState<AssignmentType | null>(existing?.assignment_type ?? null)

  useEffect(() => {
    if (open) setCreateType(existing?.assignment_type ?? null)
  }, [open, existing])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-modal relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            {existing ? 'Edit assignment' : createType ? 'New assignment' : 'Create an assignment'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!createType ? (
            <AssignmentTypeSelector selected={createType} onSelect={setCreateType} />
          ) : createType === 'project' ? (
            <ProjectAssignmentForm
              schoolId={schoolId}
              createdBy={createdBy}
              existing={existing}
              onSaved={onSaved}
              onCancel={existing ? onClose : () => setCreateType(null)}
            />
          ) : (
            <FocusedTaskForm
              schoolId={schoolId}
              createdBy={createdBy}
              existing={existing}
              onSaved={onSaved}
              onCancel={existing ? onClose : () => setCreateType(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

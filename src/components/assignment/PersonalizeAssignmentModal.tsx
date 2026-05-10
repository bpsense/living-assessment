/**
 * PersonalizeAssignmentModal.tsx
 *
 * Lets an educator override one student's view of an assignment without
 * affecting the parent or any other student. The student's snapshot was
 * created at assign time by the DB trigger; this UI edits THAT snapshot.
 */
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useToast } from '../Toast'
import {
  addStandardsToStudent,
  personalizeText,
  removeStandardsFromStudent,
  type StudentAssignmentView,
} from '../../lib/standards-assignment-data'
import StandardsPicker from '../standards/StandardsPicker'

interface Props {
  open: boolean
  schoolId: string
  studentAssignment: StudentAssignmentView
  onClose: () => void
  onSaved: () => void
}

export default function PersonalizeAssignmentModal({
  open,
  schoolId,
  studentAssignment,
  onClose,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [title, setTitle] = useState(studentAssignment.title)
  const [description, setDescription] = useState(studentAssignment.description ?? '')
  const [standardIds, setStandardIds] = useState<Set<string>>(
    new Set(studentAssignment.standards.map((s) => s.id))
  )
  const [originalIds] = useState<Set<string>>(
    new Set(studentAssignment.standards.map((s) => s.id))
  )
  const [saving, setSaving] = useState(false)

  // Reset on (re)open
  useEffect(() => {
    if (!open) return
    setTitle(studentAssignment.title)
    setDescription(studentAssignment.description ?? '')
    setStandardIds(new Set(studentAssignment.standards.map((s) => s.id)))
  }, [open, studentAssignment])

  // Body scroll lock + Escape close
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  async function handleSave() {
    setSaving(true)
    try {
      const trimmedTitle = title.trim()
      const trimmedDesc = description.trim()
      // Only set personalized fields if they actually differ from "no personalization"
      // (i.e. send whatever the user entered; backend nullable cols).
      await personalizeText(studentAssignment.student_assignment_id, {
        title: trimmedTitle.length > 0 ? trimmedTitle : null,
        description: trimmedDesc.length > 0 ? trimmedDesc : null,
      })

      const toAdd: string[] = []
      const toRemove: string[] = []
      for (const id of standardIds) if (!originalIds.has(id)) toAdd.push(id)
      for (const id of originalIds) if (!standardIds.has(id)) toRemove.push(id)

      await Promise.all([
        addStandardsToStudent(studentAssignment.student_assignment_id, toAdd),
        removeStandardsFromStudent(studentAssignment.student_assignment_id, toRemove),
      ])

      toast('Personalization saved', 'success')
      onSaved()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text">Personalize for this student</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-xs text-text-muted">
            Edits here apply only to this student. The parent project and other students aren't affected.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Standards</label>
            <StandardsPicker
              schoolId={schoolId}
              selectedIds={standardIds}
              onChange={setStandardIds}
              compact
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

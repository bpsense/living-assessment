import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'

interface Props {
  classroomId: string
  classroomName: string
  studentCount: number
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteClassroomConfirm({
  classroomId,
  classroomName,
  studentCount,
  onClose,
  onDeleted,
}: Props) {
  const { toast } = useToast()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const canDelete = confirmText.trim() === classroomName.trim()

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)
    const { error } = await supabase.from('classrooms').delete().eq('id', classroomId)
    setDeleting(false)
    if (error) {
      toast('Failed to delete classroom', 'error')
      return
    }
    toast(`"${classroomName}" deleted`, 'success')
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-alert-500" />
            <h3 className="text-base font-bold text-text">Delete Classroom?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-text">
          <p>
            You&rsquo;re about to delete <span className="font-semibold">{classroomName}</span>.
          </p>
          <ul className="list-disc space-y-1 rounded-lg bg-alert-50 px-5 py-3 text-xs text-alert-700">
            <li>
              {studentCount} learner{studentCount === 1 ? '' : 's'} will be unenrolled from this
              classroom (their student profiles are preserved).
            </li>
            <li>Educator assignments to this classroom will be removed.</li>
            <li>Assignments tied to this classroom will be kept but no longer linked to it.</li>
          </ul>
          <p className="text-xs text-text-muted">
            This cannot be undone. Type <span className="font-mono font-semibold text-text">{classroomName}</span> to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={classroomName}
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-alert-400 focus:outline-none focus:ring-2 focus:ring-alert-100"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="flex items-center gap-1.5 rounded-lg bg-alert-500 px-4 py-2 text-sm font-medium text-white hover:bg-alert-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete classroom
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'

interface EditableClassroom {
  id: string
  name: string
  grade_level: string | null
  age_min: number | null
  age_max: number | null
}

interface Props {
  classroom: EditableClassroom
  onClose: () => void
  onSaved: () => void
}

export default function EditClassroomModal({ classroom, onClose, onSaved }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState(classroom.name)
  const [grade, setGrade] = useState(classroom.grade_level ?? '')
  const [ageMin, setAgeMin] = useState(classroom.age_min !== null ? String(classroom.age_min) : '')
  const [ageMax, setAgeMax] = useState(classroom.age_max !== null ? String(classroom.age_max) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    if (!ageMin.trim() || !ageMax.trim()) {
      toast('Set the age range for this classroom.', 'error')
      return
    }
    const minVal = Number(ageMin)
    const maxVal = Number(ageMax)
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      toast('Age range must be numbers.', 'error')
      return
    }
    if (minVal > maxVal) {
      toast('Min age must be less than or equal to max age.', 'error')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('classrooms')
      .update({
        name: name.trim(),
        grade_level: grade.trim() || null,
        age_min: minVal,
        age_max: maxVal,
      })
      .eq('id', classroom.id)

    setSaving(false)
    if (error) {
      toast('Failed to update classroom', 'error')
      return
    }
    toast('Classroom updated', 'success')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSave} className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h3 className="text-base font-bold text-text">Edit Classroom</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Grade Level</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 3-5"
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">
              Age Range *
              <span className="ml-1 text-[10px] font-normal text-text-light">
                (defaults the competencies and skills shown when assigning work)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={25}
                required
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                placeholder="Min"
                className="w-24 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <span className="text-xs text-text-light">to</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={25}
                required
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                placeholder="Max"
                className="w-24 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <span className="text-xs text-text-light">years</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Plus, X, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Classroom } from '../../types/database'
import { useToast } from '../Toast'

interface Props {
  studentId: string
  schoolId: string
  classrooms: (Classroom & { is_primary: boolean; status?: string })[]
  onChanged: () => void
}

export default function StudentClassroomsManager({ studentId, schoolId, classrooms, onChanged }: Props) {
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [availableClassrooms, setAvailableClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch available classrooms when add panel is opened
  useEffect(() => {
    if (!showAdd) return

    async function fetchAvailable() {
      const { data } = await supabase
        .from('classrooms')
        .select('*')
        .eq('school_id', schoolId)
        .order('name')

      const enrolledIds = new Set(classrooms.map((c) => c.id))
      setAvailableClassrooms(
        ((data ?? []) as Classroom[]).filter((c) => !enrolledIds.has(c.id))
      )
    }
    fetchAvailable()
  }, [showAdd, schoolId, classrooms])

  async function handleAdd() {
    if (!selectedClassroomId) return
    setSaving(true)

    const { error } = await supabase
      .from('student_classrooms')
      .insert({
        student_id: studentId,
        classroom_id: selectedClassroomId,
        school_id: schoolId,
        is_primary: false,
      })

    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return
    }

    toast('Added to classroom', 'success')
    setShowAdd(false)
    setSelectedClassroomId('')
    onChanged()
  }

  async function handleRemove(classroomId: string) {
    const classroom = classrooms.find((c) => c.id === classroomId)
    if (classroom?.is_primary) {
      toast('Cannot remove primary classroom', 'error')
      return
    }

    const { error } = await supabase
      .from('student_classrooms')
      .delete()
      .eq('student_id', studentId)
      .eq('classroom_id', classroomId)

    if (error) {
      toast(error.message, 'error')
      return
    }

    toast('Removed from classroom', 'success')
    onChanged()
  }

  async function handleSetPrimary(classroomId: string) {
    // Update the students.classroom_id which triggers the sync trigger
    const { error } = await supabase
      .from('students')
      .update({ classroom_id: classroomId })
      .eq('id', studentId)

    if (error) {
      toast(error.message, 'error')
      return
    }

    toast('Primary classroom updated', 'success')
    onChanged()
  }

  if (classrooms.length <= 1 && !showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
      >
        <Plus className="h-3 w-3" />
        Add to another classroom
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-muted">Classrooms</h4>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {classrooms.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-sm"
          >
            {c.is_primary && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            )}
            <span>{c.name}</span>
            {!c.is_primary && classrooms.length > 1 && (
              <>
                <button
                  onClick={() => handleSetPrimary(c.id)}
                  title="Make primary"
                  className="ml-1 text-text-light hover:text-amber-500"
                >
                  <Star className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleRemove(c.id)}
                  title="Remove from classroom"
                  className="text-text-light hover:text-error-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="">Select classroom...</option>
            {availableClassrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.grade_level ? ` (${c.grade_level})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedClassroomId || saving}
            className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
          <button
            onClick={() => { setShowAdd(false); setSelectedClassroomId('') }}
            className="text-sm text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

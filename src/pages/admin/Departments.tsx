import { useState, useEffect, useCallback } from 'react'
import { useActiveSchoolId } from '../../lib/school-context'
import { supabase } from '../../lib/supabase'
import { MapPin, Plus, Loader2, Pencil, Trash2, School } from 'lucide-react'
import type { Department, Classroom } from '../../types/database'

export default function Departments() {
  const schoolId = useActiveSchoolId()
  const [departments, setDepartments] = useState<(Department & { classrooms: Classroom[] })[]>([])
  const [unassignedClassrooms, setUnassignedClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)

    const [deptRes, classroomRes] = await Promise.all([
      supabase.from('departments').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
    ])

    const depts = (deptRes.data ?? []) as Department[]
    const classrooms = (classroomRes.data ?? []) as Classroom[]

    // Group classrooms by department
    const deptWithClassrooms = depts.map((d) => ({
      ...d,
      classrooms: classrooms.filter((c) => c.department_id === d.id),
    }))

    setDepartments(deptWithClassrooms)
    setUnassignedClassrooms(classrooms.filter((c) => !c.department_id))
    setLoading(false)
  }, [schoolId])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!schoolId) return
    setSaving(true)
    setError(null)

    if (editingId) {
      const { error: err } = await supabase
        .from('departments')
        .update({ name: formName, description: formDescription || null })
        .eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('departments')
        .insert({ school_id: schoolId, name: formName, description: formDescription || null })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setFormName('')
    setFormDescription('')
    setEditingId(null)
    setShowForm(false)
    setSaving(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this department? Classrooms will be unassigned but not deleted.')) return
    await supabase.from('departments').delete().eq('id', id)
    loadData()
  }

  async function handleAssignClassroom(classroomId: string, departmentId: string | null) {
    await supabase.from('classrooms').update({ department_id: departmentId }).eq('id', classroomId)
    loadData()
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id)
    setFormName(dept.name)
    setFormDescription(dept.description ?? '')
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Departments & Locations</h1>
          <p className="mt-1 text-sm text-text-muted">
            Organize classrooms into departments or locations
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormName(''); setFormDescription('') }}
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          Add Department
        </button>
      </div>

      {/* Create/edit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text">
            {editingId ? 'Edit Department' : 'New Department'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Lower School, Building A"
                required
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Description (optional)</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            {error && <p className="text-sm text-alert-500">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !formName.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create Department'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="rounded-lg border border-bg-muted px-4 py-2 text-sm font-medium text-text hover:bg-bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Department list */}
      {departments.length === 0 && !showForm && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-8 text-center shadow-sm">
          <MapPin className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 font-medium text-text">No departments yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Create departments to organize classrooms by location or division
          </p>
        </div>
      )}

      <div className="space-y-4">
        {departments.map((dept) => (
          <div key={dept.id} className="rounded-xl border border-bg-muted bg-bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-bg-muted px-5 py-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary-500" />
                <div>
                  <h3 className="font-semibold text-text">{dept.name}</h3>
                  {dept.description && (
                    <p className="text-xs text-text-muted">{dept.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                  {dept.classrooms.length} classroom{dept.classrooms.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => startEdit(dept)} className="rounded p-1 text-text-light hover:bg-bg-muted hover:text-text" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(dept.id)} className="rounded p-1 text-text-light hover:bg-alert-50 hover:text-alert-500" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Classrooms in this department */}
            <div className="p-4">
              {dept.classrooms.length === 0 ? (
                <p className="text-sm text-text-light">No classrooms assigned</p>
              ) : (
                <div className="space-y-2">
                  {dept.classrooms.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <School className="h-4 w-4 text-text-light" />
                        <span className="text-sm text-text">{c.name}</span>
                        {c.grade_level && (
                          <span className="text-xs text-text-light">({c.grade_level})</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssignClassroom(c.id, null)}
                        className="text-xs text-text-light hover:text-alert-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign unassigned classrooms */}
              {unassignedClassrooms.length > 0 && (
                <div className="mt-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleAssignClassroom(e.target.value, dept.id)
                      e.target.value = ''
                    }}
                    className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-sm text-text-muted"
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add classroom to this department</option>
                    {unassignedClassrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Unassigned classrooms section */}
        {unassignedClassrooms.length > 0 && departments.length > 0 && (
          <div className="rounded-xl border border-dashed border-bg-muted bg-bg-card/50 p-5">
            <h3 className="mb-3 text-sm font-medium text-text-muted">
              Unassigned Classrooms ({unassignedClassrooms.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {unassignedClassrooms.map((c) => (
                <span key={c.id} className="rounded-full bg-bg-muted px-3 py-1 text-xs text-text-muted">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

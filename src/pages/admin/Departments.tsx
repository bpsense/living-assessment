import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSchoolId } from '../../lib/school-context'
import { supabase } from '../../lib/supabase'
import { useDepartmentLabel } from '../../lib/department-label'
import { MapPin, Plus, Loader2, Pencil, Trash2, School, X } from 'lucide-react'
import type { Department, Classroom, Profile } from '../../types/database'

interface DeptAdmin {
  id: string
  user_id: string
  department_id: string
  full_name: string
  email: string
}

export default function Departments() {
  const schoolId = useActiveSchoolId()
  const { singular, plural } = useDepartmentLabel()
  const [departments, setDepartments] = useState<(Department & { classrooms: Classroom[] })[]>([])
  const [unassignedClassrooms, setUnassignedClassrooms] = useState<Classroom[]>([])
  const [deptAdmins, setDeptAdmins] = useState<Map<string, DeptAdmin[]>>(new Map())
  const [allEducators, setAllEducators] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Department id for which the inline "create classroom" form is open. */
  const [createClassroomFor, setCreateClassroomFor] = useState<string | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomGrade, setNewRoomGrade] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)

  const loadData = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)

    const [deptRes, classroomRes, adminsRes, educatorsRes] = await Promise.all([
      supabase.from('departments').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
      supabase
        .from('department_admins')
        .select('id, user_id, department_id, profiles(full_name, email)')
        .eq('school_id', schoolId),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('school_id', schoolId)
        .eq('role', 'educator')
        .eq('is_active', true)
        .order('full_name'),
    ])

    const depts = (deptRes.data ?? []) as Department[]
    const classrooms = (classroomRes.data ?? []) as Classroom[]

    // Group classrooms by department
    const deptWithClassrooms = depts.map((d) => ({
      ...d,
      classrooms: classrooms.filter((c) => c.department_id === d.id),
    }))

    // Group admins by department
    const adminMap = new Map<string, DeptAdmin[]>()
    for (const row of adminsRes.data ?? []) {
      const r = row as any
      const profile = r.profiles as { full_name: string; email: string } | null
      if (!profile) continue
      const list = adminMap.get(r.department_id) ?? []
      list.push({
        id: r.id,
        user_id: r.user_id,
        department_id: r.department_id,
        full_name: profile.full_name,
        email: profile.email,
      })
      adminMap.set(r.department_id, list)
    }

    setDepartments(deptWithClassrooms)
    setUnassignedClassrooms(classrooms.filter((c) => !c.department_id))
    setDeptAdmins(adminMap)
    setAllEducators((educatorsRes.data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[])
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
    if (!confirm(`Delete this ${singular.toLowerCase()}? Classrooms will be unassigned but not deleted.`)) return
    await supabase.from('departments').delete().eq('id', id)
    loadData()
  }

  async function handleAssignClassroom(classroomId: string, departmentId: string | null) {
    await supabase.from('classrooms').update({ department_id: departmentId }).eq('id', classroomId)
    loadData()
  }

  async function handleCreateClassroomInDept(e: React.FormEvent, departmentId: string) {
    e.preventDefault()
    if (!schoolId || !newRoomName.trim()) return
    setCreatingRoom(true)
    const { error: err } = await supabase.from('classrooms').insert({
      school_id: schoolId,
      department_id: departmentId,
      name: newRoomName.trim(),
      grade_level: newRoomGrade.trim() || null,
    })
    setCreatingRoom(false)
    if (err) { setError(err.message); return }
    setNewRoomName('')
    setNewRoomGrade('')
    setCreateClassroomFor(null)
    loadData()
  }

  async function handleAddAdmin(userId: string, departmentId: string) {
    if (!schoolId) return
    await supabase
      .from('department_admins')
      .upsert(
        { user_id: userId, department_id: departmentId, school_id: schoolId },
        { onConflict: 'user_id,department_id' }
      )
    loadData()
  }

  async function handleRemoveAdmin(userId: string, departmentId: string) {
    await supabase
      .from('department_admins')
      .delete()
      .eq('user_id', userId)
      .eq('department_id', departmentId)
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
          <h1 className="text-2xl font-bold text-text">{plural}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Organize classrooms into {plural.toLowerCase()}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormName(''); setFormDescription('') }}
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          Add {singular}
        </button>
      </div>

      {/* Create/edit form */}
      {showForm && (
        <div className="mb-6 glass-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-text">
            {editingId ? `Edit ${singular}` : `New ${singular}`}
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
                {editingId ? 'Save Changes' : `Create ${singular}`}
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

      {/* Empty state */}
      {departments.length === 0 && !showForm && (
        <div className="glass-card p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 font-medium text-text">No {plural.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Create {plural.toLowerCase()} to organize classrooms
          </p>
        </div>
      )}

      <div className="space-y-4">
        {departments.map((dept) => {
          const admins = deptAdmins.get(dept.id) ?? []
          const adminUserIds = new Set(admins.map((a) => a.user_id))
          const availableEducators = allEducators.filter((e) => !adminUserIds.has(e.id))

          return (
            <div key={dept.id} className="glass-card">
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

              {/* Admins section */}
              <div className="border-b border-bg-muted px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-text-muted">Admins:</span>
                  {admins.length === 0 && (
                    <span className="text-xs text-text-light">None assigned</span>
                  )}
                  {admins.map((admin) => (
                    <span
                      key={admin.user_id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700"
                    >
                      {admin.full_name}
                      <button
                        onClick={() => handleRemoveAdmin(admin.user_id, dept.id)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-accent-200"
                        title="Remove admin"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {availableEducators.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleAddAdmin(e.target.value, dept.id)
                        e.target.value = ''
                      }}
                      className="rounded-lg border border-bg-muted bg-bg px-2 py-0.5 text-xs text-text-muted"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Add admin
                      </option>
                      {availableEducators.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Classrooms in this department */}
              <div className="p-4">
                {dept.classrooms.length === 0 ? (
                  <p className="text-sm text-text-light">No classrooms assigned</p>
                ) : (
                  <div className="space-y-2">
                    {dept.classrooms.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 transition-colors hover:bg-bg-muted">
                        <Link
                          to={`/classroom/${c.id}`}
                          className="flex flex-1 items-center gap-2 text-text hover:text-primary-600"
                        >
                          <School className="h-4 w-4 text-text-light" />
                          <span className="text-sm font-medium">{c.name}</span>
                          {c.grade_level && (
                            <span className="text-xs text-text-light">({c.grade_level})</span>
                          )}
                        </Link>
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

                {/* Add classroom: assign existing or create new */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {unassignedClassrooms.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleAssignClassroom(e.target.value, dept.id)
                        e.target.value = ''
                      }}
                      className="flex-1 rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-sm text-text-muted"
                      defaultValue=""
                    >
                      <option value="" disabled>+ Assign existing classroom</option>
                      {unassignedClassrooms.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateClassroomFor(createClassroomFor === dept.id ? null : dept.id)
                      setNewRoomName('')
                      setNewRoomGrade('')
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create classroom in this {singular.toLowerCase()}
                  </button>
                </div>

                {createClassroomFor === dept.id && (
                  <form
                    onSubmit={(e) => handleCreateClassroomInDept(e, dept.id)}
                    className="mt-3 rounded-lg border border-bg-muted bg-bg p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        autoFocus
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Classroom name *"
                        required
                        className="rounded-lg border border-bg-muted bg-bg-card px-3 py-1.5 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none"
                      />
                      <input
                        value={newRoomGrade}
                        onChange={(e) => setNewRoomGrade(e.target.value)}
                        placeholder="Grade level (optional)"
                        className="rounded-lg border border-bg-muted bg-bg-card px-3 py-1.5 text-sm text-text placeholder:text-text-light focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={creatingRoom || !newRoomName.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                      >
                        {creatingRoom && <Loader2 className="h-3 w-3 animate-spin" />}
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateClassroomFor(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )
        })}

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

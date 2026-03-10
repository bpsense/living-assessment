import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Loader2,
  Search,
  ClipboardPen,
  Pencil,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import type { Student, Classroom } from '../types/database'

// ============================================================
// Types
// ============================================================

interface StudentRow extends Student {
  classroom_name: string
  observation_count: number
}

// ============================================================
// Main page
// ============================================================

export default function Students() {
  const { profile } = useAuth()
  const { role, canEditStudents, canViewAllStudents, isDepartmentAdmin, departmentAdminIds, isReadOnly, formatStudentName } = useAccessControl()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [classroomId, setClassroomId] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')

  useEffect(() => {
    if (!profile) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function fetchAll() {
    if (!profile) return
    setLoading(true)

    try {
      // 1. Determine which classrooms the user can see
      let accessibleClassroomIds: string[] | null = null // null = all

      if (role === 'parent') {
        // Parents see only their linked students (fetch via parent_students)
        const { data: linkedData } = await supabase
          .from('parent_students')
          .select('student_id')
          .eq('parent_id', profile.id)

        const linkedStudentIds = (linkedData ?? []).map((r) => (r as { student_id: string }).student_id)

        if (linkedStudentIds.length === 0) {
          setStudents([])
          setClassrooms([])
          setLoading(false)
          return
        }

        // Fetch only linked students
        const { data: linkedStudents } = await supabase
          .from('students')
          .select('*')
          .in('id', linkedStudentIds)
          .order('last_name')

        const studs = (linkedStudents ?? []) as Student[]
        const classIds = [...new Set(studs.map((s) => s.classroom_id))]

        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .in('id', classIds)

        const rooms = (classroomData ?? []) as Classroom[]
        setClassrooms(rooms)

        const classroomMap = new Map(rooms.map((c) => [c.id, c.name]))

        setStudents(
          studs.map((s) => ({
            ...s,
            classroom_name: classroomMap.get(s.classroom_id) ?? 'Unknown',
            observation_count: 0, // Parents don't need obs counts in the list
          }))
        )
        setLoading(false)
        return
      }

      if (role === 'educator' && !canViewAllStudents) {
        // Educators see only students in their assigned classrooms
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('classroom_id')
          .eq('educator_id', profile.id)

        accessibleClassroomIds = (ecData ?? []).map((r) => (r as { classroom_id: string }).classroom_id)
      } else if (isDepartmentAdmin && !canViewAllStudents) {
        // Department admins see students in their department classrooms
        const { data: deptClassrooms } = await supabase
          .from('classrooms')
          .select('id')
          .eq('school_id', profile.school_id)
          .in('department_id', departmentAdminIds)

        accessibleClassroomIds = (deptClassrooms ?? []).map((r) => (r as { id: string }).id)
      }

      // 2. Fetch classrooms
      let classroomQuery = supabase
        .from('classrooms')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('name')

      if (accessibleClassroomIds !== null) {
        if (accessibleClassroomIds.length === 0) {
          setStudents([])
          setClassrooms([])
          setLoading(false)
          return
        }
        classroomQuery = classroomQuery.in('id', accessibleClassroomIds)
      }

      const { data: classroomData } = await classroomQuery
      const rooms = (classroomData ?? []) as Classroom[]
      setClassrooms(rooms)

      if (rooms.length === 0) {
        setStudents([])
        setLoading(false)
        return
      }

      const roomIds = rooms.map((r) => r.id)

      // 3. Fetch students and observations
      const [studentRes, obsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .in('classroom_id', roomIds)
          .order('last_name'),
        supabase
          .from('observations')
          .select('id, student_id')
          .eq('school_id', profile.school_id),
      ])

      const studs = (studentRes.data ?? []) as Student[]
      const obs = (obsRes.data ?? []) as { id: string; student_id: string }[]

      const classroomMap = new Map(rooms.map((c) => [c.id, c.name]))
      const obsCounts = new Map<string, number>()
      for (const o of obs) {
        obsCounts.set(o.student_id, (obsCounts.get(o.student_id) ?? 0) + 1)
      }

      setStudents(
        studs.map((s) => ({
          ...s,
          classroom_name: classroomMap.get(s.classroom_id) ?? 'Unknown',
          observation_count: obsCounts.get(s.id) ?? 0,
        }))
      )
    } catch {
      toast('Failed to load learners', 'error')
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditStudent(null)
    setFirstName('')
    setLastName('')
    setClassroomId(classrooms[0]?.id ?? '')
    setGradeLevel('')
    setShowForm(true)
  }

  function openEditForm(student: Student) {
    setEditStudent(student)
    setFirstName(student.first_name)
    setLastName(student.last_name)
    setClassroomId(student.classroom_id)
    setGradeLevel(student.grade_level ?? '')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !firstName.trim() || !lastName.trim() || !classroomId) return
    setSaving(true)

    if (editStudent) {
      // Update
      const { error } = await supabase
        .from('students')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          classroom_id: classroomId,
          grade_level: gradeLevel.trim() || null,
        })
        .eq('id', editStudent.id)

      if (error) {
        toast('Failed to update learner', 'error')
      } else {
        toast('Learner updated!', 'success')
      }
    } else {
      // Create
      const { error } = await supabase.from('students').insert({
        school_id: profile.school_id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        classroom_id: classroomId,
        grade_level: gradeLevel.trim() || null,
      })

      if (error) {
        toast('Failed to add learner', 'error')
      } else {
        toast('Learner added!', 'success')
      }
    }

    setSaving(false)
    setShowForm(false)
    fetchAll()
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  // ---------- Filter ----------
  const filtered = search
    ? students.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          s.classroom_name.toLowerCase().includes(search.toLowerCase())
      )
    : students

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {role === 'parent' ? 'My Children' : 'Learners'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {students.length} learner{students.length !== 1 ? 's' : ''} across{' '}
            {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEditStudents && !isReadOnly && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Learner
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or classroom..."
          className="w-full rounded-lg border border-bg-muted bg-bg-card py-2.5 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">
              {editStudent ? 'Edit Learner' : 'Add New Learner'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-text-light hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  First Name *
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Amara"
                  required
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Last Name *
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Johnson"
                  required
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Classroom *
                </label>
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">Select classroom...</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.grade_level ? ` (${c.grade_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Grade Level
                </label>
                <input
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editStudent ? 'Save Changes' : 'Add Learner'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-10 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            {search ? 'No learners match your search.' : 'No learners yet. Add your first learner!'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-bg-muted bg-bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-muted bg-bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-text-muted">Learner</th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-muted sm:table-cell">
                  Classroom
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-muted sm:table-cell">
                  Grade
                </th>
                {role !== 'parent' && (
                  <th className="px-4 py-3 text-center font-medium text-text-muted">Obs</th>
                )}
                <th className="px-4 py-3 text-right font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const displayName = formatStudentName(student.first_name, student.last_name)
                const initials =
                  `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()
                return (
                  <tr
                    key={student.id}
                    className="border-b border-bg-muted last:border-0 transition-colors hover:bg-bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                          {initials}
                        </div>
                        <div>
                          <button
                            onClick={() => navigate(`/student/${student.id}`)}
                            className="font-medium text-text hover:text-primary-600"
                          >
                            {displayName}
                          </button>
                          <p className="text-xs text-text-light sm:hidden">
                            {student.classroom_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {student.classroom_name}
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {student.grade_level ?? '—'}
                    </td>
                    {role !== 'parent' && (
                      <td className="px-4 py-3 text-center text-text-muted">
                        {student.observation_count}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEditStudents && !isReadOnly && (
                          <>
                            <button
                              onClick={() => navigate(`/student/${student.id}/observe`)}
                              title="Record observation"
                              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-primary-50 hover:text-primary-600"
                            >
                              <ClipboardPen className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditForm(student)}
                              title="Edit learner"
                              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

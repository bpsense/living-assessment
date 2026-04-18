import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  School,
  Users,
  ClipboardPen,
  Plus,
  Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import type { Classroom } from '../types/database'

// ============================================================
// Types
// ============================================================

interface ClassroomRow extends Classroom {
  student_count: number
  observation_count: number
}

// ============================================================
// Main page
// ============================================================

export default function Classrooms() {
  const { profile } = useAuth()
  const { role, canEditClassrooms, isDepartmentAdmin, departmentAdminIds, isReadOnly } = useAccessControl()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchClassrooms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function fetchClassrooms() {
    if (!profile) return
    setLoading(true)

    try {
      let rooms: Classroom[] = []

      if (role === 'parent') {
        // Parents see only classrooms their children are in
        const { data: linkedData } = await supabase
          .from('parent_students')
          .select('student_id')
          .eq('parent_id', profile.id)

        const linkedStudentIds = (linkedData ?? []).map((r) => (r as { student_id: string }).student_id)

        if (linkedStudentIds.length === 0) {
          setClassrooms([])
          setLoading(false)
          return
        }

        // Get classrooms via junction table for parent's children
        const { data: scData } = await supabase
          .from('student_classrooms')
          .select('classroom_id')
          .in('student_id', linkedStudentIds)

        const classIds = [...new Set((scData ?? []).map((s) => (s as { classroom_id: string }).classroom_id))]

        if (classIds.length === 0) {
          setClassrooms([])
          setLoading(false)
          return
        }

        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .in('id', classIds)
          .order('name')

        rooms = (classroomData ?? []) as Classroom[]
      } else if (role === 'educator' && !canEditClassrooms) {
        // Educators see only their assigned classrooms
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('classroom_id')
          .eq('educator_id', profile.id)

        const assignedIds = (ecData ?? []).map((r) => (r as { classroom_id: string }).classroom_id)

        if (assignedIds.length === 0) {
          setClassrooms([])
          setLoading(false)
          return
        }

        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .in('id', assignedIds)
          .order('name')

        rooms = (classroomData ?? []) as Classroom[]
      } else if (isDepartmentAdmin && !canEditClassrooms) {
        // Department admins see classrooms in their departments
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .eq('school_id', profile.school_id)
          .in('department_id', departmentAdminIds)
          .order('name')

        rooms = (classroomData ?? []) as Classroom[]
      } else {
        // Admin / System Admin: all classrooms
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('*')
          .eq('school_id', profile.school_id)
          .order('name')

        rooms = (classroomData ?? []) as Classroom[]
      }

      if (rooms.length === 0) {
        setClassrooms([])
        setLoading(false)
        return
      }

      // Student counts (via junction table) + observation counts
      const roomIds = rooms.map((r) => r.id)
      const [scRes, obsRes] = await Promise.all([
        supabase
          .from('student_classrooms')
          .select('student_id, classroom_id')
          .in('classroom_id', roomIds),
        supabase
          .from('observations')
          .select('id, student_id')
          .eq('school_id', profile.school_id),
      ])

      const scRows = (scRes.data ?? []) as { student_id: string; classroom_id: string }[]
      const studentsByRoom = new Map<string, string[]>()
      for (const sc of scRows) {
        const arr = studentsByRoom.get(sc.classroom_id) ?? []
        arr.push(sc.student_id)
        studentsByRoom.set(sc.classroom_id, arr)
      }

      const observations = (obsRes.data ?? []) as { id: string; student_id: string }[]
      const obsByStudent = new Map<string, number>()
      for (const o of observations) {
        obsByStudent.set(o.student_id, (obsByStudent.get(o.student_id) ?? 0) + 1)
      }

      const rows: ClassroomRow[] = rooms.map((room) => {
        const roomStudentIds = studentsByRoom.get(room.id) ?? []
        const obsCount = roomStudentIds.reduce(
          (sum, sid) => sum + (obsByStudent.get(sid) ?? 0),
          0
        )
        return {
          ...room,
          student_count: roomStudentIds.length,
          observation_count: obsCount,
        }
      })

      setClassrooms(rows)
    } catch (err) {
      console.error('Failed to load classrooms:', err)
      toast('Failed to load classrooms', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !newName.trim()) return
    setCreating(true)

    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        school_id: profile.school_id,
        name: newName.trim(),
        grade_level: newGrade.trim() || null,
      })
      .select()
      .single()

    if (error) {
      toast('Failed to create classroom', 'error')
      setCreating(false)
      return
    }

    // Auto-join the new classroom for the creating admin
    if (data) {
      await supabase.from('educator_classrooms').insert({
        educator_id: profile.id,
        classroom_id: data.id,
        school_id: profile.school_id,
      })
    }

    toast('Classroom created!', 'success')
    setNewName('')
    setNewGrade('')
    setShowCreate(false)
    setCreating(false)
    fetchClassrooms()
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Classrooms</h1>
          <p className="mt-1 text-sm text-text-muted">
            {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}
            {' \u00b7 '}
            {classrooms.reduce((s, c) => s + c.student_count, 0)} learners total
          </p>
        </div>
        {canEditClassrooms && !isReadOnly && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            New Classroom
          </button>
        )}
      </div>

      {/* Create classroom form (admin only) */}
      {canEditClassrooms && !isReadOnly && showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-card p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-text">Create Classroom</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Classroom Name *
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Upper Elementary"
                required
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Grade Level
              </label>
              <input
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="e.g. 3-5"
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Classroom list */}
      {classrooms.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <School className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm text-text-muted">
            No classrooms yet.{canEditClassrooms ? ' Create your first classroom to get started.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((room) => (
            <div
              key={room.id}
              onClick={() => navigate(`/classroom/${room.id}`)}
              className="glass-card glass-card-interactive group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                    <School className="h-5 w-5 text-primary-600" />
                  </div>
                  {room.grade_level && (
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                      Grade {room.grade_level}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-base font-bold text-text">{room.name}</h3>

                <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {room.student_count} student{room.student_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardPen className="h-3.5 w-3.5" />
                    {room.observation_count} obs
                  </span>
                </div>
              </div>

              <div className="flex border-t border-bg-muted">
                <span className="flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-primary-600 transition-colors group-hover:bg-primary-50">
                  View Classroom
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

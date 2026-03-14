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
  UserPlus,
  Link2,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import InviteLearnerModal from '../components/student/InviteLearnerModal'
import type { Student, Classroom } from '../types/database'

// ============================================================
// Types
// ============================================================

interface StudentRow extends Student {
  classroom_name: string
  observation_count: number
  accountStatus: 'linked' | 'none'
  linkedEmail: string | null
}

interface UnlinkedLearner {
  id: string
  full_name: string
  email: string
}

// ============================================================
// Main page
// ============================================================

export default function Students() {
  const { profile } = useAuth()
  const { role, canEditStudents, canViewAllStudents, canInviteUsers, isDepartmentAdmin, departmentAdminIds, isReadOnly, formatStudentName, accessLevel } = useAccessControl()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)

  // Account linking state
  const [unlinkedLearners, setUnlinkedLearners] = useState<UnlinkedLearner[]>([])
  const [inviteStudent, setInviteStudent] = useState<Student | null>(null)
  const [linkingLearnerId, setLinkingLearnerId] = useState<string | null>(null)
  const [linkStudentSearch, setLinkStudentSearch] = useState('')
  const [linkingInProgress, setLinkingInProgress] = useState(false)

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
          setUnlinkedLearners([])
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
            observation_count: 0,
            accountStatus: 'none' as const,
            linkedEmail: null,
          }))
        )
        setUnlinkedLearners([])
        setLoading(false)
        return
      }

      if (role === 'educator' && !canViewAllStudents) {
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('classroom_id')
          .eq('educator_id', profile.id)

        accessibleClassroomIds = (ecData ?? []).map((r) => (r as { classroom_id: string }).classroom_id)
      } else if (isDepartmentAdmin && !canViewAllStudents) {
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
          setUnlinkedLearners([])
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
        setUnlinkedLearners([])
        setLoading(false)
        return
      }

      const roomIds = rooms.map((r) => r.id)

      // 3. Fetch students (via junction table), observations, AND learner profiles
      const { data: scData } = await supabase
        .from('student_classrooms')
        .select('student_id')
        .in('classroom_id', roomIds)
      const enrolledStudentIds = [...new Set((scData ?? []).map((r) => r.student_id))]

      const [studentRes, obsRes, profileRes] = await Promise.all([
        enrolledStudentIds.length > 0
          ? supabase
              .from('students')
              .select('*')
              .in('id', enrolledStudentIds)
              .order('last_name')
          : Promise.resolve({ data: [] }),
        supabase
          .from('observations')
          .select('id, student_id')
          .eq('school_id', profile.school_id),
        supabase
          .from('profiles')
          .select('id, full_name, email, student_id')
          .eq('school_id', profile.school_id)
          .eq('role', 'learner'),
      ])

      const studs = (studentRes.data ?? []) as Student[]
      const obs = (obsRes.data ?? []) as { id: string; student_id: string }[]
      const learnerProfiles = (profileRes.data ?? []) as { id: string; full_name: string; email: string; student_id: string | null }[]

      // Build lookup maps
      const classroomMap = new Map(rooms.map((c) => [c.id, c.name]))
      const obsCounts = new Map<string, number>()
      for (const o of obs) {
        obsCounts.set(o.student_id, (obsCounts.get(o.student_id) ?? 0) + 1)
      }

      // Profile map: studentId → { id, email }
      const profileMap = new Map<string, { profileId: string; email: string }>()
      const orphanedProfiles: UnlinkedLearner[] = []

      for (const p of learnerProfiles) {
        if (p.student_id) {
          profileMap.set(p.student_id, { profileId: p.id, email: p.email })
        } else {
          orphanedProfiles.push({ id: p.id, full_name: p.full_name, email: p.email })
        }
      }

      setUnlinkedLearners(orphanedProfiles)

      setStudents(
        studs.map((s) => {
          const linked = profileMap.get(s.id)
          return {
            ...s,
            classroom_name: classroomMap.get(s.classroom_id) ?? 'Unknown',
            observation_count: obsCounts.get(s.id) ?? 0,
            accountStatus: linked ? 'linked' as const : 'none' as const,
            linkedEmail: linked?.email ?? null,
          }
        })
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

  async function handleLinkProfile(learnerId: string, studentId: string) {
    setLinkingInProgress(true)
    const { error } = await supabase
      .from('profiles')
      .update({ student_id: studentId })
      .eq('id', learnerId)

    if (error) {
      toast('Failed to link profile to student', 'error')
    } else {
      toast('Learner account linked!', 'success')
      setLinkingLearnerId(null)
      setLinkStudentSearch('')
      fetchAll()
    }
    setLinkingInProgress(false)
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  // ---------- Computed stats ----------
  const linkedCount = students.filter((s) => s.accountStatus === 'linked').length
  const unlinkedCount = students.filter((s) => s.accountStatus === 'none').length
  const showAccountColumn = role !== 'parent'

  // Students without linked accounts (for the link picker)
  const unlinkedStudents = students.filter((s) => s.accountStatus === 'none')

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
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {role === 'parent' ? 'My Children' : 'Learners'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {students.length} learner{students.length !== 1 ? 's' : ''} across{' '}
            {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}
            {showAccountColumn && students.length > 0 && (
              <span className="ml-1">
                &middot; {linkedCount} with accounts &middot; {unlinkedCount} without
              </span>
            )}
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

      {/* Unlinked learner profiles banner */}
      {unlinkedLearners.length > 0 && accessLevel >= 5 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              {unlinkedLearners.length} Learner Account{unlinkedLearners.length !== 1 ? 's' : ''} Not Linked to a Student
            </h3>
          </div>
          <p className="mb-3 text-xs text-amber-700">
            These users have learner accounts but aren't connected to a student on any class roster. Link them to an existing student to connect their profile.
          </p>
          <div className="space-y-2">
            {unlinkedLearners.map((learner) => (
              <div
                key={learner.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {learner.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{learner.full_name}</p>
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{learner.email}</span>
                  </div>
                </div>

                {linkingLearnerId === learner.id ? (
                  <div className="flex items-center gap-2">
                    {unlinkedStudents.length === 0 ? (
                      <span className="text-xs text-text-muted italic">All students already linked</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Search student..."
                          value={linkStudentSearch}
                          onChange={(e) => setLinkStudentSearch(e.target.value)}
                          className="w-32 rounded border border-bg-muted bg-bg-card px-2 py-1 text-xs focus:border-primary-300 focus:outline-none"
                        />
                        <div className="relative">
                          <select
                            onChange={(e) => {
                              if (e.target.value) handleLinkProfile(learner.id, e.target.value)
                            }}
                            disabled={linkingInProgress}
                            className="appearance-none rounded border border-bg-muted bg-bg-card px-2 py-1 pr-6 text-xs focus:border-primary-300 focus:outline-none"
                          >
                            <option value="">Select student...</option>
                            {unlinkedStudents
                              .filter((s) => {
                                if (!linkStudentSearch) return true
                                return `${s.first_name} ${s.last_name}`
                                  .toLowerCase()
                                  .includes(linkStudentSearch.toLowerCase())
                              })
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.first_name} {s.last_name} — {s.classroom_name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setLinkingLearnerId(null); setLinkStudentSearch('') }}
                      className="rounded p-1 text-text-muted hover:bg-bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setLinkingLearnerId(learner.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />
                    Link to Student
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                {showAccountColumn && (
                  <th className="hidden px-4 py-3 text-left font-medium text-text-muted md:table-cell">
                    Account
                  </th>
                )}
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
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          student.accountStatus === 'linked'
                            ? 'bg-success-50 text-success-700'
                            : 'bg-primary-100 text-primary-700'
                        }`}>
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
                    {showAccountColumn && (
                      <td className="hidden px-4 py-3 md:table-cell">
                        {student.accountStatus === 'linked' ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700"
                            title={student.linkedEmail ?? undefined}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Linked
                          </span>
                        ) : canInviteUsers ? (
                          <button
                            onClick={() => setInviteStudent(student)}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:bg-primary-50 hover:text-primary-700 transition-colors"
                          >
                            <UserPlus className="h-3 w-3" />
                            Invite
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                            No Account
                          </span>
                        )}
                      </td>
                    )}
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
                        {/* Quick invite for mobile (no Account column) */}
                        {showAccountColumn && student.accountStatus === 'none' && canInviteUsers && (
                          <button
                            onClick={() => setInviteStudent(student)}
                            title="Invite learner account"
                            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-primary-50 hover:text-primary-600 md:hidden"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
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

      {/* Invite modal */}
      {inviteStudent && (
        <InviteLearnerModal
          student={inviteStudent}
          open={!!inviteStudent}
          onClose={() => setInviteStudent(null)}
          onSuccess={() => {
            setInviteStudent(null)
            fetchAll()
          }}
        />
      )}
    </div>
  )
}

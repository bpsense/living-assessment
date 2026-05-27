/**
 * SnapshotVisibility.tsx
 *
 * Admin/dept-admin master page for controlling whether the Competency
 * Snapshot section is rendered in each student's family view. The flag
 * lives on `students.family_snapshot_visible` (migration 082).
 *
 * Layout:
 *  - One section per classroom with a bulk toggle ("Show snapshot to all
 *    families in this class" / "Hide from all").
 *  - Below the bulk row, the classroom roster with a per-student toggle.
 *  - A separate "Unenrolled" section for students with no classroom row.
 *
 * Educators and above with `view`/`edit` access can land on this page; only
 * the per-student writes use the standard RLS path on `students`.
 */
import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import {
  setClassroomSnapshotVisibility,
  setStudentSnapshotVisibility,
} from '../../lib/snapshot-visibility'
import type { Classroom, Student } from '../../types/database'

interface RosterEntry {
  student: Student
  /** True if the student appears in at least one classroom in this school. */
  hasClassroom: boolean
}

interface ClassroomBlock {
  classroom: Classroom
  students: Student[]
}

export default function SnapshotVisibility() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const schoolId = profile?.school_id ?? null

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [studentClassrooms, setStudentClassrooms] = useState<
    { student_id: string; classroom_id: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [bulkBusy, setBulkBusy] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    setLoading(true)

    async function run() {
      const [cRes, sRes, scRes] = await Promise.all([
        supabase
          .from('classrooms')
          .select('*')
          .eq('school_id', schoolId)
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('name'),
        supabase
          .from('students')
          .select('*')
          .eq('school_id', schoolId)
          .eq('student_status', 'active')
          .order('last_name'),
        supabase
          .from('student_classrooms')
          .select('student_id, classroom_id')
          .eq('school_id', schoolId)
          .eq('status', 'active'),
      ])

      if (cancelled) return
      setClassrooms((cRes.data ?? []) as Classroom[])
      setStudents((sRes.data ?? []) as Student[])
      setStudentClassrooms(
        (scRes.data ?? []) as { student_id: string; classroom_id: string }[]
      )
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [schoolId])

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  )

  const blocks: ClassroomBlock[] = useMemo(() => {
    const byClassroom = new Map<string, Student[]>()
    for (const sc of studentClassrooms) {
      const stu = studentById.get(sc.student_id)
      if (!stu) continue
      const list = byClassroom.get(sc.classroom_id) ?? []
      list.push(stu)
      byClassroom.set(sc.classroom_id, list)
    }
    return classrooms.map((c) => ({
      classroom: c,
      students: (byClassroom.get(c.id) ?? []).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      ),
    }))
  }, [classrooms, studentClassrooms, studentById])

  const unenrolled: RosterEntry[] = useMemo(() => {
    const enrolledIds = new Set(studentClassrooms.map((r) => r.student_id))
    return students
      .filter((s) => !enrolledIds.has(s.id))
      .map((s) => ({ student: s, hasClassroom: false }))
  }, [students, studentClassrooms])

  const filterLower = filter.trim().toLowerCase()
  const filteredBlocks = filterLower
    ? blocks
        .map((b) => ({
          ...b,
          students: b.students.filter((s) =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(filterLower)
          ),
        }))
        .filter((b) => b.students.length > 0 || b.classroom.name.toLowerCase().includes(filterLower))
    : blocks

  const filteredUnenrolled = filterLower
    ? unenrolled.filter((u) =>
        `${u.student.first_name} ${u.student.last_name}`
          .toLowerCase()
          .includes(filterLower)
      )
    : unenrolled

  function applyStudentLocal(studentId: string, visible: boolean) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, family_snapshot_visible: visible } : s
      )
    )
  }

  async function handleRowToggle(student: Student) {
    if (rowBusy) return
    const next = !student.family_snapshot_visible
    setRowBusy(student.id)
    applyStudentLocal(student.id, next)
    const { error } = await setStudentSnapshotVisibility(student.id, next)
    setRowBusy(null)
    if (error) {
      applyStudentLocal(student.id, !next)
      toast(error, 'error')
    }
  }

  async function handleBulk(block: ClassroomBlock, visible: boolean) {
    if (bulkBusy) return
    setBulkBusy(block.classroom.id)
    // Optimistic update
    const ids = new Set(block.students.map((s) => s.id))
    setStudents((prev) =>
      prev.map((s) =>
        ids.has(s.id) ? { ...s, family_snapshot_visible: visible } : s
      )
    )
    const { updated, error } = await setClassroomSnapshotVisibility(
      block.classroom.id,
      visible
    )
    setBulkBusy(null)
    if (error) {
      // Roll back optimistic update by refetching the affected students.
      const { data } = await supabase
        .from('students')
        .select('*')
        .in('id', [...ids])
      if (data) {
        const fetched = data as Student[]
        setStudents((prev) =>
          prev.map((s) => fetched.find((f) => f.id === s.id) ?? s)
        )
      }
      toast(error, 'error')
      return
    }
    toast(
      visible
        ? `Snapshot visible for ${updated} learner${updated === 1 ? '' : 's'} in ${block.classroom.name}`
        : `Snapshot hidden for ${updated} learner${updated === 1 ? '' : 's'} in ${block.classroom.name}`,
      'success'
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary-500" />
          <h1 className="text-2xl font-bold text-text">Snapshot Visibility</h1>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Control whether the Competency Snapshot section is shown to families
          and learners in each student's profile. Toggle by entire classroom
          or for individual students. Educators and admins always see the
          snapshot regardless of this setting.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search learners or classrooms…"
          className="w-full rounded-xl border border-bg-muted bg-bg-card py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </div>

      {filteredBlocks.length === 0 && filteredUnenrolled.length === 0 && (
        <p className="rounded-xl border border-dashed border-bg-muted bg-bg-card p-6 text-center text-sm text-text-muted">
          No learners found.
        </p>
      )}

      <div className="space-y-4">
        {filteredBlocks.map((block) => (
          <ClassroomCard
            key={block.classroom.id}
            block={block}
            bulkBusy={bulkBusy === block.classroom.id}
            rowBusyId={rowBusy}
            onBulk={(visible) => handleBulk(block, visible)}
            onRowToggle={handleRowToggle}
          />
        ))}

        {filteredUnenrolled.length > 0 && (
          <UnenrolledCard
            students={filteredUnenrolled.map((u) => u.student)}
            rowBusyId={rowBusy}
            onRowToggle={handleRowToggle}
          />
        )}
      </div>
    </div>
  )
}

function ClassroomCard({
  block,
  bulkBusy,
  rowBusyId,
  onBulk,
  onRowToggle,
}: {
  block: ClassroomBlock
  bulkBusy: boolean
  rowBusyId: string | null
  onBulk: (visible: boolean) => void
  onRowToggle: (student: Student) => void
}) {
  const { classroom, students } = block
  const visibleCount = students.filter((s) => s.family_snapshot_visible).length
  const hiddenCount = students.length - visibleCount

  return (
    <section className="rounded-2xl border border-bg-muted bg-bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-bg-muted p-4">
        <div>
          <h2 className="text-base font-semibold text-text">
            {classroom.name}
            {classroom.grade_level && (
              <span className="ml-2 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                {classroom.grade_level}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {students.length} learner{students.length === 1 ? '' : 's'}
            {students.length > 0 && (
              <>
                {' · '}
                <span className="text-success-600">{visibleCount} visible</span>
                {hiddenCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-text-muted">{hiddenCount} hidden</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={bulkBusy || students.length === 0}
            onClick={() => onBulk(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-success-200 bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-700 hover:bg-success-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            Show all
          </button>
          <button
            type="button"
            disabled={bulkBusy || students.length === 0}
            onClick={() => onBulk(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg-muted/60 px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
            Hide all
          </button>
        </div>
      </header>

      {students.length === 0 ? (
        <p className="p-4 text-xs text-text-muted">No learners enrolled.</p>
      ) : (
        <ul className="divide-y divide-bg-muted">
          {students.map((s) => (
            <StudentRow
              key={s.id}
              student={s}
              busy={rowBusyId === s.id}
              onToggle={() => onRowToggle(s)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function UnenrolledCard({
  students,
  rowBusyId,
  onRowToggle,
}: {
  students: Student[]
  rowBusyId: string | null
  onRowToggle: (student: Student) => void
}) {
  return (
    <section className="rounded-2xl border border-dashed border-bg-muted bg-bg-card/60">
      <header className="border-b border-bg-muted p-4">
        <h2 className="text-base font-semibold text-text-muted">
          Not in any classroom
        </h2>
        <p className="mt-0.5 text-xs text-text-light">
          {students.length} learner{students.length === 1 ? '' : 's'} — toggle individually.
        </p>
      </header>
      <ul className="divide-y divide-bg-muted">
        {students.map((s) => (
          <StudentRow
            key={s.id}
            student={s}
            busy={rowBusyId === s.id}
            onToggle={() => onRowToggle(s)}
          />
        ))}
      </ul>
    </section>
  )
}

function StudentRow({
  student,
  busy,
  onToggle,
}: {
  student: Student
  busy: boolean
  onToggle: () => void
}) {
  const visible = student.family_snapshot_visible
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-text">
          {student.last_name}, {student.first_name}
        </p>
        {student.grade_level && (
          <p className="text-[11px] text-text-light">Grade {student.grade_level}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={visible}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          visible
            ? 'border-success-200 bg-success-50 text-success-700 hover:bg-success-100'
            : 'border-bg-muted bg-bg-muted/60 text-text-muted hover:bg-bg-muted'
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : visible ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
        {visible ? 'Visible' : 'Hidden'}
      </button>
    </li>
  )
}

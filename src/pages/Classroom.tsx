import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Loader2,
  ArrowLeft,
  Users,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  X,
  Plus,
  UserCheck,
  UserPlus,
  Upload,
  LayoutGrid,
  List,
  Phone,
  MessageCircle,
} from 'lucide-react'
import { useClassroomView } from '../lib/classroom-data'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { assignClassroom, unassignClassroom } from '../lib/educator-data'
import { DimensionIcon } from '../components/student/DimensionIcon'
import MiniRadar from '../components/dashboard/MiniRadar'
import AddStudentModal from '../components/classroom/AddStudentModal'
import CsvImportModal from '../components/classroom/CsvImportModal'
import CreateAssignmentModal from '../components/assignment/CreateAssignmentModal'
import { createClassConversation } from '../lib/messaging-data'
import type { DimensionScore } from '../lib/student-data'
import type { Student, Dimension, StudentContact } from '../types/database'

// ============================================================
// Competency-level colour helpers
// ============================================================

/** Map a 1-5 average to one of the 4 rating buckets (0 = no data) */
function compLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0
  if (score < 1.5) return 1
  if (score < 2.5) return 2
  if (score < 3.5) return 3
  return 4
}

const LEVEL_BG: Record<number, string> = {
  0: 'bg-bg-muted',
  1: 'bg-alert-500',
  2: 'bg-caution-500',
  3: 'bg-primary-400',
  4: 'bg-success-500',
}

const LEVEL_BG_LIGHT: Record<number, string> = {
  0: 'bg-bg-muted',
  1: 'bg-alert-50',
  2: 'bg-caution-50',
  3: 'bg-primary-50',
  4: 'bg-success-50',
}

const LEVEL_TEXT: Record<number, string> = {
  0: 'text-text-light',
  1: 'text-alert-600',
  2: 'text-caution-600',
  3: 'text-primary-700',
  4: 'text-success-600',
}

const LEVEL_LABEL: Record<number, string> = {
  0: '—',
  1: 'Emerging',
  2: 'Developing',
  3: 'Achieving',
  4: 'Mastery',
}

// ============================================================
// Main page
// ============================================================

export default function ClassroomPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { actualRole, profile } = useAuth()
  const { toast } = useToast()
  const {
    classroom,
    educators,
    allSchoolEducators,
    students,
    dimensions,
    studentScoresMap,
    classInterestPulse,
    studentContactsMap,
    loading,
    error,
    refetch,
  } = useClassroomView(id)

  // Use actualRole (not profile.role) so the section stays visible
  // even when the admin is using the view-as switcher
  const isAdmin = actualRole === 'admin'
  const isStaff = actualRole === 'admin' || actualRole === 'educator'
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [showAddEducator, setShowAddEducator] = useState(false)
  const [assigningEducator, setAssigningEducator] = useState(false)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [creatingClassChat, setCreatingClassChat] = useState(false)

  // ------ Loading / Error ------
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !classroom) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
        <p className="text-lg font-semibold text-text">Classroom not found</p>
        <p className="text-sm text-text-muted">{error}</p>
        <button
          onClick={() => navigate('/classrooms')}
          className="mt-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          Back to Classrooms
        </button>
      </div>
    )
  }

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* ================================================================
          1. HEADER
          ================================================================ */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{classroom.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
              {classroom.grade_level && (
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" /> Grade{' '}
                  {classroom.grade_level}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" /> {students.length} learner
                {students.length !== 1 ? 's' : ''}
              </span>
              {educators.length > 0 && (
                <span>
                  {educators.map((e) => e.full_name).join(', ')}
                </span>
              )}
            </div>
            <span className="mt-1.5 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              {currentPeriod}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isStaff && (
              <>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Learner
                </button>
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </button>
                <button
                  onClick={() => setShowCreateAssignment(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700 transition-colors hover:bg-accent-100"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  New Assignment
                </button>
                <button
                  onClick={async () => {
                    if (!classroom || !profile || creatingClassChat) return
                    setCreatingClassChat(true)
                    try {
                      await createClassConversation(
                        classroom.id,
                        classroom.name,
                        profile.id,
                        classroom.school_id
                      )
                      navigate('/messages')
                    } catch (err: any) {
                      toast(err.message || 'Failed to open class chat', 'error')
                    } finally {
                      setCreatingClassChat(false)
                    }
                  }}
                  disabled={creatingClassChat}
                  className="flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-50"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Class Chat
                </button>
              </>
            )}
            <BulkActions
              students={students}
              dimensions={dimensions}
              studentScoresMap={studentScoresMap}
              classroomName={classroom.name}
            />
          </div>
        </div>
      </div>

      {/* ================================================================
          1b. EDUCATORS (admin can add/remove)
          ================================================================ */}
      {isAdmin && (
        <section className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <UserCheck className="h-4 w-4 text-primary-500" />
              Assigned Educators
            </h2>
            <button
              onClick={() => setShowAddEducator(!showAddEducator)}
              className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Educator
            </button>
          </div>

          {/* Add educator dropdown */}
          {showAddEducator && (() => {
            const assignedIds = new Set(educators.map((e) => e.id))
            const unassigned = allSchoolEducators.filter((e) => !assignedIds.has(e.id))
            return (
              <div className="mb-3 rounded-lg border border-bg-muted bg-bg p-3">
                {unassigned.length > 0 ? (
                  <>
                    <p className="mb-2 text-xs font-medium text-text-muted">Select an educator to assign:</p>
                    <div className="flex flex-wrap gap-2">
                      {unassigned.map((e) => (
                        <button
                          key={e.id}
                          onClick={async () => {
                            if (assigningEducator || !classroom) return
                            setAssigningEducator(true)
                            const { error: err } = await assignClassroom(e.id, classroom.id, classroom.school_id)
                            if (err) {
                              toast(`Failed to assign: ${err}`, 'error')
                            } else {
                              toast(`${e.full_name} assigned to ${classroom.name}`, 'success')
                              refetch()
                            }
                            setAssigningEducator(false)
                          }}
                          disabled={assigningEducator}
                          className="rounded-lg border border-bg-muted bg-bg-card px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50"
                        >
                          {e.full_name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-light">All educators are already assigned to this classroom.</p>
                )}
              </div>
            )
          })()}

          {/* Assigned educators list */}
          {educators.length === 0 ? (
            <p className="text-sm text-text-light">No educators assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {educators.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-1.5"
                >
                  <span className="text-xs font-medium text-primary-700">{e.full_name}</span>
                  <button
                    onClick={async () => {
                      if (assigningEducator || !classroom) return
                      setAssigningEducator(true)
                      const { error: err } = await unassignClassroom(e.id, classroom.id)
                      if (err) {
                        toast(`Failed to remove: ${err}`, 'error')
                      } else {
                        toast(`${e.full_name} removed from ${classroom.name}`, 'success')
                        refetch()
                      }
                      setAssigningEducator(false)
                    }}
                    disabled={assigningEducator}
                    className="rounded-full p-0.5 text-primary-400 transition-colors hover:bg-primary-100 hover:text-primary-700 disabled:opacity-50"
                    title={`Remove ${e.full_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================
          2. STUDENT ROSTER
          ================================================================ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">Learners</h2>
          {students.length > 0 && (
            <div className="flex items-center rounded-lg border border-bg-muted bg-bg-card p-0.5">
              <button
                onClick={() => setViewMode('card')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'card'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          )}
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-bg-muted bg-bg-card p-8 text-center shadow-sm">
            <Users className="mx-auto h-10 w-10 text-text-light" />
            <p className="mt-3 text-sm text-text-muted">
              No learners in this classroom yet.
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                dimensions={dimensions}
                scores={studentScoresMap.get(student.id) ?? []}
                onClick={() => navigate(`/student/${student.id}`)}
              />
            ))}
          </div>
        ) : (
          <StudentTable
            students={students}
            studentContactsMap={studentContactsMap}
            onStudentClick={(sid) => navigate(`/student/${sid}`)}
          />
        )}
      </section>

      {/* ================================================================
          3. CLASS-LEVEL ANALYTICS (collapsible)
          ================================================================ */}
      {students.length > 0 && dimensions.length > 0 && (
        <section>
          <button
            onClick={() => setAnalyticsOpen((v) => !v)}
            className="mb-3 flex w-full items-center justify-between text-left"
          >
            <h2 className="text-lg font-bold text-text">
              Class Analytics
            </h2>
            {analyticsOpen ? (
              <ChevronUp className="h-5 w-5 text-text-muted" />
            ) : (
              <ChevronDown className="h-5 w-5 text-text-muted" />
            )}
          </button>

          {analyticsOpen && (
            <div className="space-y-6">
              {/* ---- Dimension Heatmap ---- */}
              <CompetencyHeatmap
                students={students}
                dimensions={dimensions}
                studentScoresMap={studentScoresMap}
                onStudentClick={(sid) => navigate(`/student/${sid}`)}
              />

              {/* ---- Class Interest Pulse ---- */}
              <ClassInterestPulse data={classInterestPulse} />
            </div>
          )}
        </section>
      )}

      {/* ================================================================
          MODALS
          ================================================================ */}
      {showAddStudentModal && classroom && (
        <AddStudentModal
          open={showAddStudentModal}
          onClose={() => setShowAddStudentModal(false)}
          classroomId={classroom.id}
          schoolId={classroom.school_id}
          onSaved={refetch}
        />
      )}

      {showCsvModal && classroom && (
        <CsvImportModal
          open={showCsvModal}
          onClose={() => setShowCsvModal(false)}
          classroomId={classroom.id}
          schoolId={classroom.school_id}
          onImported={refetch}
        />
      )}

      {showCreateAssignment && classroom && (
        <CreateAssignmentModal
          open={showCreateAssignment}
          onClose={() => setShowCreateAssignment(false)}
          onCreated={() => {
            setShowCreateAssignment(false)
          }}
          classroomId={classroom.id}
        />
      )}
    </div>
  )
}

// ============================================================
// Student Card
// ============================================================

function StudentCard({
  student,
  dimensions,
  scores,
  onClick,
}: {
  student: Student
  dimensions: Dimension[]
  scores: DimensionScore[]
  onClick: () => void
}) {
  const initials =
    `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()
  const hasScores = scores.some((d) => d.competency > 0 || d.interest > 0)

  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-bg-muted bg-bg-card p-4 text-left shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
    >
      {/* Avatar + Name */}
      <div className="mb-3 flex items-center gap-3">
        {student.avatar_url ? (
          <img
            src={student.avatar_url}
            alt={`${student.first_name} ${student.last_name}`}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
            <span className="text-sm font-bold text-primary-700">
              {initials}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">
            {student.first_name} {student.last_name}
          </p>
          {student.grade_level && (
            <p className="text-xs text-text-light">
              Grade {student.grade_level}
            </p>
          )}
        </div>
      </div>

      {/* Mini Radar */}
      <div className="-mx-1">
        {hasScores ? (
          <MiniRadar dimensionScores={scores} />
        ) : (
          <div className="flex h-[180px] items-center justify-center">
            <p className="text-[11px] text-text-light">No data yet</p>
          </div>
        )}
      </div>

      {/* Competency dots row */}
      <div className="mt-1 flex items-center justify-center gap-1.5">
        {dimensions.map((dim) => {
          const ds = scores.find((s) => s.dimension_id === dim.id)
          const level = compLevel(ds?.competency ?? 0)
          return (
            <div
              key={dim.id}
              title={`${dim.name}: ${LEVEL_LABEL[level]}`}
              className={clsx(
                'h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-110',
                LEVEL_BG[level]
              )}
            />
          )
        })}
      </div>
    </button>
  )
}

// ============================================================
// Student Table (list view)
// ============================================================

function StudentTable({
  students,
  studentContactsMap,
  onStudentClick,
}: {
  students: Student[]
  studentContactsMap: Map<string, StudentContact[]>
  onStudentClick: (id: string) => void
}) {
  /** Compute age from date_of_birth */
  function computeAge(dob: string | null): string {
    if (!dob) return '—'
    const birth = new Date(dob + 'T00:00:00')
    if (isNaN(birth.getTime())) return '—'
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const monthDiff = now.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--
    }
    return age >= 0 ? String(age) : '—'
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-bg-muted bg-bg-card shadow-sm">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-bg-muted bg-bg">
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
              Grade
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted">
              Age
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Emergency Contact
              </span>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((st) => {
            const contacts = studentContactsMap.get(st.id) ?? []
            const primary = contacts.find((c) => c.is_primary) ?? contacts[0]
            const initials = `${st.first_name[0]}${st.last_name[0]}`.toUpperCase()

            return (
              <tr
                key={st.id}
                onClick={() => onStudentClick(st.id)}
                className="cursor-pointer border-b border-bg-muted transition-colors last:border-b-0 hover:bg-primary-50/50"
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {st.avatar_url ? (
                      <img
                        src={st.avatar_url}
                        alt={`${st.first_name} ${st.last_name}`}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                        <span className="text-xs font-bold text-primary-700">
                          {initials}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">
                        {st.first_name} {st.last_name}
                      </p>
                      {st.preferred_name && (
                        <p className="truncate text-xs text-text-light">
                          &ldquo;{st.preferred_name}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Grade */}
                <td className="px-4 py-3 text-text-muted">
                  {st.grade_level ?? '—'}
                </td>

                {/* Age */}
                <td className="px-4 py-3 text-center text-text-muted">
                  {computeAge(st.date_of_birth)}
                </td>

                {/* Emergency Contact */}
                <td className="px-4 py-3">
                  {primary ? (
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">
                        {primary.full_name}
                        {primary.relationship && (
                          <span className="ml-1 text-xs text-text-light">
                            ({primary.relationship})
                          </span>
                        )}
                      </p>
                      {primary.phone && (
                        <p className="truncate text-xs text-text-muted">
                          {primary.phone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-text-light">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      st.student_status === 'active'
                        ? 'bg-success-50 text-success-700'
                        : st.student_status === 'inactive'
                          ? 'bg-caution-50 text-caution-700'
                          : 'bg-alert-50 text-alert-700'
                    )}
                  >
                    {st.student_status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// Competency Heatmap
// ============================================================

function CompetencyHeatmap({
  students,
  dimensions,
  studentScoresMap,
  onStudentClick,
}: {
  students: Student[]
  dimensions: Dimension[]
  studentScoresMap: Map<string, DimensionScore[]>
  onStudentClick: (id: string) => void
}) {
  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      <h3 className="mb-1 text-base font-bold text-text">
        Dimension Heatmap
      </h3>
      <p className="mb-4 text-xs text-text-muted">
        Competency levels across all learners and dimensions
      </p>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-medium text-text-muted">
        {([1, 2, 3, 4] as const).map((l) => (
          <span key={l} className="flex items-center gap-1">
            <span
              className={clsx('inline-block h-3 w-3 rounded-sm', LEVEL_BG[l])}
            />
            {LEVEL_LABEL[l]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-bg-muted" />
          No data
        </span>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-bg-card pb-2 pr-3 text-left font-semibold text-text-muted">
                Learner
              </th>
              {dimensions.map((dim) => (
                <th
                  key={dim.id}
                  className="pb-2 text-center font-normal text-text-muted"
                >
                  <div
                    className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-bg-muted"
                    title={dim.name}
                  >
                    <DimensionIcon
                      name={dim.icon}
                      className="h-3.5 w-3.5 text-text-muted"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const scores = studentScoresMap.get(st.id) ?? []
              return (
                <tr
                  key={st.id}
                  className="cursor-pointer transition-colors hover:bg-bg"
                  onClick={() => onStudentClick(st.id)}
                >
                  <td className="sticky left-0 z-10 bg-bg-card py-1 pr-3 font-medium text-text">
                    {st.first_name} {st.last_name[0]}.
                  </td>
                  {dimensions.map((dim) => {
                    const ds = scores.find(
                      (s) => s.dimension_id === dim.id
                    )
                    const level = compLevel(ds?.competency ?? 0)
                    return (
                      <td key={dim.id} className="p-0.5 text-center">
                        <div
                          className={clsx(
                            'mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold',
                            level === 0
                              ? 'bg-bg-muted text-text-light'
                              : LEVEL_BG_LIGHT[level],
                            level > 0 && LEVEL_TEXT[level]
                          )}
                          title={`${dim.name}: ${LEVEL_LABEL[level]}${ds?.competency ? ` (${ds.competency.toFixed(1)})` : ''}`}
                        >
                          {level > 0 ? level : ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Class Interest Pulse — bar chart
// ============================================================

function ClassInterestPulse({
  data,
}: {
  data: { dimension_id: string; dimension_name: string; icon: string | null; avg_interest: number }[]
}) {
  const sorted = [...data].sort((a, b) => b.avg_interest - a.avg_interest)
  const hasData = sorted.some((d) => d.avg_interest > 0)

  const chartData = sorted.map((d) => ({
    name: truncateName(d.dimension_name),
    interest: d.avg_interest,
  }))

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      <h3 className="mb-1 text-base font-bold text-text">
        Class Interest Pulse
      </h3>
      <p className="mb-4 text-xs text-text-muted">
        Average learner interest rating per dimension
      </p>

      {hasData ? (
        <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F1EC" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 5]}
              tickCount={6}
              tick={{ fontSize: 10, fill: '#B2BEC3' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: '#636E72' }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #F3F1EC',
              }}
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toFixed(1)} / 5`,
                'Avg Interest',
              ]}
            />
            <Bar
              dataKey="interest"
              fill="#D4943A"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-40 items-center justify-center">
          <p className="text-xs text-text-light">
            No interest survey data yet
          </p>
        </div>
      )}
    </div>
  )
}

function truncateName(name: string, max = 16): string {
  if (name.length <= max) return name
  const words = name.split(/[\s&]+/)
  let result = words[0]
  for (let i = 1; i < words.length; i++) {
    if ((result + ' ' + words[i]).length > max) break
    result += ' ' + words[i]
  }
  return result.length < name.length ? result + '...' : result
}

// ============================================================
// Bulk Actions toolbar
// ============================================================

function BulkActions({
  students,
  dimensions,
  studentScoresMap,
  classroomName,
}: {
  students: Student[]
  dimensions: Dimension[]
  studentScoresMap: Map<string, DimensionScore[]>
  classroomName: string
}) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [surveyTokens, setSurveyTokens] = useState<
    { student_id: string; student_name: string; token: string }[]
  >([])
  const [creatingSessions, setCreatingSessions] = useState(false)

  // ---------- Start Class Interest Survey ----------

  async function startClassSurvey() {
    if (!profile || students.length === 0) return
    setCreatingSessions(true)
    setSurveyModalOpen(true)

    const rows = students.map((s) => ({
      student_id: s.id,
      school_id: s.school_id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }))

    const { data, error } = await supabase
      .from('student_sessions')
      .insert(rows)
      .select('student_id, token')

    setCreatingSessions(false)

    if (error || !data) {
      toast('Failed to create survey sessions', 'error')
      setSurveyModalOpen(false)
      return
    }

    const tokens = (data as { student_id: string; token: string }[]).map(
      (d) => {
        const st = students.find((s) => s.id === d.student_id)
        return {
          student_id: d.student_id,
          student_name: st
            ? `${st.first_name} ${st.last_name}`
            : 'Unknown',
          token: d.token,
        }
      }
    )

    setSurveyTokens(tokens)
  }

  // ---------- Export Class Report ----------

  function exportReport() {
    if (students.length === 0) return

    // Build CSV rows
    const dimHeaders = dimensions.map((d) => d.name)
    const header = [
      'Learner',
      'Grade',
      ...dimHeaders.map((h) => `${h} (Comp)`),
      ...dimHeaders.map((h) => `${h} (Interest)`),
      'Avg Competency',
      'Avg Interest',
    ]

    const rows: string[][] = students.map((st) => {
      const scores = studentScoresMap.get(st.id) ?? []
      const comps = dimensions.map((d) => {
        const ds = scores.find((s) => s.dimension_id === d.id)
        return ds?.competency ? ds.competency.toFixed(1) : ''
      })
      const interests = dimensions.map((d) => {
        const ds = scores.find((s) => s.dimension_id === d.id)
        return ds?.interest ? ds.interest.toFixed(1) : ''
      })

      const compValues = scores
        .map((s) => s.competency)
        .filter((v) => v > 0)
      const intValues = scores
        .map((s) => s.interest)
        .filter((v) => v > 0)

      const avgComp =
        compValues.length > 0
          ? (
              compValues.reduce((a, b) => a + b, 0) / compValues.length
            ).toFixed(1)
          : ''
      const avgInt =
        intValues.length > 0
          ? (
              intValues.reduce((a, b) => a + b, 0) / intValues.length
            ).toFixed(1)
          : ''

      return [
        `${st.first_name} ${st.last_name}`,
        st.grade_level ?? '',
        ...comps,
        ...interests,
        avgComp,
        avgInt,
      ]
    })

    const csvContent = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${classroomName.replace(/\s+/g, '_')}_report.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast('Class report downloaded')
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={startClassSurvey}
          disabled={students.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-100 disabled:opacity-50 sm:text-sm"
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Start Class</span> Survey
        </button>
        <button
          onClick={exportReport}
          disabled={students.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50 sm:text-sm"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span> Report
        </button>
      </div>

      {/* ---- Survey modal ---- */}
      {surveyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSurveyModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
              <h3 className="text-base font-bold text-text">
                Class Interest Survey
              </h3>
              <button
                onClick={() => setSurveyModalOpen(false)}
                className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {creatingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
                  <span className="ml-2 text-sm text-text-muted">
                    Creating sessions...
                  </span>
                </div>
              ) : surveyTokens.length > 0 ? (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-text-muted">
                    Sessions created for {surveyTokens.length} learner
                    {surveyTokens.length !== 1 ? 's' : ''}. Open each
                    survey on a shared device. Links expire in 24 hours.
                  </p>
                  {surveyTokens.map((t) => (
                    <div
                      key={t.student_id}
                      className="flex items-center justify-between rounded-lg border border-bg-muted px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-text">
                        {t.student_name}
                      </span>
                      <button
                        onClick={() => navigate(`/survey/${t.token}`)}
                        className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-600"
                      >
                        Open Survey
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-text-muted">
                  No learners to survey.
                </p>
              )}
            </div>

            <div className="border-t border-bg-muted px-5 py-3">
              <button
                onClick={() => setSurveyModalOpen(false)}
                className="w-full rounded-lg bg-bg-muted px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

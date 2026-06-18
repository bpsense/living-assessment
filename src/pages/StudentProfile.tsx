import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { differenceInYears } from 'date-fns'
import { Loader2, AlertCircle, ClipboardPen, ClipboardList, ArrowLeft, FileDown, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useStudentProfile } from '../lib/student-data'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { usePageAccess } from '../lib/role-permissions'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import AssignModal from '../components/assignment/AssignModal'
import { smoothSnapshots, snapshotToDimensionScores } from '../lib/living-data'
import { buildSnapshotsFromObservations } from '../lib/observation-snapshots'
import LivingVisualization from '../components/student/LivingVisualization'
import AmoebaEmptyState from '../components/student/AmoebaEmptyState'
import CompetencySnapshot from '../components/student/CompetencySnapshot'
import ZoneMatrix from '../components/student/ZoneMatrix'
import { INTEREST_ENABLED, MESSAGING_ENABLED } from '../lib/features'
import AILearningGuide from '../components/student/AILearningGuide'
import FamilySupportGuide from '../components/student/FamilySupportGuide'
import Timeline from '../components/student/Timeline'
import SISSection from '../components/student/SISSection'
import SISEditModal from '../components/student/SISEditModal'
import TeacherNotes from '../components/student/TeacherNotes'
import ParentNotes from '../components/student/ParentNotes'
import StudentIncidents from '../components/student/StudentIncidents'
import LearnerMessagesSection from '../components/student/LearnerMessagesSection'
import StudentContextDoc from '../components/student/StudentContextDoc'
import StudentClassroomsManager from '../components/student/StudentClassroomsManager'
import StudentAssignmentsSection from '../components/student/StudentAssignmentsSection'

// ============================================================
// Student avatar with fallback initials
// ============================================================

function StudentAvatar({
  student,
}: {
  student: { first_name: string; last_name: string; avatar_url: string | null }
}) {
  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase()

  if (student.avatar_url) {
    return (
      <img
        src={student.avatar_url}
        alt={`${student.first_name} ${student.last_name}`}
        className="h-20 w-20 rounded-full border-4 border-bg-card object-cover shadow-md"
      />
    )
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bg-card bg-primary-100 shadow-md">
      <span className="text-2xl font-bold text-primary-700">{initials}</span>
    </div>
  )
}

// ============================================================
// Main page component
// ============================================================

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { role, formatStudentName, canExportReports } = useAccessControl()
  const { canEdit: canAssign } = usePageAccess('assignments')
  const { toast } = useToast()
  const [launchingSurvey, setLaunchingSurvey] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showSISEdit, setShowSISEdit] = useState(false)
  const [showStudentNumber, setShowStudentNumber] = useState(false)
  const [copiedNumber, setCopiedNumber] = useState(false)
  const {
    student,
    classroom,
    classrooms,
    dimensions,
    dimensionScores,
    timeline,
    observations,
    surveys,
    observers,
    loading,
    error,
    refetch,
  } = useStudentProfile(id)

  const isFamilyView = role === 'parent'

  // Filter dimensions for family view — only show those marked visible_to_family
  const visibleDimensions = useMemo(
    () => (isFamilyView ? dimensions.filter((d) => d.visible_to_family) : dimensions),
    [dimensions, isFamilyView]
  )
  const visibleDimensionIds = useMemo(
    () => new Set(visibleDimensions.map((d) => d.id)),
    [visibleDimensions]
  )

  // ── Timeline / snapshot state (lifted from LivingVisualization) ──
  // Timeline is shown by default for educators so they can always rewind
  const [snapshotIdx, setSnapshotIdx] = useState<number | null>(null)
  const [showTimeline, setShowTimeline] = useState(true)
  const [playing, setPlaying] = useState(false)

  // ── Determine amoeba empty-state variant ──
  const amoebaEmptyVariant = useMemo<'no_dob' | 'no_assessments' | null>(() => {
    if (!student) return null
    if (!student.date_of_birth) return 'no_dob'
    if (observations.length > 0) return null
    return 'no_assessments'
  }, [student, observations.length])

  // Build the amoeba timeline from the student's observations, rolled up per
  // dimension and converted to the DimensionScore[] shape the LivingBlob consumes
  // (interest dots merged in from the latest interest survey at each cutoff).
  const snapshots = useMemo(() => {
    if (!student?.date_of_birth || amoebaEmptyVariant !== null) return []
    const raw = buildSnapshotsFromObservations({
      dateOfBirth: student.date_of_birth,
      dimensions: visibleDimensions,
      observations,
    })
    const smoothed = smoothSnapshots(raw)
    return smoothed.map((s) => ({
      ...s,
      dimensionScores: snapshotToDimensionScores(s, visibleDimensions, surveys),
    }))
  }, [student?.date_of_birth, amoebaEmptyVariant, visibleDimensions, surveys, observations])

  // Initialize snapshotIdx to latest when snapshots become available
  // (covers the default showTimeline=true case)
  useEffect(() => {
    if (snapshots.length > 0 && snapshotIdx === null) {
      setSnapshotIdx(snapshots.length - 1)
    }
  }, [snapshots.length, snapshotIdx])

  // Toggle timeline visibility
  const handleToggleTimeline = useCallback(() => {
    if (!showTimeline) {
      // Opening — start at latest snapshot
      setSnapshotIdx(snapshots.length - 1)
    }
    setShowTimeline((v) => !v)
  }, [showTimeline, snapshots.length])

  // Filter dimension scores for family view
  const filteredDimensionScores = useMemo(
    () => (isFamilyView ? dimensionScores.filter((s) => visibleDimensionIds.has(s.dimension_id)) : dimensionScores),
    [dimensionScores, isFamilyView, visibleDimensionIds]
  )

  async function launchInterestSurvey() {
    if (!student) return
    setLaunchingSurvey(true)

    const { data, error: sessErr } = await supabase
      .from('student_sessions')
      .insert({
        student_id: student.id,
        school_id: student.school_id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('token')
      .single()

    setLaunchingSurvey(false)

    if (sessErr || !data) {
      toast('Could not create survey session', 'error')
      return
    }

    navigate(`/survey/${data.token}`)
  }

  function scrollToDimension(dimensionId: string) {
    const el = document.getElementById(`dimension-${dimensionId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight
      el.classList.add('ring-2', 'ring-primary-400', 'ring-offset-2')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary-400', 'ring-offset-2')
      }, 1500)
    }
  }

  // ---------- Loading / Error states ----------
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
          <p className="mt-3 text-sm text-text-muted">Loading learner profile...</p>
        </div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-alert-500" />
          <h2 className="mt-3 text-lg font-semibold text-text">Unable to load profile</h2>
          <p className="mt-1 text-sm text-text-muted">{error ?? 'Learner not found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const age = student.date_of_birth
    ? differenceInYears(new Date(), new Date(student.date_of_birth))
    : null

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* ========== HEADER ========== */}
      <section>
        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="glass-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <StudentAvatar student={student} />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-text">
                  {formatStudentName(student.first_name, student.last_name)}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                  {classrooms.length > 0 ? (
                    <span>
                      {classrooms.filter((c) => c.status === 'active').map((c) => c.name).join(', ') || classroom?.name}
                    </span>
                  ) : (
                    classroom && <span>{classroom.name}</span>
                  )}
                  {student.grade_level && <span>Grade {student.grade_level}</span>}
                  {age !== null && <span>Age {age}</span>}
                </div>
                {student.student_number && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-sm text-text-muted">
                    <span className="text-xs text-text-light">Learner #:</span>
                    <span className="font-mono text-sm font-medium text-text">
                      {showStudentNumber
                        ? student.student_number
                        : '\u2022'.repeat(student.student_number.length)}
                    </span>
                    <button
                      onClick={() => setShowStudentNumber((v) => !v)}
                      className="rounded p-0.5 text-text-light transition-colors hover:text-text"
                      title={showStudentNumber ? 'Hide number' : 'Show number'}
                    >
                      {showStudentNumber ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(student.student_number!)
                        setCopiedNumber(true)
                        setTimeout(() => setCopiedNumber(false), 2000)
                      }}
                      className="rounded p-0.5 text-text-light transition-colors hover:text-text"
                      title="Copy number"
                    >
                      {copiedNumber ? (
                        <Check className="h-3.5 w-3.5 text-success-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
                <span className="mt-2 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                  {currentPeriod}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!isFamilyView && (
                <>
                  <button
                    onClick={() => navigate(`/student/${student.id}/observe`)}
                    className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
                  >
                    <ClipboardPen className="h-4 w-4" />
                    Record Observation
                  </button>
                  {canAssign && (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Assign
                    </button>
                  )}
                  {INTEREST_ENABLED && (
                    <button
                      onClick={launchInterestSurvey}
                      disabled={launchingSurvey}
                      className="flex items-center gap-2 rounded-lg border border-accent-300 bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100 disabled:opacity-50"
                    >
                      {launchingSurvey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardList className="h-4 w-4" />
                      )}
                      Interest Survey
                    </button>
                  )}
                </>
              )}
              {canExportReports && (
                <button
                  onClick={() => navigate(`/export/${student.id}`)}
                  className="flex items-center gap-2 rounded-lg border border-bg-muted bg-bg-card px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
                >
                  <FileDown className="h-4 w-4" />
                  Export Report
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========== LIVING BLOB VISUALIZATION ==========
          V1 amoeba is the live experience. The V2 LearnerProfileVisualization
          component remains in the codebase for the next iteration but is not
          mounted here yet — it needs the student's V2 skill_assessments to
          have populated before it produces a meaningful contour. */}
      <section>
        <div className="glass-card p-5">
          {amoebaEmptyVariant !== null ? (
            <AmoebaEmptyState variant={amoebaEmptyVariant} />
          ) : (
            <LivingVisualization
              dimensionScores={filteredDimensionScores}
              snapshots={snapshots}
              snapshotIdx={snapshotIdx}
              onSnapshotChange={setSnapshotIdx}
              showTimeline={showTimeline}
              onToggleTimeline={handleToggleTimeline}
              playing={playing}
              onPlayingChange={setPlaying}
              onDimensionClick={scrollToDimension}
              familyView={isFamilyView}
              observations={observations}
              observers={observers}
            />
          )}
        </div>
      </section>

      {/* ========== COMPETENCY SNAPSHOT (current standing, competency by competency) ==========
          Hidden from family view when the student's `family_snapshot_visible`
          flag is false (admin- or educator-controlled). Educator+ always sees
          it and can toggle the family visibility from the section header. */}
      {(!isFamilyView || student.family_snapshot_visible) && (
        <CompetencySnapshot
          studentId={student.id}
          schoolId={student.school_id}
          studentFirstName={student.first_name}
          dateOfBirth={student.date_of_birth}
          audience={isFamilyView ? 'family' : 'educator'}
          familyVisible={student.family_snapshot_visible}
          onChangedVisibility={refetch}
          observers={observers}
          onObservationSaved={refetch}
          prefetched={{
            dimensions: visibleDimensions,
            observations,
          }}
        />
      )}

      {/* ========== ASSIGNMENTS (educator: all + visibility toggle; family: visible only) ========== */}
      <StudentAssignmentsSection studentId={student.id} familyView={isFamilyView} />

      {/* ========== CLASSROOM ENROLLMENTS (educator/admin only) ========== */}
      {!isFamilyView && (
        <section className="glass-card p-5">
          <StudentClassroomsManager
            studentId={student.id}
            schoolId={student.school_id}
            classrooms={classrooms}
            onChanged={refetch}
          />
        </section>
      )}

      {/* ========== SIS INFORMATION (educator/admin only) ========== */}
      {!isFamilyView && (
        <SISSection student={student} onEdit={() => setShowSISEdit(true)} role={role} onRefetch={refetch} />
      )}

      {/* ========== TEACHER NOTES (educator/admin only) ========== */}
      {!isFamilyView && (
        <TeacherNotes studentId={student.id} schoolId={student.school_id} />
      )}

      {/* ========== INCIDENT REPORTS ========== */}
      {!isFamilyView && (
        <StudentIncidents studentId={student.id} />
      )}
      {isFamilyView && (
        <StudentIncidents studentId={student.id} isFamilyView />
      )}

      {/* ========== FAMILY INPUT — read-only for educators, editable for parents ========== */}
      {!isFamilyView && (
        <ParentNotes studentId={student.id} schoolId={student.school_id} editable={false} />
      )}
      {isFamilyView && (
        <ParentNotes studentId={student.id} schoolId={student.school_id} editable={true} />
      )}

      {/* ========== FAMILY SUPPORT GUIDE (family view) ========== */}
      {isFamilyView && student && (
        <section>
          <FamilySupportGuide
            studentId={student.id}
            schoolId={student.school_id}
            studentName={student.first_name}
            gradeLevel={student.grade_level}
            dimensionScores={filteredDimensionScores}
            mode="family"
          />
        </section>
      )}

      {/* ========== LEARNER MESSAGES (family view) ========== */}
      {isFamilyView && MESSAGING_ENABLED && student && profile && (
        <LearnerMessagesSection
          studentId={student.id}
          parentId={profile.id}
          childName={student.first_name}
        />
      )}

      {/* SIS Edit Modal */}
      {showSISEdit && (
        <SISEditModal
          open={showSISEdit}
          onClose={() => setShowSISEdit(false)}
          student={student}
          onSaved={refetch}
        />
      )}

      {showAssignModal && (
        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          mode="individual"
          schoolId={student.school_id}
          studentId={student.id}
          studentName={formatStudentName(student.first_name, student.last_name)}
          onAssigned={refetch}
        />
      )}

      {/* ========== ZONE MATRIX (educator/admin only) ========== */}
      {!isFamilyView && INTEREST_ENABLED && (
        <section>
          <div className="glass-card p-5">
            <h2 className="mb-1 text-lg font-bold text-text">Learning Zones</h2>
            <p className="mb-4 text-sm text-text-muted">
              Dimensions mapped to interest and competency levels for actionable insights.
            </p>
            <ZoneMatrix
              dimensionScores={dimensionScores}
              onDimensionClick={scrollToDimension}
            />
          </div>
        </section>
      )}

      {/* ========== AI LEARNING GUIDE (educator/admin only) ========== */}
      {!isFamilyView && student && (
        <section>
          <AILearningGuide
            studentId={student.id}
            schoolId={student.school_id}
            studentName={`${student.first_name} ${student.last_name}`}
            gradeLevel={student.grade_level}
            dimensionScores={dimensionScores}
          />
        </section>
      )}

      {/* ========== FAMILY SUPPORT GUIDE — admin view (educator/admin only) ========== */}
      {!isFamilyView && student && (
        <section>
          <FamilySupportGuide
            studentId={student.id}
            schoolId={student.school_id}
            studentName={student.first_name}
            gradeLevel={student.grade_level}
            dimensionScores={dimensionScores}
            mode="admin"
          />
        </section>
      )}

      {/* ========== STUDENT CONTEXT DOCUMENT (educator/admin only) ========== */}
      {!isFamilyView && student && (
        <StudentContextDoc studentId={student.id} schoolId={student.school_id} />
      )}

      {/* ========== TIMELINE (educator/admin only) ========== */}
      {!isFamilyView && (
        <section>
          <div className="glass-card p-5">
            <h2 className="mb-4 text-lg font-bold text-text">Timeline</h2>
            <Timeline entries={timeline} dimensions={dimensions} />
          </div>
        </section>
      )}
    </div>
  )
}

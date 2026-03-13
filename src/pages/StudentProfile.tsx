import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { differenceInYears } from 'date-fns'
import { Loader2, AlertCircle, ClipboardPen, ClipboardList, ArrowLeft, TrendingUp, FileDown, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useStudentProfile } from '../lib/student-data'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { buildSnapshots, getSnapshotObservationDate, smoothSnapshots } from '../lib/living-data'
import LivingVisualization from '../components/student/LivingVisualization'
import ZoneMatrix from '../components/student/ZoneMatrix'
import AILearningGuide from '../components/student/AILearningGuide'
import FamilySupportGuide from '../components/student/FamilySupportGuide'
import DimensionCard from '../components/student/DimensionCard'
import Timeline from '../components/student/Timeline'
import SISSection from '../components/student/SISSection'
import SISEditModal from '../components/student/SISEditModal'
import TeacherNotes from '../components/student/TeacherNotes'
import ParentNotes from '../components/student/ParentNotes'
import StudentContextDoc from '../components/student/StudentContextDoc'

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
  useAuth()
  const { role, formatStudentName } = useAccessControl()
  const { toast } = useToast()
  const [launchingSurvey, setLaunchingSurvey] = useState(false)
  const [showSISEdit, setShowSISEdit] = useState(false)
  const [showStudentNumber, setShowStudentNumber] = useState(false)
  const [copiedNumber, setCopiedNumber] = useState(false)
  const {
    student,
    classroom,
    dimensions,
    dimensionScores,
    timeline,
    observations,
    surveys,
    observers,
    competencyData,
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

  // Build snapshots with forward-looking smoothing so growth ramps
  // gradually toward each change rather than jumping in a single step.
  // (Experiment — remove smoothSnapshots() wrapper to revert to raw steps)
  const snapshots = useMemo(
    () => smoothSnapshots(buildSnapshots(observations, surveys, visibleDimensions, competencyData)),
    [observations, surveys, visibleDimensions, competencyData]
  )

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

  // Derive the active snapshot (if any)
  const activeSnapshot = useMemo(() => {
    if (!showTimeline || snapshotIdx === null || snapshots.length === 0) return null
    const idx = Math.min(snapshotIdx, snapshots.length - 1)
    return snapshots[idx] ?? null
  }, [showTimeline, snapshotIdx, snapshots])

  const isHistorical = activeSnapshot !== null && snapshotIdx !== null && snapshotIdx < snapshots.length - 1

  // Filter dimension scores for family view
  const filteredDimensionScores = useMemo(
    () => (isFamilyView ? dimensionScores.filter((s) => visibleDimensionIds.has(s.dimension_id)) : dimensionScores),
    [dimensionScores, isFamilyView, visibleDimensionIds]
  )

  // Scores to show in dimension cards — historical or current
  const displayScoresForCards = useMemo(() => {
    if (activeSnapshot && isHistorical) {
      const snapshotScores = activeSnapshot.dimensionScores
      return isFamilyView ? snapshotScores.filter((s) => visibleDimensionIds.has(s.dimension_id)) : snapshotScores
    }
    return filteredDimensionScores
  }, [activeSnapshot, isHistorical, filteredDimensionScores, isFamilyView, visibleDimensionIds])

  // Observation date for back-dating (null means "now")
  const observationDate = useMemo(() => {
    if (activeSnapshot && isHistorical) {
      return getSnapshotObservationDate(activeSnapshot)
    }
    return null
  }, [activeSnapshot, isHistorical])

  // Label for the active period
  const observationPeriodLabel = isHistorical ? activeSnapshot?.label ?? null : null

  // Callback after a quick-rate observation is created
  const handleObservationCreated = useCallback(() => {
    refetch()
  }, [refetch])

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

        <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <StudentAvatar student={student} />
              <div>
                <h1 className="text-xl font-bold text-text">
                  {formatStudentName(student.first_name, student.last_name)}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                  {classroom && <span>{classroom.name}</span>}
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
                </>
              )}
              <button
                onClick={() => navigate(`/export/${student.id}`)}
                className="flex items-center gap-2 rounded-lg border border-bg-muted bg-bg-card px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
              >
                <FileDown className="h-4 w-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== LIVING BLOB VISUALIZATION ========== */}
      <section>
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
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
        </div>
      </section>

      {/* ========== SIS INFORMATION (educator/admin only) ========== */}
      {!isFamilyView && (
        <SISSection student={student} onEdit={() => setShowSISEdit(true)} role={role} onRefetch={refetch} />
      )}

      {/* ========== TEACHER NOTES (educator/admin only) ========== */}
      {!isFamilyView && (
        <TeacherNotes studentId={student.id} schoolId={student.school_id} />
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

      {/* SIS Edit Modal */}
      {showSISEdit && (
        <SISEditModal
          open={showSISEdit}
          onClose={() => setShowSISEdit(false)}
          student={student}
          onSaved={refetch}
        />
      )}

      {/* ========== ZONE MATRIX (educator/admin only) ========== */}
      {!isFamilyView && (
        <section>
          <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
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

      {/* ========== DIMENSION CARDS (educator/admin only) ========== */}
      {!isFamilyView && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Dimensions</h2>
            <p className="text-xs text-text-muted">
              Click a competency level to quick-rate
            </p>
          </div>

          {/* Historical period banner for dimension cards */}
          {isHistorical && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-2">
              <TrendingUp className="h-4 w-4 text-accent-600" />
              <span className="text-xs font-medium text-accent-700">
                Viewing {observationPeriodLabel} — click a competency level to back-date an observation
              </span>
              <button
                onClick={() => {
                  setPlaying(false)
                  setSnapshotIdx(snapshots.length - 1)
                }}
                className="ml-auto text-xs font-semibold text-accent-600 hover:text-accent-700"
              >
                Jump to now →
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {displayScoresForCards.map((score) => (
              <DimensionCard
                key={score.dimension_id}
                score={score}
                studentId={student.id}
                schoolId={student.school_id}
                observationDate={observationDate}
                observationPeriodLabel={observationPeriodLabel}
                onObservationCreated={handleObservationCreated}
              />
            ))}
          </div>
        </section>
      )}

      {/* ========== TIMELINE (educator/admin only) ========== */}
      {!isFamilyView && (
        <section>
          <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-text">Timeline</h2>
            <Timeline entries={timeline} dimensions={dimensions} />
          </div>
        </section>
      )}
    </div>
  )
}

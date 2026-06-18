/**
 * AssignmentDetail.tsx  (route: /assignments/:assignmentId)
 *
 * Roster + observation view for one assignment. Left: assignment summary +
 * roster (status-filterable). Right: the selected learner's observations and
 * an inline Add-Observation form that records an assignment_observation —
 * which, when "Feed to amoeba" is on, mirrors into `observations` via the DB
 * trigger and shows up on the learner's Living Blob.
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { usePageAccess } from '../lib/role-permissions'
import { DimensionIcon } from '../components/student/DimensionIcon'
import { useAssignmentFormData } from '../components/assignment/useAssignmentFormData'
import { Toggle, inputCls } from '../components/assignment/assignmentFormShared'
import {
  fetchAssignment,
  fetchAssignmentRoster,
  fetchAssignmentObservations,
  addObservation,
  setStudentAssignmentStatus,
  type AssignmentWithRelations,
  type AssignmentRosterEntry,
  type AssignmentObservation,
  type StudentAssignmentStatus,
  type AssignmentObservationType,
} from '../lib/assignment-data'
import { ASSESSMENT_LEVELS, formatLevel, type AssessmentLevel } from '../lib/standards-assignment-data'
import type { Dimension, Competency } from '../types/database'

const LEVEL_BADGE: Record<AssessmentLevel, string> = {
  emerging: 'bg-alert-50 text-alert-700 border-alert-200',
  developing: 'bg-caution-50 text-caution-700 border-caution-200',
  achieving: 'bg-primary-50 text-primary-700 border-primary-200',
  mastery: 'bg-success-50 text-success-700 border-success-200',
}
const LEVEL_ACTIVE: Record<AssessmentLevel, string> = {
  emerging: 'border-alert-500 bg-alert-500 text-white',
  developing: 'border-caution-500 bg-caution-500 text-white',
  achieving: 'border-primary-500 bg-primary-500 text-white',
  mastery: 'border-success-500 bg-success-500 text-white',
}
const STATUS_BADGE: Record<StudentAssignmentStatus, string> = {
  assigned: 'bg-bg-muted text-text-muted',
  in_progress: 'bg-caution-50 text-caution-700',
  complete: 'bg-success-50 text-success-700',
  archived: 'bg-bg-muted text-text-light',
}
const STATUS_LABEL: Record<StudentAssignmentStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  complete: 'Complete',
  archived: 'Archived',
}
const OBS_TYPES: { value: AssignmentObservationType; label: string }[] = [
  { value: 'formative', label: 'Formative' },
  { value: 'summative', label: 'Summative' },
  { value: 'anecdotal', label: 'Anecdotal' },
]

export default function AssignmentDetail() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { toast } = useToast()
  const { canEdit } = usePageAccess('assignments')
  const { dimensions, competenciesByDimension } = useAssignmentFormData(profile?.school_id)

  const [assignment, setAssignment] = useState<AssignmentWithRelations | null>(null)
  const [roster, setRoster] = useState<AssignmentRosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | StudentAssignmentStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [observations, setObservations] = useState<(AssignmentObservation & { observer_name: string | null })[]>([])
  const [loadingObs, setLoadingObs] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const loadRoster = useCallback(async () => {
    if (!assignmentId) return
    const rows = await fetchAssignmentRoster(assignmentId)
    setRoster(rows)
    setSelectedId((cur) => cur ?? rows[0]?.id ?? null)
  }, [assignmentId])

  useEffect(() => {
    if (!assignmentId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchAssignment(assignmentId), fetchAssignmentRoster(assignmentId)])
      .then(([a, rows]) => {
        if (cancelled) return
        setAssignment(a)
        setRoster(rows)
        setSelectedId(rows[0]?.id ?? null)
      })
      .catch((e) => !cancelled && toast(e instanceof Error ? e.message : 'Failed to load', 'error'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [assignmentId, toast])

  const selected = roster.find((r) => r.id === selectedId) ?? null

  const loadObservations = useCallback(async () => {
    if (!selectedId) {
      setObservations([])
      return
    }
    setLoadingObs(true)
    try {
      setObservations(await fetchAssignmentObservations(selectedId))
    } catch {
      setObservations([])
    } finally {
      setLoadingObs(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadObservations()
    setShowAdd(false)
  }, [loadObservations])

  async function handleStatusChange(status: StudentAssignmentStatus) {
    if (!selected) return
    const { error } = await setStudentAssignmentStatus(selected.id, status)
    if (error) return toast(error, 'error')
    setRoster((rows) => rows.map((r) => (r.id === selected.id ? { ...r, status } : r)))
  }

  const filteredRoster = statusFilter === 'all' ? roster : roster.filter((r) => r.status === statusFilter)
  const assignmentDims = dimensions.filter((d) => assignment?.dimension_ids.includes(d.id))

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }
  if (!assignment) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-text-muted">Assignment not found.</p>
        <button onClick={() => navigate('/assignments')} className="text-sm font-medium text-primary-600">
          Back to assignments
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <button
        onClick={() => navigate('/assignments')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" /> Assignments
      </button>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---- Left: summary + roster ---- */}
        <div className="space-y-4 lg:col-span-1">
          <div className="glass-card p-4">
            <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium capitalize text-primary-700">
              {assignment.assignment_type.replace('_', ' ')}
            </span>
            <h1 className="mt-2 text-lg font-bold text-text">{assignment.title}</h1>
            {assignmentDims.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {assignmentDims.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-[11px] text-text-muted"
                  >
                    <DimensionIcon name={d.icon} className="h-3 w-3" />
                    {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Roster</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | StudentAssignmentStatus)}
                className="rounded-lg border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text-muted focus:outline-none"
              >
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            {filteredRoster.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">No learners.</p>
            ) : (
              <div className="space-y-1">
                {filteredRoster.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                      r.id === selectedId ? 'bg-primary-50' : 'hover:bg-bg-muted'
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-[11px] font-semibold text-text-muted">
                      {r.student_avatar_url ? (
                        <img src={r.student_avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        r.student_name.charAt(0)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{r.student_name}</span>
                    </span>
                    <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-medium', STATUS_BADGE[r.status])}>
                      {r.observation_count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- Right: selected learner ---- */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="glass-card flex min-h-[40vh] items-center justify-center p-6">
              <p className="text-sm text-text-muted">Select a learner to see observations.</p>
            </div>
          ) : (
            <div className="glass-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-text">{selected.student_name}</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={selected.status}
                    disabled={!canEdit}
                    onChange={(e) => handleStatusChange(e.target.value as StudentAssignmentStatus)}
                    className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs font-medium text-text focus:outline-none disabled:opacity-60"
                  >
                    {(['assigned', 'in_progress', 'complete', 'archived'] as const).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <button
                      onClick={() => setShowAdd((v) => !v)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
                    >
                      <Plus className="h-3.5 w-3.5" /> Observation
                    </button>
                  )}
                </div>
              </div>

              {showAdd && canEdit && profile && (
                <AddObservationForm
                  studentAssignmentId={selected.id}
                  studentId={selected.student_id}
                  schoolId={assignment.school_id}
                  observerId={profile.id}
                  dimensions={assignmentDims.length > 0 ? assignmentDims : dimensions}
                  competenciesByDimension={competenciesByDimension}
                  onSaved={async () => {
                    setShowAdd(false)
                    await Promise.all([loadObservations(), loadRoster()])
                    toast('Observation recorded', 'success')
                  }}
                />
              )}

              {/* Observations */}
              <div className="mt-5">
                {loadingObs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                  </div>
                ) : observations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-bg-muted px-4 py-6 text-center text-sm text-text-muted">
                    No observations yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {observations.map((o) => (
                      <div key={o.id} className="rounded-xl border border-bg-muted bg-bg-card p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', LEVEL_BADGE[o.level])}>
                            {formatLevel(o.level)}
                          </span>
                          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] capitalize text-text-muted">
                            {o.observation_type}
                          </span>
                          {!o.feeds_amoeba && (
                            <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] text-text-light">
                              not in amoeba
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-text-light">
                            {new Date(o.observed_at).toLocaleDateString()}
                          </span>
                        </div>
                        {o.notes && <p className="mt-1.5 text-sm text-text">{o.notes}</p>}
                        {o.observer_name && (
                          <p className="mt-1 text-[11px] text-text-light">— {o.observer_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Inline Add-Observation form
// ============================================================
function AddObservationForm({
  studentAssignmentId,
  studentId,
  schoolId,
  observerId,
  dimensions,
  competenciesByDimension,
  onSaved,
}: {
  studentAssignmentId: string
  studentId: string
  schoolId: string
  observerId: string
  dimensions: Dimension[]
  competenciesByDimension: Map<string, Competency[]>
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [dimensionId, setDimensionId] = useState(dimensions[0]?.id ?? '')
  const [competencyId, setCompetencyId] = useState('')
  const [obsType, setObsType] = useState<AssignmentObservationType>('formative')
  const [level, setLevel] = useState<AssessmentLevel | null>(null)
  const [notes, setNotes] = useState('')
  const [feedsAmoeba, setFeedsAmoeba] = useState(true)
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const comps = competenciesByDimension.get(dimensionId) ?? []

  async function handleSave() {
    if (!dimensionId || !level) {
      toast('Pick a dimension and a level', 'error')
      return
    }
    setSaving(true)
    const { error } = await addObservation({
      student_assignment_id: studentAssignmentId,
      student_id: studentId,
      school_id: schoolId,
      dimension_id: dimensionId,
      competency_id: competencyId || null,
      observer_id: observerId,
      observation_type: obsType,
      level,
      notes: notes.trim() || null,
      observed_at: new Date(observedAt).toISOString(),
      feeds_amoeba: feedsAmoeba,
    })
    setSaving(false)
    if (error) return toast(error, 'error')
    onSaved()
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
      {/* Observation type */}
      <div className="flex gap-2">
        {OBS_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setObsType(t.value)}
            className={clsx(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              obsType === t.value
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Dimension</label>
          <select
            value={dimensionId}
            onChange={(e) => {
              setDimensionId(e.target.value)
              setCompetencyId('')
            }}
            className={inputCls}
          >
            {dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Competency (optional)</label>
          <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Level */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-muted">Level</label>
        <div className="grid grid-cols-4 gap-2">
          {ASSESSMENT_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevel(lvl)}
              className={clsx(
                'rounded-lg border-2 px-2 py-2 text-xs font-semibold capitalize transition-all',
                level === lvl ? LEVEL_ACTIVE[lvl] : 'border-bg-muted bg-bg-card text-text-muted hover:border-primary-200'
              )}
            >
              {formatLevel(lvl)}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className={inputCls + ' resize-none'}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Date</label>
          <input type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      <Toggle
        checked={feedsAmoeba}
        onChange={setFeedsAmoeba}
        label="Feed to amoeba"
        description="Adds this assessment to the learner's Living Blob timeline."
      />

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !level}
          className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}

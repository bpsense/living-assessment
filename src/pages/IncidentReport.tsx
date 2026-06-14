import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Users,
  School,
  Paperclip,
  Eye,
  EyeOff,
  MessageSquare,
  Download,
  Trash2,
  FileImage,
  File as FileIcon,
  AtSign,
  X,
  Plus,
  Lock,
  CheckCircle2,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import {
  useIncidentReport,
  addFollowUp,
  changeIncidentStatus,
  setIncidentStudentSeverity,
  setIncidentStudentVisibility,
  setAllIncidentStudentsVisibility,
  updateIncidentCommunication,
  getIncidentFamilyStudents,
  deleteIncidentAttachment,
  getAttachmentUrl,
  addIncidentTags,
  removeIncidentTag,
  markIncidentNotificationsRead,
} from '../lib/incident-data'
import { supabase } from '../lib/supabase'
import type {
  Profile,
  IncidentFamilyStudent,
  IncidentSeverity,
  IncidentStatus,
  IncidentReportWithDetails,
} from '../types/database'

// ============================================================
// Constants
// ============================================================

const TYPE_LABELS: Record<string, string> = {
  behavioral: 'Behavioral',
  medical_injury: 'Medical / Injury',
  safety: 'Safety',
  bullying: 'Bullying',
  property_damage: 'Property Damage',
  emotional_welfare: 'Emotional / Welfare',
  other: 'Other',
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-success-50', text: 'text-success-700' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700' },
  critical: { bg: 'bg-alert-50', text: 'text-alert-700' },
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

// Ascending order — used to pick the highest severity among a family's children.
const SEVERITY_ORDER: IncidentSeverity[] = ['low', 'medium', 'high', 'critical']

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-alert-50', text: 'text-alert-700' },
  in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  resolved: { bg: 'bg-success-50', text: 'text-success-700' },
  closed: { bg: 'bg-bg-muted', text: 'text-text-muted' },
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const ROLE_LABELS: Record<string, string> = {
  involved: 'Involved',
  victim: 'Victim',
  aggressor: 'Aggressor',
  witness: 'Witness',
  bystander: 'Bystander',
}

const NOTIFICATION_METHODS = ['Phone', 'Email', 'In-person', 'Via app']

// ============================================================
// Component
// ============================================================

export default function IncidentReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { role } = useAccessControl()
  const { toast } = useToast()
  const { incident, loading, error, refetch } = useIncidentReport(id)

  const [followUpNotes, setFollowUpNotes] = useState('')
  const [followUpStatus, setFollowUpStatus] = useState('')
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [familyStudents, setFamilyStudents] = useState<IncidentFamilyStudent[]>([])

  const isAdmin = role === 'admin'
  const isReporter = incident?.reported_by === profile?.id
  const isAssigned = incident?.assigned_to === profile?.id
  const canAddFollowUp = isAdmin || isAssigned || isReporter
  const isFamilyView = role === 'parent'

  // Family view: fetch the redacted involved-student list (own children
  // revealed, everyone else redacted) via the SECURITY DEFINER RPC.
  useEffect(() => {
    if (!isFamilyView || !incident) {
      setFamilyStudents([])
      return
    }
    let cancelled = false
    getIncidentFamilyStudents(incident.id)
      .then((rows) => { if (!cancelled) setFamilyStudents(rows) })
      .catch(() => { if (!cancelled) setFamilyStudents([]) })
    return () => { cancelled = true }
  }, [isFamilyView, incident])

  // Highest severity among the family's own (revealed) children — shown in the
  // header instead of the incident-level severity, so a witness's family
  // doesn't see a "Critical" tag for an incident their child barely touched.
  const familyEffectiveSeverity = useMemo<IncidentSeverity | null>(() => {
    const revealed = familyStudents.filter((s) => !s.redacted && s.severity)
    if (revealed.length === 0) return null
    return revealed.reduce<IncidentSeverity>(
      (max, s) =>
        SEVERITY_ORDER.indexOf(s.severity as IncidentSeverity) > SEVERITY_ORDER.indexOf(max)
          ? (s.severity as IncidentSeverity)
          : max,
      'low'
    )
  }, [familyStudents])

  const handleAddFollowUp = useCallback(async () => {
    if (!profile || !id || !followUpNotes.trim()) return
    setSubmittingFollowUp(true)
    try {
      await addFollowUp(id, profile.id, followUpNotes.trim(), followUpStatus || undefined)
      toast('Follow-up added', 'success')
      setFollowUpNotes('')
      setFollowUpStatus('')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSubmittingFollowUp(false)
    }
  }, [id, profile, followUpNotes, followUpStatus, toast, refetch])

  const handleChangeStatus = useCallback(async (newStatus: IncidentStatus, note?: string) => {
    if (!profile || !id) return
    setChangingStatus(true)
    try {
      await changeIncidentStatus(id, profile.id, newStatus, note)
      toast(`Incident ${(STATUS_LABELS[newStatus] ?? newStatus).toLowerCase()}`, 'success')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setChangingStatus(false)
    }
  }, [id, profile, toast, refetch])

  const handleSetStudentSeverity = useCallback(async (rowId: string, severity: IncidentSeverity | null) => {
    try {
      await setIncidentStudentSeverity(rowId, severity)
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [toast, refetch])

  const handleSetStudentVisibility = useCallback(async (rowId: string, shared: boolean) => {
    try {
      await setIncidentStudentVisibility(rowId, shared)
      toast(shared ? 'Visible to this family' : 'Hidden from this family', 'success')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [toast, refetch])

  const handleSetAllVisibility = useCallback(async (shared: boolean) => {
    if (!incident) return
    try {
      await setAllIncidentStudentsVisibility(incident.id, shared)
      toast(shared ? 'Shared with all families' : 'Hidden from all families', 'success')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [incident, toast, refetch])

  const handleDownloadAttachment = useCallback(async (filePath: string, _fileName: string) => {
    try {
      const url = await getAttachmentUrl(filePath)
      window.open(url, '_blank')
    } catch {
      toast('Failed to download file', 'error')
    }
  }, [toast])

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await deleteIncidentAttachment(attachmentId)
      toast('Attachment deleted', 'success')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [toast, refetch])

  // Mark this user's unread notifications for the incident as read on open,
  // so the bold/dot indicators clear after the user has actually seen it.
  useEffect(() => {
    if (incident && profile) {
      markIncidentNotificationsRead(incident.id, profile.id).catch(() => {
        // Silent — failing to clear a notification badge isn't worth alerting
      })
    }
  }, [incident, profile])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-alert-400" />
        <p className="text-sm text-text-muted">{error ?? 'Incident not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-primary-500 hover:underline">
          Go back
        </button>
      </div>
    )
  }

  // In the family view, show the family's child severity (or nothing while it
  // loads) rather than the incident-level severity. Staff always see the real one.
  const headerSeverity: IncidentSeverity | null = isFamilyView ? familyEffectiveSeverity : incident.severity
  const sevStyle = SEVERITY_STYLES[headerSeverity ?? 'low'] ?? SEVERITY_STYLES.low
  const statusStyle = STATUS_STYLES[incident.status] ?? STATUS_STYLES.open

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {headerSeverity && (
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', sevStyle.bg, sevStyle.text)}>
              <AlertTriangle className="h-3 w-3" />
              {SEVERITY_LABELS[headerSeverity] ?? headerSeverity}
            </span>
          )}
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
            {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
          </span>
          <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', statusStyle.bg, statusStyle.text)}>
            {STATUS_LABELS[incident.status] ?? incident.status}
          </span>
        </div>

        {/* Status management — close / resolve / reopen (managers only) */}
        {canAddFollowUp && (
          <div className="mb-3">
            <StatusControl status={incident.status} busy={changingStatus} onChange={handleChangeStatus} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(new Date(incident.incident_date), 'MMM d, yyyy')}
            {incident.incident_time && ` at ${incident.incident_time}`}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {incident.location.charAt(0).toUpperCase() + incident.location.slice(1)}
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Filed by {incident.reporter?.full_name ?? 'Unknown'}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
        <h3 className="mb-2 text-sm font-semibold text-text">Description</h3>
        <p className="whitespace-pre-wrap text-sm text-text-muted">{incident.description}</p>
      </div>

      {/* Immediate Actions */}
      {incident.immediate_actions_taken && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-text">Immediate Actions Taken</h3>
          <p className="whitespace-pre-wrap text-sm text-text-muted">{incident.immediate_actions_taken}</p>
        </div>
      )}

      {/* Students Involved (staff view) — admins get per-student severity + visibility */}
      {!isFamilyView && incident.students && incident.students.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Users className="h-4 w-4" />
              Students Involved ({incident.students.length})
            </h3>
            {isAdmin && incident.students.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSetAllVisibility(true)}
                  className="flex items-center gap-1 rounded-lg bg-success-50 px-2 py-1 text-[11px] font-medium text-success-700 hover:bg-success-100"
                >
                  <Eye className="h-3 w-3" /> Share all
                </button>
                <button
                  onClick={() => handleSetAllVisibility(false)}
                  className="flex items-center gap-1 rounded-lg bg-bg-muted px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-muted/80"
                >
                  <EyeOff className="h-3 w-3" /> Hide all
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {incident.students.map((s) => {
              const effSev = (s.severity ?? incident.severity) as IncidentSeverity
              const effStyle = SEVERITY_STYLES[effSev] ?? SEVERITY_STYLES.low
              return (
                <div key={s.id} className="rounded-lg bg-bg px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/student/${s.student_id}`}
                      className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                        {s.student?.first_name?.[0]}{s.student?.last_name?.[0]}
                      </div>
                      {s.student?.first_name} {s.student?.last_name}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', effStyle.bg, effStyle.text)}>
                        {SEVERITY_LABELS[effSev] ?? effSev}
                      </span>
                      <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-bg-muted pt-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
                        Severity
                        <select
                          value={s.severity ?? ''}
                          onChange={(e) => handleSetStudentSeverity(s.id, e.target.value ? (e.target.value as IncidentSeverity) : null)}
                          className="rounded-lg border border-bg-muted bg-bg-card px-2 py-1 text-[11px] text-text focus:outline-none"
                        >
                          <option value="">Inherit ({SEVERITY_LABELS[incident.severity]})</option>
                          {SEVERITY_ORDER.map((sv) => (
                            <option key={sv} value={sv}>{SEVERITY_LABELS[sv]}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => handleSetStudentVisibility(s.id, !s.shared_with_family)}
                        className={clsx(
                          'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                          s.shared_with_family
                            ? 'bg-success-50 text-success-700 hover:bg-success-100'
                            : 'bg-bg-muted text-text-muted hover:bg-bg-muted/80'
                        )}
                      >
                        {s.shared_with_family ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {s.shared_with_family ? 'Family can see' : 'Hidden from family'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {isAdmin && (
            <p className="mt-3 text-[11px] leading-relaxed text-text-light">
              Per-student severity sets what shows on each child&rsquo;s profile (&ldquo;Inherit&rdquo; uses the incident&rsquo;s {SEVERITY_LABELS[incident.severity]}). Family visibility is per-student — only enabled families can open this report, and other students are redacted for them.
            </p>
          )}
        </div>
      )}

      {/* Students Involved (family view) — own children revealed, others redacted */}
      {isFamilyView && familyStudents.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Users className="h-4 w-4" />
            Students Involved ({familyStudents.length})
          </h3>
          <div className="space-y-2">
            {familyStudents.map((s) => {
              if (s.redacted) {
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-light">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span className="italic">Redacted for privacy</span>
                  </div>
                )
              }
              const rowStyle = s.severity ? (SEVERITY_STYLES[s.severity] ?? SEVERITY_STYLES.low) : null
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2">
                  <Link
                    to={`/student/${s.student_id}`}
                    className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                    {s.first_name} {s.last_name}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {s.severity && rowStyle && (
                      <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', rowStyle.bg, rowStyle.text)}>
                        {SEVERITY_LABELS[s.severity] ?? s.severity}
                      </span>
                    )}
                    {s.role && (
                      <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Classrooms */}
      {!isFamilyView && incident.classrooms && incident.classrooms.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <School className="h-4 w-4" />
            Classrooms Involved
          </h3>
          <div className="flex flex-wrap gap-2">
            {incident.classrooms.map((c) => (
              <Link
                key={c.id}
                to={`/classroom/${c.classroom_id}`}
                className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
              >
                {c.classroom?.name ?? 'Unknown'}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {incident.attachments && incident.attachments.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Paperclip className="h-4 w-4" />
            Attachments ({incident.attachments.length})
          </h3>
          <div className="space-y-2">
            {incident.attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {a.file_type?.startsWith('image/') ? (
                    <FileImage className="h-4 w-4 shrink-0 text-primary-500" />
                  ) : (
                    <FileIcon className="h-4 w-4 shrink-0 text-text-light" />
                  )}
                  <span className="truncate text-sm text-text">{a.file_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadAttachment(a.file_path, a.file_name)}
                    className="rounded p-1 text-text-light hover:text-primary-500"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteAttachment(a.id)}
                      className="rounded p-1 text-text-light hover:text-alert-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Witnesses (staff only) */}
      {!isFamilyView && incident.witnesses && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-text">Witnesses</h3>
          <p className="text-sm text-text-muted">{incident.witnesses}</p>
        </div>
      )}

      {/* Family Communication (staff only) — has this been communicated to parents? */}
      {!isFamilyView && (
        <FamilyCommunicationSection
          key={incident.updated_at}
          incident={incident}
          canEdit={canAddFollowUp}
          onSaved={refetch}
        />
      )}

      {/* Resolution Notes */}
      {incident.resolution_notes && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-success-700">Resolution Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-success-700">{incident.resolution_notes}</p>
          {incident.resolved_at && (
            <p className="mt-2 text-xs text-success-600">
              Resolved {format(new Date(incident.resolved_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {/* Follow-ups */}
      {!isFamilyView && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
            <MessageSquare className="h-4 w-4" />
            Follow-ups
          </h3>

          {/* Timeline */}
          {incident.follow_ups && incident.follow_ups.length > 0 ? (
            <div className="mb-4 space-y-3">
              {incident.follow_ups.map((f) => (
                <div key={f.id} className="border-l-2 border-primary-200 pl-4">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="font-medium text-text">{f.author?.full_name ?? 'Unknown'}</span>
                    <span>&middot;</span>
                    <span>{format(new Date(f.created_at), 'MMM d, yyyy h:mm a')}</span>
                    {f.status_change && (
                      <span className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        STATUS_STYLES[f.status_change]?.bg ?? 'bg-bg-muted',
                        STATUS_STYLES[f.status_change]?.text ?? 'text-text-muted'
                      )}>
                        → {STATUS_LABELS[f.status_change] ?? f.status_change}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{f.notes}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-text-light">No follow-ups yet.</p>
          )}

          {/* Add Follow-up form */}
          {canAddFollowUp && (
            <div className="border-t border-bg-muted pt-4">
              <textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Add a follow-up note..."
                rows={3}
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <div className="mt-2 flex items-center justify-between">
                <select
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value)}
                  className="rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text focus:outline-none"
                >
                  <option value="">No status change</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  onClick={handleAddFollowUp}
                  disabled={!followUpNotes.trim() || submittingFollowUp}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:bg-primary-300"
                >
                  {submittingFollowUp && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Follow-up
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assigned To */}
      {!isFamilyView && incident.assigned_person && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-text">Assigned To</h3>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {incident.assigned_person.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-text">{incident.assigned_person.full_name}</span>
          </div>
        </div>
      )}

      {/* CC'd Staff */}
      {!isFamilyView && (
        <TaggedStaffSection
          incidentId={incident.id}
          schoolId={incident.school_id}
          tagged={incident.tagged_users ?? []}
          assigneeId={incident.assigned_to}
          reporterId={incident.reported_by}
          currentUserId={profile?.id}
          canEdit={isAdmin || isAssigned || isReporter}
          onChanged={refetch}
        />
      )}
    </div>
  )
}

// ============================================================
// Status control (close / resolve / reopen)
// ============================================================

function StatusControl({
  status,
  busy,
  onChange,
}: {
  status: IncidentStatus
  busy: boolean
  onChange: (newStatus: IncidentStatus, note?: string) => void
}) {
  // Closing/resolving lets the user attach an optional note; reopening and
  // marking-in-progress happen immediately.
  const [pending, setPending] = useState<IncidentStatus | null>(null)
  const [note, setNote] = useState('')

  const isActive = status === 'open' || status === 'in_progress'
  const neutralBtn =
    'flex items-center gap-1 rounded-lg bg-bg-muted px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted/80 disabled:opacity-50'

  if (pending) {
    return (
      <div className="rounded-lg border border-bg-muted bg-bg p-3">
        <label className="mb-1 block text-xs font-medium text-text-muted">
          {pending === 'closed' ? 'Closing note (optional)' : 'Resolution note (optional)'}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add a short note for the record…"
          className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={() => { setPending(null); setNote('') }}
            className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => { onChange(pending, note); setPending(null); setNote('') }}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            Confirm {pending === 'closed' ? 'Close' : 'Resolve'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === 'open' && (
        <button onClick={() => onChange('in_progress')} disabled={busy} className={neutralBtn}>
          <Clock className="h-3.5 w-3.5" /> Mark in progress
        </button>
      )}
      {isActive && (
        <button
          onClick={() => { setPending('resolved'); setNote('') }}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 transition-colors hover:bg-success-100 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
        </button>
      )}
      {status !== 'closed' && (
        <button onClick={() => { setPending('closed'); setNote('') }} disabled={busy} className={neutralBtn}>
          <XCircle className="h-3.5 w-3.5" /> Close incident
        </button>
      )}
      {!isActive && (
        <button onClick={() => onChange('open')} disabled={busy} className={neutralBtn}>
          <RotateCcw className="h-3.5 w-3.5" /> Reopen
        </button>
      )}
    </div>
  )
}

// ============================================================
// Family Communication (staff-only) sub-component
// ============================================================

function FamilyCommunicationSection({
  incident,
  canEdit,
  onSaved,
}: {
  incident: IncidentReportWithDetails
  canEdit: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [notified, setNotified] = useState(incident.parent_notified)
  const [method, setMethod] = useState(incident.parent_notification_method ?? '')
  const [log, setLog] = useState(incident.family_communication_log ?? '')
  const [followup, setFollowup] = useState(incident.family_communication_followup ?? '')
  const [saving, setSaving] = useState(false)

  const dirty =
    notified !== incident.parent_notified ||
    (method || null) !== (incident.parent_notification_method ?? null) ||
    (log.trim() || null) !== (incident.family_communication_log ?? null) ||
    (followup.trim() || null) !== (incident.family_communication_followup ?? null)

  async function save() {
    setSaving(true)
    try {
      await updateIncidentCommunication(incident.id, {
        parent_notified: notified,
        parent_notification_method: notified ? (method || null) : null,
        family_communication_log: log.trim() || null,
        family_communication_followup: followup.trim() || null,
      })
      toast('Communication updated', 'success')
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Read-only view for staff who can't manage this incident.
  if (!canEdit) {
    return (
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
          <MessageSquare className="h-4 w-4" /> Family Communication
        </h3>
        <p className="text-sm text-text-muted">
          {incident.parent_notified
            ? <>Parents notified{incident.parent_notification_method ? ` via ${incident.parent_notification_method}` : ''}.</>
            : 'Parents not yet notified.'}
        </p>
        {incident.family_communication_log && (
          <div className="mt-3">
            <p className="text-xs font-medium text-text-muted">Details</p>
            <p className="whitespace-pre-wrap text-sm text-text-muted">{incident.family_communication_log}</p>
          </div>
        )}
        {incident.family_communication_followup && (
          <div className="mt-3">
            <p className="text-xs font-medium text-text-muted">Follow-up needed</p>
            <p className="whitespace-pre-wrap text-sm text-text-muted">{incident.family_communication_followup}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
        <MessageSquare className="h-4 w-4" /> Family Communication
      </h3>
      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notified}
            onChange={(e) => setNotified(e.target.checked)}
            className="h-4 w-4 rounded border-bg-muted text-primary-500 focus:ring-primary-200"
          />
          <span className="text-sm text-text">Parents/guardians have been notified</span>
        </label>
        {notified && (
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">How were they notified?</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Select method…</option>
              {NOTIFICATION_METHODS.map((m) => (
                <option key={m} value={m.toLowerCase()}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Communication details</label>
          <textarea
            value={log}
            onChange={(e) => setLog(e.target.value)}
            rows={3}
            placeholder="What was shared with the family, when, and by whom…"
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Follow-up needed</label>
          <textarea
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            rows={2}
            placeholder="Any outstanding follow-up with the family…"
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-text-light">Visible to staff only — never shown to families.</p>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:bg-primary-300"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tagged Staff (CC) sub-component
// ============================================================

interface TaggedStaffSectionProps {
  incidentId: string
  schoolId: string
  tagged: NonNullable<ReturnType<typeof useIncidentReport>['incident']>['tagged_users']
  assigneeId: string | null
  reporterId: string
  currentUserId: string | undefined
  canEdit: boolean
  onChanged: () => void
}

function TaggedStaffSection({
  incidentId,
  schoolId,
  tagged,
  assigneeId,
  reporterId,
  currentUserId,
  canEdit,
  onChanged,
}: TaggedStaffSectionProps) {
  const { toast } = useToast()
  const [allStaff, setAllStaff] = useState<Pick<Profile, 'id' | 'full_name' | 'email'>[]>([])
  const [picking, setPicking] = useState(false)
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Fetch all staff (admins + educators) in the school for the picker
  useEffect(() => {
    if (!picking) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('school_id', schoolId)
      .in('role', ['admin', 'educator'])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => {
        if (cancelled) return
        setAllStaff((data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[])
      })
    return () => { cancelled = true }
  }, [picking, schoolId])

  const taggedIds = new Set((tagged ?? []).map((t) => t.user_id))
  // Hide assignee, reporter, and already-tagged from the picker
  const excluded = new Set<string>(taggedIds)
  if (assigneeId) excluded.add(assigneeId)
  excluded.add(reporterId)

  async function handleSave() {
    if (!currentUserId || selectedToAdd.size === 0) return
    setSaving(true)
    try {
      await addIncidentTags(incidentId, [...selectedToAdd], currentUserId)
      toast('Tagged successfully', 'success')
      setSelectedToAdd(new Set())
      setPicking(false)
      onChanged()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeIncidentTag(incidentId, userId)
      onChanged()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <AtSign className="h-4 w-4" />
          CC'd Staff (FYI)
        </h3>
        {canEdit && !picking && (
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
          >
            <Plus className="h-3 w-3" />
            Tag staff
          </button>
        )}
      </div>

      {(!tagged || tagged.length === 0) && !picking && (
        <p className="text-xs text-text-light">No staff CC'd. The assignee is automatically notified.</p>
      )}

      {tagged && tagged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tagged.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700"
            >
              {t.user?.full_name ?? 'Unknown'}
              {canEdit && (
                <button
                  onClick={() => handleRemove(t.user_id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-accent-200"
                  title="Remove tag"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {picking && (
        <div className="mt-3 rounded-lg border border-bg-muted bg-bg p-3">
          <p className="mb-2 text-xs text-text-muted">Select staff to CC (they'll be notified):</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {allStaff.filter((s) => !excluded.has(s.id)).map((s) => {
              const checked = selectedToAdd.has(s.id)
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedToAdd)
                      if (e.target.checked) next.add(s.id)
                      else next.delete(s.id)
                      setSelectedToAdd(next)
                    }}
                    className="rounded border-bg-muted text-primary-500 focus:ring-primary-400"
                  />
                  <span className="flex-1">{s.full_name}</span>
                  <span className="text-xs text-text-light">{s.email}</span>
                </label>
              )
            })}
            {allStaff.filter((s) => !excluded.has(s.id)).length === 0 && (
              <p className="px-2 text-xs text-text-light">No one to add — assignee, reporter, and already-tagged are excluded.</p>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => { setPicking(false); setSelectedToAdd(new Set()) }}
              className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedToAdd.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Add {selectedToAdd.size > 0 && `(${selectedToAdd.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

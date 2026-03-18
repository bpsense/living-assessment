import { useState, useCallback } from 'react'
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
  ChevronDown,
  FileImage,
  File as FileIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useToast } from '../components/Toast'
import {
  useIncidentReport,
  addFollowUp,
  toggleFamilySharing,
  deleteIncidentAttachment,
  getAttachmentUrl,
} from '../lib/incident-data'
import type { IncidentStatus } from '../types/database'

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
  const [togglingShare, setTogglingShare] = useState(false)

  const isAdmin = role === 'admin'
  const isReporter = incident?.reported_by === profile?.id
  const isAssigned = incident?.assigned_to === profile?.id
  const canAddFollowUp = isAdmin || isAssigned || isReporter
  const isFamilyView = role === 'parent'

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

  const handleToggleShare = useCallback(async () => {
    if (!incident) return
    setTogglingShare(true)
    try {
      await toggleFamilySharing(incident.id, !incident.shared_with_family)
      toast(incident.shared_with_family ? 'Hidden from families' : 'Shared with families', 'success')
      refetch()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setTogglingShare(false)
    }
  }, [incident, toast, refetch])

  const handleDownloadAttachment = useCallback(async (filePath: string, fileName: string) => {
    try {
      const url = await getAttachmentUrl(filePath)
      window.open(url, '_blank')
    } catch (e) {
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

  const sevStyle = SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low
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
          <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', sevStyle.bg, sevStyle.text)}>
            <AlertTriangle className="h-3 w-3" />
            {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
          </span>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
            {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
          </span>
          <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', statusStyle.bg, statusStyle.text)}>
            {STATUS_LABELS[incident.status] ?? incident.status}
          </span>
        </div>

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

      {/* Students Involved — hide other students for family view */}
      {!isFamilyView && incident.students && incident.students.length > 0 && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Users className="h-4 w-4" />
            Students Involved ({incident.students.length})
          </h3>
          <div className="space-y-2">
            {incident.students.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
                <Link
                  to={`/student/${s.student_id}`}
                  className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                    {s.student?.first_name?.[0]}{s.student?.last_name?.[0]}
                  </div>
                  {s.student?.first_name} {s.student?.last_name}
                </Link>
                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                  {ROLE_LABELS[s.role] ?? s.role}
                </span>
              </div>
            ))}
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

      {/* Witnesses & Parent Notification */}
      {!isFamilyView && (
        <div className="grid gap-4 sm:grid-cols-2">
          {incident.witnesses && (
            <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-text">Witnesses</h3>
              <p className="text-sm text-text-muted">{incident.witnesses}</p>
            </div>
          )}
          <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
            <h3 className="mb-2 text-sm font-semibold text-text">Parent Notification</h3>
            <p className="text-sm text-text-muted">
              {incident.parent_notified ? (
                <>Notified{incident.parent_notification_method ? ` via ${incident.parent_notification_method}` : ''}</>
              ) : (
                'Not yet notified'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Family Sharing Toggle (Admin only) */}
      {isAdmin && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Family Sharing</h3>
              <p className="text-xs text-text-muted">
                {incident.shared_with_family
                  ? 'Families of involved students can see this incident'
                  : 'This incident is hidden from families'}
              </p>
            </div>
            <button
              onClick={handleToggleShare}
              disabled={togglingShare}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                incident.shared_with_family
                  ? 'bg-success-50 text-success-700 hover:bg-success-100'
                  : 'bg-bg-muted text-text-muted hover:bg-bg-muted/80'
              )}
            >
              {incident.shared_with_family ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {incident.shared_with_family ? 'Shared' : 'Hidden'}
            </button>
          </div>
        </div>
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
    </div>
  )
}

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'
import { useStudentIncidents } from '../../lib/incident-data'

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

// ============================================================
// Props
// ============================================================

interface Props {
  studentId: string
  isFamilyView?: boolean
}

// ============================================================
// Component
// ============================================================

export default function StudentIncidents({ studentId, isFamilyView = false }: Props) {
  const { incidents, loading } = useStudentIncidents(studentId)

  const openCount = useMemo(
    () => incidents.filter((i) => i.status === 'open' || i.status === 'in_progress').length,
    [incidents]
  )

  // Family view: only show incidents shared with family
  const visibleIncidents = useMemo(
    () => isFamilyView ? incidents.filter((i) => i.shared_with_family) : incidents,
    [incidents, isFamilyView]
  )

  return (
    <section className="glass-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-alert-500" />
          <h2 className="text-sm font-bold text-text">Incident Reports</h2>
          {openCount > 0 && !isFamilyView && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-alert-500 px-1.5 text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          </div>
        ) : visibleIncidents.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-light">
            {isFamilyView ? 'No shared incidents.' : 'No incidents recorded.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleIncidents.map((incident) => {
              const sevStyle = SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low
              const statusStyle = STATUS_STYLES[incident.status] ?? STATUS_STYLES.open

              return (
                <Link
                  key={incident.id}
                  to={`/incident/${incident.id}`}
                  className="flex items-start gap-3 rounded-lg border border-bg-muted p-3 transition-colors hover:bg-bg-muted/30"
                >
                  <div className={clsx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', sevStyle.bg)}>
                    <AlertTriangle className={clsx('h-3.5 w-3.5', sevStyle.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                        {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
                      </span>
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', statusStyle.bg, statusStyle.text)}>
                        {STATUS_LABELS[incident.status] ?? incident.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-text-muted">{incident.description}</p>
                    <p className="mt-0.5 text-[10px] text-text-light">
                      {format(new Date(incident.incident_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

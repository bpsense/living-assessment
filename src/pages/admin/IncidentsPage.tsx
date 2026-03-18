import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useIncidentReports, type IncidentFilters } from '../../lib/incident-data'

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
// Component
// ============================================================

export default function IncidentsPage() {
  const { profile, activeSchoolId, isSystemAdmin } = useAuth()
  const navigate = useNavigate()
  const schoolId = isSystemAdmin ? activeSchoolId : profile?.school_id

  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filters: IncidentFilters = useMemo(() => ({
    status: filterStatus || undefined,
    incident_type: filterType || undefined,
    severity: filterSeverity || undefined,
    search: searchQuery || undefined,
  }), [filterStatus, filterType, filterSeverity, searchQuery])

  const { incidents, loading, error } = useIncidentReports(schoolId ?? undefined, filters)

  // Summary stats
  const stats = useMemo(() => {
    const all = incidents
    return {
      total: all.length,
      open: all.filter((i) => i.status === 'open').length,
      critical: all.filter((i) => i.severity === 'critical').length,
      high: all.filter((i) => i.severity === 'high').length,
      inProgress: all.filter((i) => i.status === 'in_progress').length,
    }
  }, [incidents])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-alert-400" />
        <p className="text-sm text-text-muted">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-alert-500" />
          <h1 className="text-xl font-bold text-text">Incident Reports</h1>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-bg-muted bg-bg-card p-4 text-center">
          <p className="text-2xl font-bold text-text">{stats.total}</p>
          <p className="text-xs text-text-muted">Total</p>
        </div>
        <div className="rounded-xl border border-alert-200 bg-alert-50 p-4 text-center">
          <p className="text-2xl font-bold text-alert-700">{stats.open}</p>
          <p className="text-xs text-alert-600">Open</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">{stats.critical + stats.high}</p>
          <p className="text-xs text-orange-600">High / Critical</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats.inProgress}</p>
          <p className="text-xs text-yellow-600">In Progress</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents..."
              className="w-full rounded-xl border border-bg-muted bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              showFilters
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : 'border-bg-muted bg-bg text-text-muted hover:bg-bg-muted'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-bg-muted bg-bg-card p-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text focus:outline-none"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            {(filterStatus || filterType || filterSeverity) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterType(''); setFilterSeverity('') }}
                className="text-xs text-alert-500 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Incident List */}
      {incidents.length === 0 ? (
        <div className="py-12 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-text-light" />
          <p className="text-sm text-text-muted">No incidents found</p>
          <p className="text-xs text-text-light">Incidents will appear here when filed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => {
            const sevStyle = SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES.low
            const statusStyle = STATUS_STYLES[incident.status] ?? STATUS_STYLES.open

            return (
              <button
                key={incident.id}
                onClick={() => navigate(`/incident/${incident.id}`)}
                className="flex w-full items-start gap-3 rounded-xl border border-bg-muted bg-bg-card p-4 text-left transition-colors hover:bg-bg-muted/30"
              >
                {/* Severity indicator */}
                <div className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', sevStyle.bg)}>
                  <AlertTriangle className={clsx('h-4 w-4', sevStyle.text)} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                      {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
                    </span>
                    <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', statusStyle.bg, statusStyle.text)}>
                      {STATUS_LABELS[incident.status] ?? incident.status}
                    </span>
                    <span className="text-[11px] text-text-light">
                      {format(new Date(incident.incident_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-text-muted">{incident.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-text-light">
                    {incident.student_names && incident.student_names.length > 0 && (
                      <span>
                        {incident.student_names.slice(0, 3).join(', ')}
                        {incident.student_names.length > 3 && ` +${incident.student_names.length - 3}`}
                      </span>
                    )}
                    {incident.reporter_name && (
                      <span>Filed by {incident.reporter_name}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Eye, ShieldAlert, Loader2, Building2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { clsx } from 'clsx'

type FeedItemType = 'observation' | 'incident'

interface FeedItem {
  id: string
  type: FeedItemType
  schoolId: string
  schoolName: string
  actor: string
  summary: string
  occurredAt: string
  severity?: string
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return 'just now'
  if (diff < hr) return `${Math.floor(diff / min)}m ago`
  if (diff < day) return `${Math.floor(diff / hr)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function SystemActivity() {
  const { allSchools, setActiveSchool } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | FeedItemType>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const schoolNameMap = new Map(allSchools.map((s) => [s.id, s.name]))

      const [obsRes, incRes] = await Promise.all([
        supabase
          .from('observations')
          .select(`
            id, observed_at, school_id,
            dimension:dimensions(name),
            observer:profiles!observations_observer_id_fkey(full_name),
            student:students(first_name, last_name)
          `)
          .order('observed_at', { ascending: false })
          .limit(50),
        supabase
          .from('incident_reports')
          .select(`
            id, created_at, school_id, severity, incident_type, description,
            reporter:profiles!incident_reports_reported_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      type ObsRow = {
        id: string
        observed_at: string
        school_id: string
        dimension: { name: string } | { name: string }[] | null
        observer: { full_name: string } | { full_name: string }[] | null
        student: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      }
      type IncRow = {
        id: string
        created_at: string
        school_id: string
        severity: string
        incident_type: string
        description: string
        reporter: { full_name: string } | { full_name: string }[] | null
      }

      const obsItems: FeedItem[] = ((obsRes.data ?? []) as ObsRow[]).map((r) => {
        const dim = Array.isArray(r.dimension) ? r.dimension[0] : r.dimension
        const obs = Array.isArray(r.observer) ? r.observer[0] : r.observer
        const stu = Array.isArray(r.student) ? r.student[0] : r.student
        const studentLabel = stu ? `${stu.first_name} ${stu.last_name}` : 'a learner'
        return {
          id: `obs-${r.id}`,
          type: 'observation',
          schoolId: r.school_id,
          schoolName: schoolNameMap.get(r.school_id) ?? 'Unknown',
          actor: obs?.full_name ?? 'Someone',
          summary: `observed ${dim?.name ?? 'a dimension'} for ${studentLabel}`,
          occurredAt: r.observed_at,
        }
      })

      const incItems: FeedItem[] = ((incRes.data ?? []) as IncRow[]).map((r) => {
        const rep = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter
        return {
          id: `inc-${r.id}`,
          type: 'incident',
          schoolId: r.school_id,
          schoolName: schoolNameMap.get(r.school_id) ?? 'Unknown',
          actor: rep?.full_name ?? 'Someone',
          summary: `reported a ${r.incident_type.replace(/_/g, ' ')} incident`,
          occurredAt: r.created_at,
          severity: r.severity,
        }
      })

      const merged = [...obsItems, ...incItems].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )

      if (cancelled) return
      setItems(merged)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [allSchools])

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter)

  function enterSchool(schoolId: string) {
    setActiveSchool(schoolId)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Activity log</h1>
        <p className="mt-1 text-sm text-text-muted">Recent observations and incidents across all schools</p>
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'observation', 'incident'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600',
            )}
          >
            {f === 'all' ? 'All' : f === 'observation' ? 'Observations' : 'Incidents'}
          </button>
        ))}
      </div>

      <div className="glass-card">
        {loading ? (
          <div className="flex items-center justify-center px-5 py-10 text-sm text-text-light">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-light">No activity</p>
        ) : (
          <ul className="divide-y divide-bg-muted">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <div
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    item.type === 'incident' ? 'bg-alert-100' : 'bg-primary-100',
                  )}
                >
                  {item.type === 'incident' ? (
                    <ShieldAlert className="h-4 w-4 text-alert-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-primary-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text">
                    <span className="font-medium">{item.actor}</span>{' '}
                    <span className="text-text-muted">{item.summary}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-light">
                    <button
                      onClick={() => enterSchool(item.schoolId)}
                      className="flex items-center gap-1 hover:text-primary-600"
                    >
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{item.schoolName}</span>
                    </button>
                    {item.severity && (
                      <span
                        className={clsx(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                          item.severity === 'critical' || item.severity === 'high'
                            ? 'bg-alert-100 text-alert-700'
                            : 'bg-bg-muted text-text-muted',
                        )}
                      >
                        {item.severity}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-text-light">{formatRelative(item.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-text-light">
        <Activity className="h-3 w-3" /> Showing the most recent platform-wide activity
      </p>
    </div>
  )
}

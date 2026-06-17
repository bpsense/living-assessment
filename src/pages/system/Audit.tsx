import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  ClipboardList,
  LogIn,
  FilePlus2,
  FilePen,
  Trash2,
  ChevronRight,
  ShieldAlert,
  Globe,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useAuditLog, type AuditFilters, type AuditRow } from '../../lib/audit-data'
import type { ActivityEventType, UserRole } from '../../types/database'

type EventFilter = 'all' | ActivityEventType

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'login', label: 'Logins' },
  { key: 'insert', label: 'Created' },
  { key: 'update', label: 'Updated' },
  { key: 'delete', label: 'Deleted' },
]

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  educator: 'Educator',
  parent: 'Family',
  learner: 'Learner',
}

function eventMeta(t: ActivityEventType): { Icon: typeof LogIn; cls: string; label: string } {
  switch (t) {
    case 'login':
      return { Icon: LogIn, cls: 'bg-blue-100 text-blue-700', label: 'login' }
    case 'insert':
      return { Icon: FilePlus2, cls: 'bg-emerald-100 text-emerald-700', label: 'created' }
    case 'update':
      return { Icon: FilePen, cls: 'bg-amber-100 text-amber-700', label: 'updated' }
    case 'delete':
      return { Icon: Trash2, cls: 'bg-alert-100 text-alert-600', label: 'deleted' }
  }
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

function shortId(id: string | null): string {
  if (!id) return ''
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Expanded detail for a data event: a field-level diff (update) or the full row JSON (insert/delete). */
function ChangeDetail({ row }: { row: AuditRow }) {
  const changed = row.changed
  if (!changed) return null

  if (row.eventType === 'update') {
    const entries = Object.entries(changed) as [string, { old?: unknown; new?: unknown }][]
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-text-muted">Changed fields</p>
        <div className="overflow-hidden rounded-lg border border-bg-muted">
          <table className="min-w-full text-xs">
            <thead className="bg-bg-muted text-text-light">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Field</th>
                <th className="px-3 py-1.5 text-left font-medium">Old</th>
                <th className="px-3 py-1.5 text-left font-medium">New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-muted">
              {entries.map(([field, change]) => (
                <tr key={field}>
                  <td className="px-3 py-1.5 font-mono text-text">{field}</td>
                  <td className="px-3 py-1.5 font-mono text-alert-600 line-through decoration-alert-300">
                    {displayValue(change?.old)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-emerald-700">{displayValue(change?.new)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // insert / delete — full row snapshot
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-text-muted">
        {row.eventType === 'insert' ? 'Created record' : 'Deleted record'}
      </p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-bg-muted p-3 text-xs text-text">
        {JSON.stringify(changed, null, 2)}
      </pre>
    </div>
  )
}

export default function Audit() {
  const { allSchools, isSystemAdmin } = useAuth()

  const [schoolId, setSchoolId] = useState('')
  const [actorId, setActorId] = useState('')
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // People for the actor dropdown, scoped to the selected school (or all schools).
  const [people, setPeople] = useState<{ id: string; full_name: string; role: UserRole }[]>([])
  useEffect(() => {
    let cancelled = false
    let q = supabase.from('profiles').select('id, full_name, role').order('full_name')
    if (schoolId) q = q.eq('school_id', schoolId)
    q.limit(500).then(({ data }) => {
      if (!cancelled) setPeople((data ?? []) as { id: string; full_name: string; role: UserRole }[])
    })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  const sortedSchools = useMemo(
    () => [...allSchools].sort((a, b) => a.name.localeCompare(b.name)),
    [allSchools],
  )

  const filters: AuditFilters = useMemo(
    () => ({
      schoolId: schoolId || null,
      actorId: actorId || null,
      eventTypes: eventFilter === 'all' ? [] : [eventFilter],
      from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null,
      to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : null,
    }),
    [schoolId, actorId, eventFilter, fromDate, toDate],
  )

  const { rows, loading, error, hasMore, loadMore } = useAuditLog(allSchools, filters, isSystemAdmin)

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectCls =
    'rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-sm text-text focus:border-primary-400 focus:outline-none'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
          <ClipboardList className="h-6 w-6 text-primary-500" />
          Logins &amp; Activity
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Platform-wide audit trail — logins and record changes across all schools. Visible to system admins only.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={schoolId}
          onChange={(e) => {
            setSchoolId(e.target.value)
            setActorId('') // actor list changes with the school
          }}
          className={selectCls}
          aria-label="Filter by school"
        >
          <option value="">All schools</option>
          {sortedSchools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archived_at ? ' (archived)' : ''}
            </option>
          ))}
        </select>

        <select
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          className={selectCls}
          aria-label="Filter by user"
        >
          <option value="">All users</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} · {ROLE_LABELS[p.role]}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {EVENT_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setEventFilter(f.key)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                eventFilter === f.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-light">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={selectCls}
            aria-label="From date"
          />
          <span>→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={selectCls}
            aria-label="To date"
          />
        </div>
      </div>

      {/* Results */}
      <div className="glass-card overflow-hidden">
        {error ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-alert-600">
            <ShieldAlert className="h-4 w-4" /> {error}
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="flex items-center justify-center px-5 py-10 text-sm text-text-light">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-light">No activity matches these filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-bg-muted text-left text-xs uppercase tracking-wide text-text-light">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">School</th>
                  <th className="px-4 py-2.5 font-medium">Object</th>
                  <th className="px-4 py-2.5 font-medium" aria-label="Details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-muted">
                {rows.map((r) => {
                  const meta = eventMeta(r.eventType)
                  const canExpand = !!r.changed
                  const isOpen = expanded.has(r.id)
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={clsx('align-top', canExpand && 'cursor-pointer hover:bg-bg-muted/50')}
                        onClick={canExpand ? () => toggle(r.id) : undefined}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-text-light" title={new Date(r.occurredAt).toLocaleString()}>
                          {formatRelative(r.occurredAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-text">{r.actorName}</span>
                          {r.actorRole && (
                            <span className="ml-1.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                              {ROLE_LABELS[r.actorRole]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              meta.cls,
                            )}
                          >
                            <meta.Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-text-muted">{r.schoolName}</td>
                        <td className="px-4 py-2.5 text-text-muted">
                          {r.tableName ? (
                            <span>
                              <span className="font-mono text-text">{r.tableName}</span>
                              {r.recordId && (
                                <span className="ml-1 font-mono text-text-light">· {shortId(r.recordId)}</span>
                              )}
                            </span>
                          ) : r.eventType === 'login' && r.ipAddress ? (
                            <span
                              className="inline-flex items-center gap-1 font-mono text-xs text-text-light"
                              title="Source IP address"
                            >
                              <Globe className="h-3 w-3" />
                              {r.ipAddress}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {canExpand && (
                            <ChevronRight
                              className={clsx('inline h-4 w-4 text-text-light transition-transform', isOpen && 'rotate-90')}
                            />
                          )}
                        </td>
                      </tr>
                      {canExpand && isOpen && (
                        <tr className="bg-bg-muted/30">
                          <td colSpan={6} className="px-4 py-3">
                            <ChangeDetail row={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-bg-muted bg-bg-card px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </div>
  )
}

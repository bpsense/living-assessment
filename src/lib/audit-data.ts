import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ActivityEventType, ActivityLog, School, UserRole } from '../types/database'

const PAGE_SIZE = 50

export interface AuditFilters {
  /** Restrict to one school; null = all schools. */
  schoolId: string | null
  /** Restrict to one actor (profiles.id); null = all actors. */
  actorId: string | null
  /** Restrict to these event types; empty = all. */
  eventTypes: ActivityEventType[]
  /** Inclusive lower bound (ISO timestamp); null = no lower bound. */
  from: string | null
  /** Inclusive upper bound (ISO timestamp); null = no upper bound. */
  to: string | null
}

/** Coarse location for a login IP. Fields are null when unresolved or unknown. */
export interface IpGeo {
  countryCode: string | null
  region: string | null
}

/** A single audit row with actor + school names already resolved for display. */
export interface AuditRow {
  id: number
  occurredAt: string
  eventType: ActivityEventType
  category: 'auth' | 'data'
  actorId: string | null
  actorName: string
  actorRole: UserRole | null
  schoolId: string | null
  schoolName: string
  tableName: string | null
  recordId: string | null
  /** Source IP for login events; null for data events and pre-096 logins. */
  ipAddress: string | null
  /** Coarse location resolved from ipAddress; null until resolved or if unavailable. */
  geo: IpGeo | null
  changed: Record<string, unknown> | null
}

export interface UseAuditLogResult {
  rows: AuditRow[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
}

type ActorCache = Map<string, { full_name: string; role: UserRole }>
/** Resolved coarse location per login IP; null = requested-but-unresolved (don't re-ask). */
type GeoCache = Map<string, IpGeo | null>

/** "System / service" stands in for the null actor (service-role / edge / seed writes). */
const SYSTEM_ACTOR = 'System / service'

/** Fetch one page of activity_log rows for the given filters (newest first). */
async function queryPage(
  filters: AuditFilters,
  pageIndex: number,
): Promise<{ rows: ActivityLog[]; error: string | null }> {
  let query = supabase
    .from('activity_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1)

  if (filters.schoolId) query = query.eq('school_id', filters.schoolId)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.eventTypes.length > 0) query = query.in('event_type', filters.eventTypes)
  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', filters.to)

  const { data, error } = await query
  return { rows: (data ?? []) as ActivityLog[], error: error?.message ?? null }
}

/** Look up any actor ids not already in the cache and add them. */
async function resolveActors(raw: ActivityLog[], cache: ActorCache): Promise<void> {
  const missing = [
    ...new Set(raw.map((r) => r.actor_id).filter((v): v is string => !!v && !cache.has(v))),
  ]
  if (missing.length === 0) return
  const { data } = await supabase.from('profiles').select('id, full_name, role').in('id', missing)
  for (const p of (data ?? []) as Array<{ id: string; full_name: string; role: UserRole }>) {
    cache.set(p.id, { full_name: p.full_name, role: p.role })
  }
}

/**
 * Resolve coarse location for any login IPs not already in the geo cache (best-effort).
 * Goes through the system-admin-only resolve-ip-geo edge function, which caches each IP
 * server-side so the upstream provider sees a given IP at most once. Every requested IP
 * is recorded in the cache (null when unresolved) so it is never re-requested in-session.
 */
async function resolveGeo(raw: ActivityLog[], cache: GeoCache): Promise<void> {
  const missing = [
    ...new Set(
      raw
        .filter((r) => r.event_type === 'login' && !!r.ip_address && !cache.has(r.ip_address))
        .map((r) => r.ip_address as string),
    ),
  ]
  if (missing.length === 0) return
  try {
    const { data, error } = await supabase.functions.invoke('resolve-ip-geo', { body: { ips: missing } })
    const results = !error && data ? ((data as { results?: Record<string, IpGeo | null> }).results ?? {}) : {}
    for (const ip of missing) cache.set(ip, results[ip] ?? null)
  } catch {
    // Geo is non-essential; on failure the row simply shows its IP without a location.
    for (const ip of missing) cache.set(ip, null)
  }
}

/** Re-attach geo from the cache to already-mapped rows (used after resolveGeo resolves). */
function applyGeo(rows: AuditRow[], geoCache: GeoCache): AuditRow[] {
  return rows.map((row) => {
    const g = row.ipAddress ? (geoCache.get(row.ipAddress) ?? null) : null
    return row.geo === g ? row : { ...row, geo: g }
  })
}

function mapRows(
  raw: ActivityLog[],
  cache: ActorCache,
  schoolMap: Map<string, string>,
  geoCache: GeoCache,
): AuditRow[] {
  return raw.map((r) => {
    const cached = r.actor_id ? cache.get(r.actor_id) : undefined
    return {
      id: r.id,
      occurredAt: r.occurred_at,
      eventType: r.event_type,
      category: r.category,
      actorId: r.actor_id,
      actorName: r.actor_id ? (cached?.full_name ?? 'Unknown user') : SYSTEM_ACTOR,
      actorRole: cached?.role ?? null,
      schoolId: r.school_id,
      schoolName: r.school_id ? (schoolMap.get(r.school_id) ?? 'Unknown school') : '—',
      tableName: r.table_name,
      recordId: r.record_id,
      ipAddress: r.ip_address,
      geo: r.ip_address ? (geoCache.get(r.ip_address) ?? null) : null,
      changed: r.changed,
    }
  })
}

/**
 * Loads the platform audit trail (activity_log) for the super-admin dashboard.
 *
 * Reads go through the normal anon-key client: the activity_log RLS policy grants
 * SELECT only to system admins (is_system_admin()), so a non-admin sees nothing.
 * Actor names are resolved separately from `profiles` (activity_log.actor_id FKs
 * auth.users, not profiles, so it can't be embedded) and cached across pages;
 * school names come from the already-loaded `allSchools`.
 */
export function useAuditLog(allSchools: School[], filters: AuditFilters, enabled: boolean): UseAuditLogResult {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Actor profile cache, kept across pages and filter changes (read synchronously).
  const actorCacheRef = useRef<ActorCache>(new Map())
  // Login-IP → location cache, shared across pages (resolved lazily, best-effort).
  const geoCacheRef = useRef<GeoCache>(new Map())
  // Guards against out-of-order responses (filters change while a fetch is in flight).
  const reqIdRef = useRef(0)
  // Highest page loaded, so loadMore() knows what to fetch next.
  const pageRef = useRef(0)

  const schoolMap = useMemo(() => new Map(allSchools.map((s) => [s.id, s.name])), [allSchools])

  // (Re)load from page 0 whenever the filters change or the hook becomes enabled.
  useEffect(() => {
    if (!enabled) return
    const reqId = ++reqIdRef.current
    let cancelled = false
    pageRef.current = 0

    async function loadFirstPage() {
      setLoading(true)
      setError(null)
      const { rows: raw, error: qErr } = await queryPage(filters, 0)
      if (cancelled || reqId !== reqIdRef.current) return
      if (qErr) {
        setError(qErr)
        setLoading(false)
        return
      }
      await resolveActors(raw, actorCacheRef.current)
      if (cancelled || reqId !== reqIdRef.current) return
      setRows(mapRows(raw, actorCacheRef.current, schoolMap, geoCacheRef.current))
      setHasMore(raw.length === PAGE_SIZE)
      setLoading(false)
      // Progressive enhancement: resolve login-IP locations, then fill them in.
      await resolveGeo(raw, geoCacheRef.current)
      if (cancelled || reqId !== reqIdRef.current) return
      setRows((prev) => applyGeo(prev, geoCacheRef.current))
    }

    loadFirstPage()
    return () => {
      cancelled = true
    }
    // `filters` is memoized by the caller, so its reference is stable per filter set.
  }, [enabled, filters, schoolMap])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    const reqId = ++reqIdRef.current
    const next = pageRef.current + 1
    setLoading(true)
    const { rows: raw, error: qErr } = await queryPage(filters, next)
    if (reqId !== reqIdRef.current) return
    if (qErr) {
      setError(qErr)
      setLoading(false)
      return
    }
    await resolveActors(raw, actorCacheRef.current)
    if (reqId !== reqIdRef.current) return
    pageRef.current = next
    setRows((prev) => [...prev, ...mapRows(raw, actorCacheRef.current, schoolMap, geoCacheRef.current)])
    setHasMore(raw.length === PAGE_SIZE)
    setLoading(false)
    // Progressive enhancement: resolve the newly loaded page's login-IP locations.
    await resolveGeo(raw, geoCacheRef.current)
    if (reqId !== reqIdRef.current) return
    setRows((prev) => applyGeo(prev, geoCacheRef.current))
  }, [loading, hasMore, filters, schoolMap])

  return { rows, loading, error, hasMore, loadMore }
}

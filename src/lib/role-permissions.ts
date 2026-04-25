/**
 * role-permissions.ts
 *
 * Reads (school_id, role) → sidebar_key → access from the role_permissions
 * table, falling back to the catalog defaults when a row is missing. The
 * cache lives in module scope keyed by (school_id, role) so the
 * permissions page is the only source of writes.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { useAccessControl } from './access-control'
import {
  SIDEBAR_BY_KEY,
  effectiveRoleFor,
  type EffectiveRole,
  type ItemAccess,
  type SidebarKey,
} from './sidebar-catalog'

/** Map of sidebar_key → access for a single (school, role) tuple. */
export type RolePermissionMap = Partial<Record<SidebarKey, ItemAccess>>

interface RolePermissionRow {
  role: string
  sidebar_key: string
  access: ItemAccess
}

const cache = new Map<string, RolePermissionMap>()
const inflight = new Map<string, Promise<RolePermissionMap>>()
const subscribers = new Set<() => void>()

function cacheKey(schoolId: string, role: EffectiveRole): string {
  return `${schoolId}:${role}`
}

async function loadFor(schoolId: string, role: EffectiveRole): Promise<RolePermissionMap> {
  const key = cacheKey(schoolId, role)
  const hit = cache.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending

  const promise = (async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('role, sidebar_key, access')
      .eq('school_id', schoolId)
      .eq('role', role)
    const map: RolePermissionMap = {}
    for (const row of (data ?? []) as RolePermissionRow[]) {
      map[row.sidebar_key as SidebarKey] = row.access
    }
    cache.set(key, map)
    inflight.delete(key)
    return map
  })()

  inflight.set(key, promise)
  return promise
}

/**
 * Invalidate the cache for a (school, role) — called after the permissions
 * page saves changes so all live hooks re-fetch.
 */
export function invalidateRolePermissions(schoolId: string, role?: EffectiveRole) {
  if (role) {
    cache.delete(cacheKey(schoolId, role))
  } else {
    for (const key of [...cache.keys()]) {
      if (key.startsWith(`${schoolId}:`)) cache.delete(key)
    }
  }
  for (const fn of subscribers) fn()
}

/** Resolve the effective access for a single sidebar item. */
export function resolveAccess(
  key: SidebarKey,
  role: EffectiveRole,
  overrides: RolePermissionMap
): ItemAccess {
  const explicit = overrides[key]
  if (explicit) return explicit
  const item = SIDEBAR_BY_KEY[key]
  return item?.defaultAccess[role] ?? 'hidden'
}

/**
 * Reactive hook returning the override map for a given effective role.
 * Components can call `resolveAccess(key, role, map)` to materialize
 * per-item access.
 */
export function useRolePermissions(role: EffectiveRole | undefined): {
  permissions: RolePermissionMap
  loading: boolean
} {
  const { profile } = useAuth()
  const schoolId = profile?.school_id
  const [permissions, setPermissions] = useState<RolePermissionMap>(() => {
    if (!schoolId || !role) return {}
    return cache.get(cacheKey(schoolId, role)) ?? {}
  })
  const [loading, setLoading] = useState(!cache.has(cacheKey(schoolId ?? '', role ?? 'admin')))

  const refresh = useCallback(() => {
    if (!schoolId || !role) return
    setLoading(true)
    loadFor(schoolId, role).then((map) => {
      setPermissions(map)
      setLoading(false)
    })
  }, [schoolId, role])

  useEffect(() => {
    if (!schoolId || !role) {
      setPermissions({})
      setLoading(false)
      return
    }
    refresh()
    const sub = () => refresh()
    subscribers.add(sub)
    return () => { subscribers.delete(sub) }
  }, [schoolId, role, refresh])

  return { permissions, loading }
}

/**
 * Hook for page-level gating. Returns the effective access for a sidebar key
 * for the currently-viewing role, plus convenience booleans. Respects the
 * "view as" impersonation in useAuth — when a user is viewing as another
 * role, page-level edit affordances should mirror that target role
 * (including dropping their dept admin elevation).
 */
export function usePageAccess(key: SidebarKey): {
  access: ItemAccess
  canView: boolean
  canEdit: boolean
} {
  const { profile } = useAuth()
  // useAccessControl reads isDepartmentAdmin from useAuth, which already
  // reflects impersonation (returns the impersonated user's status when
  // viewing-as someone, otherwise the actual user's status).
  const { isDepartmentAdmin } = useAccessControl()
  const effective = profile
    ? effectiveRoleFor(profile.role, isDepartmentAdmin)
    : undefined
  const { permissions } = useRolePermissions(effective)
  const access = effective ? resolveAccess(key, effective, permissions) : 'hidden'
  return {
    access,
    canView: access !== 'hidden',
    canEdit: access === 'edit',
  }
}

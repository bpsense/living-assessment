import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, Save, RotateCcw, AlertCircle } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import {
  CONFIGURABLE_ITEMS,
  type EffectiveRole,
  type ItemAccess,
  type SidebarKey,
  type SidebarItem,
} from '../../lib/sidebar-catalog'
import { invalidateRolePermissions } from '../../lib/role-permissions'
import { useDepartmentLabel } from '../../lib/department-label'

function buildRoles(deptSingular: string): { key: EffectiveRole; label: string }[] {
  return [
    { key: 'admin', label: 'Admin' },
    { key: 'dept_admin', label: `${deptSingular} Admin` },
    { key: 'educator', label: 'Educator' },
    { key: 'parent', label: 'Family' },
    { key: 'learner', label: 'Learner' },
  ]
}

const ACCESS_OPTIONS: ItemAccess[] = ['hidden', 'view', 'edit']

const ACCESS_STYLES: Record<ItemAccess, string> = {
  hidden: 'bg-bg-muted text-text-light',
  view:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  edit:   'bg-success-50 text-success-700 border-success-200',
}

/** A flat (role, key) → access map for both the loaded state and the draft. */
type Matrix = Record<string, ItemAccess>
const cellKey = (role: EffectiveRole, key: SidebarKey) => `${role}:${key}`

export default function Permissions() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { singular: deptSingular } = useDepartmentLabel()
  const ROLES = useMemo(() => buildRoles(deptSingular), [deptSingular])
  const [loaded, setLoaded] = useState<Matrix>({})
  const [draft, setDraft] = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const schoolId = profile?.school_id

  // Load existing rows
  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('role_permissions')
      .select('role, sidebar_key, access')
      .eq('school_id', schoolId)
      .then(({ data }) => {
        if (cancelled) return
        const map: Matrix = {}
        for (const row of (data ?? []) as { role: EffectiveRole; sidebar_key: SidebarKey; access: ItemAccess }[]) {
          map[cellKey(row.role, row.sidebar_key)] = row.access
        }
        setLoaded(map)
        setDraft(map)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [schoolId])

  const dirty = useMemo(() => {
    const allKeys = new Set([...Object.keys(loaded), ...Object.keys(draft)])
    for (const k of allKeys) {
      if (loaded[k] !== draft[k]) return true
    }
    return false
  }, [loaded, draft])

  function setCell(role: EffectiveRole, key: SidebarKey, access: ItemAccess) {
    setDraft((d) => ({ ...d, [cellKey(role, key)]: access }))
  }

  function resetDraft() {
    setDraft(loaded)
  }

  async function save() {
    if (!schoolId || !profile) return
    setSaving(true)
    try {
      // Compute upserts (cells changed) and deletes (cells cleared back to default)
      const allKeys = new Set([...Object.keys(loaded), ...Object.keys(draft)])
      const upserts: { school_id: string; role: EffectiveRole; sidebar_key: SidebarKey; access: ItemAccess; updated_by: string }[] = []
      const deletes: { role: EffectiveRole; sidebar_key: SidebarKey }[] = []

      for (const k of allKeys) {
        const next = draft[k]
        const prev = loaded[k]
        if (next === prev) continue
        const [role, sidebar_key] = k.split(':') as [EffectiveRole, SidebarKey]
        if (next == null) {
          deletes.push({ role, sidebar_key })
        } else {
          upserts.push({
            school_id: schoolId,
            role,
            sidebar_key,
            access: next,
            updated_by: profile.id,
          })
        }
      }

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('role_permissions')
          .upsert(upserts, { onConflict: 'school_id,role,sidebar_key' })
        if (error) throw new Error(error.message)
      }
      for (const d of deletes) {
        await supabase
          .from('role_permissions')
          .delete()
          .eq('school_id', schoolId)
          .eq('role', d.role)
          .eq('sidebar_key', d.sidebar_key)
      }

      setLoaded(draft)
      invalidateRolePermissions(schoolId)
      toast('Permissions saved', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
            <Lock className="h-5 w-5 text-primary-500" />
            Permissions
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Control which sections each role can see, and whether they can edit or only view.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetDraft}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm font-medium text-text-muted hover:bg-bg-muted disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Permissions are a UI policy — security-critical role rules are still enforced
            server-side. Cells left at their default ("—" badge below the dropdown) follow
            the built-in defaults baked into the app.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-bg-muted bg-bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-bg-muted bg-bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                Section
              </th>
              {ROLES.map((r) => (
                <th key={r.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONFIGURABLE_ITEMS.map((item) => (
              <PermissionRow
                key={item.key}
                item={item}
                roles={ROLES}
                draft={draft}
                onChange={setCell}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PermissionRow({
  item,
  roles,
  draft,
  onChange,
}: {
  item: SidebarItem
  roles: { key: EffectiveRole; label: string }[]
  draft: Matrix
  onChange: (role: EffectiveRole, key: SidebarKey, access: ItemAccess) => void
}) {
  return (
    <tr className="border-b border-bg-muted last:border-b-0">
      <td className="px-4 py-3">
        <div className="font-medium text-text">{item.label}</div>
        {item.to && <div className="text-xs text-text-light">{item.to}</div>}
      </td>
      {roles.map((r) => {
        const cur = draft[cellKey(r.key, item.key)] ?? item.defaultAccess[r.key]
        const explicit = draft[cellKey(r.key, item.key)] != null
        return (
          <td key={r.key} className="px-4 py-3">
            <div className="flex flex-col gap-1">
              <select
                value={cur}
                onChange={(e) => onChange(r.key, item.key, e.target.value as ItemAccess)}
                className={`rounded-md border px-2 py-1 text-xs font-medium ${ACCESS_STYLES[cur]}`}
              >
                {ACCESS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <span className="text-[9px] uppercase tracking-wide text-text-light">
                {explicit ? 'custom' : `default (${item.defaultAccess[r.key]})`}
              </span>
            </div>
          </td>
        )
      })}
    </tr>
  )
}

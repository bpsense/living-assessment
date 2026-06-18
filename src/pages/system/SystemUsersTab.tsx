/**
 * SystemUsersTab.tsx
 *
 * Master cross-school user list for the system-admin dashboard: who they are,
 * which school they belong to, their role/status — and a one-click "Enter as"
 * that impersonates them (read-only) so an admin can see exactly what that user
 * sees without logging out. Full user CRUD still lives at /admin/users.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Loader2, LogIn, Search } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useUserManagement, type ManagedUser } from '../../lib/user-management'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  educator: 'Educator',
  parent: 'Family',
  learner: 'Learner',
}
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-primary-50 text-primary-700',
  educator: 'bg-success-50 text-success-700',
  parent: 'bg-accent-50 text-accent-700',
  learner: 'bg-caution-50 text-caution-700',
}

export default function SystemUsersTab() {
  const { setViewAs, actualUserId } = useAuth()
  const navigate = useNavigate()
  const { users, loading } = useUserManagement({ includeInactive: true })
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = q
    ? users.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.school_name?.toLowerCase().includes(q)
      )
    : users

  function enterAs(u: ManagedUser) {
    // setViewAs loads the user's full profile and pins the active school to theirs.
    setViewAs(u.role, u.id, u.full_name)
    navigate('/')
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-bg-muted px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-text-light" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or school…"
          className="w-full bg-transparent text-sm text-text placeholder:text-text-light focus:outline-none"
        />
        <span className="shrink-0 text-xs text-text-light">{filtered.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center px-5 py-12 text-sm text-text-light">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-text-light">No users found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-muted text-left text-xs font-medium text-text-light">
                <th className="px-5 py-2">User</th>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-muted">
              {filtered.map((u) => {
                const isSelf = u.id === actualUserId
                // Impersonating another platform admin has no single-school view.
                const canEnter = !isSelf && !u.is_system_admin && u.is_active
                return (
                  <tr key={u.id} className="transition-colors hover:bg-bg-muted/40">
                    <td className="px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">
                          {u.full_name}
                          {u.is_system_admin && (
                            <span className="ml-1.5 rounded bg-text/10 px-1 py-0.5 text-[10px] font-medium text-text-muted">
                              SYS
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-text-light">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">{u.school_name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          ROLE_BADGE[u.role] ?? 'bg-bg-muted text-text-muted'
                        )}
                      >
                        {u.is_department_admin ? 'Dept Admin' : ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.is_active ? (
                        <span className="text-xs text-success-600">Active</span>
                      ) : (
                        <span className="text-xs text-text-light">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => enterAs(u)}
                        disabled={!canEnter}
                        title={
                          isSelf
                            ? "That's you"
                            : u.is_system_admin
                              ? 'System admins have no single-school view'
                              : !u.is_active
                                ? 'User is inactive'
                                : `View the app as ${u.full_name}`
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Enter as
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

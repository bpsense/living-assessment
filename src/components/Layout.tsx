import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { supabase } from '../lib/supabase'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  School,
  Users,
  UserCheck,
  UsersRound,
  Layers,
  BookOpen,
  Building2,
  PlusCircle,
  User,
  LogOut,
  GraduationCap,
  Eye,
  MapPin,
  ChevronDown,
  X,
  ClipboardList,
  MessageCircle,
  Target,
  AlertTriangle,
  ShieldAlert,
  Languages,
  Activity,
  Wrench,
  ChevronRight,
  Lock,
  Sprout,
} from 'lucide-react'
import type { UserRole } from '../types/database'
import QuickObserveModal from './QuickObserveModal'
import AssignProjectModal from './assignment/AssignProjectModal'
import IncidentReportModal from './incident/IncidentReportModal'
import SpeedDial from './SpeedDial'
import SchoolSwitcher from './SchoolSwitcher'
import NotificationBell from './incident/NotificationBell'
import { useEducatorList, useDepartmentAdminList } from '../lib/educator-data'
import { useFamilyList } from '../lib/family-data'
import { useDepartmentLabel } from '../lib/department-label'
import { SIDEBAR_ITEMS, SIDEBAR_BY_KEY, effectiveRoleFor, type EffectiveRole, type SidebarItem } from '../lib/sidebar-catalog'
import { useRolePermissions, resolveAccess, type RolePermissionMap } from '../lib/role-permissions'

// ============================================================
// Icon registry — catalog stores icon names as strings; we resolve
// them here so the catalog stays React-free.
// ============================================================
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, School, Users, UserCheck, UsersRound, Layers, BookOpen,
  Building2, PlusCircle, User, MapPin, ClipboardList, MessageCircle, Target,
  ShieldAlert, Languages, Wrench, Lock, Sprout,
}

function renderIcon(name: string) {
  const Cmp = ICONS[name] ?? LayoutDashboard
  return <Cmp className="h-5 w-5" />
}

// ============================================================
// Per-role label/route overrides — keeps the catalog generic and
// lets each role get its preferred terminology / target route.
// ============================================================
function labelFor(item: SidebarItem, role: EffectiveRole, deptLabel: { singular: string; plural: string }): string {
  if (item.key === 'departments') return deptLabel.plural
  if (item.key === 'department-dashboard') return deptLabel.singular
  if (item.key === 'classrooms' && (role === 'educator' || role === 'dept_admin')) return 'My Classrooms'
  if (item.key === 'students' && role === 'parent') return 'My Children'
  if (item.key === 'school-profile' && role === 'parent') return 'School Info'
  if (item.key === 'profile' && role === 'learner') return 'My Profile'
  return item.label
}

function routeFor(item: SidebarItem, role: EffectiveRole): string | undefined {
  if (item.key === 'profile' && role === 'learner') return '/learner/profile'
  return item.to
}

interface NavItem {
  to?: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
  /** Stable key for folders, used to persist expand state. */
  folderKey?: string
}

/**
 * Build the role's sidebar from the central catalog + role_permissions
 * overrides. Items resolve to 'hidden' / 'view' / 'edit' for the role; only
 * non-hidden items are rendered. Folders disappear when all children are
 * hidden.
 */
function buildNavFromCatalog(
  role: EffectiveRole,
  perms: RolePermissionMap,
  deptLabel: { singular: string; plural: string }
): NavItem[] {
  // Items referenced as children of a folder shouldn't also appear at the
  // top level (the catalog lists them both ways so SIDEBAR_BY_KEY can resolve
  // them, but they're meant to be nested when rendered).
  const folderChildKeys = new Set<string>()
  for (const item of SIDEBAR_ITEMS) {
    if (item.children) for (const k of item.children) folderChildKeys.add(k)
  }

  const nav: NavItem[] = []
  for (const item of SIDEBAR_ITEMS) {
    if (folderChildKeys.has(item.key)) continue
    if (resolveAccess(item.key, role, perms) === 'hidden') continue

    if (item.children) {
      const children: NavItem[] = []
      for (const childKey of item.children) {
        const child = SIDEBAR_BY_KEY[childKey]
        if (!child) continue
        if (resolveAccess(child.key, role, perms) === 'hidden') continue
        const to = routeFor(child, role)
        if (!to) continue
        children.push({
          to,
          label: labelFor(child, role, deptLabel),
          icon: renderIcon(child.icon),
        })
      }
      if (children.length === 0) continue
      nav.push({
        label: labelFor(item, role, deptLabel),
        icon: renderIcon(item.icon),
        folderKey: `folder-${item.key}-${role}`,
        children,
      })
    } else {
      const to = routeFor(item, role)
      if (!to) continue
      nav.push({
        to,
        label: labelFor(item, role, deptLabel),
        icon: renderIcon(item.icon),
      })
    }
  }
  return nav
}

function getNavItems(
  effectiveRole: EffectiveRole,
  isSystemAdmin: boolean,
  isAllSchoolsView: boolean,
  perms: RolePermissionMap,
  deptLabel: { singular: string; plural: string }
): NavItem[] {
  // System admin viewing "All Schools" gets a hardcoded system nav (these
  // routes aren't in the per-school catalog).
  if (isSystemAdmin && isAllSchoolsView) {
    return [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { to: '/system/schools', label: 'Schools', icon: <Building2 className="h-5 w-5" /> },
      { to: '/system/activity', label: 'Activity', icon: <Activity className="h-5 w-5" /> },
      { to: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" /> },
    ]
  }

  return buildNavFromCatalog(effectiveRole, perms, deptLabel)
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  educator: 'Educator',
  parent: 'Family',
  learner: 'Learner',
}

/** Pill labels in the View As switcher; the dept_admin label is rendered
 *  via the school's department/location term at call sites. */
const VIEW_AS_PILL_LABELS: Record<Exclude<ViewAsPill, 'dept_admin'>, string> = {
  admin: 'Admin',
  educator: 'Educator',
  parent: 'Family',
}

function flattenLeafItems(items: NavItem[]): NavItem[] {
  return items.flatMap((i) => (i.children ? flattenLeafItems(i.children) : i.to ? [i] : []))
}

function NavLeaf({ item }: { item: NavItem }) {
  if (!item.to) return null
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'border-l-[3px] border-primary-500 bg-primary-50 text-primary-700'
            : 'border-l-[3px] border-transparent text-text-muted hover:bg-bg-muted hover:text-text'
        )
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )
}

function NavFolder({ item, currentPath }: { item: NavItem; currentPath: string }) {
  const storageKey = `sidebar-folder:${item.folderKey ?? item.label}`
  const childRoutes = (item.children ?? []).map((c) => c.to).filter(Boolean) as string[]
  const containsActive = childRoutes.some((r) => currentPath === r || currentPath.startsWith(r + '/'))

  const [open, setOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) return stored === '1'
    return containsActive
  })

  // Auto-open when navigating into a child route
  useEffect(() => {
    if (containsActive && !open) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containsActive])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem(storageKey, next ? '1' : '0')
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-l-[3px]',
          containsActive
            ? 'border-primary-500 bg-primary-50/60 text-primary-700'
            : 'border-transparent text-text-muted hover:bg-bg-muted hover:text-text'
        )}
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight className={clsx('h-4 w-4 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-4">
          {(item.children ?? []).map((child) => (
            <NavLeaf key={child.to} item={child} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Pill identifiers in the View-As switcher. Wider than UserRole because
 * "Dept/Location Admin" has its own filtered dropdown even though the
 * impersonated person is technically role='educator'.
 */
type ViewAsPill = 'admin' | 'dept_admin' | 'educator' | 'parent'

/** Which switcher pills the current user's actual role can use. */
function getSwitchableRoles(actualRole: UserRole): ViewAsPill[] {
  switch (actualRole) {
    case 'admin':
      return ['admin', 'dept_admin', 'educator', 'parent']
    case 'educator':
      return ['educator', 'parent']
    case 'parent':
    default:
      return []
  }
}

export default function Layout() {
  const { profile, actualRole, signOut, viewAsRole, setViewAs, viewAsUserId, viewAsUserName, isSystemAdmin, activeSchoolId, setActiveSchool } = useAuth()
  const { isDepartmentAdmin, accessLevel } = useAccessControl()
  const navigate = useNavigate()
  const location = useLocation()
  const [quickObserveOpen, setQuickObserveOpen] = useState(false)
  const [showAssignProject, setShowAssignProject] = useState(false)
  const [incidentReportOpen, setIncidentReportOpen] = useState(false)
  const [schoolName, setSchoolName] = useState<string>('')
  const [openDropdown, setOpenDropdown] = useState<ViewAsPill | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isAllSchoolsView = isSystemAdmin && activeSchoolId === null

  // Close dropdown on click-outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Educator and family lists for impersonation dropdowns
  const schoolIdForLists = isSystemAdmin ? activeSchoolId : profile?.school_id
  const { educators } = useEducatorList(schoolIdForLists ?? undefined)
  const { families } = useFamilyList(schoolIdForLists ?? undefined)
  const { admins: deptAdmins } = useDepartmentAdminList(schoolIdForLists ?? undefined)

  // Fetch school name once (based on active school for system admins)
  useEffect(() => {
    const schoolId = isSystemAdmin ? activeSchoolId : profile?.school_id
    if (!schoolId) {
      setSchoolName('')
      return
    }
    supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()
      .then(({ data }) => {
        if (data?.name) setSchoolName(data.name)
      })
  }, [profile?.school_id, isSystemAdmin, activeSchoolId])

  const deptLabel = useDepartmentLabel()
  // profile.role and isDepartmentAdmin both already reflect impersonation
  // (auth swaps them based on viewAsRole/viewAsUserId).
  const isViewingAs = !!viewAsRole
  const role = profile?.role ?? 'educator'
  // System admin viewing into a school renders nav as the admin role —
  // unless they're explicitly impersonating, in which case respect that.
  const effectiveRole: EffectiveRole =
    isSystemAdmin && !isAllSchoolsView && !isViewingAs
      ? 'admin'
      : effectiveRoleFor(role, isDepartmentAdmin)
  const { permissions } = useRolePermissions(effectiveRole)
  const navItems = getNavItems(effectiveRole, isSystemAdmin, isAllSchoolsView, permissions, deptLabel)
  // Hide FAB when impersonating (read-only context) or in All Schools view
  const showFab = (role === 'educator' || role === 'admin' || isSystemAdmin) && !isAllSchoolsView && !viewAsUserId
  // System admins can switch roles when viewing a specific school, but not in the "All Schools" view
  const switchableRoles = isAllSchoolsView ? [] : getSwitchableRoles(isSystemAdmin ? 'admin' : (actualRole ?? role))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const roleLabel = isSystemAdmin
    ? 'System Admin'
    : isDepartmentAdmin
      ? 'Dept Admin'
      : ROLE_LABELS[role]

  return (
    <div className="flex min-h-screen">
      {/* ============ Desktop sidebar ============ */}
      <aside className="glass-chrome fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/40 md:flex print:!hidden">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-white/30 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-text">Living Assessment</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) =>
            item.children ? (
              <NavFolder key={item.folderKey ?? item.label} item={item} currentPath={location.pathname} />
            ) : (
              <NavLeaf key={item.to} item={item} />
            )
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/30 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {profile?.full_name ?? 'Loading...'}
              </p>
              <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                {roleLabel}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ============ Main content ============ */}
      <div className="flex flex-1 flex-col md:pl-60 print:!pl-0">
        {/* Top bar (mobile brand + desktop school name & user) */}
        <header className="glass-chrome sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/30 px-4 md:px-6 print:!hidden">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-text">Living Assessment</span>
          </div>

          {/* Desktop: school name or school switcher for system admins */}
          <div className="hidden md:block">
            {isSystemAdmin ? (
              <SchoolSwitcher />
            ) : (
              <h2 className="text-sm font-medium text-text-muted">
                {schoolName || 'Loading…'}
              </h2>
            )}
          </div>

          {/* Right side: user info (desktop only) + sign out */}
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-text-muted">{profile?.full_name}</span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {roleLabel}
            </span>
            {profile && accessLevel >= 3 && (
              <NotificationBell profileId={profile.id} />
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile: notifications + sign out */}
          <div className="flex items-center gap-1 md:hidden">
            {profile && accessLevel >= 3 && (
              <NotificationBell profileId={profile.id} />
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* View-as role switcher with user impersonation dropdowns */}
        {switchableRoles.length > 1 && (
          <div className="glass-chrome border-b border-white/30 print:!hidden">
            {/* Impersonation banner */}
            {viewAsUserId && viewAsUserName && (
              <div className="flex items-center justify-between bg-accent-50 px-4 py-1.5 md:px-6">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-accent-600" />
                  <span className="text-xs font-medium text-accent-700">
                    Viewing as {viewAsUserName} ({ROLE_LABELS[viewAsRole ?? 'educator']})
                  </span>
                </div>
                <button
                  onClick={() => setViewAs(null)}
                  className="flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium text-accent-700 hover:bg-accent-200"
                >
                  <X className="h-3 w-3" />
                  Exit
                </button>
              </div>
            )}

            {/* Role switcher buttons */}
            <div ref={dropdownRef} className="relative flex items-center gap-2 px-4 py-1.5 md:px-6">
              <Eye className="h-3.5 w-3.5 text-text-light" />
              <span className="text-xs text-text-light">View as:</span>

              {switchableRoles.map((r) => {
                const pillLabel =
                  r === 'dept_admin' ? `${deptLabel.singular} Admin` : VIEW_AS_PILL_LABELS[r]
                const pillActive =
                  r === 'admin'
                    ? role === 'admin' && !viewAsUserId
                    : r === 'dept_admin'
                      ? role === 'educator' && isDepartmentAdmin
                      : r === 'educator'
                        ? role === 'educator' && !isDepartmentAdmin
                        : role === 'parent'
                return (
                <div key={r} className="relative">
                  {r === 'admin' ? (
                    /* Admin: simple click, no dropdown */
                    <button
                      onClick={() => {
                        setViewAs(role === r && !viewAsUserId ? null : r)
                        setOpenDropdown(null)
                      }}
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                        pillActive
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {pillLabel}
                    </button>
                  ) : (
                    /* Dept Admin / Educator / Family: click opens dropdown */
                    <button
                      onClick={() => setOpenDropdown(openDropdown === r ? null : r)}
                      className={clsx(
                        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                        pillActive
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {pillLabel}
                      <ChevronDown className={clsx('h-3 w-3 transition-transform', openDropdown === r && 'rotate-180')} />
                    </button>
                  )}

                  {/* Dept Admin dropdown — filtered list of educators that have a department_admins row */}
                  {openDropdown === r && r === 'dept_admin' && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-bg-muted bg-bg-card shadow-lg">
                      <div className="max-h-64 overflow-y-auto py-1">
                        {deptAdmins.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-text-light">
                            No {deptLabel.singular.toLowerCase()} admins
                          </p>
                        ) : (
                          deptAdmins.map((da) => (
                            <button
                              key={da.id}
                              onClick={() => {
                                setViewAs('educator', da.id, da.full_name)
                                setOpenDropdown(null)
                              }}
                              className={clsx(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted',
                                viewAsUserId === da.id && 'bg-primary-50 text-primary-700 font-medium'
                              )}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                                {da.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{da.full_name}</p>
                                {da.departments.length > 0 && (
                                  <p className="truncate text-[10px] text-text-light">
                                    {da.departments.map((d) => d.name).join(', ')}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dropdown for educator/family selection */}
                  {openDropdown === r && r === 'educator' && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-bg-muted bg-bg-card shadow-lg">
                      <div className="max-h-64 overflow-y-auto py-1">
                        {educators.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-text-light">No educators found</p>
                        ) : (
                          educators.map((edu) => (
                            <button
                              key={edu.id}
                              onClick={() => {
                                setViewAs('educator', edu.id, edu.full_name)
                                setOpenDropdown(null)
                              }}
                              className={clsx(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted',
                                viewAsUserId === edu.id && 'bg-primary-50 text-primary-700 font-medium'
                              )}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                                {edu.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{edu.full_name}</p>
                                {edu.classrooms.length > 0 && (
                                  <p className="truncate text-[10px] text-text-light">
                                    {edu.classrooms.map((c) => c.name).join(', ')}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {openDropdown === r && r === 'parent' && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-bg-muted bg-bg-card shadow-lg">
                      <div className="max-h-64 overflow-y-auto py-1">
                        {families.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-text-light">No families found</p>
                        ) : (
                          families.map((fam) => (
                            <button
                              key={fam.id}
                              onClick={() => {
                                setViewAs('parent', fam.id, fam.full_name)
                                setOpenDropdown(null)
                              }}
                              className={clsx(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted',
                                viewAsUserId === fam.id && 'bg-primary-50 text-primary-700 font-medium'
                              )}
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[10px] font-semibold text-accent-700">
                                {fam.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{fam.full_name}</p>
                                {fam.linked_students.length > 0 && (
                                  <p className="truncate text-[10px] text-text-light">
                                    {fam.linked_students.map((s) => `${s.first_name} ${s.last_name}`).join(', ')}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )
              })}

              {(viewAsRole || viewAsUserId) && (
                <button
                  onClick={() => {
                    setViewAs(null)
                    setOpenDropdown(null)
                  }}
                  className="ml-1 text-[10px] text-text-light hover:text-alert-500"
                >
                  ✕ reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* System admin: prominent banner when viewing into a specific school */}
        {isSystemAdmin && !isAllSchoolsView && (
          <div className="flex items-center justify-between border-b border-primary-200 bg-primary-50 px-4 py-1.5 md:px-6 print:!hidden">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-primary-600" />
              <span className="text-xs font-medium text-primary-700">
                Viewing as School Admin
              </span>
              <span className="text-xs text-primary-700">·</span>
              <Building2 className="h-3.5 w-3.5 text-primary-600" />
              <span className="text-xs font-semibold text-primary-800">{schoolName || 'Loading…'}</span>
            </div>
            <button
              onClick={() => setActiveSchool(null)}
              className="flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700 hover:bg-primary-200"
            >
              <X className="h-3 w-3" />
              Exit to All Schools
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6 print:!p-0">
          <Outlet />
        </main>
      </div>

      {/* ============ Mobile bottom nav ============ */}
      <nav className="glass-chrome fixed inset-x-0 bottom-0 z-30 flex border-t border-white/30 md:hidden print:!hidden">
        {flattenLeafItems(navItems).slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to!}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary-500'
                  : 'text-text-light hover:text-text-muted'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ============ Floating Action Button (SpeedDial) ============ */}
      {showFab && (
        <SpeedDial
          actions={[
            {
              icon: <Eye className="h-4 w-4" />,
              label: 'Quick Observation',
              onClick: () => setQuickObserveOpen(true),
              color: 'bg-accent-500 hover:bg-accent-600',
            },
            {
              icon: <ClipboardList className="h-4 w-4" />,
              label: 'Assign Project',
              onClick: () => setShowAssignProject(true),
              color: 'bg-primary-500 hover:bg-primary-600',
            },
            {
              icon: <AlertTriangle className="h-4 w-4" />,
              label: 'Incident Report',
              onClick: () => setIncidentReportOpen(true),
              color: 'bg-alert-500 hover:bg-alert-600',
            },
          ]}
        />
      )}

      {/* ============ Quick Observe Modal ============ */}
      <QuickObserveModal
        open={quickObserveOpen}
        onClose={() => setQuickObserveOpen(false)}
      />

      {/* ============ Assign Project (standards-driven, from FAB) ============ */}
      <AssignProjectModal
        open={showAssignProject}
        onClose={() => setShowAssignProject(false)}
      />

      {/* ============ Incident Report Modal ============ */}
      <IncidentReportModal
        open={incidentReportOpen}
        onClose={() => setIncidentReportOpen(false)}
      />
    </div>
  )
}

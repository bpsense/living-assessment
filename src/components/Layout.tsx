import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import type { UserRole } from '../types/database'
import QuickObserveModal from './QuickObserveModal'
import CreateAssignmentModal from './assignment/CreateAssignmentModal'
import IncidentReportModal from './incident/IncidentReportModal'
import SpeedDial from './SpeedDial'
import SchoolSwitcher from './SchoolSwitcher'
import NotificationBell from './incident/NotificationBell'
import { useEducatorList } from '../lib/educator-data'
import { useFamilyList } from '../lib/family-data'
import { useDepartmentLabel } from '../lib/department-label'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function getNavItems(
  role: UserRole,
  isSystemAdmin: boolean,
  isAllSchoolsView: boolean,
  isDepartmentAdmin: boolean,
  deptLabel: { singular: string; plural: string }
): NavItem[] {
  // System admin viewing "All Schools" gets the system nav
  if (isSystemAdmin && isAllSchoolsView) {
    return [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { to: '/system/schools', label: 'Schools', icon: <Building2 className="h-5 w-5" /> },
      { to: '/system/activity', label: 'Activity', icon: <Activity className="h-5 w-5" /> },
      { to: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" /> },
    ]
  }

  // System admin viewing a specific school gets school admin nav + Users
  if (isSystemAdmin) {
    return [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { to: '/classrooms', label: 'Classrooms', icon: <School className="h-5 w-5" /> },
      { to: '/assignments', label: 'Assignments', icon: <ClipboardList className="h-5 w-5" /> },
      { to: '/messages', label: 'Messages', icon: <MessageCircle className="h-5 w-5" /> },
      { to: '/students', label: 'Learners', icon: <Users className="h-5 w-5" /> },
      { to: '/admin/educators', label: 'Educators', icon: <UserCheck className="h-5 w-5" /> },
      { to: '/admin/families', label: 'Families', icon: <UsersRound className="h-5 w-5" /> },
      { to: '/admin/incidents', label: 'Incidents', icon: <ShieldAlert className="h-5 w-5" /> },
      { to: '/admin/departments', label: deptLabel.plural, icon: <MapPin className="h-5 w-5" /> },
      { to: '/admin/dimensions', label: 'Dimensions', icon: <Layers className="h-5 w-5" /> },
      { to: '/standards', label: 'Standards', icon: <BookOpen className="h-5 w-5" /> },
      { to: '/translate', label: 'Translate', icon: <Languages className="h-5 w-5" /> },
      { to: '/admin/skill-library', label: 'Skill Library', icon: <Target className="h-5 w-5" /> },
      { to: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" /> },
      { to: '/settings', label: 'School Profile', icon: <Building2 className="h-5 w-5" /> },
    ]
  }

  switch (role) {
    case 'educator': {
      const items: NavItem[] = [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/classrooms', label: 'My Classrooms', icon: <School className="h-5 w-5" /> },
        { to: '/assignments', label: 'Assignments', icon: <ClipboardList className="h-5 w-5" /> },
        { to: '/messages', label: 'Messages', icon: <MessageCircle className="h-5 w-5" /> },
        { to: '/students', label: 'Learners', icon: <Users className="h-5 w-5" /> },
        { to: '/observe', label: 'Quick Observe', icon: <PlusCircle className="h-5 w-5" /> },
      ]
      // Department admins get extra nav items
      if (isDepartmentAdmin) {
        items.push(
          { to: '/department', label: deptLabel.singular, icon: <MapPin className="h-5 w-5" /> },
          { to: '/admin/educators', label: 'Educators', icon: <UserCheck className="h-5 w-5" /> },
          { to: '/admin/families', label: 'Families', icon: <UsersRound className="h-5 w-5" /> },
          { to: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" /> },
        )
      }
      items.push(
        { to: '/settings', label: 'School Profile', icon: <Building2 className="h-5 w-5" /> },
        { to: '/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
      )
      return items
    }
    case 'admin':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/classrooms', label: 'Classrooms', icon: <School className="h-5 w-5" /> },
        { to: '/assignments', label: 'Assignments', icon: <ClipboardList className="h-5 w-5" /> },
        { to: '/messages', label: 'Messages', icon: <MessageCircle className="h-5 w-5" /> },
        { to: '/students', label: 'Learners', icon: <Users className="h-5 w-5" /> },
        { to: '/admin/educators', label: 'Educators', icon: <UserCheck className="h-5 w-5" /> },
        { to: '/admin/families', label: 'Families', icon: <UsersRound className="h-5 w-5" /> },
        { to: '/admin/incidents', label: 'Incidents', icon: <ShieldAlert className="h-5 w-5" /> },
        { to: '/admin/departments', label: deptLabel.plural, icon: <MapPin className="h-5 w-5" /> },
        { to: '/admin/dimensions', label: 'Dimensions', icon: <Layers className="h-5 w-5" /> },
        { to: '/standards', label: 'Standards', icon: <BookOpen className="h-5 w-5" /> },
        { to: '/translate', label: 'Translate', icon: <Languages className="h-5 w-5" /> },
        { to: '/admin/skill-library', label: 'Skill Library', icon: <Target className="h-5 w-5" /> },
        { to: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" /> },
        { to: '/settings', label: 'School Profile', icon: <Building2 className="h-5 w-5" /> },
      ]
    case 'parent':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/messages', label: 'Messages', icon: <MessageCircle className="h-5 w-5" /> },
        { to: '/students', label: 'My Children', icon: <Users className="h-5 w-5" /> },
        { to: '/classrooms', label: 'Classrooms', icon: <School className="h-5 w-5" /> },
        { to: '/settings', label: 'School Info', icon: <Building2 className="h-5 w-5" /> },
        { to: '/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
      ]
    case 'learner':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/messages', label: 'Messages', icon: <MessageCircle className="h-5 w-5" /> },
        { to: '/learner/profile', label: 'My Profile', icon: <User className="h-5 w-5" /> },
      ]
    default:
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      ]
  }
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  educator: 'Educator',
  parent: 'Family',
  learner: 'Learner',
}

/** Which roles can the current user's actual role switch to? */
function getSwitchableRoles(actualRole: UserRole): UserRole[] {
  switch (actualRole) {
    case 'admin':
      return ['admin', 'educator', 'parent'] // Admin sees all 3
    case 'educator':
      return ['educator', 'parent']           // Educator sees Educator + Family
    case 'parent':
    default:
      return []                               // Family sees no switcher
  }
}

export default function Layout() {
  const { profile, actualRole, signOut, viewAsRole, setViewAs, viewAsUserId, viewAsUserName, isSystemAdmin, activeSchoolId, setActiveSchool } = useAuth()
  const { isDepartmentAdmin, accessLevel } = useAccessControl()
  const navigate = useNavigate()
  const [quickObserveOpen, setQuickObserveOpen] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [incidentReportOpen, setIncidentReportOpen] = useState(false)
  const [schoolName, setSchoolName] = useState<string>('')
  const [openDropdown, setOpenDropdown] = useState<UserRole | null>(null)
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
  const role = profile?.role ?? 'educator'
  const navItems = getNavItems(role, isSystemAdmin, isAllSchoolsView, isDepartmentAdmin, deptLabel)
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
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
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
          ))}
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

              {switchableRoles.map((r) => (
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
                        role === r && !viewAsUserId
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ) : (
                    /* Educator / Family: click opens dropdown */
                    <button
                      onClick={() => setOpenDropdown(openDropdown === r ? null : r)}
                      className={clsx(
                        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                        role === r
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                      )}
                    >
                      {ROLE_LABELS[r]}
                      <ChevronDown className={clsx('h-3 w-3 transition-transform', openDropdown === r && 'rotate-180')} />
                    </button>
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
              ))}

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
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
              label: 'New Assignment',
              onClick: () => setShowCreateAssignment(true),
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

      {/* ============ Create Assignment Modal (from FAB) ============ */}
      <CreateAssignmentModal
        open={showCreateAssignment}
        onClose={() => setShowCreateAssignment(false)}
        onCreated={() => setShowCreateAssignment(false)}
      />

      {/* ============ Incident Report Modal ============ */}
      <IncidentReportModal
        open={incidentReportOpen}
        onClose={() => setIncidentReportOpen(false)}
      />
    </div>
  )
}

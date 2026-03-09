import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
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
  Plus,
  Eye,
} from 'lucide-react'
import type { UserRole } from '../types/database'
import QuickObserveModal from './QuickObserveModal'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'educator':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/classrooms', label: 'My Classrooms', icon: <School className="h-5 w-5" /> },
        { to: '/observe', label: 'Quick Observe', icon: <PlusCircle className="h-5 w-5" /> },
        { to: '/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
      ]
    case 'admin':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/classrooms', label: 'Classrooms', icon: <School className="h-5 w-5" /> },
        { to: '/students', label: 'Learners', icon: <Users className="h-5 w-5" /> },
        { to: '/admin/educators', label: 'Educators', icon: <UserCheck className="h-5 w-5" /> },
        { to: '/admin/families', label: 'Families', icon: <UsersRound className="h-5 w-5" /> },
        { to: '/admin/dimensions', label: 'Dimensions', icon: <Layers className="h-5 w-5" /> },
        { to: '/standards', label: 'Standards', icon: <BookOpen className="h-5 w-5" /> },
        { to: '/settings', label: 'School Profile', icon: <Building2 className="h-5 w-5" /> },
      ]
    case 'parent':
      return [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
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
  const { profile, actualRole, signOut, viewAsRole, setViewAsRole } = useAuth()
  const navigate = useNavigate()
  const [quickObserveOpen, setQuickObserveOpen] = useState(false)
  const [schoolName, setSchoolName] = useState<string>('')

  // Fetch school name once
  useEffect(() => {
    if (!profile?.school_id) return
    supabase
      .from('schools')
      .select('name')
      .eq('id', profile.school_id)
      .single()
      .then(({ data }) => {
        if (data?.name) setSchoolName(data.name)
      })
  }, [profile?.school_id])

  const role = profile?.role ?? 'educator'
  const navItems = getNavItems(role)
  const showFab = role === 'educator' || role === 'admin'
  const switchableRoles = getSwitchableRoles(actualRole ?? role)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ============ Desktop sidebar ============ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-bg-muted bg-bg-card md:flex print:!hidden">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-bg-muted px-5">
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
        <div className="border-t border-bg-muted p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {profile?.full_name ?? 'Loading...'}
              </p>
              <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                {ROLE_LABELS[role]}
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-bg-muted bg-bg-card px-4 md:px-6 print:!hidden">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-text">Living Assessment</span>
          </div>

          {/* Desktop: school name */}
          <div className="hidden md:block">
            <h2 className="text-sm font-medium text-text-muted">
              {schoolName || 'Loading…'}
            </h2>
          </div>

          {/* Right side: user info (desktop only) + sign out */}
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-text-muted">{profile?.full_name}</span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {ROLE_LABELS[role]}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile: sign out only */}
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text md:hidden"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* View-as role switcher — only shown for admin and educator */}
        {switchableRoles.length > 1 && (
          <div className="flex items-center gap-2 border-b border-bg-muted bg-bg-card/80 px-4 py-1.5 md:px-6 print:!hidden">
            <Eye className="h-3.5 w-3.5 text-text-light" />
            <span className="text-xs text-text-light">View as:</span>
            {switchableRoles.map((r) => (
              <button
                key={r}
                onClick={() => setViewAsRole(r === viewAsRole ? null : r)}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  role === r
                    ? 'bg-primary-500 text-white'
                    : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                )}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
            {viewAsRole && (
              <button
                onClick={() => setViewAsRole(null)}
                className="ml-1 text-[10px] text-text-light hover:text-alert-500"
              >
                ✕ reset
              </button>
            )}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6 print:!p-0">
          <Outlet />
        </main>
      </div>

      {/* ============ Mobile bottom nav ============ */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-bg-muted bg-bg-card md:hidden print:!hidden">
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

      {/* ============ Floating Action Button ============ */}
      {showFab && (
        <button
          onClick={() => setQuickObserveOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-600 active:scale-95 md:bottom-6 md:right-6"
          title="Quick Observation"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* ============ Quick Observe Modal ============ */}
      <QuickObserveModal
        open={quickObserveOpen}
        onClose={() => setQuickObserveOpen(false)}
      />
    </div>
  )
}

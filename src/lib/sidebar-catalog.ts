/**
 * sidebar-catalog.ts
 *
 * Single source of truth for every navigable item in the school-scope app.
 * Drives both the rendered sidebar (Layout.tsx) and the permissions matrix
 * the school admin uses to configure each role's view (admin/Permissions).
 *
 * The catalog is intentionally NOT React-aware (no JSX in the icon field —
 * we store icon names as strings and resolve them in the renderer). This
 * keeps the catalog importable from data-layer code without dragging in
 * react/lucide.
 */
import type { UserRole } from '../types/database'

/** What a role can do with a given sidebar item. */
export type ItemAccess = 'hidden' | 'view' | 'edit'

/**
 * Stable identifiers for every item the permissions config can toggle.
 * Adding an item here means: pick a key, add it to SIDEBAR_ITEMS, and decide
 * its default access for each role. Keys must be stable — they're stored in
 * role_permissions rows.
 */
export type SidebarKey =
  | 'dashboard'
  | 'classrooms'
  | 'messages'
  | 'incidents'
  | 'departments'
  | 'school-profile'
  | 'profile'
  | 'observe'
  // Utilities folder children
  | 'dimensions'
  | 'standards'
  | 'translate'
  | 'skill-library'
  | 'assignments'
  | 'students'
  | 'educators'
  | 'families'
  | 'users'
  | 'permissions'
  // Folder
  | 'utilities'

export interface SidebarItem {
  key: SidebarKey
  /** Display label. Some items use a label key resolved at render (e.g. dept label). */
  label: string
  /** Lucide icon name (resolved by the renderer). */
  icon: string
  /** Route path for leaf items; undefined for folders. */
  to?: string
  /** Children for folder items. */
  children?: SidebarKey[]
  /**
   * Default access level for each role when no explicit row exists in
   * `role_permissions`. Preserves today's hardcoded UI behavior.
   */
  defaultAccess: Record<UserRole, ItemAccess>
  /**
   * If true, the item is meaningless to gate (e.g. Profile, Dashboard).
   * The permissions matrix hides it. The sidebar still renders it for
   * roles that have it visible by default.
   */
  alwaysVisible?: boolean
}

// Convenience builders so role default tables stay readable
const allEdit: Record<UserRole, ItemAccess> = {
  admin: 'edit', educator: 'edit', parent: 'edit', learner: 'edit',
}
const allView: Record<UserRole, ItemAccess> = {
  admin: 'view', educator: 'view', parent: 'view', learner: 'view',
}
const adminOnly: Record<UserRole, ItemAccess> = {
  admin: 'edit', educator: 'hidden', parent: 'hidden', learner: 'hidden',
}
const adminEducator: Record<UserRole, ItemAccess> = {
  admin: 'edit', educator: 'view', parent: 'hidden', learner: 'hidden',
}
const adminEducatorEdit: Record<UserRole, ItemAccess> = {
  admin: 'edit', educator: 'edit', parent: 'hidden', learner: 'hidden',
}

/**
 * The catalog. Order matters — sidebar renders top-to-bottom from this list.
 */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    to: '/',
    defaultAccess: allEdit,
    alwaysVisible: true,
  },
  {
    key: 'classrooms',
    label: 'Classrooms',
    icon: 'School',
    to: '/classrooms',
    defaultAccess: { admin: 'edit', educator: 'edit', parent: 'view', learner: 'hidden' },
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: 'MessageCircle',
    to: '/messages',
    defaultAccess: allEdit,
  },
  {
    key: 'incidents',
    label: 'Incidents',
    icon: 'ShieldAlert',
    to: '/admin/incidents',
    defaultAccess: { admin: 'edit', educator: 'hidden', parent: 'hidden', learner: 'hidden' },
  },
  {
    key: 'departments',
    label: 'Departments', // overridden at render via useDepartmentLabel().plural
    icon: 'MapPin',
    to: '/admin/departments',
    defaultAccess: { admin: 'edit', educator: 'hidden', parent: 'hidden', learner: 'hidden' },
  },
  {
    key: 'school-profile',
    label: 'School Profile',
    icon: 'Building2',
    to: '/settings',
    defaultAccess: { admin: 'edit', educator: 'view', parent: 'view', learner: 'hidden' },
  },
  {
    key: 'observe',
    label: 'Quick Observe',
    icon: 'PlusCircle',
    to: '/observe',
    defaultAccess: { admin: 'hidden', educator: 'edit', parent: 'hidden', learner: 'hidden' },
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'User',
    to: '/profile',
    defaultAccess: { admin: 'hidden', educator: 'edit', parent: 'edit', learner: 'edit' },
    alwaysVisible: true,
  },
  // ---- Utilities folder ----
  {
    key: 'utilities',
    label: 'Utilities',
    icon: 'Wrench',
    children: [
      'dimensions',
      'standards',
      'translate',
      'skill-library',
      'assignments',
      'students',
      'educators',
      'families',
      'users',
      'permissions',
    ],
    defaultAccess: { admin: 'edit', educator: 'view', parent: 'hidden', learner: 'hidden' },
  },
  {
    key: 'dimensions',
    label: 'Dimensions',
    icon: 'Layers',
    to: '/admin/dimensions',
    defaultAccess: adminOnly,
  },
  {
    key: 'standards',
    label: 'Standards',
    icon: 'BookOpen',
    to: '/standards',
    defaultAccess: adminOnly,
  },
  {
    key: 'translate',
    label: 'Translate',
    icon: 'Languages',
    to: '/translate',
    defaultAccess: adminOnly,
  },
  {
    key: 'skill-library',
    label: 'Skill Library',
    icon: 'Target',
    to: '/admin/skill-library',
    defaultAccess: adminOnly,
  },
  {
    key: 'assignments',
    label: 'Assignments',
    icon: 'ClipboardList',
    to: '/assignments',
    defaultAccess: { admin: 'edit', educator: 'edit', parent: 'view', learner: 'view' },
  },
  {
    key: 'students',
    label: 'Learners',
    icon: 'Users',
    to: '/students',
    defaultAccess: adminEducatorEdit,
  },
  {
    key: 'educators',
    label: 'Educators',
    icon: 'UserCheck',
    to: '/admin/educators',
    defaultAccess: adminEducator,
  },
  {
    key: 'families',
    label: 'Families',
    icon: 'UsersRound',
    to: '/admin/families',
    defaultAccess: adminEducator,
  },
  {
    key: 'users',
    label: 'Users',
    icon: 'Users',
    to: '/admin/users',
    defaultAccess: adminEducator,
  },
  {
    key: 'permissions',
    label: 'Permissions',
    icon: 'Lock',
    to: '/admin/permissions',
    defaultAccess: adminOnly,
    alwaysVisible: true,
  },
]

/** Map for O(1) lookup by key. */
export const SIDEBAR_BY_KEY: Record<SidebarKey, SidebarItem> = SIDEBAR_ITEMS.reduce(
  (acc, item) => {
    acc[item.key] = item
    return acc
  },
  {} as Record<SidebarKey, SidebarItem>
)

/** Items the permissions matrix can configure (folders + non-toggleable items hidden). */
export const CONFIGURABLE_ITEMS: SidebarItem[] = SIDEBAR_ITEMS.filter(
  (i) => !i.alwaysVisible && !i.children
)

// Suppress unused warnings for builders that may be used as defaults elsewhere
void allView

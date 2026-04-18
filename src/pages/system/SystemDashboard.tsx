import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  UserCheck,
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useSystemDashboard, type SchoolRow } from '../../lib/system-data'
import Sparkline from '../../components/system/Sparkline'
import { clsx } from 'clsx'

type SortKey = 'name' | 'learners' | 'educators' | 'classrooms' | 'obs' | 'activity'
type SortDir = 'asc' | 'desc'

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'Today'
  const days = Math.floor(diff / day)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function compareSchoolRow(a: SchoolRow, b: SchoolRow, key: SortKey, dir: SortDir): number {
  const mult = dir === 'asc' ? 1 : -1
  switch (key) {
    case 'name':
      return mult * a.school.name.localeCompare(b.school.name)
    case 'learners':
      return mult * (a.learnerCount - b.learnerCount)
    case 'educators':
      return mult * (a.educatorCount - b.educatorCount)
    case 'classrooms':
      return mult * (a.classroomCount - b.classroomCount)
    case 'obs':
      return mult * (a.observationsLast30d - b.observationsLast30d)
    case 'activity': {
      const at = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
      const bt = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
      return mult * (at - bt)
    }
  }
}

export default function SystemDashboard() {
  const { allSchools, setActiveSchool } = useAuth()
  const navigate = useNavigate()
  const data = useSystemDashboard(allSchools, true)

  const [sortKey, setSortKey] = useState<SortKey>('obs')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedRows = useMemo(() => {
    return [...data.schoolRows].sort((a, b) => compareSchoolRow(a, b, sortKey, sortDir))
  }, [data.schoolRows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function enterSchool(schoolId: string) {
    setActiveSchool(schoolId)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Platform Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          Adoption and activity across {data.kpis.totalSchools} school
          {data.kpis.totalSchools !== 1 ? 's' : ''}
        </p>
      </div>

      {data.error && (
        <div className="mb-6 rounded-lg border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-700">
          {data.error}
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Building2 className="h-5 w-5 text-primary-600" />}
          iconBg="bg-primary-100"
          label="Schools"
          value={data.kpis.totalSchools}
          loading={data.loading}
        />
        <KpiCard
          icon={<Users className="h-5 w-5 text-success-600" />}
          iconBg="bg-success-100"
          label="Total users"
          value={data.kpis.totalUsers}
          sub={`${data.kpis.totalLearners} learners`}
          loading={data.loading}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-accent-600" />}
          iconBg="bg-accent-100"
          label="Observations · 30d"
          value={data.kpis.observationsLast30d}
          sub={`${data.kpis.observationsLast7d} this week`}
          loading={data.loading}
          sparkline={data.kpis.observationsByDay}
        />
        <KpiCard
          icon={<UserCheck className="h-5 w-5 text-primary-600" />}
          iconBg="bg-primary-100"
          label="Active educators · 7d"
          value={data.kpis.activeEducators7d}
          sub="Logged ≥1 observation"
          loading={data.loading}
        />
      </div>

      {/* Needs attention */}
      {!data.loading && data.staleSchools.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent-200 bg-accent-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-accent-800">
                {data.staleSchools.length} school
                {data.staleSchools.length !== 1 ? 's need' : ' needs'} attention
              </p>
              <p className="mt-0.5 text-xs text-accent-700">
                No observations recorded in the last 30 days
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.staleSchools.slice(0, 6).map((row) => (
                  <button
                    key={row.school.id}
                    onClick={() => enterSchool(row.school.id)}
                    className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent-800 hover:bg-white"
                  >
                    {row.school.name}
                  </button>
                ))}
                {data.staleSchools.length > 6 && (
                  <span className="rounded-full bg-white/40 px-2.5 py-0.5 text-xs text-accent-700">
                    +{data.staleSchools.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* School table */}
        <div className="glass-card lg:col-span-2">
          <div className="border-b border-bg-muted px-5 py-3">
            <h2 className="font-semibold text-text">Schools</h2>
            <p className="text-xs text-text-light">Click a row to enter that school's admin view</p>
          </div>
          {data.loading ? (
            <div className="flex items-center justify-center px-5 py-10 text-sm text-text-light">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-text-light">
              No schools yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-muted text-left text-xs font-medium text-text-light">
                    <SortHeader label="School" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} className="px-5 py-2" />
                    <SortHeader label="Learners" sortKey="learners" current={sortKey} dir={sortDir} onClick={toggleSort} numeric />
                    <SortHeader label="Educators" sortKey="educators" current={sortKey} dir={sortDir} onClick={toggleSort} numeric />
                    <SortHeader label="Classes" sortKey="classrooms" current={sortKey} dir={sortDir} onClick={toggleSort} numeric />
                    <SortHeader label="Obs · 30d" sortKey="obs" current={sortKey} dir={sortDir} onClick={toggleSort} numeric />
                    <SortHeader label="Last activity" sortKey="activity" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-muted">
                  {sortedRows.map((row) => {
                    const isStale =
                      !row.lastActivityAt ||
                      Date.now() - new Date(row.lastActivityAt).getTime() > 30 * 24 * 60 * 60 * 1000
                    return (
                      <tr
                        key={row.school.id}
                        onClick={() => enterSchool(row.school.id)}
                        className="cursor-pointer transition-colors hover:bg-bg-muted/50"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100">
                              <Building2 className="h-4 w-4 text-primary-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text">{row.school.name}</p>
                              <p className="truncate text-xs text-text-light">{row.school.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-text">{row.learnerCount}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text">{row.educatorCount}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text">{row.classroomCount}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text">{row.observationsLast30d}</td>
                        <td className={clsx('px-3 py-3 text-xs', isStale ? 'text-accent-700' : 'text-text-muted')}>
                          {formatRelative(row.lastActivityAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ArrowRight className="ml-auto h-4 w-4 text-text-light" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="glass-card">
          <div className="border-b border-bg-muted px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-500" />
              <h2 className="font-semibold text-text">Recent activity</h2>
            </div>
          </div>
          {data.loading ? (
            <div className="flex items-center justify-center px-5 py-10 text-sm text-text-light">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : data.recentActivity.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-light">No activity yet</p>
          ) : (
            <ul className="divide-y divide-bg-muted">
              {data.recentActivity.slice(0, 10).map((item) => (
                <li key={item.id} className="px-5 py-3">
                  <p className="text-sm text-text">
                    <span className="font-medium">{item.observerName}</span>
                    <span className="text-text-muted"> observed </span>
                    <span className="text-text">{item.dimensionName}</span>
                  </p>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-text-light">
                    <button
                      onClick={() => enterSchool(item.schoolId)}
                      className="truncate hover:text-primary-600"
                    >
                      {item.schoolName}
                    </button>
                    <span className="ml-2 shrink-0">{formatRelative(item.observedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface KpiCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: number
  sub?: string
  loading?: boolean
  sparkline?: number[]
}

function KpiCard({ icon, iconBg, label, value, sub, loading, sparkline }: KpiCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-text">
              {loading ? '—' : value.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        </div>
        {sparkline && !loading && sparkline.length > 0 && (
          <Sparkline data={sparkline} width={80} height={32} />
        )}
      </div>
      {sub && <p className="mt-2 text-xs text-text-light">{sub}</p>}
    </div>
  )
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  numeric?: boolean
  className?: string
}

function SortHeader({ label, sortKey, current, dir, onClick, numeric, className }: SortHeaderProps) {
  const active = current === sortKey
  return (
    <th className={clsx(numeric ? 'px-3 py-2 text-right' : 'px-3 py-2 text-left', className)}>
      <button
        onClick={() => onClick(sortKey)}
        className={clsx(
          'inline-flex items-center gap-1 text-xs font-medium transition-colors',
          numeric && 'flex-row-reverse',
          active ? 'text-text' : 'text-text-light hover:text-text-muted',
        )}
      >
        {label}
        <ArrowUpDown className={clsx('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
        {active && <span className="sr-only">{dir === 'asc' ? 'ascending' : 'descending'}</span>}
      </button>
    </th>
  )
}

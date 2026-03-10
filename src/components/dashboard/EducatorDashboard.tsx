import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  School,
  Users,
  ClipboardPen,
  AlertTriangle,
  Eye,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type {
  EducatorDashboardData,
  FlagType,
} from '../../lib/dashboard-data'

interface Props {
  data: EducatorDashboardData
  userName: string
}

// ============================================================
// Flag styling
// ============================================================

const FLAG_CONFIG: Record<
  FlagType,
  { bg: string; border: string; icon: string; iconColor: string; label: string }
> = {
  no_observations: {
    bg: 'bg-caution-50',
    border: 'border-caution-500/30',
    icon: '🟡',
    iconColor: 'text-caution-500',
    label: 'Needs Observations',
  },
  emerging_streak: {
    bg: 'bg-alert-50',
    border: 'border-alert-500/30',
    icon: '🔴',
    iconColor: 'text-alert-500',
    label: 'Emerging Streak',
  },
  interest_gap: {
    bg: 'bg-success-50',
    border: 'border-success-500/30',
    icon: '🟢',
    iconColor: 'text-success-500',
    label: 'Opportunity',
  },
}

const RATING_LABELS: Record<number, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Achieving',
  4: 'Mastery',
}

// ============================================================
// Component
// ============================================================

export default function EducatorDashboard({ data, userName }: Props) {
  const navigate = useNavigate()

  const greeting = getGreeting()
  const firstName = userName.split(' ')[0]

  return (
    <div className="space-y-8">
      {/* ---- Greeting ---- */}
      <div>
        <h1 className="text-2xl font-bold text-text">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Here's what's happening with your learners.
        </p>
      </div>

      {/* ---- My Classrooms ---- */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-text">My Classrooms</h2>

        {data.classrooms.length === 0 ? (
          <div className="rounded-xl border border-bg-muted bg-bg-card p-8 text-center shadow-sm">
            <School className="mx-auto h-10 w-10 text-text-light" />
            <p className="mt-3 text-sm text-text-muted">
              No classrooms assigned yet. Ask your admin to assign you to a
              classroom.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.classrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/classrooms`)}
                className="group rounded-xl border border-bg-muted bg-bg-card p-5 text-left shadow-sm transition-all hover:border-primary-200 hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                    <School className="h-5 w-5 text-primary-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-light opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="font-semibold text-text">{c.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {c.student_count} learner{c.student_count !== 1 ? 's' : ''}
                  </span>
                  {c.grade_level && (
                    <span>Grade {c.grade_level}</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary-600">
                  <ClipboardPen className="h-3.5 w-3.5" />
                  {c.observations_this_week} observation
                  {c.observations_this_week !== 1 ? 's' : ''} this week
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---- Needs Attention ---- */}
      {data.attentionFlags.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-caution-500" />
            <h2 className="text-lg font-bold text-text">Needs Attention</h2>
            <span className="rounded-full bg-caution-50 px-2 py-0.5 text-xs font-semibold text-caution-600">
              {data.attentionFlags.length}
            </span>
          </div>

          <div className="space-y-2">
            {data.attentionFlags.slice(0, 10).map((flag, i) => {
              const config = FLAG_CONFIG[flag.flag_type]
              return (
                <button
                  key={`${flag.student_id}-${flag.flag_type}-${flag.dimension_name ?? i}`}
                  onClick={() => navigate(`/student/${flag.student_id}`)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm',
                    config.bg,
                    config.border
                  )}
                >
                  <span className="text-lg">{config.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">
                      {flag.student_name}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {flag.message}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-block',
                      flag.flag_type === 'no_observations' &&
                        'bg-caution-500/10 text-caution-600',
                      flag.flag_type === 'emerging_streak' &&
                        'bg-alert-500/10 text-alert-600',
                      flag.flag_type === 'interest_gap' &&
                        'bg-success-500/10 text-success-600'
                    )}
                  >
                    {config.label}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-light" />
                </button>
              )
            })}

            {data.attentionFlags.length > 10 && (
              <p className="pl-1 text-xs text-text-light">
                +{data.attentionFlags.length - 10} more
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- Recent Activity ---- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-500" />
          <h2 className="text-lg font-bold text-text">Recent Activity</h2>
        </div>

        {data.recentActivity.length === 0 ? (
          <div className="rounded-xl border border-bg-muted bg-bg-card p-8 text-center shadow-sm">
            <Eye className="mx-auto h-10 w-10 text-text-light" />
            <p className="mt-3 text-sm text-text-muted">
              No observations yet. Start recording to see activity here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-bg-muted bg-bg-card shadow-sm">
            <div className="divide-y divide-bg-muted">
              {data.recentActivity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/student/${item.student_id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
                >
                  {/* Rating badge */}
                  <div
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                      item.rating >= 3
                        ? 'bg-primary-50 text-primary-700'
                        : item.rating === 2
                          ? 'bg-caution-50 text-caution-600'
                          : 'bg-alert-50 text-alert-500'
                    )}
                  >
                    {item.rating}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">
                        {item.student_name}
                      </span>
                      <span className="hidden text-xs text-text-light sm:inline">
                        &middot;
                      </span>
                      <span className="hidden truncate text-xs text-text-muted sm:inline">
                        {item.dimension_name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-light">
                      <span>{RATING_LABELS[item.rating] ?? item.rating}</span>
                      <span>&middot;</span>
                      <span>by {item.observer_name}</span>
                    </div>
                  </div>

                  <span className="shrink-0 text-[11px] text-text-light">
                    {formatDistanceToNow(new Date(item.observed_at), {
                      addSuffix: true,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

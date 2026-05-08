import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  School,
  GraduationCap,
  ClipboardPen,
  Layers,
  BookOpen,
  Settings,
} from 'lucide-react'
import type { AdminDashboardData } from '../../lib/dashboard-data'

interface Props {
  data: AdminDashboardData
}

// Palette for classroom bars — distinct, accessible teal-spectrum colours
const BAR_COLORS = [
  '#0D7377',
  '#D4943A',
  '#10B981',
  '#0B5F62',
  '#F59E0B',
  '#F43F5E',
  '#33AFB1',
  '#7F5923',
]

// ============================================================
// Stat card
// ============================================================

function StatCard({
  icon,
  label,
  value,
  accent,
  sublabel,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent: string
  sublabel?: string
}) {
  return (
    <div
      className="kpi-card p-5"
      style={{ ['--kpi-accent' as string]: accent }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: accent + '18' }}
        >
          {icon}
        </div>
      </div>
      <p
        className="text-4xl font-semibold leading-none tracking-tight tabular-nums"
        style={{ color: accent }}
      >
        {value.toLocaleString()}
      </p>
      {sublabel && (
        <p className="mt-2 text-xs text-text-muted">{sublabel}</p>
      )}
    </div>
  )
}

// ============================================================
// Custom tooltip for bar chart
// ============================================================

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2">
      <p className="mb-1 text-xs font-semibold text-text">{label}</p>
      {payload.map(
        (
          entry: { name: string; value: number; color: string },
          i: number
        ) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name}:{' '}
            <span className="font-semibold">{entry.value.toFixed(1)}</span>
            <span className="text-text-light"> / 5</span>
          </p>
        )
      )}
    </div>
  )
}

// Truncate dimension names for X-axis
function truncateLabel(name: string, max = 12): string {
  if (name.length <= max) return name
  const words = name.split(/[\s&]+/)
  let result = words[0]
  for (let i = 1; i < words.length; i++) {
    if ((result + ' ' + words[i]).length > max) break
    result += ' ' + words[i]
  }
  return result.length < name.length ? result + '...' : result
}

// ============================================================
// Main component
// ============================================================

export default function AdminDashboard({ data }: Props) {
  const navigate = useNavigate()

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Transform comparison data for grouped bar chart
  // Shape: [{ dimension: "Math", "Sunrise K": 3.2, "Explorers 1": 2.8 }, ...]
  const barChartData = data.dimensions.map((dim) => {
    const row: Record<string, string | number> = {
      dimension: truncateLabel(dim.name),
    }
    for (const classroom of data.classrooms) {
      const match = data.classroomComparison.find(
        (c) =>
          c.classroom_id === classroom.id && c.dimension_name === dim.name
      )
      row[classroom.name] = match?.avg_competency ?? 0
    }
    return row
  })

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text">School Overview</h1>
        <p className="mt-1 text-sm text-text-muted">{currentPeriod}</p>
      </div>

      {/* ---- Stat cards ---- */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-primary-600" />}
          label="Learners"
          value={data.stats.totalStudents}
          accent="#0D7377"
          sublabel="enrolled across school"
        />
        <StatCard
          icon={<School className="h-4 w-4 text-accent-600" />}
          label="Classrooms"
          value={data.stats.totalClassrooms}
          accent="#D4943A"
          sublabel="active this period"
        />
        <StatCard
          icon={<GraduationCap className="h-4 w-4 text-success-600" />}
          label="Educators"
          value={data.stats.totalEducators}
          accent="#10B981"
          sublabel="teaching at school"
        />
        <StatCard
          icon={<ClipboardPen className="h-4 w-4 text-primary-600" />}
          label="Observations"
          value={data.stats.observationsThisPeriod}
          accent="#0D7377"
          sublabel={`recorded in ${new Date().toLocaleDateString('en-US', { month: 'long' })}`}
        />
      </section>

      {/* ---- Charts row ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cross-classroom comparison */}
        <section className="glass-card p-5">
          <h2 className="mb-1 text-base font-semibold tracking-tight text-text">
            Competency by Classroom
          </h2>
          <p className="mb-4 text-xs text-text-muted">
            Average competency per dimension across classrooms
          </p>

          {barChartData.length > 0 && data.classrooms.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={barChartData}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F1EC" />
                <XAxis
                  dataKey="dimension"
                  tick={{ fontSize: 10, fill: '#636E72' }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  domain={[0, 5]}
                  tick={{ fontSize: 10, fill: '#B2BEC3' }}
                  tickCount={6}
                />
                <Tooltip content={<BarTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {data.classrooms.map((c, i) => (
                  <Bar
                    key={c.id}
                    dataKey={c.name}
                    fill={BAR_COLORS[i % BAR_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center">
              <p className="text-xs text-text-light">
                No observation data yet
              </p>
            </div>
          )}
        </section>

        {/* Observation volume */}
        <section className="glass-card p-5">
          <h2 className="mb-1 text-base font-semibold tracking-tight text-text">
            Observation Volume
          </h2>
          <p className="mb-4 text-xs text-text-muted">
            Weekly observations over the past 12 weeks
          </p>

          {data.observationVolume.some((w) => w.count > 0) ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={data.observationVolume}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F1EC" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: '#636E72' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#B2BEC3' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #F3F1EC',
                  }}
                  labelStyle={{ fontWeight: 600, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Observations"
                  stroke="#0D7377"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0D7377', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0D7377', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center">
              <p className="text-xs text-text-light">
                No observations recorded yet
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ---- Quick Links ---- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-text">Quick Links</h2>
          <span className="count-pill">4</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            icon={<School className="h-5 w-5 text-primary-600" />}
            label="Manage Classrooms"
            to="/classrooms"
            navigate={navigate}
          />
          <QuickLink
            icon={<Layers className="h-5 w-5 text-primary-600" />}
            label="Configure Dimensions"
            to="/dimensions"
            navigate={navigate}
          />
          <QuickLink
            icon={<BookOpen className="h-5 w-5 text-primary-600" />}
            label="Standards"
            to="/standards"
            navigate={navigate}
          />
          <QuickLink
            icon={<Settings className="h-5 w-5 text-primary-600" />}
            label="Settings"
            to="/settings"
            navigate={navigate}
          />
        </div>
      </section>
    </div>
  )
}

function QuickLink({
  icon,
  label,
  to,
  navigate,
}: {
  icon: React.ReactNode
  label: string
  to: string
  navigate: (to: string) => void
}) {
  return (
    <button
      onClick={() => navigate(to)}
      className="glass-card glass-card-interactive group flex items-center gap-3 p-3 text-left"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium text-text">{label}</span>
      <span className="btn-soft px-3 py-1.5 text-xs">
        Open
      </span>
    </button>
  )
}

import { useState, useEffect } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { DimensionScore } from '../../lib/student-data'

interface Props {
  dimensionScores: DimensionScore[]
  onDimensionClick?: (dimensionId: string) => void
}

interface ChartDataPoint {
  dimension: string
  dimensionId: string
  competency: number
  interest: number
  fullMark: 5
}

// Truncate long dimension names for the radar axis
function truncateName(name: string, max = 16): string {
  if (name.length <= max) return name
  // Try to break at a natural word boundary
  const words = name.split(/[\s&]+/)
  let result = words[0]
  for (let i = 1; i < words.length; i++) {
    if ((result + ' ' + words[i]).length > max) break
    result += ' ' + words[i]
  }
  return result.length < name.length ? result + '...' : result
}

// Custom axis tick to handle long labels
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTick(props: any) {
  const { payload, x, y, textAnchor } = props
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill="#636E72"
      fontSize={11}
      fontWeight={500}
    >
      <tspan>{payload?.value ?? ''}</tspan>
    </text>
  )
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    payload: ChartDataPoint
  }>
}) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-bg-muted bg-bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-text">{data.dimension}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{entry.value.toFixed(1)}</span>
          <span className="text-text-light"> / 5</span>
        </p>
      ))}
    </div>
  )
}

export default function CompetencyRadar({ dimensionScores, onDimensionClick }: Props) {
  const [animationProgress, setAnimationProgress] = useState(0)

  // Animate grow-from-center on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimationProgress(1), 100)
    return () => clearTimeout(timer)
  }, [])

  const data: ChartDataPoint[] = dimensionScores.map((ds) => ({
    dimension: truncateName(ds.dimension_name),
    dimensionId: ds.dimension_id,
    competency: ds.competency * animationProgress,
    interest: ds.interest * animationProgress,
    fullMark: 5,
  }))

  function handleClick(point: ChartDataPoint) {
    onDimensionClick?.(point.dimensionId)
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart
          data={data}
          cx="50%"
          cy="50%"
          outerRadius="70%"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(state: any) => {
            if (state?.activePayload?.[0]) {
              handleClick(state.activePayload[0].payload as ChartDataPoint)
            }
          }}
        >
          <PolarGrid stroke="#F3F1EC" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={CustomTick}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tickCount={6}
            tick={{ fontSize: 10, fill: '#B2BEC3' }}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Competency polygon (teal) */}
          <Radar
            name="Competency (Educator Assessed)"
            dataKey="competency"
            stroke="#0D7377"
            fill="#0D7377"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={{ r: 4, fill: '#0D7377', strokeWidth: 0, cursor: 'pointer' }}
            animationDuration={800}
            animationEasing="ease-out"
          />
          {/* Interest polygon (amber) */}
          <Radar
            name="Interest (Learner Reported)"
            dataKey="interest"
            stroke="#D4943A"
            fill="#D4943A"
            fillOpacity={0.1}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 4, fill: '#D4943A', strokeWidth: 0, cursor: 'pointer' }}
            animationDuration={1000}
            animationEasing="ease-out"
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import type { DimensionScore } from '../../lib/student-data'

interface Props {
  dimensionScores: DimensionScore[]
}

export default function MiniRadar({ dimensionScores }: Props) {
  const data = dimensionScores.map((ds) => ({
    name: ds.dimension_name,
    competency: ds.competency,
    interest: ds.interest,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="#F3F1EC" />
        <PolarAngleAxis dataKey="name" tick={false} />
        <PolarRadiusAxis
          domain={[0, 5]}
          tick={false}
          axisLine={false}
        />
        {/* Competency polygon (teal) */}
        <Radar
          dataKey="competency"
          stroke="#0D7377"
          fill="#0D7377"
          fillOpacity={0.18}
          strokeWidth={1.5}
          dot={false}
        />
        {/* Interest polygon (amber, dashed) */}
        <Radar
          dataKey="interest"
          stroke="#D4943A"
          fill="#D4943A"
          fillOpacity={0.1}
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

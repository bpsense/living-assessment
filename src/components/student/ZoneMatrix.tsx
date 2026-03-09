import { clsx } from 'clsx'
import {
  TrendingUp,
  Trophy,
  Compass,
  Anchor,
} from 'lucide-react'
import type { DimensionScore } from '../../lib/student-data'
import { classifyZones, type Zone } from '../../lib/student-data'

interface Props {
  dimensionScores: DimensionScore[]
  onDimensionClick?: (dimensionId: string) => void
}

interface ZoneConfig {
  key: Zone
  label: string
  description: string
  icon: React.ReactNode
  bgClass: string
  badgeClass: string
  textClass: string
}

const ZONES: ZoneConfig[] = [
  {
    key: 'growth',
    label: 'Growth Zone',
    description: 'High interest, developing skill',
    icon: <TrendingUp className="h-4 w-4" />,
    bgClass: 'bg-success-50',
    badgeClass: 'bg-success-500 text-white',
    textClass: 'text-success-600',
  },
  {
    key: 'mastery',
    label: 'Mastery Zone',
    description: 'High interest, strong skill',
    icon: <Trophy className="h-4 w-4" />,
    bgClass: 'bg-primary-50',
    badgeClass: 'bg-primary-500 text-white',
    textClass: 'text-primary-600',
  },
  {
    key: 'explore',
    label: 'Explore Zone',
    description: 'Opportunity to spark interest',
    icon: <Compass className="h-4 w-4" />,
    bgClass: 'bg-accent-50',
    badgeClass: 'bg-accent-500 text-white',
    textClass: 'text-accent-600',
  },
  {
    key: 'cruise',
    label: 'Cruise Zone',
    description: 'Strong skill, less engaged',
    icon: <Anchor className="h-4 w-4" />,
    bgClass: 'bg-bg-muted',
    badgeClass: 'bg-text-light text-white',
    textClass: 'text-text-muted',
  },
]

export default function ZoneMatrix({ dimensionScores, onDimensionClick }: Props) {
  const classified = classifyZones(dimensionScores)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ZONES.map((zone) => {
        const dims = classified.filter((c) => c.zone === zone.key)
        return (
          <div
            key={zone.key}
            className={clsx(
              'rounded-xl border border-bg-muted p-4 transition-colors',
              zone.bgClass
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-md',
                  zone.badgeClass
                )}
              >
                {zone.icon}
              </span>
              <div>
                <h4 className={clsx('text-sm font-semibold', zone.textClass)}>
                  {zone.label}
                </h4>
                <p className="text-[11px] text-text-muted">{zone.description}</p>
              </div>
            </div>

            {dims.length === 0 ? (
              <p className="text-xs italic text-text-light">No dimensions yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dims.map((d) => (
                  <button
                    key={d.dimension_id}
                    onClick={() => onDimensionClick?.(d.dimension_id)}
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80',
                      zone.badgeClass
                    )}
                  >
                    {d.dimension_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

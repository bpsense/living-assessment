import { useMemo } from 'react'

import type { LearnerProfileDomain } from '../../types/learner-profile'
import type { VisualizationSnapshot } from '../../lib/learner-profile-vis-data'

// ============================================================
// SVG geometry constants
// ============================================================

const VIEWBOX = 640
const CENTER = VIEWBOX / 2
/** Pixels reserved for labels around the rim. */
const LABEL_PAD = 110
const MAX_RADIUS = CENTER - LABEL_PAD
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1] as const

// ============================================================
// Public API
// ============================================================

interface Props {
  domains: LearnerProfileDomain[]
  /** The active snapshot — the filled contour. */
  snapshot: VisualizationSnapshot
  /**
   * Earlier snapshots, oldest → newest, drawn as faint outlines behind the
   * active contour. Pass an empty array (the default) to hide the growth trail.
   */
  trail?: VisualizationSnapshot[]
  /** Optional caption rendered in the SVG's center. */
  centerLabel?: string
}

/**
 * Expanding-canvas amoeba renderer.
 *
 * Each domain gets its own axis whose maximum radius scales with the count of
 * age-appropriate skills (so domains with more skills extend further). The
 * student's contour fills proportionally to the sum of latest-assessment
 * level ranks vs. the canvas maximum on that axis.
 */
export default function LearnerProfileBlob({
  domains,
  snapshot,
  trail = [],
  centerLabel,
}: Props) {
  const layout = useMemo(() => buildLayout(domains, snapshot, trail), [domains, snapshot, trail])

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className="block h-auto w-full max-w-[640px]"
      role="img"
      aria-label="Learner profile amoeba visualization"
    >
      {/* Concentric expectation rings — one polygon per fraction step. */}
      {RING_FRACTIONS.map((frac, i) => (
        <polygon
          key={`ring-${i}`}
          points={polyPoints(layout.axes, (axis) => axis.canvasRadius * frac)}
          fill={i === RING_FRACTIONS.length - 1 ? 'rgba(15,23,42,0.02)' : 'none'}
          stroke="rgba(15,23,42,0.08)"
          strokeWidth={i === RING_FRACTIONS.length - 1 ? 1.25 : 0.75}
          strokeDasharray={i === RING_FRACTIONS.length - 1 ? undefined : '3 4'}
        />
      ))}

      {/* Spokes */}
      {layout.axes.map((axis) => (
        <line
          key={`spoke-${axis.domain.id}`}
          x1={CENTER}
          y1={CENTER}
          x2={axis.tipX}
          y2={axis.tipY}
          stroke="rgba(15,23,42,0.08)"
          strokeWidth={0.75}
        />
      ))}

      {/* Growth trail — earlier snapshots fade with age */}
      {layout.trailPolygons.map((poly, i) => (
        <polygon
          key={`trail-${i}`}
          points={poly.points}
          fill="none"
          stroke="rgba(99,102,241,0.55)"
          strokeWidth={1.25}
          opacity={poly.opacity}
        />
      ))}

      {/* Active contour */}
      <polygon
        points={layout.contourPoints}
        fill="rgba(99,102,241,0.18)"
        stroke="#6366F1"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Per-axis dots at the contour value (helps read individual domains) */}
      {layout.axes.map((axis) => (
        <circle
          key={`dot-${axis.domain.id}`}
          cx={CENTER + axis.contourRadius * Math.cos(axis.angle)}
          cy={CENTER + axis.contourRadius * Math.sin(axis.angle)}
          r={4}
          fill={axis.domain.color ?? '#6366F1'}
          stroke="white"
          strokeWidth={1.5}
        />
      ))}

      {/* Domain labels around the rim */}
      {layout.axes.map((axis) => (
        <DomainLabel key={`label-${axis.domain.id}`} axis={axis} />
      ))}

      {/* Center label (e.g. "Age 7") */}
      {centerLabel && (
        <text
          x={CENTER}
          y={CENTER + 4}
          textAnchor="middle"
          className="fill-text-muted"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {centerLabel}
        </text>
      )}
    </svg>
  )
}

// ============================================================
// Layout
// ============================================================

interface Axis {
  domain: LearnerProfileDomain
  /** Radians from positive-X axis; first axis points up. */
  angle: number
  /** Pixel radius of the canvas tip on this axis. */
  canvasRadius: number
  /** Pixel radius of the active contour. */
  contourRadius: number
  /** Cached canvas tip cartesian coords. */
  tipX: number
  tipY: number
  /** Source data for the active snapshot at this domain. */
  canvasSkills: number
  contourScore: number
}

interface Layout {
  axes: Axis[]
  contourPoints: string
  trailPolygons: { points: string; opacity: number }[]
}

function buildLayout(
  domains: LearnerProfileDomain[],
  snapshot: VisualizationSnapshot,
  trail: VisualizationSnapshot[]
): Layout {
  // Match snapshot's domain entries to LP domain rows (preserve sort_order).
  const stateById = new Map(snapshot.domains.map((d) => [d.domainId, d]))

  // Normalize canvas radii so the largest canvas reaches MAX_RADIUS.
  const maxCanvasSkills = Math.max(
    1,
    ...snapshot.domains.map((d) => d.canvasSkills)
  )

  const axes: Axis[] = domains.map((domain, i) => {
    const angle = (i / domains.length) * Math.PI * 2 - Math.PI / 2
    const state = stateById.get(domain.id)
    const canvasSkills = state?.canvasSkills ?? 0
    const contourScore = state?.contourScore ?? 0

    // Even an empty domain gets a small visible spoke so the shape stays
    // recognizable. We use 12% of MAX_RADIUS as a floor.
    const canvasRadius =
      canvasSkills > 0
        ? Math.max(MAX_RADIUS * 0.12, (canvasSkills / maxCanvasSkills) * MAX_RADIUS)
        : MAX_RADIUS * 0.12

    const canvasMaxScore = Math.max(1, canvasSkills * 4)
    const contourRadius = (contourScore / canvasMaxScore) * canvasRadius

    return {
      domain,
      angle,
      canvasRadius,
      contourRadius,
      tipX: CENTER + canvasRadius * Math.cos(angle),
      tipY: CENTER + canvasRadius * Math.sin(angle),
      canvasSkills,
      contourScore,
    }
  })

  const contourPoints = polyPoints(axes, (axis) => axis.contourRadius)

  // Trail: pick the most recent N before the active snapshot, oldest first.
  // Each one shrinks in opacity. Use the active snapshot's axis layout as the
  // "canvas" frame so trail contours are comparable visually.
  const TRAIL_LIMIT = 6
  const trimmedTrail = trail.slice(-TRAIL_LIMIT)
  const trailPolygons = trimmedTrail.map((trailSnapshot, i) => {
    const stateMap = new Map(trailSnapshot.domains.map((d) => [d.domainId, d]))
    const points = axes
      .map((axis) => {
        const state = stateMap.get(axis.domain.id)
        const contourScore = state?.contourScore ?? 0
        // Trail uses the *active* snapshot's canvasRadius as the visual frame;
        // its raw contourScore is normalized to that frame so older smaller
        // contours visibly nest inside the current shape.
        const canvasMaxScore = Math.max(1, axis.canvasSkills * 4)
        const r = axis.canvasSkills > 0
          ? (contourScore / canvasMaxScore) * axis.canvasRadius
          : 0
        return `${(CENTER + r * Math.cos(axis.angle)).toFixed(2)},${(CENTER + r * Math.sin(axis.angle)).toFixed(2)}`
      })
      .join(' ')
    // Newest trail snapshot is most opaque; oldest is faintest.
    const opacity = 0.12 + (i / Math.max(1, trimmedTrail.length - 1)) * 0.28
    return { points, opacity }
  })

  return { axes, contourPoints, trailPolygons }
}

function polyPoints(axes: Axis[], radiusFor: (axis: Axis) => number): string {
  return axes
    .map((axis) => {
      const r = radiusFor(axis)
      return `${(CENTER + r * Math.cos(axis.angle)).toFixed(2)},${(CENTER + r * Math.sin(axis.angle)).toFixed(2)}`
    })
    .join(' ')
}

// ============================================================
// Labels
// ============================================================

function DomainLabel({ axis }: { axis: Axis }) {
  const labelDistance = axis.canvasRadius + 18
  const x = CENTER + labelDistance * Math.cos(axis.angle)
  const y = CENTER + labelDistance * Math.sin(axis.angle)
  // Pull anchor based on angle so text doesn't overlap the spoke.
  const cosA = Math.cos(axis.angle)
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  if (cosA > 0.2) anchor = 'start'
  else if (cosA < -0.2) anchor = 'end'

  // Wrap long names onto two lines.
  const words = axis.domain.name.split(' ')
  const lines: string[] = []
  if (words.length <= 2) {
    lines.push(axis.domain.name)
  } else {
    const mid = Math.ceil(words.length / 2)
    lines.push(words.slice(0, mid).join(' '))
    lines.push(words.slice(mid).join(' '))
  }

  const total = `${axis.contourScore} / ${axis.canvasSkills * 4}`

  return (
    <g style={{ pointerEvents: 'none' }}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={y - 2 + i * 13}
          textAnchor={anchor}
          style={{ fontSize: 11, fontWeight: 600 }}
          fill={axis.domain.color ?? '#334155'}
        >
          {line}
        </text>
      ))}
      <text
        x={x}
        y={y - 2 + lines.length * 13}
        textAnchor={anchor}
        style={{ fontSize: 9 }}
        fill="rgba(15,23,42,0.55)"
      >
        {total}
      </text>
    </g>
  )
}

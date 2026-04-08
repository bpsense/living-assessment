/**
 * LivingBlob.tsx
 * SVG-based "amoeba" blob visualization for competency & interest.
 *
 * Replaces a traditional radar chart with an organic, fluid shape:
 * - 4 concentric level rings (Emerging → Developing → Achieving → Mastery)
 * - Smooth blob contour showing competency per dimension
 * - Dot markers showing interest level per dimension
 * - Dotted axis lines from center to each dimension label
 * - CSS-transitioned for smooth timeline playback
 * - Observation popup on dot click
 */

import { useMemo, useId, useState, useRef, useEffect } from 'react'
import type { DimensionScore } from '../../lib/student-data'
import type { Observation } from '../../types/database'
import ObservationPopup from './ObservationPopup'

interface Props {
  dimensionScores: DimensionScore[]
  /** Outer dimension of the SVG square (default 740) */
  size?: number
  /** Tailwind classes on the wrapping container */
  className?: string
  /** Whether to show dimension labels (disable for mini view) */
  showLabels?: boolean
  /** Whether to show level ring labels */
  showLevelLabels?: boolean
  /** Callback when a dimension is clicked */
  onDimensionClick?: (dimensionId: string) => void
  /** All observations up to current snapshot (for popup) */
  observations?: Observation[]
  /** Map of observer_id -> display name */
  observers?: Map<string, string>
  /** Grade transition squeeze progress: 1 = max squeeze (rings at largest), 0 = normal. Animates 1→0. */
  ringSqueezeProgress?: number
  /** Label shown during grade transition, e.g. "Grade 3" */
  gradeTransitionLabel?: string
  /** Persistent grade label shown in the background during playback */
  currentGradeLabel?: string
}

// ── Design tokens ──────────────────────────────────────────────
const TEAL = '#0D7377'
const TEAL_LIGHT = '#33AFB1'
const AMBER = '#D4943A'
const MAX_SCORE = 4
const LEVEL_COUNT = 4

const LEVEL_META = [
  { label: 'Emerging', stroke: '#B4AFA0', fill: 'rgba(180,175,160,0.30)' },
  { label: 'Developing', stroke: '#C0BBAD', fill: 'rgba(200,196,184,0.20)' },
  { label: 'Achieving', stroke: '#CCC8BA', fill: 'rgba(220,216,206,0.12)' },
  { label: 'Mastery', stroke: '#D8D4CA', fill: 'none' },
]

// ── Geometry helpers ───────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * Build a smooth closed path through radial points using
 * Catmull-Rom → Cubic Bezier conversion. Tension 0–1 controls
 * how "organic" the curve feels (lower = more angular, higher = smoother).
 */
function smoothBlobPath(
  cx: number,
  cy: number,
  radii: number[],
  startAngle: number,
  tension = 0.3
): string {
  const n = radii.length
  if (n < 3) return ''

  const step = 360 / n
  const pts = radii.map((r, i) =>
    polarToXY(cx, cy, Math.max(r, 0), startAngle + i * step)
  )

  // Start at first point
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]

    // Catmull-Rom control points
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }

  return d
}

/**
 * Split a dimension name into lines, wrapping on whole-word boundaries.
 * Each line is at most `maxChars` characters, and splits only happen
 * between words (never mid-word).
 */
function wrapWords(name: string, maxChars = 14): string[] {
  const words = name.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current.length === 0) {
      current = word
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// ── Popup state type ────────────────────────────────────────────

interface PopupState {
  dimensionId: string
  x: number
  y: number
}

// ── Component ──────────────────────────────────────────────────

export default function LivingBlob({
  dimensionScores,
  size = 740,
  className,
  showLabels = true,
  showLevelLabels = true,
  onDimensionClick,
  observations,
  observers,
  ringSqueezeProgress = 0,
  gradeTransitionLabel,
  currentGradeLabel,
}: Props) {
  const uid = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [popupState, setPopupState] = useState<PopupState | null>(null)

  const cx = size / 2
  const cy = size / 2
  const margin = showLabels ? 135 : 20
  const maxR = size / 2 - margin
  const n = dimensionScores.length
  const startAngle = -90 // start from top
  const angleStep = n > 0 ? 360 / n : 0

  // Close popup when scores change (timeline advancing)
  const scoresRef = useRef(dimensionScores)
  useEffect(() => {
    if (dimensionScores !== scoresRef.current) {
      setPopupState(null)
      scoresRef.current = dimensionScores
    }
  }, [dimensionScores])

  // Convert SVG coordinates to pixel coordinates for popup positioning
  function svgToPixel(svgX: number, svgY: number): { px: number; py: number } {
    const containerEl = containerRef.current
    if (!containerEl) return { px: svgX, py: svgY }
    const containerWidth = containerEl.clientWidth
    const scale = containerWidth / size
    return { px: svgX * scale, py: svgY * scale }
  }

  // Handle dot click — open popup or fall back to onDimensionClick
  function handleDotClick(dimensionId: string, svgX: number, svgY: number) {
    if (observations && observations.length > 0) {
      const { px, py } = svgToPixel(svgX, svgY)
      setPopupState({ dimensionId, x: px, y: py })
    } else {
      onDimensionClick?.(dimensionId)
    }
  }

  // Level ring radii (4 evenly-spaced rings within maxR)
  const ringRadii = useMemo(
    () => Array.from({ length: LEVEL_COUNT }, (_, i) => (maxR * (i + 1)) / LEVEL_COUNT),
    [maxR]
  )

  // Competency blob radii
  const competencyRadii = useMemo(
    () => dimensionScores.map((d) => (d.competency / MAX_SCORE) * maxR),
    [dimensionScores, maxR]
  )

  // Blob SVG path
  const blobD = useMemo(
    () => smoothBlobPath(cx, cy, competencyRadii, startAngle, 0.3),
    [cx, cy, competencyRadii, startAngle]
  )

  // Interest dot positions
  const interestDots = useMemo(
    () =>
      dimensionScores.map((d, i) => {
        const angle = startAngle + i * angleStep
        const r = (d.interest / MAX_SCORE) * maxR
        return {
          ...polarToXY(cx, cy, r, angle),
          interest: d.interest,
          id: d.dimension_id,
          name: d.dimension_name,
        }
      }),
    [dimensionScores, cx, cy, maxR, angleStep, startAngle]
  )

  // Competency dot positions (on blob edge)
  const compDots = useMemo(
    () =>
      dimensionScores.map((d, i) => {
        const angle = startAngle + i * angleStep
        const r = (d.competency / MAX_SCORE) * maxR
        return {
          ...polarToXY(cx, cy, Math.max(r, 0), angle),
          competency: d.competency,
          id: d.dimension_id,
          name: d.dimension_name,
        }
      }),
    [dimensionScores, cx, cy, maxR, angleStep, startAngle]
  )

  // Dimension label positions (outside the chart)
  //
  // Text-anchor is chosen so text always extends AWAY from the chart
  // center. We use cos(angle) to decide:
  //   cos > threshold  → label is right of center → 'start' (text → right)
  //   cos < -threshold → label is left of center  → 'end'   (text → left)
  //   |cos| ≤ threshold → label is top/bottom     → 'middle'
  //
  // For 'middle' labels, we push the anchor further out along the
  // radial axis to compensate for the text block being centered
  // (its inner edge would otherwise sit closer to the ring).
  const LABEL_GAP = 40 // min clearance from outer ring to text inner edge
  const labels = useMemo(() => {
    if (!showLabels) return []
    return dimensionScores.map((d, i) => {
      const angle = startAngle + i * angleStep
      const rad = (angle * Math.PI) / 180
      const cosA = Math.cos(rad)

      // Anchor based on horizontal direction of the spoke
      let anchor: 'start' | 'middle' | 'end' = 'middle'
      if (cosA > 0.25) anchor = 'start'       // right half → text extends right
      else if (cosA < -0.25) anchor = 'end'    // left half  → text extends left

      // Word-wrap the full dimension name
      const lines = wrapWords(d.dimension_name, 14)

      // Extra radial push for 'middle' labels (top/bottom) so
      // the inner edge of the text block clears the ring.
      let extraPush = 0
      if (anchor === 'middle') {
        const textBlockHalfH = (lines.length * 24) / 2
        extraPush = textBlockHalfH + 6
      }

      const labelR = maxR + LABEL_GAP + extraPush
      const pos = polarToXY(cx, cy, labelR, angle)

      // Spoke end: extend past the outer ring, stop just before the label
      const spokeR = maxR + LABEL_GAP - 8
      const spokeEnd = polarToXY(cx, cy, spokeR, angle)

      return {
        ...pos,
        anchor,
        lines,
        id: d.dimension_id,
        angle,
        spokeEnd,
      }
    })
  }, [dimensionScores, cx, cy, maxR, angleStep, startAngle, showLabels, LABEL_GAP])

  // Get the popup dimension's scores
  const popupDimension = popupState
    ? dimensionScores.find((d) => d.dimension_id === popupState.dimensionId)
    : null

  if (n === 0) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
      >
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
          <text x={cx} y={cy} textAnchor="middle" fill="#B2BEC3" fontSize={13}>
            No dimensions available
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ maxWidth: size, position: 'relative', overflow: 'visible' }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        overflow="visible"
        role="img"
        aria-label="Living assessment blob chart"
      >
        <defs>
          {/* Radial gradient for the blob fill — richer teal core */}
          <radialGradient id={`${uid}-blob-grad`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={TEAL_LIGHT} stopOpacity={0.22} />
            <stop offset="60%" stopColor={TEAL} stopOpacity={0.12} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0.04} />
          </radialGradient>
          {/* Glow filter for the blob */}
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Soft outer ring glow */}
          <filter id={`${uid}-ring-glow`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* ── Soft outermost glow ring ── */}
        <circle
          cx={cx}
          cy={cy}
          r={maxR + 4}
          fill="none"
          stroke={TEAL}
          strokeWidth={1}
          opacity={0.08}
          filter={`url(#${uid}-ring-glow)`}
        />

        {/* ── Incoming squeeze rings (visible during grade transition) ── */}
        {ringSqueezeProgress > 0.01 && ringRadii.map((r, i) => {
          // Incoming rings start large (80% beyond normal) and squeeze to normal position
          const inflatedR = r * (1 + 0.8 * ringSqueezeProgress)
          // Outer rings inflate even more for dramatic effect
          const outerBoost = 1 + (i / LEVEL_COUNT) * 0.3 * ringSqueezeProgress
          return (
            <circle
              key={`squeeze-ring-${i}`}
              cx={cx}
              cy={cy}
              r={inflatedR * outerBoost}
              fill={i === 0 ? `rgba(13,115,119,${0.04 * ringSqueezeProgress})` : 'none'}
              stroke={TEAL}
              strokeWidth={i === LEVEL_COUNT - 1 ? 3 : 2}
              strokeDasharray={i < LEVEL_COUNT - 1 ? '4 6' : 'none'}
              opacity={0.15 + 0.5 * ringSqueezeProgress}
              style={{ transition: 'none' }}
            />
          )
        })}

        {/* ── Main content group: compressed during grade transition ── */}
        <g
          transform={
            ringSqueezeProgress > 0.01
              ? `translate(${cx},${cy}) scale(${1 - 0.4 * ringSqueezeProgress}) translate(${-cx},${-cy})`
              : undefined
          }
          style={ringSqueezeProgress > 0.01 ? { transition: 'none' } : undefined}
        >
          {/* ── Background: concentric level fill bands (outermost first) ── */}
          {[...ringRadii].reverse().map((r, revI) => {
            const i = ringRadii.length - 1 - revI
            return (
              <circle
                key={`ring-fill-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={LEVEL_META[i].fill}
                stroke="none"
              />
            )
          })}

          {/* ── Concentric level ring strokes ── */}
          {ringRadii.map((r, i) => (
            <circle
              key={`ring-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={LEVEL_META[i].stroke}
              strokeWidth={i === LEVEL_COUNT - 1 ? 2 : 1.5}
              strokeDasharray={i < LEVEL_COUNT - 1 ? '4 6' : 'none'}
              opacity={0.9}
            />
          ))}

          {/* Level labels along the right axis */}
          {showLevelLabels &&
            ringRadii.map((r, i) => (
              <text
                key={`lvl-${i}`}
                x={cx + 8}
                y={cy - r + 15}
                fill="#A9A49A"
                fontSize={12}
                fontWeight={600}
                opacity={0.9}
                letterSpacing="0.02em"
              >
                {LEVEL_META[i].label}
              </text>
            ))}

          {/* ── Dotted axis lines from center to label position ── */}
          {labels.map((l) => (
            <line
              key={`spoke-${l.id}`}
              x1={cx}
              y1={cy}
              x2={l.spokeEnd.x}
              y2={l.spokeEnd.y}
              stroke="#A9A49A"
              strokeWidth={1.2}
              strokeDasharray="2 5"
              opacity={0.7}
            />
          ))}

          {/* ── Competency blob (organic filled shape) ── */}
          {blobD && (
            <path
              d={blobD}
              fill={`url(#${uid}-blob-grad)`}
              stroke={TEAL}
              strokeWidth={2.5}
              strokeLinejoin="round"
              filter={`url(#${uid}-glow)`}
              className="living-blob-path"
            />
          )}

          {/* ── Competency dots (on blob edge) ── */}
          {compDots.map((dot) => (
            <g key={`cdot-${dot.id}`}>
              {/* Subtle halo behind competency dot */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={10}
                fill={TEAL}
                opacity={0.08}
                className="living-blob-dot"
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={6}
                fill={TEAL}
                stroke="white"
                strokeWidth={2.5}
                className="living-blob-dot"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDotClick(dot.id, dot.x, dot.y)
                }}
              >
                <title>
                  {dot.name}: Competency {dot.competency.toFixed(1)}/4
                </title>
              </circle>
            </g>
          ))}

          {/* ── Interest dots (amber markers) ── */}
          {interestDots.map((dot) => (
            <g
              key={`idot-${dot.id}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                handleDotClick(dot.id, dot.x, dot.y)
              }}
            >
              {/* Subtle halo behind interest dot */}
              {dot.interest > 0 && (
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={11}
                  fill={AMBER}
                  opacity={0.08}
                  className="living-blob-dot"
                />
              )}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={7}
                fill={AMBER}
                stroke="white"
                strokeWidth={2.5}
                opacity={dot.interest > 0 ? 0.92 : 0.15}
                className="living-blob-dot"
              />
              {/* Inner highlight */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={2.5}
                fill="white"
                opacity={dot.interest > 0 ? 0.7 : 0}
                className="living-blob-dot"
              />
              <title>
                {dot.name}: Interest {dot.interest.toFixed(1)}/5
              </title>
            </g>
          ))}
        </g>

        {/* ── Grade label (persistent during playback, emphasized during squeeze) ── */}
        {(currentGradeLabel || (ringSqueezeProgress > 0.05 && gradeTransitionLabel)) && (() => {
          const label = ringSqueezeProgress > 0.05 && gradeTransitionLabel
            ? gradeTransitionLabel
            : currentGradeLabel
          // During squeeze: full opacity, larger, white pill background
          // Normal playback: subtle, smaller, no pill
          const isSqueeze = ringSqueezeProgress > 0.05
          const textOpacity = isSqueeze ? Math.min(1, ringSqueezeProgress * 3) : 0.35
          const fontSize = isSqueeze ? 18 : 14
          const pillOpacity = isSqueeze ? 0.9 * Math.min(1, ringSqueezeProgress * 3) : 0
          return (
            <>
              {pillOpacity > 0 && (
                <rect
                  x={cx - 60}
                  y={cy - 18}
                  width={120}
                  height={36}
                  rx={18}
                  fill="white"
                  opacity={pillOpacity}
                />
              )}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isSqueeze ? TEAL : '#A9A49A'}
                fontSize={fontSize}
                fontWeight={isSqueeze ? 800 : 600}
                opacity={textOpacity}
                letterSpacing="0.03em"
              >
                {label}
              </text>
            </>
          )
        })()}

        {/* ── Dimension labels (multi-line, word-wrapped) ── */}
        {labels.map((l) => {
          const lineHeight = 22
          // Vertically center the multi-line block around the anchor point
          const totalHeight = (l.lines.length - 1) * lineHeight
          const startY = l.y - totalHeight / 2

          return (
            <text
              key={`lbl-${l.id}`}
              x={l.x}
              y={startY}
              textAnchor={l.anchor}
              fill="#2D3436"
              fontSize={20}
              fontWeight={600}
              letterSpacing="-0.01em"
              className="living-blob-label"
              style={{ cursor: onDimensionClick ? 'pointer' : 'default' }}
              onClick={() => onDimensionClick?.(l.id)}
            >
              {l.lines.map((line, li) => (
                <tspan
                  key={li}
                  x={l.x}
                  dy={li === 0 ? '0.35em' : `${lineHeight}px`}
                >
                  {line}
                </tspan>
              ))}
            </text>
          )
        })}

        {/* Center point with subtle pulse */}
        <circle cx={cx} cy={cy} r={4} fill={TEAL} opacity={0.12} className="living-blob-center-pulse" />
        <circle cx={cx} cy={cy} r={2.5} fill="#C0BBAD" opacity={0.6} />
      </svg>

      {/* ── Observation popup overlay ── */}
      {popupState && popupDimension && (
        <ObservationPopup
          anchorX={popupState.x}
          anchorY={popupState.y}
          containerWidth={containerRef.current?.clientWidth ?? size}
          containerHeight={containerRef.current?.clientHeight ?? size}
          dimensionName={popupDimension.dimension_name}
          dimensionId={popupState.dimensionId}
          competency={popupDimension.competency}
          interest={popupDimension.interest}
          observations={(observations ?? []).filter(
            (o) => o.dimension_id === popupState.dimensionId
          )}
          observers={observers ?? new Map()}
          onClose={() => setPopupState(null)}
          onViewDetails={onDimensionClick}
        />
      )}

      {/* CSS for transitions and animations */}
      <style>{`
        .living-blob-path {
          transition: fill-opacity 400ms ease;
        }
        .living-blob-dot {
          transition: opacity 400ms ease;
        }
        .living-blob-label {
          transition: fill 200ms ease, font-size 200ms ease;
        }
        .living-blob-label:hover {
          fill: #0D7377;
        }
        .living-blob-center-pulse {
          animation: blobCenterPulse 3s ease-in-out infinite;
        }
        @keyframes blobCenterPulse {
          0%, 100% { r: 4; opacity: 0.12; }
          50% { r: 7; opacity: 0.06; }
        }
      `}</style>
    </div>
  )
}

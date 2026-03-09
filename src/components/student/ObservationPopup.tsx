/**
 * ObservationPopup.tsx
 * Popup card that appears when a competency or interest dot is clicked
 * on the Living Assessment blob. Shows all observations for that dimension
 * at the current snapshot point in time.
 */

import { useEffect, useRef } from 'react'
import { X, ExternalLink, Eye } from 'lucide-react'
import type { Observation } from '../../types/database'

// ── Props ────────────────────────────────────────────────────────

interface Props {
  /** Pixel X of the anchor dot relative to container */
  anchorX: number
  /** Pixel Y of the anchor dot relative to container */
  anchorY: number
  /** Container width for edge detection */
  containerWidth: number
  /** Container height for edge detection */
  containerHeight: number
  /** Dimension name to display */
  dimensionName: string
  /** Dimension id for "view details" */
  dimensionId: string
  /** Competency score */
  competency: number
  /** Interest score */
  interest: number
  /** Filtered observations for this dimension at current snapshot */
  observations: Observation[]
  /** Map of observer_id -> display name */
  observers: Map<string, string>
  /** Close handler */
  onClose: () => void
  /** Navigate to full dimension details */
  onViewDetails?: (dimensionId: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s),]+/g

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? []
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const RATING_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Emerging', color: 'text-amber-700', bg: 'bg-amber-50' },
  2: { label: 'Developing', color: 'text-blue-700', bg: 'bg-blue-50' },
  3: { label: 'Achieving', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  4: { label: 'Mastery', color: 'text-purple-700', bg: 'bg-purple-50' },
}

const POPUP_WIDTH = 320
const POPUP_MAX_HEIGHT = 360

// ── Component ────────────────────────────────────────────────────

export default function ObservationPopup({
  anchorX,
  anchorY,
  containerWidth,
  containerHeight: _containerHeight,
  dimensionName,
  dimensionId,
  competency,
  interest,
  observations,
  observers,
  onClose,
  onViewDetails,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay adding listener to avoid the same click that opened us
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Position: prefer above the dot, fall back to below
  const showAbove = anchorY > POPUP_MAX_HEIGHT + 20
  const top = showAbove ? anchorY - 12 : anchorY + 16
  const transformY = showAbove ? 'translateY(-100%)' : 'translateY(0)'

  // Horizontal: center on dot, clamp to container edges
  let left = anchorX - POPUP_WIDTH / 2
  if (left < 8) left = 8
  if (left + POPUP_WIDTH > containerWidth - 8) left = containerWidth - POPUP_WIDTH - 8

  // Sort observations most recent first
  const sorted = [...observations].sort(
    (a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
  )

  return (
    <div
      ref={popupRef}
      className="absolute z-50 overflow-hidden rounded-xl border border-bg-muted bg-bg-card shadow-xl"
      style={{
        top,
        left,
        width: POPUP_WIDTH,
        maxHeight: POPUP_MAX_HEIGHT,
        transform: transformY,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-bg-muted px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-text">{dimensionName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0D7377]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0D7377]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0D7377]" />
              {competency.toFixed(1)}
            </span>
            {interest > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D4943A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#D4943A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4943A]" />
                {interest.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body — observations list */}
      <div className="max-h-[220px] overflow-y-auto px-4 py-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <Eye className="h-5 w-5 text-text-light" />
            <p className="text-xs text-text-muted">No observations recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((obs) => {
              const ratingInfo = RATING_LABELS[obs.rating] ?? {
                label: `Level ${obs.rating}`,
                color: 'text-text-muted',
                bg: 'bg-bg-muted',
              }
              const urls = obs.notes ? extractUrls(obs.notes) : []
              // Strip URLs from notes for cleaner display
              const cleanNotes = obs.notes
                ? obs.notes.replace(URL_REGEX, '').trim()
                : null

              return (
                <div
                  key={obs.id}
                  className="rounded-lg border border-bg-muted bg-bg px-3 py-2"
                >
                  {/* Meta row */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-medium text-text-muted">
                      {formatDate(obs.observed_at)}
                    </span>
                    <span className="text-text-light">·</span>
                    <span className="truncate text-text-light">
                      {observers.get(obs.observer_id) ?? 'Unknown'}
                    </span>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${ratingInfo.bg} ${ratingInfo.color}`}
                    >
                      {ratingInfo.label}
                    </span>
                  </div>

                  {/* Notes */}
                  {cleanNotes && (
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      {cleanNotes}
                    </p>
                  )}

                  {/* Evidence links */}
                  {urls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {urls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 rounded bg-primary-50 px-1.5 py-0.5 text-[9px] font-medium text-primary-600 transition-colors hover:bg-primary-100"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Evidence {urls.length > 1 ? idx + 1 : ''}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {onViewDetails && (
        <div className="border-t border-bg-muted px-4 py-2">
          <button
            onClick={() => {
              onViewDetails(dimensionId)
              onClose()
            }}
            className="w-full text-center text-[11px] font-semibold text-primary-500 transition-colors hover:text-primary-600"
          >
            View dimension details →
          </button>
        </div>
      )}
    </div>
  )
}

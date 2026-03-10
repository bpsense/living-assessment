import { clsx } from 'clsx'
import {
  Heart,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react'
import type { DimensionScore } from '../../lib/student-data'
import { useFamilySupport } from '../../lib/family-support'
import { useAuth } from '../../lib/auth'
import FamilySuggestionCard from './FamilySuggestionCard'

// ============================================================
// Props
// ============================================================

interface Props {
  studentId: string
  schoolId: string
  studentName: string
  gradeLevel: string | null
  dimensionScores: DimensionScore[]
  /** "family" = parent-facing view, "admin" = educator/admin view with note controls */
  mode: 'family' | 'admin'
}

// ============================================================
// Main Component
// ============================================================

export default function FamilySupportGuide({
  studentId,
  schoolId,
  studentName,
  gradeLevel,
  dimensionScores,
  mode,
}: Props) {
  const { profile } = useAuth()
  const {
    suggestions,
    educatorNotes,
    loading,
    generating,
    error,
    cached,
    generate,
    addEducatorNote,
    removeEducatorNote,
  } = useFamilySupport(studentId, schoolId, studentName, gradeLevel, dimensionScores)

  const hasSuggestions = suggestions.length > 0
  const isFamilyMode = mode === 'family'

  function handleAddNote(suggestionId: string, note: string) {
    if (!profile) return
    addEducatorNote(suggestionId, note, profile.id, profile.full_name)
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isFamilyMode
                ? 'bg-gradient-to-br from-rose-400 to-orange-400'
                : 'bg-gradient-to-br from-rose-500 to-primary-500'
            )}
          >
            <Heart className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">
              {isFamilyMode ? 'Family Support Guide' : 'Family Support Guide'}
            </h2>
            <p className="text-xs text-text-muted">
              {isFamilyMode
                ? `Personalized ideas for supporting ${studentName}'s learning at home`
                : `AI-powered home activity suggestions for ${studentName}'s family`}
            </p>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
            hasSuggestions
              ? 'border border-bg-muted bg-bg text-text-muted hover:bg-bg-muted'
              : isFamilyMode
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-primary-500 text-white hover:bg-primary-600',
            loading && 'opacity-50'
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasSuggestions ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading
            ? 'Generating…'
            : hasSuggestions
              ? 'Refresh Ideas'
              : isFamilyMode
                ? 'Get Ideas'
                : 'Generate for Family'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-alert-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-alert-500" />
          <p className="text-sm text-alert-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {generating && (
        <div className="mt-6 flex flex-col items-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
          <p className="mt-3 text-sm text-text-muted">
            {isFamilyMode
              ? `Creating personalized ideas for supporting ${studentName} at home…`
              : `Generating family support suggestions for ${studentName}…`}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {hasSuggestions && !generating && (
        <div className="mt-4 space-y-3">
          {/* Cached indicator */}
          {cached && (
            <div className="flex items-center gap-1.5 text-xs text-text-light">
              <Clock className="h-3 w-3" />
              Showing saved suggestions (profile unchanged since last generation)
            </div>
          )}

          {/* Suggestion cards */}
          {suggestions.map((s) => (
            <FamilySuggestionCard
              key={s.id}
              suggestion={s}
              educatorNote={educatorNotes[s.id]}
              showEducatorControls={!isFamilyMode}
              onAddNote={!isFamilyMode ? handleAddNote : undefined}
              onRemoveNote={!isFamilyMode ? removeEducatorNote : undefined}
            />
          ))}

          {/* Family mode footer */}
          {isFamilyMode && (
            <p className="pt-2 text-center text-xs text-text-light">
              These suggestions are personalized based on {studentName}&apos;s
              learning profile. Try what feels right for your family!
            </p>
          )}

          {/* Admin mode footer */}
          {!isFamilyMode && (
            <p className="pt-2 text-center text-xs text-text-light">
              Add notes to any suggestion to provide families with personalized context.
              Your notes will be visible to the family alongside the AI suggestions.
            </p>
          )}
        </div>
      )}

      {/* Empty initial state */}
      {!hasSuggestions && !generating && !error && (
        <div className="mt-4 text-center">
          {isFamilyMode ? (
            <p className="text-sm text-text-light">
              Click &quot;Get Ideas&quot; to receive personalized suggestions for
              supporting {studentName}&apos;s learning at home through everyday activities.
            </p>
          ) : (
            <p className="text-sm text-text-light">
              Click &quot;Generate for Family&quot; to create AI-powered home activity
              suggestions. You can then add personalized notes for the family.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

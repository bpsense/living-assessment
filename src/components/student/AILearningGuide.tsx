import { clsx } from 'clsx'
import {
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  Bookmark,
  Share2,
  RefreshCw,
  Clock,
  TrendingUp,
  Trophy,
  Compass,
  Anchor,
  Lightbulb,
  Palette,
  Target,
  Zap,
  Link,
} from 'lucide-react'
import type { DimensionScore } from '../../lib/student-data'
import type { LearningSuggestion, SuggestionActivityType } from '../../types/database'
import { useLearningGuide } from '../../lib/learning-suggestions'

// ============================================================
// Props
// ============================================================

interface Props {
  studentId: string
  schoolId: string
  studentName: string
  gradeLevel: string | null
  dimensionScores: DimensionScore[]
}

// ============================================================
// Zone & activity config (mirrors ZoneMatrix.tsx colour scheme)
// ============================================================

const ZONE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  growth: {
    label: 'Growth',
    icon: <TrendingUp className="h-3 w-3" />,
    badgeClass: 'bg-success-500 text-white',
  },
  mastery: {
    label: 'Mastery',
    icon: <Trophy className="h-3 w-3" />,
    badgeClass: 'bg-primary-500 text-white',
  },
  explore: {
    label: 'Explore',
    icon: <Compass className="h-3 w-3" />,
    badgeClass: 'bg-accent-500 text-white',
  },
  cruise: {
    label: 'Cruise',
    icon: <Anchor className="h-3 w-3" />,
    badgeClass: 'bg-text-light text-white',
  },
}

const ACTIVITY_CONFIG: Record<
  SuggestionActivityType,
  { label: string; icon: React.ReactNode; className: string }
> = {
  project: {
    label: 'Project',
    icon: <Palette className="h-3 w-3" />,
    className: 'bg-blue-50 text-blue-700',
  },
  exploration: {
    label: 'Exploration',
    icon: <Lightbulb className="h-3 w-3" />,
    className: 'bg-purple-50 text-purple-700',
  },
  practice: {
    label: 'Practice',
    icon: <Target className="h-3 w-3" />,
    className: 'bg-green-50 text-green-700',
  },
  challenge: {
    label: 'Challenge',
    icon: <Zap className="h-3 w-3" />,
    className: 'bg-orange-50 text-orange-700',
  },
  connection: {
    label: 'Connection',
    icon: <Link className="h-3 w-3" />,
    className: 'bg-pink-50 text-pink-700',
  },
}

// ============================================================
// Suggestion Card
// ============================================================

function SuggestionCard({
  suggestion,
  isDismissed,
  isSaved,
  isShared,
  onDismiss,
  onSave,
  onShare,
}: {
  suggestion: LearningSuggestion
  isDismissed: boolean
  isSaved: boolean
  isShared: boolean
  onDismiss: () => void
  onSave: () => void
  onShare: () => void
}) {
  const zone = ZONE_CONFIG[suggestion.zone] ?? ZONE_CONFIG.growth
  const activity =
    ACTIVITY_CONFIG[suggestion.activity_type as SuggestionActivityType] ??
    ACTIVITY_CONFIG.project

  return (
    <div
      className={clsx(
        'rounded-lg border border-bg-muted bg-bg p-4 transition-all',
        isDismissed && 'opacity-40'
      )}
    >
      {/* Top row: badges */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            zone.badgeClass
          )}
        >
          {zone.icon}
          {zone.label}
        </span>
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            activity.className
          )}
        >
          {activity.icon}
          {activity.label}
        </span>
        <span className="text-[11px] text-text-light">
          {suggestion.dimension_name}
        </span>
      </div>

      {/* Title + description */}
      <h4
        className={clsx(
          'text-sm font-semibold text-text',
          isDismissed && 'line-through'
        )}
      >
        {suggestion.title}
      </h4>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">
        {suggestion.description}
      </p>

      {/* Parent-friendly summary */}
      {suggestion.parent_friendly_summary && (
        <p className="mt-2 rounded-md bg-primary-50 px-3 py-1.5 text-xs italic text-primary-700">
          <span className="font-medium not-italic">For families:</span>{' '}
          {suggestion.parent_friendly_summary}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1">
        {!isDismissed && (
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="rounded-md p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onSave}
          title={isSaved ? 'Saved' : 'Save'}
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            isSaved
              ? 'bg-primary-50 text-primary-600'
              : 'text-text-light hover:bg-bg-muted hover:text-text-muted'
          )}
        >
          <Bookmark
            className="h-3.5 w-3.5"
            fill={isSaved ? 'currentColor' : 'none'}
          />
        </button>
        <button
          onClick={onShare}
          title={isShared ? 'Shared with family' : 'Share with family'}
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            isShared
              ? 'bg-success-50 text-success-600'
              : 'text-text-light hover:bg-bg-muted hover:text-text-muted'
          )}
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function AILearningGuide({
  studentId,
  schoolId,
  studentName,
  gradeLevel,
  dimensionScores,
}: Props) {
  const {
    suggestions,
    educatorActions,
    loading,
    error,
    cached,
    generate,
    dismissSuggestion,
    saveSuggestion,
    shareSuggestion,
  } = useLearningGuide(studentId, schoolId, studentName, gradeLevel, dimensionScores)

  const hasSuggestions = suggestions.length > 0

  // Group by priority for display order
  const grouped = {
    high: suggestions.filter((s) => s.priority === 'high'),
    medium: suggestions.filter((s) => s.priority === 'medium'),
    low: suggestions.filter((s) => s.priority === 'low'),
  }

  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-primary-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">AI Learning Guide</h2>
            <p className="text-xs text-text-muted">
              Personalized suggestions powered by Claude
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
              ? 'Regenerate'
              : 'Generate Suggestions'}
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
      {loading && (
        <div className="mt-6 flex flex-col items-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
          <p className="mt-3 text-sm text-text-muted">
            Analyzing learning profile and generating suggestions…
          </p>
        </div>
      )}

      {/* Suggestions */}
      {hasSuggestions && !loading && (
        <div className="mt-4 space-y-5">
          {/* Cached indicator */}
          {cached && (
            <div className="flex items-center gap-1.5 text-xs text-text-light">
              <Clock className="h-3 w-3" />
              Showing cached suggestions (profile unchanged since last generation)
            </div>
          )}

          {/* High priority */}
          {grouped.high.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-success-600">
                <TrendingUp className="h-3.5 w-3.5" />
                Highest Priority — Growth Zone
              </h3>
              <div className="space-y-3">
                {grouped.high.map((s) => {
                  const actions = educatorActions[s.id]
                  return (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      isDismissed={!!actions?.dismissed}
                      isSaved={!!actions?.saved}
                      isShared={!!actions?.shared_with_parent}
                      onDismiss={() => dismissSuggestion(s.id)}
                      onSave={() => saveSuggestion(s.id)}
                      onShare={() => shareSuggestion(s.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Medium priority */}
          {grouped.medium.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-600">
                <Trophy className="h-3.5 w-3.5" />
                Additional Suggestions
              </h3>
              <div className="space-y-3">
                {grouped.medium.map((s) => {
                  const actions = educatorActions[s.id]
                  return (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      isDismissed={!!actions?.dismissed}
                      isSaved={!!actions?.saved}
                      isShared={!!actions?.shared_with_parent}
                      onDismiss={() => dismissSuggestion(s.id)}
                      onSave={() => saveSuggestion(s.id)}
                      onShare={() => shareSuggestion(s.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Low priority */}
          {grouped.low.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-light">
                <Anchor className="h-3.5 w-3.5" />
                When Opportunity Arises
              </h3>
              <div className="space-y-3">
                {grouped.low.map((s) => {
                  const actions = educatorActions[s.id]
                  return (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      isDismissed={!!actions?.dismissed}
                      isSaved={!!actions?.saved}
                      isShared={!!actions?.shared_with_parent}
                      onDismiss={() => dismissSuggestion(s.id)}
                      onSave={() => saveSuggestion(s.id)}
                      onShare={() => shareSuggestion(s.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty initial state */}
      {!hasSuggestions && !loading && !error && (
        <p className="mt-4 text-center text-sm text-text-light">
          Click "Generate Suggestions" to get AI-powered learning activity
          ideas based on this learner's interest and competency profile.
        </p>
      )}
    </div>
  )
}

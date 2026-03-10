import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Sun,
  CalendarDays,
  BookOpen,
  MessageCircle,
  Palette,
  Trees,
  Users,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  X,
  GraduationCap,
} from 'lucide-react'
import type { FamilySuggestion, FamilySuggestionCategory, EducatorNote } from '../../types/database'

// ============================================================
// Category config
// ============================================================

const CATEGORY_CONFIG: Record<
  FamilySuggestionCategory,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  'daily-routine': {
    label: 'Daily Routine',
    icon: <Sun className="h-3 w-3" />,
    badgeClass: 'bg-amber-50 text-amber-700',
  },
  'weekend-activity': {
    label: 'Weekend Activity',
    icon: <CalendarDays className="h-3 w-3" />,
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  reading: {
    label: 'Reading',
    icon: <BookOpen className="h-3 w-3" />,
    badgeClass: 'bg-purple-50 text-purple-700',
  },
  conversation: {
    label: 'Conversation',
    icon: <MessageCircle className="h-3 w-3" />,
    badgeClass: 'bg-teal-50 text-teal-700',
  },
  'creative-play': {
    label: 'Creative Play',
    icon: <Palette className="h-3 w-3" />,
    badgeClass: 'bg-pink-50 text-pink-700',
  },
  outdoor: {
    label: 'Outdoor',
    icon: <Trees className="h-3 w-3" />,
    badgeClass: 'bg-green-50 text-green-700',
  },
  social: {
    label: 'Social',
    icon: <Users className="h-3 w-3" />,
    badgeClass: 'bg-indigo-50 text-indigo-700',
  },
}

// ============================================================
// Props
// ============================================================

interface Props {
  suggestion: FamilySuggestion
  educatorNote?: EducatorNote
  /** Show controls for adding/editing educator notes (admin/educator mode) */
  showEducatorControls?: boolean
  onAddNote?: (suggestionId: string, note: string) => void
  onRemoveNote?: (suggestionId: string) => void
}

// ============================================================
// Component
// ============================================================

export default function FamilySuggestionCard({
  suggestion,
  educatorNote,
  showEducatorControls = false,
  onAddNote,
  onRemoveNote,
}: Props) {
  const [showWhy, setShowWhy] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(educatorNote?.note ?? '')

  const category =
    CATEGORY_CONFIG[suggestion.category as FamilySuggestionCategory] ??
    CATEGORY_CONFIG['daily-routine']

  function handleSaveNote() {
    if (!noteText.trim() || !onAddNote) return
    onAddNote(suggestion.id, noteText.trim())
    setEditingNote(false)
  }

  function handleRemoveNote() {
    if (!onRemoveNote) return
    onRemoveNote(suggestion.id)
    setNoteText('')
    setEditingNote(false)
  }

  return (
    <div className="rounded-lg border border-bg-muted bg-bg p-4 transition-shadow hover:shadow-sm">
      {/* Category badge + dimension name */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            category.badgeClass
          )}
        >
          {category.icon}
          {category.label}
        </span>
        <span className="text-[11px] text-text-light">
          {suggestion.dimension_name}
        </span>
      </div>

      {/* Title + description */}
      <h4 className="text-sm font-semibold text-text">{suggestion.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-text-muted">
        {suggestion.description}
      </p>

      {/* Materials needed */}
      {suggestion.materials_needed && suggestion.materials_needed !== 'None' && (
        <p className="mt-2 text-xs text-text-light">
          <span className="font-medium">You&apos;ll need:</span> {suggestion.materials_needed}
        </p>
      )}

      {/* Why it helps — expandable */}
      {suggestion.why_it_helps && (
        <button
          onClick={() => setShowWhy((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
        >
          {showWhy ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Why this helps
        </button>
      )}
      {showWhy && (
        <p className="mt-1.5 rounded-md bg-primary-50 px-3 py-2 text-xs italic leading-relaxed text-primary-700">
          {suggestion.why_it_helps}
        </p>
      )}

      {/* Educator note — visible to families as teacher callout */}
      {educatorNote && !editingNote && (
        <div className="mt-3 rounded-md border border-primary-100 bg-primary-50/50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
            <GraduationCap className="h-3 w-3" />
            A note from {educatorNote.author_name}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-primary-600">
            {educatorNote.note}
          </p>
          {/* Educator controls for editing/removing */}
          {showEducatorControls && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setNoteText(educatorNote.note)
                  setEditingNote(true)
                }}
                className="text-[10px] font-medium text-primary-500 hover:text-primary-700"
              >
                Edit
              </button>
              <button
                onClick={handleRemoveNote}
                className="text-[10px] font-medium text-alert-500 hover:text-alert-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/edit note controls (educator/admin mode) */}
      {showEducatorControls && !educatorNote && !editingNote && (
        <button
          onClick={() => setEditingNote(true)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-text-light transition-colors hover:text-primary-600"
        >
          <MessageSquarePlus className="h-3 w-3" />
          Add note for family
        </button>
      )}

      {/* Note editing textarea */}
      {editingNote && (
        <div className="mt-3 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a personal note for the family about this activity..."
            rows={2}
            className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim()}
              className="rounded-md bg-primary-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setEditingNote(false)
                setNoteText(educatorNote?.note ?? '')
              }}
              className="flex items-center gap-1 rounded-md px-3 py-1 text-xs text-text-muted hover:bg-bg-muted"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

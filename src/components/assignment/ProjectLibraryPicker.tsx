import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Loader2,
  Search,
  Globe,
  Sparkles,
  Clock,
  Layers,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  fetchTemplates,
  getAttributionText,
  type TemplateWithCreator,
  type TemplateFilters,
} from '../../lib/assignment-template-data'
import type { AssignmentTemplate, GradeBand } from '../../types/database'

// ============================================================
// Constants
// ============================================================

const GRADE_BANDS: { value: GradeBand; label: string }[] = [
  { value: 'early_elementary', label: 'K-2' },
  { value: 'elementary', label: '3-5' },
  { value: 'upper_elementary', label: '4-6' },
  { value: 'middle_school', label: '6-8' },
  { value: 'mixed', label: 'Mixed' },
]

const SUBJECT_OPTIONS = [
  'Math', 'Science', 'ELA', 'Social Studies', 'Art', 'Music',
  'World Languages', 'Technology', 'Interdisciplinary',
]

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (template: AssignmentTemplate) => void
}

// ============================================================
// Component
// ============================================================

export default function ProjectLibraryPicker({ open, onClose, onSelect }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<TemplateWithCreator[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [gradeBand, setGradeBand] = useState<GradeBand | ''>('')
  const [subjectArea, setSubjectArea] = useState('')

  const loadTemplates = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const filters: TemplateFilters = { status: 'published' }
      if (search) filters.search = search
      if (gradeBand) filters.gradeBand = gradeBand as GradeBand
      if (subjectArea) filters.subjectArea = subjectArea

      const data = await fetchTemplates(profile.school_id, filters)
      setTemplates(data)
    } catch {
      toast('Failed to load project library', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, search, gradeBand, subjectArea, toast])

  useEffect(() => {
    if (open) loadTemplates()
  }, [open, loadTemplates])

  // Reset filters on open
  useEffect(() => {
    if (open) {
      setSearch('')
      setGradeBand('')
      setSubjectArea('')
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text">Project Library</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-bg-muted px-5 py-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={gradeBand}
              onChange={(e) => setGradeBand(e.target.value as GradeBand | '')}
              className="rounded-lg border border-bg-muted bg-bg px-2 py-1.5 text-xs text-text focus:border-primary-400 focus:outline-none"
            >
              <option value="">All Grades</option>
              {GRADE_BANDS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <select
              value={subjectArea}
              onChange={(e) => setSubjectArea(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-2 py-1.5 text-xs text-text focus:border-primary-400 focus:outline-none"
            >
              <option value="">All Subjects</option>
              {SUBJECT_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Sparkles className="h-8 w-8 text-text-light" />
              <p className="text-sm text-text-muted">
                {search || gradeBand || subjectArea
                  ? 'No projects match your filters'
                  : 'No published projects available yet'}
              </p>
            </div>
          )}

          {!loading && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-bg-muted bg-bg p-4 transition-colors hover:border-primary-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text truncate">{t.title}</h3>
                        {t.is_global && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            <Globe className="h-2.5 w-2.5" />
                            System
                          </span>
                        )}
                      </div>
                      {/* Attribution */}
                      <p className="mt-0.5 text-[11px] text-text-light italic">
                        {getAttributionText(t)}
                      </p>
                      {t.driving_question && (
                        <p className="mt-1.5 text-xs text-text-muted line-clamp-2">
                          {t.driving_question}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-light">
                        {t.grade_band && (
                          <span className="rounded bg-bg-muted px-1.5 py-0.5">
                            {GRADE_BANDS.find(g => g.value === t.grade_band)?.label ?? t.grade_band}
                          </span>
                        )}
                        {t.subject_area.length > 0 && (
                          <span className="rounded bg-bg-muted px-1.5 py-0.5">
                            {t.subject_area.join(', ')}
                          </span>
                        )}
                        {t.estimated_duration_days && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {t.estimated_duration_days}d
                          </span>
                        )}
                        {t.phases.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Layers className="h-3 w-3" />
                            {t.phases.length} phases
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelect(t)
                        onClose()
                      }}
                      className="shrink-0 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-primary-600"
                    >
                      Use This
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

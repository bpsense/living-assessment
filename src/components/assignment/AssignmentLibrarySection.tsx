import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Plus,
  Loader2,
  BookOpen,
  Search,
  Trash2,
  Tag,
  FileText,
  Sparkles,
  Copy,
  Pencil,
  Archive,
  Clock,
  BarChart3,
  Filter,
  Eye,
  X,
  Globe,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useIsAllSchoolsView } from '../../lib/school-context'
import { useToast } from '../Toast'
import {
  fetchTemplates,
  deleteTemplate,
  duplicateTemplate,
  archiveTemplate,
  getAttributionText,
  type TemplateWithCreator,
  type TemplateFilters,
} from '../../lib/assignment-template-data'
import type { AssignmentTemplate, GradeBand, DOKLevel, TemplateStatus } from '../../types/database'
import CreateAssignmentModal from './CreateAssignmentModal'
import TemplateBuilder from './TemplateBuilder'

// ============================================================
// Constants
// ============================================================

const GRADE_BAND_LABELS: Record<GradeBand, string> = {
  early_elementary: 'Early Elem',
  elementary: 'Elementary',
  upper_elementary: 'Upper Elem',
  middle_school: 'Middle School',
  mixed: 'Mixed',
}

const STATUS_STYLES: Record<TemplateStatus, string> = {
  draft: 'bg-bg-muted text-text-muted',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

const DOK_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700',
  2: 'bg-indigo-100 text-indigo-700',
  3: 'bg-violet-100 text-violet-700',
  4: 'bg-fuchsia-100 text-fuchsia-700',
}

// ============================================================
// Template Detail View
// ============================================================

function TemplateDetailView({
  template,
  onClose,
}: {
  template: TemplateWithCreator
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h3 className="text-base font-bold text-text">{template.title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {template.is_global && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-700">
                <Globe className="h-3 w-3" />
                System Template
              </span>
            )}
            <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-medium', STATUS_STYLES[template.status])}>
              {template.status}
            </span>
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[10px] font-medium text-primary-700">
              {GRADE_BAND_LABELS[template.grade_band]}
            </span>
            <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-medium', DOK_COLORS[template.dok_level])}>
              DOK {template.dok_level}
            </span>
            {template.subject_area.map((s) => (
              <span key={s} className="rounded-full bg-bg-muted px-2.5 py-0.5 text-[10px] font-medium text-text-muted">{s}</span>
            ))}
          </div>

          {template.description && (
            <p className="text-sm text-text-muted">{template.description}</p>
          )}

          {template.driving_question && (
            <div className="rounded-lg bg-primary-50 p-3">
              <p className="text-xs font-semibold text-primary-700 mb-1">Driving Question</p>
              <p className="text-sm text-primary-800 italic">"{template.driving_question}"</p>
            </div>
          )}

          {template.authenticity_hook && (
            <div>
              <p className="text-xs font-semibold text-text-light mb-1">Authenticity Hook</p>
              <p className="text-sm text-text-muted">{template.authenticity_hook}</p>
            </div>
          )}

          {template.essential_understandings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-light mb-1">Essential Understandings</p>
              <ul className="space-y-1">
                {template.essential_understandings.map((u, i) => (
                  <li key={i} className="text-sm text-text-muted">• {u}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Phases */}
          {template.phases.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-light mb-2">Project Phases</p>
              <div className="space-y-2">
                {template.phases.map((phase, i) => (
                  <div key={phase.id} className="rounded-lg border border-bg-muted bg-bg p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">{i + 1}</span>
                      <p className="text-sm font-semibold text-text">{phase.title}</p>
                      <span className="text-xs text-text-muted">{phase.duration_days}d · DOK {phase.dok_level}</span>
                    </div>
                    {phase.description && <p className="mt-1 text-xs text-text-muted">{phase.description}</p>}
                    {phase.activities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {phase.activities.map((a) => (
                          <span key={a.id} className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-muted">{a.title}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Product */}
          {template.final_product?.description && (
            <div>
              <p className="text-xs font-semibold text-text-light mb-1">Final Product</p>
              <p className="text-sm text-text-muted">{template.final_product.description}</p>
              {template.final_product.audience && (
                <p className="mt-1 text-xs text-text-muted">Audience: {template.final_product.audience}</p>
              )}
            </div>
          )}

          {/* Differentiation */}
          {template.differentiation && (template.differentiation.extending || template.differentiation.supporting) && (
            <div>
              <p className="text-xs font-semibold text-text-light mb-1">Differentiation</p>
              {template.differentiation.extending && <p className="text-xs text-text-muted"><strong>Extending:</strong> {template.differentiation.extending}</p>}
              {template.differentiation.supporting && <p className="text-xs text-text-muted"><strong>Supporting:</strong> {template.differentiation.supporting}</p>}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-text-muted pt-2 border-t border-bg-muted">
            <span>{getAttributionText(template)}</span>
            <span>v{template.version}</span>
            <span>{template.competency_ids.length} competencies</span>
            <span>{template.skill_ids.length} skills</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Section
// ============================================================

export default function AssignmentLibrarySection() {
  const { profile, isSystemAdmin } = useAuth()
  const isAllSchoolsView = useIsAllSchoolsView()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<TemplateWithCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editTemplate, setEditTemplate] = useState<AssignmentTemplate | null>(null)
  const [viewTemplate, setViewTemplate] = useState<TemplateWithCreator | null>(null)

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterGrade, setFilterGrade] = useState<GradeBand | ''>('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterDok, setFilterDok] = useState<DOKLevel | ''>('')
  const [filterStatus, setFilterStatus] = useState<TemplateStatus | ''>('')

  // Template to use for creating an assignment
  const [useTemplate, setUseTemplate] = useState<AssignmentTemplate | null>(null)

  const loadData = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const filters: TemplateFilters = {}
      if (search) filters.search = search
      if (filterGrade) filters.gradeBand = filterGrade
      if (filterSubject) filters.subjectArea = filterSubject
      if (filterDok) filters.dokLevel = filterDok
      if (filterStatus) filters.status = filterStatus

      const tmpl = await fetchTemplates(profile.school_id, filters)
      // System admin "All Schools" view: show only global templates
      setTemplates(isAllSchoolsView ? tmpl.filter(t => t.is_global) : tmpl)
    } catch {
      toast('Failed to load library', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, isAllSchoolsView, search, filterGrade, filterSubject, filterDok, filterStatus, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDelete(t: TemplateWithCreator) {
    if (!confirm(`Remove "${t.title}" from the library?`)) return
    setDeleting(t.id)
    try {
      await deleteTemplate(t.id)
      toast('Template removed', 'success')
      loadData()
    } catch {
      toast('Failed to delete', 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(t: TemplateWithCreator) {
    if (!profile) return
    try {
      await duplicateTemplate(t.id, profile.school_id, profile.id)
      toast('Template duplicated', 'success')
      loadData()
    } catch {
      toast('Failed to duplicate', 'error')
    }
  }

  async function handleArchive(t: TemplateWithCreator) {
    try {
      await archiveTemplate(t.id)
      toast('Template archived', 'success')
      loadData()
    } catch {
      toast('Failed to archive', 'error')
    }
  }

  const isStaff = profile?.role === 'educator' || profile?.role === 'admin'
  const hasActiveFilters = filterGrade || filterSubject || filterDok || filterStatus

  return (
    <>
      {/* Search + Filter + Add */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              hasActiveFilters
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-bg-muted bg-bg text-text-muted hover:bg-bg-muted'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[10px] text-white">
                {[filterGrade, filterSubject, filterDok, filterStatus].filter(Boolean).length}
              </span>
            )}
          </button>
          {(isStaff || isSystemAdmin) && (
            <button
              onClick={() => { setEditTemplate(null); setShowBuilder(true) }}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              {isAllSchoolsView ? 'New Global Template' : 'New Template'}
            </button>
          )}
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-bg-muted bg-bg p-3">
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as GradeBand | '')}
              className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
            >
              <option value="">All grades</option>
              {Object.entries(GRADE_BAND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
            >
              <option value="">All subjects</option>
              {['Math', 'Science', 'ELA', 'Social Studies', 'Art', 'Music', 'PE', 'Technology', 'Interdisciplinary'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filterDok}
              onChange={(e) => setFilterDok(e.target.value ? Number(e.target.value) as DOKLevel : '')}
              className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
            >
              <option value="">All DOK</option>
              <option value="1">DOK 1</option>
              <option value="2">DOK 2</option>
              <option value="3">DOK 3</option>
              <option value="4">DOK 4</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TemplateStatus | '')}
              className="rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => { setFilterGrade(''); setFilterSubject(''); setFilterDok(''); setFilterStatus('') }}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <BookOpen className="h-7 w-7 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">
              {search || hasActiveFilters ? 'No matching templates' : 'No templates in the library yet'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {search || hasActiveFilters
                ? 'Try adjusting your filters or search term.'
                : 'Create a PBL project template to get started.'}
            </p>
          </div>
          {!search && !hasActiveFilters && isStaff && (
            <button
              onClick={() => { setEditTemplate(null); setShowBuilder(true) }}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
          )}
        </div>
      )}

      {/* Template cards */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-bg-muted bg-bg-card px-4 py-4 transition-colors hover:border-primary-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <FileText className="h-5 w-5 text-primary-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text truncate">{t.title}</p>
                    {t.is_global && (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        <Globe className="h-3 w-3" />
                        System
                      </span>
                    )}
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', STATUS_STYLES[t.status])}>
                      {t.status}
                    </span>
                    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                      {GRADE_BAND_LABELS[t.grade_band]}
                    </span>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', DOK_COLORS[t.dok_level])}>
                      DOK {t.dok_level}
                    </span>
                  </div>

                  {/* Subject chips */}
                  {t.subject_area.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.subject_area.map((s) => (
                        <span key={s} className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-muted">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Driving question */}
                  {t.driving_question && (
                    <p className="mt-1 text-xs text-text-muted italic line-clamp-1">"{t.driving_question}"</p>
                  )}

                  <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted">
                    {t.phases.length > 0 && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {t.phases.length} phase{t.phases.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {t.estimated_duration_days && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t.estimated_duration_days}d
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {t.competency_ids.length} competenc{t.competency_ids.length !== 1 ? 'ies' : 'y'}
                    </span>
                    {t.skill_ids.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {t.skill_ids.length} skill{t.skill_ids.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span>{getAttributionText(t)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setViewTemplate(t)}
                    title="View"
                    className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {(isStaff || isSystemAdmin) && (
                    <>
                      {(!t.is_global || isSystemAdmin) && (
                        <button
                          onClick={() => { setEditTemplate(t); setShowBuilder(true) }}
                          title="Edit"
                          className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(t)}
                        title="Duplicate"
                        className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {(!t.is_global || isSystemAdmin) && t.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(t)}
                          title="Archive"
                          className="rounded-lg p-2 text-text-light transition-colors hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setUseTemplate(t)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Use
                  </button>
                  {(t.created_by === profile?.id || profile?.role === 'admin' || isSystemAdmin) && (!t.is_global || isSystemAdmin) && (
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={deleting === t.id}
                      className="rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600 disabled:opacity-50"
                    >
                      {deleting === t.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Builder */}
      <TemplateBuilder
        open={showBuilder}
        onClose={() => { setShowBuilder(false); setEditTemplate(null) }}
        onSaved={loadData}
        template={editTemplate}
      />

      {/* Template detail view */}
      {viewTemplate && (
        <TemplateDetailView
          template={viewTemplate}
          onClose={() => setViewTemplate(null)}
        />
      )}

      {/* Use template → CreateAssignmentModal */}
      {useTemplate && (
        <CreateAssignmentModal
          open={true}
          onClose={() => setUseTemplate(null)}
          onCreated={() => setUseTemplate(null)}
          template={useTemplate}
        />
      )}
    </>
  )
}

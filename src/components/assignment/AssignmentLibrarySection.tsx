import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Plus,
  Loader2,
  BookOpen,
  Search,
  Trash2,
  Users,
  User,
  Tag,
  FileText,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  fetchTemplates,
  createTemplate,
  deleteTemplate,
  type TemplateWithCreator,
} from '../../lib/assignment-template-data'
import { fetchCompetencyTree, type CompetencyTreeNode } from '../../lib/assignment-data'
import { fetchSkills, type SkillWithCompetencies } from '../../lib/skills-data'
import type { AssignmentTemplate, AssignmentTemplateInsert, AssignmentType } from '../../types/database'
import CreateAssignmentModal from './CreateAssignmentModal'

// ============================================================
// Template Edit Modal
// ============================================================

function TemplateEditModal({
  open,
  onClose,
  onSaved,
  schoolId,
  createdBy,
  competencyTree,
  allSkills,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  schoolId: string
  createdBy: string
  competencyTree: CompetencyTreeNode[]
  allSkills: SkillWithCompetencies[]
}) {
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('class')
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set())
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setAssignmentType('class')
      setSelectedCompetencies(new Set())
      setSelectedSkills(new Set())
    }
  }, [open])

  async function handleSave() {
    if (!title.trim()) {
      toast('Title is required', 'error')
      return
    }
    if (selectedCompetencies.size === 0) {
      toast('Select at least one competency', 'error')
      return
    }

    setSaving(true)
    try {
      const data: AssignmentTemplateInsert = {
        school_id: schoolId,
        created_by: createdBy,
        title: title.trim(),
        description: description.trim() || null,
        assignment_type: assignmentType,
        competency_ids: Array.from(selectedCompetencies),
        skill_ids: Array.from(selectedSkills),
        is_shared: true,
        template_data: {},
      }
      await createTemplate(data)
      toast('Template saved to library', 'success')
      onSaved()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  // Flatten competencies for selection
  const allCompetencies = competencyTree.flatMap((domain) => domain.competencies)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h3 className="text-base font-bold text-text">Add to Library</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fraction Operations Practice"
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this assignment template..."
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Assignment Type
            </label>
            <div className="flex gap-2">
              {(['class', 'individual'] as AssignmentType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setAssignmentType(t)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    assignmentType === t
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-bg-muted bg-bg text-text-muted hover:border-primary-200'
                  )}
                >
                  {t === 'class' ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  {t === 'class' ? 'Class' : 'Individual'}
                </button>
              ))}
            </div>
          </div>

          {/* Competency picker */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Competencies *
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-bg-muted bg-bg p-2 space-y-1">
              {competencyTree.length === 0 ? (
                <p className="py-2 text-center text-xs text-text-light">No competencies found</p>
              ) : (
                competencyTree.map((domain) => (
                  <div key={domain.domain_id}>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide px-1 pt-1">
                      {domain.domain_name}
                    </p>
                    {domain.competencies.map((comp) => (
                      <label
                        key={comp.id}
                        className="flex items-center gap-2 rounded px-1.5 py-1 text-xs cursor-pointer hover:bg-primary-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCompetencies.has(comp.id)}
                          onChange={() => {
                            setSelectedCompetencies((prev) => {
                              const next = new Set(prev)
                              if (next.has(comp.id)) next.delete(comp.id)
                              else next.add(comp.id)
                              return next
                            })
                          }}
                          className="rounded border-bg-muted text-primary-500 focus:ring-primary-400"
                        />
                        <span className="font-medium text-primary-700">{comp.code}</span>
                        <span className="text-text">{comp.name}</span>
                      </label>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Skills picker */}
          {allSkills.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-light">
                Skills (optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allSkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      setSelectedSkills((prev) => {
                        const next = new Set(prev)
                        if (next.has(skill.id)) next.delete(skill.id)
                        else next.add(skill.id)
                        return next
                      })
                    }}
                    className={clsx(
                      'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      selectedSkills.has(skill.id)
                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                        : 'bg-bg-muted text-text-muted hover:bg-emerald-50 hover:text-emerald-600'
                    )}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-bg-muted px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-bg-muted px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted/80"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || selectedCompetencies.size === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Section
// ============================================================

export default function AssignmentLibrarySection() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<TemplateWithCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [competencyTree, setCompetencyTree] = useState<CompetencyTreeNode[]>([])
  const [allSkills, setAllSkills] = useState<SkillWithCompetencies[]>([])

  // Template to use for creating an assignment
  const [useTemplate, setUseTemplate] = useState<AssignmentTemplate | null>(null)

  const loadData = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const [tmpl, tree, skills] = await Promise.all([
        fetchTemplates(profile.school_id, search ? { search } : undefined),
        fetchCompetencyTree(profile.school_id),
        fetchSkills(profile.school_id),
      ])
      setTemplates(tmpl)
      setCompetencyTree(tree)
      setAllSkills(skills)
    } catch {
      toast('Failed to load library', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, search, toast])

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

  const isStaff = profile?.role === 'educator' || profile?.role === 'admin'

  return (
    <>
      {/* Search + Add button */}
      <div className="mb-4 flex items-center gap-3">
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
        {isStaff && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add to Library
          </button>
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
              {search ? 'No matching templates' : 'No templates in the library yet'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {search
                ? 'Try a different search term.'
                : 'Save assignment templates here so you and your team can reuse them.'}
            </p>
          </div>
          {!search && isStaff && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              Add to Library
            </button>
          )}
        </div>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 rounded-xl border border-bg-muted bg-bg-card px-4 py-4 transition-colors hover:border-primary-200"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <FileText className="h-5 w-5 text-primary-500" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text truncate">{t.title}</p>
                  <span
                    className={clsx(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      t.assignment_type === 'class'
                        ? 'bg-primary-50 text-primary-700'
                        : 'bg-accent-50 text-accent-700'
                    )}
                  >
                    {t.assignment_type === 'class' ? 'Class' : 'Individual'}
                  </span>
                </div>
                {t.description && (
                  <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{t.description}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
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
                  <span>by {t.creator_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseTemplate(t)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Use
                </button>
                {(t.created_by === profile?.id || profile?.role === 'admin') && (
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
          ))}
        </div>
      )}

      {/* Create template modal */}
      {profile && (
        <TemplateEditModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSaved={loadData}
          schoolId={profile.school_id}
          createdBy={profile.id}
          competencyTree={competencyTree}
          allSkills={allSkills}
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

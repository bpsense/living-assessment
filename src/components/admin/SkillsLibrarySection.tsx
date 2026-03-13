import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  X,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '../Toast'
import { useAuth } from '../../lib/auth'
import {
  fetchSkills,
  fetchSkillCategories,
  createSkill,
  updateSkill,
  deleteSkill,
  GRADE_OPTIONS,
  type SkillWithCompetencies,
} from '../../lib/skills-data'
import {
  fetchCompetencyTree,
  type CompetencyTreeNode,
} from '../../lib/assignment-data'

// ============================================================
// Skill Edit/Create Modal
// ============================================================

function SkillEditModal({
  open,
  skill,
  competencyTree,
  onClose,
  onSaved,
}: {
  open: boolean
  skill: SkillWithCompetencies | null // null = create mode
  competencyTree: CompetencyTreeNode[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { profile } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [minGrade, setMinGrade] = useState('')
  const [maxGrade, setMaxGrade] = useState('')
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [compExpanded, setCompExpanded] = useState(false)

  useEffect(() => {
    if (open && skill) {
      setName(skill.name)
      setDescription(skill.description || '')
      setCategory(skill.category || '')
      setMinGrade(skill.min_grade || '')
      setMaxGrade(skill.max_grade || '')
      setSelectedCompetencies(new Set(skill.competencies.map((c) => c.id)))
    } else if (open) {
      setName('')
      setDescription('')
      setCategory('')
      setMinGrade('')
      setMaxGrade('')
      setSelectedCompetencies(new Set())
    }
    setCompExpanded(false)
  }, [open, skill])

  const toggleCompetency = (id: string) => {
    setSelectedCompetencies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim() || !profile?.school_id) return

    setSaving(true)
    try {
      const compIds = Array.from(selectedCompetencies)
      if (skill) {
        await updateSkill(
          skill.id,
          {
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            min_grade: minGrade || null,
            max_grade: maxGrade || null,
          },
          compIds
        )
        toast('Skill updated', 'success')
      } else {
        await createSkill(
          {
            school_id: profile.school_id,
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            min_grade: minGrade || null,
            max_grade: maxGrade || null,
            is_default: false,
            created_by: profile.id,
          },
          compIds
        )
        toast('Skill created', 'success')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save skill', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            {skill ? 'Edit Skill' : 'Add Skill'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Visualization"
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Description <span className="font-normal text-text-light">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this skill involves..."
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Category <span className="font-normal text-text-light">(optional)</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Research & Inquiry"
              list="skill-categories"
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>

          {/* Grade range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-light">
                Min Grade <span className="font-normal text-text-light">(optional)</span>
              </label>
              <select
                value={minGrade}
                onChange={(e) => setMinGrade(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              >
                <option value="">Any</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-light">
                Max Grade <span className="font-normal text-text-light">(optional)</span>
              </label>
              <select
                value={maxGrade}
                onChange={(e) => setMaxGrade(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              >
                <option value="">Any</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Competency links */}
          <div>
            <button
              type="button"
              onClick={() => setCompExpanded(!compExpanded)}
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-light"
            >
              {compExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Linked Competencies ({selectedCompetencies.size})
            </button>

            {selectedCompetencies.size > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {Array.from(selectedCompetencies).map((id) => {
                  const comp = competencyTree
                    .flatMap((d) => d.subdomains.flatMap((sd) => sd.competencies))
                    .find((c) => c.id === id)
                  if (!comp) return null
                  return (
                    <button
                      key={id}
                      onClick={() => toggleCompetency(id)}
                      className="flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700 transition-colors hover:bg-primary-200"
                    >
                      {comp.code}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )
                })}
              </div>
            )}

            {compExpanded && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-bg-muted bg-bg p-2 space-y-1">
                {competencyTree.flatMap((d) =>
                  d.subdomains.flatMap((sd) =>
                    sd.competencies.map((comp) => {
                      const isSelected = selectedCompetencies.has(comp.id)
                      return (
                        <button
                          key={comp.id}
                          onClick={() => toggleCompetency(comp.id)}
                          className={clsx(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors',
                            isSelected ? 'bg-primary-50' : 'hover:bg-bg-muted'
                          )}
                        >
                          <div
                            className={clsx(
                              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                              isSelected ? 'border-primary-500 bg-primary-500' : 'border-bg-muted'
                            )}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="text-[11px] font-semibold text-primary-700">{comp.code}</span>
                          <span className="truncate text-[11px] text-text">{comp.name}</span>
                        </button>
                      )
                    })
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-bg-muted px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {skill ? 'Save Changes' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Skills Library Section
// ============================================================

export default function SkillsLibrarySection() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [skills, setSkills] = useState<SkillWithCompetencies[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [competencyTree, setCompetencyTree] = useState<CompetencyTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editSkill, setEditSkill] = useState<SkillWithCompetencies | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const [skillsData, cats, tree] = await Promise.all([
        fetchSkills(profile.school_id),
        fetchSkillCategories(profile.school_id),
        fetchCompetencyTree(profile.school_id),
      ])
      setSkills(skillsData)
      setCategories(cats)
      setCompetencyTree(tree)
    } catch {
      toast('Failed to load skills', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDelete(skill: SkillWithCompetencies) {
    if (!confirm(`Delete "${skill.name}"? This cannot be undone.`)) return
    setDeleting(skill.id)
    try {
      await deleteSkill(skill.id)
      toast('Skill deleted', 'success')
      loadData()
    } catch {
      toast('Failed to delete skill', 'error')
    } finally {
      setDeleting(null)
    }
  }

  // Filter skills
  const filtered = skills.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false
    if (search) {
      const lower = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(lower) ||
        (s.description || '').toLowerCase().includes(lower) ||
        (s.category || '').toLowerCase().includes(lower)
      )
    }
    return true
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, SkillWithCompetencies[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const groupedCategories = Object.keys(grouped).sort()

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditSkill(null); setShowCreate(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          Add Skill
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <Tag className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">
              {search || categoryFilter ? 'No matching skills' : 'No skills yet'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {search || categoryFilter
                ? 'Try a different search or filter.'
                : 'Add skills to your library for teachers to tag on assignments.'}
            </p>
          </div>
          {!search && !categoryFilter && (
            <button
              onClick={() => { setEditSkill(null); setShowCreate(true) }}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              Add Skill
            </button>
          )}
        </div>
      )}

      {/* Skill list grouped by category */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {groupedCategories.map((cat) => (
            <div key={cat}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-light">
                {cat} ({grouped[cat].length})
              </h3>
              <div className="space-y-2">
                {grouped[cat].map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center gap-4 rounded-xl border border-bg-muted bg-bg-card px-4 py-3 transition-colors hover:border-primary-200"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <Tag className="h-4 w-4 text-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text">{skill.name}</p>
                        {skill.is_default && (
                          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] text-text-light">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                        {skill.description && (
                          <span className="truncate">{skill.description}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {skill.competencies.map((c) => (
                          <span
                            key={c.id}
                            className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-medium text-primary-600"
                          >
                            {c.code}
                          </span>
                        ))}
                        {(skill.min_grade || skill.max_grade) && (
                          <span className="rounded-full bg-bg-muted px-1.5 py-0.5 text-[9px] text-text-light">
                            {skill.min_grade || '?'}–{skill.max_grade || '?'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditSkill(skill); setShowCreate(true) }}
                        className="rounded-lg p-2 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                        title="Edit skill"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(skill)}
                        disabled={deleting === skill.id}
                        className="rounded-lg p-2 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600 disabled:opacity-50"
                        title="Delete skill"
                      >
                        {deleting === skill.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category datalist */}
      <datalist id="skill-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Edit/Create modal */}
      <SkillEditModal
        open={showCreate}
        skill={editSkill}
        competencyTree={competencyTree}
        onClose={() => { setShowCreate(false); setEditSkill(null) }}
        onSaved={loadData}
      />
    </div>
  )
}

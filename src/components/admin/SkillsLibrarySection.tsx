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
  AlertCircle,
  Lock,
} from 'lucide-react'
import { useToast } from '../Toast'
import { useAuth } from '../../lib/auth'
import {
  fetchSkills,
  fetchSkillCategories,
  fetchDimensions,
  fetchSkillDomains,
  fetchLearnerProfileDomainsForSchool,
  attachDomainsToSkills,
  bulkAssignDomain,
  createSkill,
  updateSkill,
  deleteSkill,
  GRADE_OPTIONS,
  AGE_BAND_PRESETS,
  type SkillWithCompetencies,
  type SkillWithDomain,
} from '../../lib/skills-data'
import type { LearnerProfileDomain } from '../../types/learner-profile'
import {
  fetchCompetencyTree,
  type CompetencyTreeNode,
} from '../../lib/assignment-data'
import SmartSelect, { type SmartSelectOption } from '../SmartSelect'
import { supabase } from '../../lib/supabase'
import type { Dimension } from '../../types/database'

// ============================================================
// Skill Edit/Create Modal
// ============================================================

/** Map dimension category to a dot color for the dropdown */
const CATEGORY_COLORS: Record<string, string> = {
  'Academic': '#3b82f6',
  'Creative & Arts': '#a855f7',
  'Physical & Health': '#10b981',
  'Social & Emotional': '#f59e0b',
  'Cognitive': '#6366f1',
}

function SkillEditModal({
  open,
  skill,
  competencyTree,
  dimensions,
  learnerProfileDomains,
  categoryOptions,
  domainOptions,
  onClose,
  onSaved,
}: {
  open: boolean
  skill: SkillWithCompetencies | null // null = create mode
  competencyTree: CompetencyTreeNode[]
  dimensions: Dimension[]
  learnerProfileDomains: LearnerProfileDomain[]
  categoryOptions: SmartSelectOption[]
  domainOptions: SmartSelectOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const { profile } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [domain, setDomain] = useState('')
  /** V2: Learner Profile domain id (separate from the legacy `progression_domain` string). */
  const [domainId, setDomainId] = useState<string>('')
  const [ageBandStart, setAgeBandStart] = useState<string>('')
  const [ageBandEnd, setAgeBandEnd] = useState<string>('')
  const [ageBandPreset, setAgeBandPreset] = useState('')
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
      setDomain(skill.progression_domain || '')
      setDomainId(skill.domain_id || '')
      setAgeBandStart(skill.age_band_start !== null ? String(skill.age_band_start) : '')
      setAgeBandEnd(skill.age_band_end !== null ? String(skill.age_band_end) : '')
      setMinGrade(skill.min_grade || '')
      setMaxGrade(skill.max_grade || '')
      setSelectedCompetencies(new Set(skill.competencies.map((c) => c.id)))
      // Check if current min/max matches a preset
      const match = AGE_BAND_PRESETS.find(
        (p) => p.min === (skill.min_grade || '') && p.max === (skill.max_grade || '')
      )
      setAgeBandPreset(match ? match.label : (skill.min_grade || skill.max_grade) ? 'custom' : '')
    } else if (open) {
      setName('')
      setDescription('')
      setCategory('')
      setDomain('')
      setDomainId('')
      setAgeBandStart('')
      setAgeBandEnd('')
      setAgeBandPreset('')
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

  function handleAgeBandChange(value: string) {
    setAgeBandPreset(value)
    if (value === 'custom' || value === '') {
      if (value === '') {
        setMinGrade('')
        setMaxGrade('')
      }
      return
    }
    const preset = AGE_BAND_PRESETS.find((p) => p.label === value)
    if (preset) {
      setMinGrade(preset.min)
      setMaxGrade(preset.max)
    }
  }

  /** Create a new category value — just returns the string (no DB insert needed, categories are freeform on skills) */
  async function handleCreateCategory(input: string): Promise<string> {
    return input
  }

  /** Create a new domain — creates a dimension in the learner profile */
  async function handleCreateDomain(input: string): Promise<string> {
    if (!profile?.school_id) throw new Error('No school')
    // Insert as a new dimension
    const { data, error } = await supabase
      .from('dimensions')
      .insert({
        school_id: profile.school_id,
        name: input.trim(),
        category: 'Academic',
        display_order: dimensions.length,
        is_active: true,
        visible_to_family: true,
      })
      .select('id, name')
      .single()
    if (error) throw error
    toast(`Domain "${data.name}" created`, 'success')
    // Return the name as the value (domain is stored as a string on skills)
    return data.name
  }

  async function handleSave() {
    if (!name.trim() || !profile?.school_id) return

    const parsedAgeStart = ageBandStart.trim() === '' ? null : Number(ageBandStart)
    const parsedAgeEnd = ageBandEnd.trim() === '' ? null : Number(ageBandEnd)
    if (
      (parsedAgeStart !== null && Number.isNaN(parsedAgeStart)) ||
      (parsedAgeEnd !== null && Number.isNaN(parsedAgeEnd))
    ) {
      toast('Age band values must be numbers', 'error')
      return
    }
    if (parsedAgeStart !== null && parsedAgeEnd !== null && parsedAgeStart > parsedAgeEnd) {
      toast('Age band start must be ≤ end', 'error')
      return
    }

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
            progression_domain: domain.trim() || null,
            domain_id: domainId || null,
            age_band_start: parsedAgeStart,
            age_band_end: parsedAgeEnd,
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
            progression_domain: domain.trim() || null,
            domain_id: domainId || null,
            age_band_start: parsedAgeStart,
            age_band_end: parsedAgeEnd,
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

  // Build age-band options for SmartSelect
  const ageBandOptions: SmartSelectOption[] = [
    ...AGE_BAND_PRESETS.map((p) => ({ value: p.label, label: p.label })),
    { value: 'custom', label: 'Custom range' },
  ]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-modal relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
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

          {/* V2: Learner Profile Domain (FK to learner_profile_domains) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Learner Profile Domain
              {!domainId && (
                <span className="ml-1 font-normal text-amber-600">— unmapped</span>
              )}
            </label>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              <option value="">— Not mapped —</option>
              {learnerProfileDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-light">
              Tags this skill to a domain on the school&apos;s active Learner Profile.
            </p>
          </div>

          {/* V2: Age band */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-light">
              Expected for ages <span className="font-normal text-text-light">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={25}
                value={ageBandStart}
                onChange={(e) => setAgeBandStart(e.target.value)}
                placeholder="from"
                className="w-24 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <span className="text-xs text-text-muted">to</span>
              <input
                type="number"
                min={0}
                max={25}
                value={ageBandEnd}
                onChange={(e) => setAgeBandEnd(e.target.value)}
                placeholder="to"
                className="w-24 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <span className="text-xs text-text-muted">years old</span>
            </div>
          </div>

          {/* Legacy free-text domain (kept for backwards compatibility with existing data) */}
          <SmartSelect
            value={domain}
            onChange={setDomain}
            options={domainOptions}
            label="Legacy domain (free text)"
            optional
            placeholder="Select a domain…"
            allowCreate
            onCreateNew={handleCreateDomain}
            createPlaceholder="New domain name…"
          />

          {/* Category */}
          <SmartSelect
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            label="Category"
            optional
            placeholder="Select a category…"
            allowCreate
            onCreateNew={handleCreateCategory}
            createPlaceholder="New category name…"
          />

          {/* Age band */}
          <SmartSelect
            value={ageBandPreset}
            onChange={handleAgeBandChange}
            options={ageBandOptions}
            label="Age Band"
            optional
            placeholder="Select an age range…"
          />

          {/* Custom grade range (shown when "Custom" is selected) */}
          {ageBandPreset === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-light">
                  Min Grade
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
                  Max Grade
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
          )}

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
  const { profile, isSystemAdmin } = useAuth()
  const { toast } = useToast()

  const [skills, setSkills] = useState<SkillWithDomain[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [dims, setDims] = useState<Dimension[]>([])
  const [skillDomains, setSkillDomains] = useState<string[]>([])
  const [learnerProfileDomains, setLearnerProfileDomains] = useState<LearnerProfileDomain[]>([])
  const [competencyTree, setCompetencyTree] = useState<CompetencyTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState<string>('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editSkill, setEditSkill] = useState<SkillWithCompetencies | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Bulk-assign UI state for the unmapped-skills banner
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDomainId, setBulkDomainId] = useState<string>('')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile?.school_id) return
    setLoading(true)
    try {
      const [skillsData, cats, tree, dimsData, domainsData, lpDomains] = await Promise.all([
        fetchSkills(profile.school_id),
        fetchSkillCategories(profile.school_id),
        fetchCompetencyTree(profile.school_id),
        fetchDimensions(profile.school_id),
        fetchSkillDomains(profile.school_id),
        fetchLearnerProfileDomainsForSchool(profile.school_id),
      ])
      const enriched = await attachDomainsToSkills(skillsData)
      setSkills(enriched)
      setCategories(cats)
      setCompetencyTree(tree)
      setDims(dimsData)
      setSkillDomains(domainsData)
      setLearnerProfileDomains(lpDomains)
    } catch {
      toast('Failed to load skills', 'error')
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, toast])

  // Build domain options: dimensions first, then any freeform domains not already covered
  const domainOptions: SmartSelectOption[] = (() => {
    const dimNames = new Set(dims.map((d) => d.name))
    const fromDims: SmartSelectOption[] = dims.map((d) => ({
      value: d.name,
      label: d.name,
      color: CATEGORY_COLORS[d.category] || '#94a3b8',
      detail: d.category,
    }))
    const fromSkills: SmartSelectOption[] = skillDomains
      .filter((name) => !dimNames.has(name))
      .map((name) => ({ value: name, label: name }))
    return [...fromDims, ...fromSkills]
  })()

  // Build category options from existing categories
  const categoryOptions: SmartSelectOption[] = categories.map((c) => ({
    value: c,
    label: c,
  }))

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
    if (domainFilter) {
      if (domainFilter === '__unmapped__') {
        if (s.domain_id) return false
      } else if (s.domain_id !== domainFilter) {
        return false
      }
    }
    if (ageFilter !== '') {
      const age = Number(ageFilter)
      if (!Number.isNaN(age)) {
        const start = s.age_band_start ?? Number.NEGATIVE_INFINITY
        const end = s.age_band_end ?? Number.POSITIVE_INFINITY
        if (age < start || age > end) return false
      }
    }
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

  // Skills with no Learner Profile domain — surfaced via the admin banner.
  const unmappedSkills = skills.filter((s) => !s.domain_id)

  function toggleBulkSelected(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllUnmapped() {
    setBulkSelected(new Set(unmappedSkills.map((s) => s.id)))
  }

  async function handleBulkAssign() {
    if (bulkSelected.size === 0 || !bulkDomainId) {
      toast('Pick a domain and at least one skill', 'error')
      return
    }
    setBulkSaving(true)
    try {
      await bulkAssignDomain([...bulkSelected], bulkDomainId)
      toast(`Mapped ${bulkSelected.size} skill${bulkSelected.size === 1 ? '' : 's'}`, 'success')
      setBulkOpen(false)
      setBulkSelected(new Set())
      setBulkDomainId('')
      loadData()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk assign failed', 'error')
    } finally {
      setBulkSaving(false)
    }
  }

  // Group by category
  const grouped = filtered.reduce<Record<string, SkillWithDomain[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const groupedCategories = Object.keys(grouped).sort()

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
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
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">All domains</option>
          <option value="__unmapped__">Unmapped</option>
          {learnerProfileDomains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={25}
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value)}
          placeholder="Age"
          aria-label="Filter by learner age"
          className="w-20 rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
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

      {/* Unmapped skills admin banner */}
      {unmappedSkills.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {unmappedSkills.length} skill{unmappedSkills.length === 1 ? ' is' : 's are'} not yet mapped to a Learner Profile domain
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                Map them so they show up on the amoeba and in domain-filtered views.
              </p>
              {!bulkOpen ? (
                <button
                  onClick={() => {
                    setBulkOpen(true)
                    selectAllUnmapped()
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Bulk-assign domain
                </button>
              ) : (
                <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-text-muted">Assign to:</span>
                    <select
                      value={bulkDomainId}
                      onChange={(e) => setBulkDomainId(e.target.value)}
                      className="rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    >
                      <option value="">— Pick a domain —</option>
                      {learnerProfileDomains.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <span className="ml-auto text-[11px] text-text-light">
                      {bulkSelected.size} selected
                    </span>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {unmappedSkills.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(s.id)}
                          onChange={() => toggleBulkSelected(s.id)}
                        />
                        <span className="flex-1 truncate text-text">{s.name}</span>
                        {s.is_baseline && (
                          <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[9px] font-medium text-text-light">
                            Baseline
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setBulkOpen(false)
                        setBulkSelected(new Set())
                        setBulkDomainId('')
                      }}
                      disabled={bulkSaving}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkAssign}
                      disabled={bulkSaving || !bulkDomainId || bulkSelected.size === 0}
                      className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                {grouped[cat].map((skill) => {
                  const canMutate = !skill.is_baseline || isSystemAdmin
                  return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-4 rounded-xl border border-bg-muted bg-bg-card px-4 py-3 transition-colors hover:border-primary-200"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <Tag className="h-4 w-4 text-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text">{skill.name}</p>
                        {skill.domain ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: skill.domain.color ?? '#94A3B8' }}
                          >
                            {skill.domain.name}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Unmapped
                          </span>
                        )}
                        {skill.is_baseline && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-white">
                            <Lock className="h-2.5 w-2.5" />
                            Baseline
                          </span>
                        )}
                        {skill.is_default && !skill.is_baseline && (
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
                        {(skill.age_band_start !== null || skill.age_band_end !== null) && (
                          <span className="rounded-full bg-bg-muted px-1.5 py-0.5 text-[9px] text-text-light">
                            ages {skill.age_band_start ?? '?'}–{skill.age_band_end ?? '?'}
                          </span>
                        )}
                        {(skill.min_grade || skill.max_grade) && (
                          <span className="rounded-full bg-bg-muted px-1.5 py-0.5 text-[9px] text-text-light">
                            {skill.min_grade || '?'}–{skill.max_grade || '?'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canMutate ? (
                        <>
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
                        </>
                      ) : (
                        <span
                          className="rounded-lg p-2 text-text-light"
                          title="Baseline skills are managed by system admins"
                        >
                          <Lock className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      <SkillEditModal
        open={showCreate}
        skill={editSkill}
        competencyTree={competencyTree}
        dimensions={dims}
        learnerProfileDomains={learnerProfileDomains}
        categoryOptions={categoryOptions}
        domainOptions={domainOptions}
        onClose={() => { setShowCreate(false); setEditSkill(null) }}
        onSaved={loadData}
      />
    </div>
  )
}

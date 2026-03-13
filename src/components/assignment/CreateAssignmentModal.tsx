import { useState, useEffect, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import {
  X,
  Loader2,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  Users,
  User,
  BookOpen,
  Sparkles,
  Tag,
  Plus,
} from 'lucide-react'
import { useToast } from '../Toast'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  createAssignment,
  fetchCompetencyTree,
  fetchClassroomStudents,
  type CompetencyTreeNode,
} from '../../lib/assignment-data'
import {
  fetchSkills,
  fetchSkillsByCompetencies,
  createSkill,
  type SkillWithCompetencies,
} from '../../lib/skills-data'
import type {
  Classroom,
  Student,
  AssignmentType,
  AssignmentTemplate,
} from '../../types/database'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  /** Pre-select a classroom */
  classroomId?: string
  /** Pre-select a student (for individual assignment) */
  studentId?: string
  /** Pre-fill from a saved template */
  template?: AssignmentTemplate | null
}

// ============================================================
// Competency Picker sub-component
// ============================================================

function CompetencyPicker({
  tree,
  selected,
  onToggle,
  search,
}: {
  tree: CompetencyTreeNode[]
  selected: Set<string>
  onToggle: (id: string) => void
  search: string
}) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [expandedSubdomains, setExpandedSubdomains] = useState<Set<string>>(new Set())

  const toggleDomain = (id: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSubdomain = (id: string) => {
    setExpandedSubdomains((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const lowerSearch = search.toLowerCase()

  return (
    <div className="space-y-1">
      {tree.map(({ domain, subdomains }) => {
        // Filter by search
        const filteredSubdomains = subdomains
          .map((sd) => ({
            ...sd,
            competencies: sd.competencies.filter(
              (c) =>
                !search ||
                c.name.toLowerCase().includes(lowerSearch) ||
                c.code.toLowerCase().includes(lowerSearch) ||
                (c.objective || '').toLowerCase().includes(lowerSearch)
            ),
          }))
          .filter((sd) => sd.competencies.length > 0)

        if (filteredSubdomains.length === 0) return null

        const domainExpanded = expandedDomains.has(domain.id) || !!search

        return (
          <div key={domain.id} className="rounded-lg border border-bg-muted">
            <button
              onClick={() => toggleDomain(domain.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-bg"
            >
              {domainExpanded
                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-light" />
                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-light" />}
              <span className="flex-1 text-xs font-semibold text-text">{domain.name}</span>
              <span className="text-[10px] text-text-light">
                {filteredSubdomains.reduce((s, sd) => s + sd.competencies.length, 0)}
              </span>
            </button>

            {domainExpanded && (
              <div className="border-t border-bg-muted px-2 py-1.5 space-y-1">
                {filteredSubdomains.map(({ subdomain, competencies }) => {
                  const sdExpanded = expandedSubdomains.has(subdomain.id) || !!search

                  return (
                    <div key={subdomain.id}>
                      <button
                        onClick={() => toggleSubdomain(subdomain.id)}
                        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-bg-muted"
                      >
                        {sdExpanded
                          ? <ChevronDown className="h-3 w-3 shrink-0 text-text-light" />
                          : <ChevronRight className="h-3 w-3 shrink-0 text-text-light" />}
                        <span className="flex-1 text-[11px] font-medium text-text-muted">
                          {subdomain.name}
                        </span>
                      </button>

                      {sdExpanded && (
                        <div className="ml-4 space-y-0.5 py-0.5">
                          {competencies.map((comp) => {
                            const isSelected = selected.has(comp.id)
                            return (
                              <button
                                key={comp.id}
                                onClick={() => onToggle(comp.id)}
                                className={clsx(
                                  'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                                  isSelected
                                    ? 'bg-primary-50 ring-1 ring-primary-200'
                                    : 'hover:bg-bg'
                                )}
                              >
                                <div
                                  className={clsx(
                                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                    isSelected
                                      ? 'border-primary-500 bg-primary-500'
                                      : 'border-bg-muted'
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-primary-700">
                                      {comp.code}
                                    </span>
                                    <span className="truncate text-[11px] text-text">
                                      {comp.name}
                                    </span>
                                  </div>
                                  {comp.objective && (
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-text-light line-clamp-2">
                                      {comp.objective}
                                    </p>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Skill Picker sub-component
// ============================================================

function SkillPicker({
  skills,
  selected,
  onToggle,
  suggestedIds,
  onAddAll,
  search,
  onSearch,
  onQuickCreate,
  creating,
}: {
  skills: SkillWithCompetencies[]
  selected: Set<string>
  onToggle: (id: string) => void
  suggestedIds: Set<string>
  onAddAll: () => void
  search: string
  onSearch: (s: string) => void
  onQuickCreate: (name: string) => void
  creating: boolean
}) {
  const [quickName, setQuickName] = useState('')

  const lowerSearch = search.toLowerCase()
  const filtered = skills.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(lowerSearch) ||
      (s.description || '').toLowerCase().includes(lowerSearch) ||
      (s.category || '').toLowerCase().includes(lowerSearch)
  )

  // Group by category
  const grouped = filtered.reduce<Record<string, SkillWithCompetencies[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  // Unselected suggested skills
  const unselectedSuggested = skills.filter(
    (s) => suggestedIds.has(s.id) && !selected.has(s.id)
  )

  return (
    <div className="space-y-2">
      {/* Auto-suggestion banner */}
      {unselectedSuggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] font-medium text-amber-700 mr-1">Suggested:</span>
          {unselectedSuggested.slice(0, 6).map((s) => (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className="flex items-center gap-0.5 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <Plus className="h-2.5 w-2.5" />
              {s.name}
            </button>
          ))}
          {unselectedSuggested.length > 1 && (
            <button
              onClick={onAddAll}
              className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800 transition-colors hover:bg-amber-300"
            >
              Add all
            </button>
          )}
        </div>
      )}

      {/* Selected chips */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {Array.from(selected).map((id) => {
            const skill = skills.find((s) => s.id === id)
            if (!skill) return null
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-200"
              >
                {skill.name}
                <X className="h-2.5 w-2.5" />
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search skills..."
          className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-8 pr-3 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </div>

      {/* Category-grouped list */}
      <div className="max-h-48 overflow-y-auto space-y-2">
        {categories.length === 0 && (
          <p className="py-3 text-center text-xs text-text-light">No skills found</p>
        )}
        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-light">
              {cat}
            </p>
            <div className="space-y-0.5">
              {grouped[cat].map((skill) => {
                const isSelected = selected.has(skill.id)
                return (
                  <button
                    key={skill.id}
                    onClick={() => onToggle(skill.id)}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      isSelected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-bg'
                    )}
                  >
                    <div
                      className={clsx(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-bg-muted'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-text">{skill.name}</span>
                      {skill.competencies.length > 0 && (
                        <span className="ml-1.5 text-[9px] text-text-light">
                          ({skill.competencies.map((c) => c.code).join(', ')})
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick-create */}
      <div className="flex items-center gap-2 border-t border-bg-muted pt-2">
        <input
          type="text"
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && quickName.trim()) {
              onQuickCreate(quickName.trim())
              setQuickName('')
            }
          }}
          placeholder="Quick-add a new skill..."
          className="flex-1 rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        <button
          onClick={() => {
            if (quickName.trim()) {
              onQuickCreate(quickName.trim())
              setQuickName('')
            }
          }}
          disabled={!quickName.trim() || creating}
          className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function CreateAssignmentModal({
  open,
  onClose,
  onCreated,
  classroomId: defaultClassroomId,
  studentId: defaultStudentId,
  template,
}: Props) {
  const { toast } = useToast()
  const { profile } = useAuth()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(
    defaultStudentId ? 'individual' : 'class'
  )
  const [classroomId, setClassroomId] = useState(defaultClassroomId || '')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    defaultStudentId ? new Set([defaultStudentId]) : new Set()
  )
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set())
  const [competencySearch, setCompetencySearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [skillSearch, setSkillSearch] = useState('')
  const [skillsExpanded, setSkillsExpanded] = useState(false)

  // Data state
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [competencyTree, setCompetencyTree] = useState<CompetencyTreeNode[]>([])
  const [allSkills, setAllSkills] = useState<SkillWithCompetencies[]>([])
  const [suggestedSkillIds, setSuggestedSkillIds] = useState<Set<string>>(new Set())
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset on open (pre-fill from template if provided)
  useEffect(() => {
    if (open) {
      setTitle(template?.title ?? '')
      setDescription(template?.description ?? '')
      setDueDate('')
      setAssignmentType(
        defaultStudentId
          ? 'individual'
          : template?.assignment_type ?? 'class'
      )
      setClassroomId(defaultClassroomId || '')
      setSelectedStudents(defaultStudentId ? new Set([defaultStudentId]) : new Set())
      setSelectedCompetencies(
        template?.competency_ids?.length
          ? new Set(template.competency_ids)
          : new Set()
      )
      setCompetencySearch('')
      setSelectedSkills(
        template?.skill_ids?.length
          ? new Set(template.skill_ids)
          : new Set()
      )
      setSkillSearch('')
      setSkillsExpanded(!!template?.skill_ids?.length)
      setSuggestedSkillIds(new Set())
    }
  }, [open, defaultClassroomId, defaultStudentId, template])

  // Load classrooms, competency tree, and skills
  useEffect(() => {
    if (!open || !profile?.school_id) return

    setLoading(true)

    Promise.all([
      supabase
        .from('classrooms')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('name'),
      fetchCompetencyTree(profile.school_id),
      fetchSkills(profile.school_id),
    ]).then(([classroomRes, tree, skills]) => {
      setClassrooms(classroomRes.data || [])
      setCompetencyTree(tree)
      setAllSkills(skills)
      setLoading(false)
    }).catch(() => {
      toast('Failed to load data', 'error')
      setLoading(false)
    })
  }, [open, profile?.school_id, toast])

  // Auto-suggest skills when competencies change
  useEffect(() => {
    if (!profile?.school_id || selectedCompetencies.size === 0) {
      setSuggestedSkillIds(new Set())
      return
    }

    fetchSkillsByCompetencies(profile.school_id, Array.from(selectedCompetencies))
      .then((suggested) => {
        setSuggestedSkillIds(new Set(suggested.map((s) => s.id)))
        // Auto-expand skills section when there are suggestions
        if (suggested.length > 0) setSkillsExpanded(true)
      })
      .catch(() => {/* ignore */})
  }, [profile?.school_id, selectedCompetencies])

  // Load students when classroom changes
  useEffect(() => {
    if (!classroomId) {
      setStudents([])
      return
    }

    fetchClassroomStudents(classroomId)
      .then(setStudents)
      .catch(() => setStudents([]))
  }, [classroomId])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, submitting])

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── Handlers ───────────────────────────────────────────

  const toggleCompetency = useCallback((id: string) => {
    setSelectedCompetencies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleStudent = useCallback((id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const addAllSuggestedSkills = useCallback(() => {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      suggestedSkillIds.forEach((id) => next.add(id))
      return next
    })
  }, [suggestedSkillIds])

  const handleQuickCreateSkill = useCallback(async (name: string) => {
    if (!profile?.school_id) return
    setCreatingSkill(true)
    try {
      const skillId = await createSkill({
        school_id: profile.school_id,
        name,
        description: null,
        category: null,
        min_grade: null,
        max_grade: null,
        is_default: false,
        created_by: profile.id,
      })
      // Re-fetch skills to include the new one
      const updated = await fetchSkills(profile.school_id)
      setAllSkills(updated)
      // Auto-select the new skill
      setSelectedSkills((prev) => new Set(prev).add(skillId))
      toast(`Skill "${name}" created`, 'success')
    } catch {
      toast('Failed to create skill', 'error')
    } finally {
      setCreatingSkill(false)
    }
  }, [profile?.school_id, profile?.id, toast])

  const studentIds = useMemo(() => {
    if (assignmentType === 'class') {
      return students.map((s) => s.id)
    }
    return Array.from(selectedStudents)
  }, [assignmentType, students, selectedStudents])

  const canSubmit =
    title.trim() &&
    selectedCompetencies.size > 0 &&
    studentIds.length > 0 &&
    classroomId &&
    !submitting

  async function handleSubmit() {
    if (!canSubmit || !profile) return

    setSubmitting(true)
    try {
      await createAssignment(
        {
          school_id: profile.school_id,
          classroom_id: classroomId,
          teacher_id: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          assignment_type: assignmentType,
          status: 'active',
        },
        Array.from(selectedCompetencies),
        studentIds,
        selectedSkills.size > 0 ? Array.from(selectedSkills) : undefined
      )
      toast('Assignment created', 'success')
      onCreated()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create assignment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">Create Assignment</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-light">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ecosystem Research Project"
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
                  placeholder="What students will do..."
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>

              {/* Due date + Assignment type row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-light">
                    Due Date <span className="font-normal text-text-light">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-light">
                    Assign To
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAssignmentType('class')}
                      className={clsx(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        assignmentType === 'class'
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-bg-muted text-text-muted hover:bg-bg'
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Class
                    </button>
                    <button
                      onClick={() => setAssignmentType('individual')}
                      className={clsx(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        assignmentType === 'individual'
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-bg-muted text-text-muted hover:bg-bg'
                      )}
                    >
                      <User className="h-3.5 w-3.5" />
                      Individual
                    </button>
                  </div>
                </div>
              </div>

              {/* Classroom selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-light">
                  Classroom
                </label>
                <select
                  value={classroomId}
                  onChange={(e) => {
                    setClassroomId(e.target.value)
                    setSelectedStudents(new Set())
                  }}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="">Select a classroom...</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.grade_level ? ` (${c.grade_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student selector (individual mode) */}
              {assignmentType === 'individual' && classroomId && students.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text-light">
                    Select Students ({selectedStudents.size} selected)
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-bg-muted bg-bg p-2 space-y-0.5">
                    {students.map((s) => {
                      const isSelected = selectedStudents.has(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleStudent(s.id)}
                          className={clsx(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                            isSelected ? 'bg-primary-50' : 'hover:bg-bg-muted'
                          )}
                        >
                          <div
                            className={clsx(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              isSelected
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-bg-muted'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-xs text-text">
                            {s.first_name} {s.last_name}
                          </span>
                          {s.grade_level && (
                            <span className="text-[10px] text-text-light">
                              Grade {s.grade_level}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Class assignment info */}
              {assignmentType === 'class' && classroomId && students.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2">
                  <Users className="h-4 w-4 text-primary-600" />
                  <span className="text-xs text-primary-700">
                    Will be assigned to all {students.length} active students in this classroom
                  </span>
                </div>
              )}

              {/* Competency picker */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-light">
                    Linked Competencies ({selectedCompetencies.size} selected)
                  </label>
                </div>

                {competencyTree.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-bg-muted bg-bg px-4 py-8 text-center">
                    <BookOpen className="h-5 w-5 text-text-light" />
                    <p className="text-xs text-text-muted">
                      No competency framework uploaded yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
                      <input
                        type="text"
                        value={competencySearch}
                        onChange={(e) => setCompetencySearch(e.target.value)}
                        placeholder="Search competencies..."
                        className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-8 pr-3 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      />
                    </div>

                    {/* Selected chips */}
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

                    {/* Tree */}
                    <div className="max-h-60 overflow-y-auto">
                      <CompetencyPicker
                        tree={competencyTree}
                        selected={selectedCompetencies}
                        onToggle={toggleCompetency}
                        search={competencySearch}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Skills picker (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setSkillsExpanded(!skillsExpanded)}
                  className="mb-1.5 flex w-full items-center gap-2 text-left"
                >
                  {skillsExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-text-light" />
                    : <ChevronRight className="h-3.5 w-3.5 text-text-light" />}
                  <Tag className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-text-light">
                    Skills{selectedSkills.size > 0 ? ` (${selectedSkills.size} selected)` : ''}
                  </span>
                  <span className="text-[10px] text-text-light">(optional)</span>
                </button>

                {skillsExpanded && (
                  <div className="rounded-lg border border-bg-muted bg-bg p-3">
                    {allSkills.length === 0 ? (
                      <p className="py-3 text-center text-xs text-text-light">
                        No skills in the library yet. Use quick-add below or ask your admin to set them up.
                      </p>
                    ) : (
                      <SkillPicker
                        skills={allSkills}
                        selected={selectedSkills}
                        onToggle={toggleSkill}
                        suggestedIds={suggestedSkillIds}
                        onAddAll={addAllSuggestedSkills}
                        search={skillSearch}
                        onSearch={setSkillSearch}
                        onQuickCreate={handleQuickCreateSkill}
                        creating={creatingSkill}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-bg-muted px-5 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            Create Assignment
          </button>
        </div>
      </div>
    </div>
  )
}

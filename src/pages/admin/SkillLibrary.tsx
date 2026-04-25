/**
 * SkillLibrary.tsx
 * Admin page for managing the school's skill library.
 * Seed defaults, browse/edit skills, manage progression steps,
 * and create custom skills.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useActiveSchoolId } from '../../lib/school-context'
import { useToast } from '../../components/Toast'
import {
  fetchAssessableSkills,
  fetchSkillWithProgression,
  updateProgressionStep,
  addProgressionStep,
  deleteProgressionStep,
  createSkillWithProgression,
} from '../../lib/skill-progression-data'
import { seedDefaultSkillProgressions, importCustomProgression } from '../../lib/seed-skill-progressions'
import { GRADE_OPTIONS } from '../../lib/skills-data'
import type {
  SkillWithProgression,
  SkillProgressionStepInsert,
  SkillInsert,
} from '../../types/database'
import {
  Loader2,
  Search,
  Plus,
  Target,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Upload,
  Check,
  X,
  Database,
} from 'lucide-react'
import { usePageAccess } from '../../lib/role-permissions'
import { clsx } from 'clsx'

// ============================================================
// Framework options for seeding
// ============================================================

const SEED_FRAMEWORKS: { id: 'ccss_math' | 'ccss_ela' | 'casel'; label: string; description: string }[] = [
  { id: 'ccss_math', label: 'Common Core Math (K-8)', description: '262 standards with grade-level expectations' },
  { id: 'ccss_ela', label: 'Common Core ELA (K-5)', description: '471 standards across 6 strands' },
  { id: 'casel', label: 'CASEL SEL', description: '40 social-emotional learning standards with grade band progressions' },
]

// ============================================================
// Main component
// ============================================================

export default function SkillLibrary() {
  const schoolId = useActiveSchoolId()
  const { toast } = useToast()
  const { canEdit } = usePageAccess('skill-library')

  // Data
  const [skills, setSkills] = useState<SkillWithProgression[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [framework, setFramework] = useState('')
  const [domain, setDomain] = useState('')

  // UI states
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)
  const [expandedSkillData, setExpandedSkillData] = useState<SkillWithProgression | null>(null)
  const [expandedLoading, setExpandedLoading] = useState(false)

  // Seeding
  const [showSeedDialog, setShowSeedDialog] = useState(false)
  const [seedFrameworks, setSeedFrameworks] = useState<Set<'ccss_math' | 'ccss_ela' | 'casel'>>(new Set())
  const [seeding, setSeeding] = useState(false)

  // Create custom skill
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('')
  const [newSkillDomain, setNewSkillDomain] = useState('')
  const [newSkillStrand, setNewSkillStrand] = useState('')

  // Step editing
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editStepDesc, setEditStepDesc] = useState('')
  const [editStepExamples, setEditStepExamples] = useState('')
  const [savingStep, setSavingStep] = useState(false)

  // Adding step
  const [addingStepSkillId, setAddingStepSkillId] = useState<string | null>(null)
  const [newStepGrade, setNewStepGrade] = useState('')
  const [newStepDesc, setNewStepDesc] = useState('')
  const [addingStep, setAddingStep] = useState(false)

  // Load skills
  const loadSkills = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await fetchAssessableSkills(schoolId, {
        sourceFramework: framework || undefined,
        domain: domain || undefined,
        search: search || undefined,
      })
      setSkills(data)
    } catch {
      toast('Failed to load skills', 'error')
    } finally {
      setLoading(false)
    }
  }, [schoolId, framework, domain, search, toast])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // Available domains
  const domains = useMemo(() => {
    const set = new Set<string>()
    skills.forEach((s) => {
      if (s.progression_domain) set.add(s.progression_domain)
    })
    return [...set].sort()
  }, [skills])

  // Expand skill to show progression
  async function handleExpandSkill(skillId: string) {
    if (expandedSkillId === skillId) {
      setExpandedSkillId(null)
      setExpandedSkillData(null)
      return
    }

    setExpandedSkillId(skillId)
    if (!schoolId) return

    setExpandedLoading(true)
    try {
      const data = await fetchSkillWithProgression(skillId, schoolId)
      setExpandedSkillData(data)
    } catch {
      toast('Failed to load progression', 'error')
    } finally {
      setExpandedLoading(false)
    }
  }

  // Seed defaults
  async function handleSeed() {
    if (!schoolId || seedFrameworks.size === 0) return
    setSeeding(true)
    try {
      const result = await seedDefaultSkillProgressions(schoolId, [...seedFrameworks])
      toast(`Created ${result.skillsCreated} skills with ${result.stepsCreated} steps`, 'success')
      setShowSeedDialog(false)
      setSeedFrameworks(new Set())
      loadSkills()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Seeding failed', 'error')
    } finally {
      setSeeding(false)
    }
  }

  // Toggle seed framework selection
  function toggleSeedFramework(fw: 'ccss_math' | 'ccss_ela' | 'casel') {
    setSeedFrameworks((prev) => {
      const next = new Set(prev)
      if (next.has(fw)) next.delete(fw)
      else next.add(fw)
      return next
    })
  }

  // Create custom skill
  async function handleCreateSkill() {
    if (!schoolId || !newSkillName.trim()) return
    setCreating(true)
    try {
      const skill: SkillInsert = {
        school_id: schoolId,
        name: newSkillName.trim(),
        description: null,
        category: newSkillCategory.trim() || null,
        is_assessable: true,
        source_framework: 'custom',
        progression_domain: newSkillDomain.trim() || null,
        progression_strand: newSkillStrand.trim() || null,
      }

      await createSkillWithProgression(skill, [])
      toast(`Skill "${newSkillName}" created`, 'success')
      setShowCreateForm(false)
      setNewSkillName('')
      setNewSkillCategory('')
      setNewSkillDomain('')
      setNewSkillStrand('')
      loadSkills()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create skill', 'error')
    } finally {
      setCreating(false)
    }
  }

  // Save step edit
  async function handleSaveStep(stepId: string) {
    setSavingStep(true)
    try {
      await updateProgressionStep(stepId, {
        expectation_description: editStepDesc,
        example_tasks: editStepExamples || null,
      })
      toast('Step updated', 'success')
      setEditingStep(null)
      // Refresh expanded skill
      if (expandedSkillId && schoolId) {
        const data = await fetchSkillWithProgression(expandedSkillId, schoolId)
        setExpandedSkillData(data)
      }
    } catch {
      toast('Failed to update step', 'error')
    } finally {
      setSavingStep(false)
    }
  }

  // Add new step
  async function handleAddStep() {
    if (!addingStepSkillId || !schoolId || !newStepGrade || !newStepDesc.trim()) return
    setAddingStep(true)
    try {
      const stepData: SkillProgressionStepInsert = {
        skill_id: addingStepSkillId,
        school_id: schoolId,
        grade_level: newStepGrade,
        expectation_description: newStepDesc.trim(),
        example_tasks: null,
        prerequisite_step_id: null,
        competency_ids: [],
      }
      await addProgressionStep(stepData)
      toast('Step added', 'success')
      setAddingStepSkillId(null)
      setNewStepGrade('')
      setNewStepDesc('')
      // Refresh
      if (expandedSkillId && schoolId) {
        const data = await fetchSkillWithProgression(expandedSkillId, schoolId)
        setExpandedSkillData(data)
      }
    } catch {
      toast('Failed to add step', 'error')
    } finally {
      setAddingStep(false)
    }
  }

  // Delete step
  async function handleDeleteStep(stepId: string) {
    if (!confirm('Delete this progression step?')) return
    try {
      await deleteProgressionStep(stepId)
      toast('Step deleted', 'success')
      if (expandedSkillId && schoolId) {
        const data = await fetchSkillWithProgression(expandedSkillId, schoolId)
        setExpandedSkillData(data)
      }
    } catch {
      toast('Failed to delete step', 'error')
    }
  }

  // JSON import
  async function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !schoolId) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!Array.isArray(data)) {
        toast('Invalid format: expected an array', 'error')
        return
      }

      const result = await importCustomProgression(schoolId, data)
      toast(`Imported ${result.skillsCreated} skills with ${result.stepsCreated} steps`, 'success')
      loadSkills()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    }

    // Reset input
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Skill Library</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage assessable skills with grade-level progression steps.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowSeedDialog(true)}
              className="flex items-center gap-2 rounded-xl border border-bg-muted bg-bg-card px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-bg-muted"
            >
              <Database className="h-4 w-4" />
              Populate Library
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              New Skill
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
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
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">All Frameworks</option>
          <option value="ccss_math">Common Core Math</option>
          <option value="ccss_ela">Common Core ELA</option>
          <option value="casel">CASEL SEL</option>
          <option value="custom">Custom</option>
        </select>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Import JSON */}
      <div className="mb-4 flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-bg-muted px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-primary-300 hover:text-primary-600">
          <Upload className="h-3.5 w-3.5" />
          Import Custom JSON
          <input
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
        </label>
        <span className="text-xs text-text-light">
          {skills.length} skill{skills.length !== 1 ? 's' : ''} loaded
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && skills.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <Target className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">No assessable skills yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Populate the library with Common Core, CASEL, or custom frameworks.
            </p>
          </div>
          <button
            onClick={() => setShowSeedDialog(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
          >
            <Database className="h-4 w-4" />
            Populate Library
          </button>
        </div>
      )}

      {/* Skills list */}
      {!loading && skills.length > 0 && (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-xl border border-bg-muted bg-bg-card overflow-hidden">
              {/* Skill header */}
              <button
                onClick={() => handleExpandSkill(skill.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-muted/50"
              >
                {expandedSkillId === skill.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-text-light" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-light" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">{skill.name}</span>
                    {skill.source_standard_code && (
                      <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-light">
                        {skill.source_standard_code}
                      </span>
                    )}
                    <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-600">
                      {skill.source_framework}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                    {skill.progression_domain && <span>{skill.progression_domain}</span>}
                    {skill.progression_strand && <span>/ {skill.progression_strand}</span>}
                    <span>{skill.steps.length} step{skill.steps.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </button>

              {/* Expanded: progression steps */}
              {expandedSkillId === skill.id && (
                <div className="border-t border-bg-muted">
                  {expandedLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                    </div>
                  ) : expandedSkillData ? (
                    <div className="divide-y divide-bg-muted">
                      {expandedSkillData.steps.map((step) => (
                        <div key={step.id} className="px-4 py-3">
                          {editingStep === step.id ? (
                            // Editing mode
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-text-muted w-10">
                                  {step.grade_level}
                                </span>
                                <input
                                  type="text"
                                  value={editStepDesc}
                                  onChange={(e) => setEditStepDesc(e.target.value)}
                                  className="flex-1 rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text focus:border-primary-400 focus:outline-none"
                                />
                              </div>
                              <div className="ml-12">
                                <input
                                  type="text"
                                  value={editStepExamples}
                                  onChange={(e) => setEditStepExamples(e.target.value)}
                                  placeholder="Example tasks..."
                                  className="w-full rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                                />
                              </div>
                              <div className="ml-12 flex gap-2">
                                <button
                                  onClick={() => handleSaveStep(step.id)}
                                  disabled={savingStep}
                                  className="flex items-center gap-1 rounded bg-primary-500 px-2 py-1 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                                >
                                  {savingStep ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingStep(null)}
                                  className="flex items-center gap-1 rounded bg-bg-muted px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-muted/80"
                                >
                                  <X className="h-3 w-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-xs font-semibold text-text-muted w-10">
                                {step.grade_level}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-text">{step.expectation_description}</p>
                                {step.example_tasks && (
                                  <p className="mt-0.5 text-xs text-text-light italic">{step.example_tasks}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  onClick={() => {
                                    setEditingStep(step.id)
                                    setEditStepDesc(step.expectation_description)
                                    setEditStepExamples(step.example_tasks ?? '')
                                  }}
                                  className="rounded p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
                                  title="Edit"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStep(step.id)}
                                  className="rounded p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-600"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add step form */}
                      {addingStepSkillId === skill.id ? (
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={newStepGrade}
                              onChange={(e) => setNewStepGrade(e.target.value)}
                              className="w-20 rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text focus:border-primary-400 focus:outline-none"
                            >
                              <option value="">Grade</option>
                              {GRADE_OPTIONS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={newStepDesc}
                              onChange={(e) => setNewStepDesc(e.target.value)}
                              placeholder="Expectation description..."
                              className="flex-1 rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleAddStep}
                              disabled={addingStep || !newStepGrade || !newStepDesc.trim()}
                              className="flex items-center gap-1 rounded bg-primary-500 px-2 py-1 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                            >
                              {addingStep ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              Add
                            </button>
                            <button
                              onClick={() => setAddingStepSkillId(null)}
                              className="rounded bg-bg-muted px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-muted/80"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2">
                          <button
                            onClick={() => setAddingStepSkillId(skill.id)}
                            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Add progression step
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-xs text-text-muted">No data</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* Seed Dialog */}
      {/* ============================================================ */}
      {showSeedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-text">Populate Skill Library</h2>
            <p className="mt-1 text-sm text-text-muted">
              Select frameworks to import. Existing skills won&apos;t be duplicated.
            </p>

            <div className="mt-4 space-y-2">
              {SEED_FRAMEWORKS.map((fw) => (
                <label
                  key={fw.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 transition-colors',
                    seedFrameworks.has(fw.id) ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-bg-muted'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={seedFrameworks.has(fw.id)}
                    onChange={() => toggleSeedFramework(fw.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-text">{fw.label}</span>
                    <p className="text-xs text-text-muted">{fw.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowSeedDialog(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSeed}
                disabled={seeding || seedFrameworks.size === 0}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50"
              >
                {seeding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Populate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Create Custom Skill Form */}
      {/* ============================================================ */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-text">Create Custom Skill</h2>
            <p className="mt-1 text-sm text-text-muted">
              Define a new assessable skill. Add progression steps after creation.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text">Skill Name *</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g., Written Communication"
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text">Category</label>
                <input
                  type="text"
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  placeholder="e.g., Communication"
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">Domain</label>
                  <input
                    type="text"
                    value={newSkillDomain}
                    onChange={(e) => setNewSkillDomain(e.target.value)}
                    placeholder="e.g., Writing"
                    className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">Strand</label>
                  <input
                    type="text"
                    value={newSkillStrand}
                    onChange={(e) => setNewSkillStrand(e.target.value)}
                    placeholder="e.g., Narrative"
                    className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSkill}
                disabled={creating || !newSkillName.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

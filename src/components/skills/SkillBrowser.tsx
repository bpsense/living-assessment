/**
 * SkillBrowser.tsx
 * Primary UI for educators to browse and select skills for assignment.
 * Shows skills grouped by grade zones (remediation / current / extension)
 * with domain grouping, search, and progression ladder expansion.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useActiveSchoolId } from '../../lib/school-context'
import { useToast } from '../Toast'
import {
  fetchAssessableSkills,
  fetchSkillsForGrade,
  getProgressionLadder,
} from '../../lib/skill-progression-data'
import {
  gradeToOrdinal,
  GRADE_OPTIONS,
} from '../../lib/skills-data'
import type {
  SkillWithProgression,
  SkillProgressionStep,
  GradeZone,
  Skill,
} from '../../types/database'
import { Lock } from 'lucide-react'
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  Filter,
  BookOpen,
  Plus,
} from 'lucide-react'
import { clsx } from 'clsx'

// ============================================================
// Types
// ============================================================

interface SkillBrowserProps {
  /** Called when educator clicks "Assign" on a skill step */
  onAssign?: (skill: Skill, step: SkillProgressionStep) => void
  /** Default grade level (auto-detected from classroom context) */
  defaultGrade?: string
  /** Whether to show the "Create Custom Skill" button */
  showCreateButton?: boolean
  onCreateCustom?: () => void
}

interface GradeGroupedSkills {
  zone: GradeZone
  grade: string
  skills: { skill: Skill; step: SkillProgressionStep }[]
}

const ZONE_CONFIG: Record<GradeZone, { label: string; color: string; bg: string; icon: typeof Target }> = {
  remediation: {
    label: 'Remediation',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    icon: ArrowDownLeft,
  },
  current: {
    label: 'Current Grade',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    icon: Target,
  },
  extension: {
    label: 'Extension',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    icon: ArrowUpRight,
  },
}

const FRAMEWORK_OPTIONS = [
  { value: '', label: 'All Frameworks' },
  { value: 'ccss_math', label: 'Common Core Math' },
  { value: 'ccss_ela', label: 'Common Core ELA' },
  { value: 'casel', label: 'CASEL SEL' },
  { value: 'custom', label: 'Custom' },
]

// ============================================================
// Main component
// ============================================================

export default function SkillBrowser({
  onAssign,
  defaultGrade,
  showCreateButton = true,
  onCreateCustom,
}: SkillBrowserProps) {
  const schoolId = useActiveSchoolId()
  const { toast } = useToast()

  // Filters
  const [search, setSearch] = useState('')
  const [framework, setFramework] = useState('')
  const [domain, setDomain] = useState('')
  /** V2: filter to skills whose age band includes this age. */
  const [age, setAge] = useState('')
  const [gradeLevel, setGradeLevel] = useState(defaultGrade ?? '')

  // Data
  const [skills, setSkills] = useState<SkillWithProgression[]>([])
  const [gradeResults, setGradeResults] = useState<{ zone: GradeZone; step: SkillProgressionStep; skill: Skill }[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [expandedZones, setExpandedZones] = useState<Set<GradeZone>>(new Set(['current']))
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [ladderSteps, setLadderSteps] = useState<SkillProgressionStep[]>([])
  const [ladderLoading, setLadderLoading] = useState(false)

  // Fetch data
  const loadSkills = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      if (gradeLevel) {
        // Fetch grade-filtered skills with zones
        const results = await fetchSkillsForGrade(schoolId, gradeLevel, {
          domain: domain || undefined,
        })
        setGradeResults(results)
        setSkills([])
      } else {
        // Fetch all assessable skills
        const data = await fetchAssessableSkills(schoolId, {
          sourceFramework: framework || undefined,
          domain: domain || undefined,
          search: search || undefined,
        })
        setSkills(data)
        setGradeResults([])
      }
    } catch {
      toast('Failed to load skills', 'error')
    } finally {
      setLoading(false)
    }
  }, [schoolId, gradeLevel, domain, framework, search, toast])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // Compute available domains from loaded data
  const domains = useMemo(() => {
    const domainSet = new Set<string>()
    if (gradeLevel && gradeResults.length > 0) {
      gradeResults.forEach((r) => {
        if (r.skill.progression_domain) domainSet.add(r.skill.progression_domain)
      })
    } else {
      skills.forEach((s) => {
        if (s.progression_domain) domainSet.add(s.progression_domain)
      })
    }
    return [...domainSet].sort()
  }, [skills, gradeResults, gradeLevel])

  // Group grade results by zone and grade
  const zoneGroups = useMemo((): GradeGroupedSkills[] => {
    if (!gradeLevel || gradeResults.length === 0) return []

    // Apply search filter client-side
    let filtered = gradeResults
    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.skill.name.toLowerCase().includes(lower) ||
          r.step.expectation_description.toLowerCase().includes(lower) ||
          (r.skill.progression_domain ?? '').toLowerCase().includes(lower)
      )
    }
    if (framework) {
      filtered = filtered.filter((r) => r.skill.source_framework === framework)
    }
    const ageNum = age === '' ? null : Number(age)
    if (ageNum !== null && !Number.isNaN(ageNum)) {
      filtered = filtered.filter((r) => skillMatchesAge(r.skill, ageNum))
    }

    // Group by zone, then by grade
    const groups = new Map<string, GradeGroupedSkills>()
    for (const r of filtered) {
      const key = `${r.zone}-${r.step.grade_level}`
      if (!groups.has(key)) {
        groups.set(key, {
          zone: r.zone,
          grade: r.step.grade_level,
          skills: [],
        })
      }
      groups.get(key)!.skills.push({ skill: r.skill, step: r.step })
    }

    // Sort groups: current first, then remediation desc, then extension asc
    const zoneOrder: Record<GradeZone, number> = { current: 0, remediation: 1, extension: 2 }
    return [...groups.values()].sort((a, b) => {
      const zo = zoneOrder[a.zone] - zoneOrder[b.zone]
      if (zo !== 0) return zo
      return gradeToOrdinal(a.grade) - gradeToOrdinal(b.grade)
    })
  }, [gradeResults, gradeLevel, search, framework, age])

  // Non-grade-filtered view: group by domain
  const domainGroups = useMemo(() => {
    if (gradeLevel) return new Map<string, SkillWithProgression[]>()
    const ageNum = age === '' ? null : Number(age)
    const filtered = skills.filter((s) => {
      if (ageNum !== null && !Number.isNaN(ageNum) && !skillMatchesAge(s, ageNum)) return false
      return true
    })
    const grouped = new Map<string, SkillWithProgression[]>()
    for (const skill of filtered) {
      const dom = skill.progression_domain ?? 'Uncategorized'
      if (!grouped.has(dom)) grouped.set(dom, [])
      grouped.get(dom)!.push(skill)
    }
    return grouped
  }, [skills, gradeLevel, age])

  // Toggle zone expansion
  function toggleZone(zone: GradeZone) {
    setExpandedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zone)) next.delete(zone)
      else next.add(zone)
      return next
    })
  }

  // Load progression ladder when expanding a skill
  async function handleExpandSkill(skillId: string) {
    if (expandedSkill === skillId) {
      setExpandedSkill(null)
      return
    }

    setExpandedSkill(skillId)
    if (!schoolId) return

    setLadderLoading(true)
    try {
      const steps = await getProgressionLadder(skillId, schoolId)
      setLadderSteps(steps)
    } catch {
      toast('Failed to load progression', 'error')
    } finally {
      setLadderLoading(false)
    }
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>

        <input
          type="number"
          min={0}
          max={25}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="Age"
          aria-label="Filter by learner age"
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />

        <select
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          {FRAMEWORK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          title="Filter by legacy free-text domain"
        >
          <option value="">All Legacy Domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={gradeLevel}
          onChange={(e) => setGradeLevel(e.target.value)}
          className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          <option value="">All Grades</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && gradeResults.length === 0 && skills.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-bg-muted bg-bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <BookOpen className="h-7 w-7 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">No skills found</p>
            <p className="mt-1 text-sm text-text-muted">
              {search || framework || domain
                ? 'Try adjusting your filters.'
                : 'Populate the skills library from the admin settings to get started.'}
            </p>
          </div>
        </div>
      )}

      {/* Grade-filtered view: zone groups */}
      {!loading && gradeLevel && zoneGroups.length > 0 && (
        <div className="space-y-3">
          {zoneGroups.map((group) => {
            const config = ZONE_CONFIG[group.zone]
            const ZoneIcon = config.icon
            const isExpanded = expandedZones.has(group.zone)

            return (
              <div key={`${group.zone}-${group.grade}`} className="rounded-xl border border-bg-muted bg-bg-card overflow-hidden">
                {/* Zone header */}
                <button
                  onClick={() => toggleZone(group.zone)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-muted/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-text-light" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-light" />
                  )}
                  <span className={clsx('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', config.color)}>
                    <ZoneIcon className="h-3.5 w-3.5" />
                    {config.label} (Grade {group.grade})
                  </span>
                  <span className="ml-auto text-xs text-text-muted">
                    {group.skills.length} skill{group.skills.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Skills list */}
                {isExpanded && (
                  <div className="divide-y divide-bg-muted border-t border-bg-muted">
                    {groupByDomain(group.skills).map(([domainName, items]) => (
                      <div key={domainName}>
                        {domainName !== 'Uncategorized' && (
                          <div className="bg-bg-muted/30 px-4 py-2">
                            <span className="text-xs font-medium text-text-muted">{domainName}</span>
                          </div>
                        )}
                        {items.map(({ skill, step }) => (
                          <SkillCard
                            key={`${skill.id}-${step.grade_level}`}
                            skill={skill}
                            step={step}
                            zone={group.zone}
                            gradeLevel={gradeLevel}
                            isExpanded={expandedSkill === skill.id}
                            ladderSteps={expandedSkill === skill.id ? ladderSteps : []}
                            ladderLoading={expandedSkill === skill.id && ladderLoading}
                            onExpand={() => handleExpandSkill(skill.id)}
                            onAssign={onAssign}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* All-skills view: domain groups */}
      {!loading && !gradeLevel && skills.length > 0 && (
        <div className="space-y-3">
          {[...domainGroups.entries()].map(([domainName, domainSkills]) => (
            <div key={domainName} className="rounded-xl border border-bg-muted bg-bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-bg-muted">
                <Filter className="h-4 w-4 text-primary-500" />
                <span className="text-sm font-semibold text-text">{domainName}</span>
                <span className="text-xs text-text-muted">({domainSkills.length})</span>
              </div>
              <div className="divide-y divide-bg-muted">
                {domainSkills.map((skill) => {
                  const defaultStep = skill.steps.length > 0 ? skill.steps[0] : null
                  return (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      step={defaultStep}
                      zone="current"
                      gradeLevel={gradeLevel}
                      isExpanded={expandedSkill === skill.id}
                      ladderSteps={expandedSkill === skill.id ? ladderSteps : []}
                      ladderLoading={expandedSkill === skill.id && ladderLoading}
                      onExpand={() => handleExpandSkill(skill.id)}
                      onAssign={onAssign}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create custom skill button */}
      {showCreateButton && onCreateCustom && (
        <button
          onClick={onCreateCustom}
          className="flex items-center gap-2 self-start rounded-xl border border-dashed border-primary-300 px-4 py-3 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" />
          Create Custom Skill
        </button>
      )}
    </div>
  )
}

// ============================================================
// SkillCard sub-component
// ============================================================

function SkillCard({
  skill,
  step,
  zone: _zone,
  gradeLevel,
  isExpanded,
  ladderSteps,
  ladderLoading,
  onExpand,
  onAssign,
}: {
  skill: Skill
  step: SkillProgressionStep | null
  zone: GradeZone
  gradeLevel: string
  isExpanded: boolean
  ladderSteps: SkillProgressionStep[]
  ladderLoading: boolean
  onExpand: () => void
  onAssign?: (skill: Skill, step: SkillProgressionStep) => void
}) {
  const isBaseline = skill.school_id === null
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Expand/collapse */}
        <button
          onClick={onExpand}
          className="mt-0.5 rounded p-0.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">{skill.name}</span>
            {isBaseline && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-white">
                <Lock className="h-2.5 w-2.5" />
                Baseline
              </span>
            )}
            {(skill.age_band_start !== null || skill.age_band_end !== null) && (
              <span className="shrink-0 rounded-full bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-light">
                ages {skill.age_band_start ?? '?'}–{skill.age_band_end ?? '?'}
              </span>
            )}
            {skill.source_standard_code && (
              <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-light">
                {skill.source_standard_code}
              </span>
            )}
          </div>
          {step && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">
              {step.expectation_description}
            </p>
          )}
          {step?.example_tasks && (
            <p className="mt-1 text-xs text-text-light italic line-clamp-1">
              e.g., {step.example_tasks}
            </p>
          )}
        </div>

        {/* Assign button */}
        {step && onAssign && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAssign(skill, step)
            }}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-600"
          >
            Assign
            <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Progression ladder (expanded) */}
      {isExpanded && (
        <div className="ml-7 mt-3 rounded-lg border border-bg-muted bg-bg p-3">
          <p className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
            Progression Ladder
          </p>
          {ladderLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
            </div>
          ) : ladderSteps.length === 0 ? (
            <p className="py-2 text-xs text-text-light">No progression steps defined.</p>
          ) : (
            <div className="space-y-1.5">
              {ladderSteps.map((ladderStep, i) => {
                const isCurrent = ladderStep.grade_level === gradeLevel
                const isAbove = gradeLevel && gradeToOrdinal(ladderStep.grade_level) > gradeToOrdinal(gradeLevel)
                const isBelow = gradeLevel && gradeToOrdinal(ladderStep.grade_level) < gradeToOrdinal(gradeLevel)
                const isLast = i === ladderSteps.length - 1

                return (
                  <div
                    key={ladderStep.id}
                    className={clsx(
                      'flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
                      isCurrent && 'bg-emerald-50 ring-1 ring-emerald-200',
                    )}
                  >
                    {/* Tree connector */}
                    <span className="shrink-0 font-mono text-text-light">
                      {isLast ? '└─' : '├─'}
                    </span>

                    <span className="shrink-0 font-semibold text-text-muted w-6">
                      {ladderStep.grade_level}:
                    </span>
                    <span className="flex-1 text-text">
                      {ladderStep.expectation_description}
                    </span>

                    {/* Zone badge */}
                    {isCurrent && (
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        CURRENT
                      </span>
                    )}
                    {isAbove && (
                      <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        above grade
                      </span>
                    )}
                    {isBelow && (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        below grade
                      </span>
                    )}

                    {/* Assign from any step */}
                    {onAssign && (
                      <button
                        onClick={() => onAssign(skill, ladderStep)}
                        className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

/** True when the requested learner age falls within a skill's declared age band. */
function skillMatchesAge(
  skill: Pick<Skill, 'age_band_start' | 'age_band_end'>,
  age: number
): boolean {
  const start = skill.age_band_start ?? Number.NEGATIVE_INFINITY
  const end = skill.age_band_end ?? Number.POSITIVE_INFINITY
  return age >= start && age <= end
}

/** Group skill+step pairs by progression_domain */
function groupByDomain(
  items: { skill: Skill; step: SkillProgressionStep }[]
): [string, { skill: Skill; step: SkillProgressionStep }[]][] {
  const map = new Map<string, { skill: Skill; step: SkillProgressionStep }[]>()
  for (const item of items) {
    const dom = item.skill.progression_domain ?? 'Uncategorized'
    if (!map.has(dom)) map.set(dom, [])
    map.get(dom)!.push(item)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

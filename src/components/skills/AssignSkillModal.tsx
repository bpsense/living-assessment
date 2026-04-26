import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Loader2, Search, X } from 'lucide-react'

import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  fetchLearnerProfileDomainsForSchool,
  fetchSkills,
  attachDomainsToSkills,
  type SkillWithDomain,
} from '../../lib/skills-data'
import { assignSkillsStandalone } from '../../lib/student-skill-assignment-data'
import type { LearnerProfileDomain } from '../../types/learner-profile'

interface Props {
  open: boolean
  onClose: () => void
  studentId: string
  /** Called after successful assignment with the count inserted/already-existing. */
  onAssigned?: (count: number) => void
}

/**
 * Standalone "Assign Skill" picker. Browses the school's skill library
 * (own + baseline) with domain and age filters; lets the user select one or
 * more skills and assigns them to the student via assignSkillsStandalone.
 */
export default function AssignSkillModal({ open, onClose, studentId, onAssigned }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const schoolId = profile?.school_id ?? null

  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState<SkillWithDomain[]>([])
  const [domains, setDomains] = useState<LearnerProfileDomain[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')

  useEffect(() => {
    if (!open || !schoolId) return
    setLoading(true)
    setSelected(new Set())
    setSearch('')
    setDomainFilter('')
    setAgeFilter('')
    Promise.all([
      fetchSkills(schoolId),
      fetchLearnerProfileDomainsForSchool(schoolId),
    ])
      .then(async ([raw, doms]) => {
        const enriched = await attachDomainsToSkills(raw)
        setSkills(enriched)
        setDomains(doms)
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Failed to load skills', 'error'))
      .finally(() => setLoading(false))
  }, [open, schoolId, toast])

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase()
    const ageNum = ageFilter === '' ? null : Number(ageFilter)
    return skills.filter((s) => {
      if (domainFilter && s.domain_id !== domainFilter) return false
      if (lower) {
        const inName = s.name.toLowerCase().includes(lower)
        const inDesc = (s.description ?? '').toLowerCase().includes(lower)
        if (!inName && !inDesc) return false
      }
      if (ageNum !== null && !Number.isNaN(ageNum)) {
        const start = s.age_band_start ?? Number.NEGATIVE_INFINITY
        const end = s.age_band_end ?? Number.POSITIVE_INFINITY
        if (ageNum < start || ageNum > end) return false
      }
      return true
    })
  }, [skills, search, domainFilter, ageFilter])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAssign() {
    if (!profile || selected.size === 0) return
    setSaving(true)
    try {
      const result = await assignSkillsStandalone(
        studentId,
        [...selected],
        profile.id
      )
      toast(`Assigned ${result.length} skill${result.length === 1 ? '' : 's'}`, 'success')
      onAssigned?.(result.length)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to assign', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={() => !saving && onClose()}
    >
      <div
        className="glass-modal relative flex max-h-[90vh] w-full flex-col rounded-t-2xl sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text">Assign Skill</h2>
            <p className="text-xs text-text-light">
              Pick one or more skills to assign directly to this learner.
            </p>
          </div>
          <button
            onClick={() => !saving && onClose()}
            className="rounded-lg p-1.5 text-text-light hover:bg-bg-muted hover:text-text"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 border-b border-bg-muted px-5 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills…"
                className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              <option value="">All domains</option>
              {domains.map((d) => (
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
              className="rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">
              No skills match those filters.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((s) => {
                const isSelected = selected.has(s.id)
                return (
                  <li key={s.id}>
                    <label
                      className={clsx(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        isSelected
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-bg-muted bg-bg-card hover:border-primary-200 hover:bg-bg-muted/40'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(s.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-text">{s.name}</span>
                          {s.domain && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: s.domain.color ?? '#94A3B8' }}
                            >
                              {s.domain.name}
                            </span>
                          )}
                          {s.is_baseline && (
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-white">
                              Baseline
                            </span>
                          )}
                          {(s.age_band_start !== null || s.age_band_end !== null) && (
                            <span className="rounded-full bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-light">
                              ages {s.age_band_start ?? '?'}–{s.age_band_end ?? '?'}
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-text-light">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-bg-muted px-5 py-3">
          <span className="text-xs text-text-light">
            {selected.size} selected · {filtered.length} shown
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={saving || selected.size === 0}
              className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

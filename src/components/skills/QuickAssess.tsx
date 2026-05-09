import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { AlertCircle, Loader2, Save } from 'lucide-react'

import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  getAssignmentsForStudent,
  type StudentSkillAssignmentWithSkill,
} from '../../lib/student-skill-assignment-data'
import {
  getLatestAssessmentsByStudent,
  recordAssessments,
} from '../../lib/skill-assessment-data'
import {
  ASSESSMENT_LEVELS,
  formatLevel,
  type AssessmentLevel,
  type SkillAssessment,
} from '../../lib/skill-assessment-data'

interface Props {
  studentId: string
  /** Hides the section header — useful when embedded inside another card. */
  embedded?: boolean
}

interface DraftRow {
  assignment: StudentSkillAssignmentWithSkill
  /** The level chosen in this session, distinct from the saved latest. */
  draftLevel: AssessmentLevel | null
  draftNotes: string
}

const LEVEL_STYLES: Record<AssessmentLevel, { active: string; idle: string }> = {
  emerging: {
    active: 'bg-amber-500 text-white',
    idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  developing: {
    active: 'bg-sky-500 text-white',
    idle: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  achieving: {
    active: 'bg-emerald-500 text-white',
    idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  exceeding: {
    active: 'bg-violet-500 text-white',
    idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
}

export default function QuickAssess({ studentId, embedded = false }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [latest, setLatest] = useState<Map<string, SkillAssessment>>(new Map())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [assignments, latestMap] = await Promise.all([
        getAssignmentsForStudent(studentId, { status: 'active' }),
        getLatestAssessmentsByStudent(studentId),
      ])
      setRows(
        assignments.map((a) => ({
          assignment: a,
          draftLevel: null,
          draftNotes: '',
        }))
      )
      setLatest(latestMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill assignments')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  function setDraftLevel(skillId: string, level: AssessmentLevel) {
    setRows((prev) =>
      prev.map((r) =>
        r.assignment.skill_id === skillId
          ? { ...r, draftLevel: r.draftLevel === level ? null : level }
          : r
      )
    )
  }

  function setDraftNotes(skillId: string, notes: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.assignment.skill_id === skillId ? { ...r, draftNotes: notes } : r
      )
    )
  }

  const dirtyRows = useMemo(() => rows.filter((r) => r.draftLevel !== null), [rows])

  async function handleSave() {
    if (!profile || dirtyRows.length === 0) return
    setSaving(true)
    try {
      await recordAssessments(
        dirtyRows.map((r) => ({
          studentId,
          skillId: r.assignment.skill_id,
          assessedBy: profile.id,
          level: r.draftLevel as AssessmentLevel,
          notes: r.draftNotes.trim() || null,
          studentSkillAssignmentId: r.assignment.id,
        }))
      )
      toast(
        `Recorded ${dirtyRows.length} assessment${dirtyRows.length === 1 ? '' : 's'}`,
        'success'
      )
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save assessments', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!embedded && (
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-text">Quick Assess</h3>
          <span className="text-xs text-text-light">
            {rows.length} active skill{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-3 py-2 text-xs text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bg-muted bg-bg-card px-4 py-6 text-center">
          <p className="text-xs text-text-muted">
            No active skill assignments. Assign skills via a project or directly from this profile.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const last = latest.get(r.assignment.skill_id)
            return (
              <li
                key={r.assignment.id}
                className="rounded-xl border border-bg-muted bg-bg-card px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text">
                    {r.assignment.skill.name}
                  </span>
                  {last && (
                    <span className="ml-auto text-[11px] text-text-light">
                      latest: <span className="font-medium text-text-muted">{formatLevel(last.level)}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ASSESSMENT_LEVELS.map((level) => {
                    const isActive = r.draftLevel === level
                    const styles = LEVEL_STYLES[level]
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDraftLevel(r.assignment.skill_id, level)}
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          isActive ? styles.active : styles.idle
                        )}
                      >
                        {formatLevel(level)}
                      </button>
                    )
                  })}
                </div>

                {r.draftLevel && (
                  <input
                    type="text"
                    value={r.draftNotes}
                    onChange={(e) => setDraftNotes(r.assignment.skill_id, e.target.value)}
                    placeholder="Optional note for this assessment…"
                    className="mt-2 w-full rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {dirtyRows.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="text-xs text-text-light">
            {dirtyRows.length} pending
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save assessments
          </button>
        </div>
      )}
    </div>
  )
}

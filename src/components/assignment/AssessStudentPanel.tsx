/**
 * AssessStudentPanel.tsx
 *
 * Per-student assessment UI within an assignment. Renders the student's
 * snapshot of standards (which may differ from siblings if personalized);
 * for each standard the educator picks a level (Emerging/Developing/
 * Achieving/Mastery), optionally adds a per-standard note, and the panel
 * supports per-student-per-assessment file attachments at the bottom.
 *
 * Each saved standard writes a new row to assignment_standard_assessments
 * (append-only). Files are uploaded against the FIRST saved row's id and
 * shared across all assessments saved in the same submit click for now.
 */
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Paperclip, Save, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  ASSESSMENT_LEVELS,
  formatLevel,
  getLatestAssessmentsByStudent,
  recordStandardAssessments,
  type AssessmentLevel,
  type StandardAssessment,
  type StudentAssignmentView,
} from '../../lib/standards-assignment-data'
import {
  uploadAssessmentAttachments,
  MAX_UPLOAD_BYTES,
} from '../../lib/assignment-files'

interface Props {
  studentAssignment: StudentAssignmentView
  /** Called after a successful save (parent can refresh roster / latest scores). */
  onSaved?: () => void
}

interface DraftRow {
  standardId: string
  draftLevel: AssessmentLevel | null
  draftNotes: string
  /** Last-saved level for this (student, standard), if any. Display only. */
  latestLevel: AssessmentLevel | null
  latestAt: string | null
}

const LEVEL_STYLES: Record<AssessmentLevel, { active: string; idle: string }> = {
  emerging:   { active: 'bg-amber-500 text-white',    idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  developing: { active: 'bg-sky-500 text-white',      idle: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
  achieving:  { active: 'bg-emerald-500 text-white',  idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  mastery:    { active: 'bg-violet-500 text-white',   idle: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
}

export default function AssessStudentPanel({ studentAssignment, onSaved }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [latest, setLatest] = useState<Map<string, StandardAssessment>>(new Map())
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLatestAssessmentsByStudent(studentAssignment.student_id)
      .then((m) => {
        if (cancelled) return
        setLatest(m)
        setDrafts(
          studentAssignment.standards.map((s) => {
            const last = m.get(s.id)
            return {
              standardId: s.id,
              draftLevel: null,
              draftNotes: '',
              latestLevel: last?.level ?? null,
              latestAt: last?.assessed_at ?? null,
            }
          })
        )
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [studentAssignment.student_id, studentAssignment.standards])

  const dirty = useMemo(() => drafts.filter((d) => d.draftLevel !== null), [drafts])

  function setLevel(id: string, level: AssessmentLevel) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.standardId === id
          ? { ...d, draftLevel: d.draftLevel === level ? null : level }
          : d
      )
    )
  }

  function setNotes(id: string, notes: string) {
    setDrafts((prev) => prev.map((d) => (d.standardId === id ? { ...d, draftNotes: notes } : d)))
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (f.size > MAX_UPLOAD_BYTES * 4) {
        toast(`${f.name} is too large; pick a smaller file.`, 'error')
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  async function handleSave() {
    if (!profile?.school_id || dirty.length === 0) return
    setSaving(true)
    try {
      const inserted = await recordStandardAssessments(
        dirty.map((d) => ({
          student_assignment_id: studentAssignment.student_assignment_id,
          student_id: studentAssignment.student_id,
          school_id: profile.school_id,
          standard_id: d.standardId,
          level: d.draftLevel as AssessmentLevel,
          notes: d.draftNotes.trim() || null,
          assessor_id: profile.id,
        }))
      )

      // Attach files to the first saved assessment (representative row).
      // Each file becomes one row in assessment_attachments.
      if (files.length > 0 && inserted.length > 0) {
        try {
          await uploadAssessmentAttachments({
            assessmentId: inserted[0].id,
            schoolId: profile.school_id,
            uploadedBy: profile.id,
            files,
          })
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Some files failed to upload', 'error')
        }
      }

      // Refresh latest map locally
      const newLatest = new Map(latest)
      for (const row of inserted) newLatest.set(row.standard_id, row)
      setLatest(newLatest)
      setDrafts((prev) =>
        prev.map((d) => {
          const updated = newLatest.get(d.standardId)
          return updated
            ? {
                ...d,
                draftLevel: null,
                draftNotes: '',
                latestLevel: updated.level,
                latestAt: updated.assessed_at,
              }
            : d
        })
      )
      setFiles([])

      toast(
        `Saved ${inserted.length} assessment${inserted.length === 1 ? '' : 's'}`,
        'success'
      )
      onSaved?.()
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

  if (studentAssignment.standards.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-bg-muted bg-bg-card px-4 py-6 text-center text-xs text-text-muted">
        No standards on this student's snapshot. Personalize the assignment first.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {drafts.map((d, i) => {
          const std = studentAssignment.standards[i]
          return (
            <li
              key={d.standardId}
              className="rounded-xl border border-bg-muted bg-bg-card px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-text-light">{std.code}</span>
                {std.grade_level && (
                  <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-text-muted">
                    {std.grade_level}
                  </span>
                )}
                <span className="flex-1 text-xs text-text">{std.description}</span>
                {d.latestLevel && (
                  <span className="text-[11px] text-text-light">
                    last: <span className="font-medium text-text-muted">{formatLevel(d.latestLevel)}</span>
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {ASSESSMENT_LEVELS.map((level) => {
                  const isActive = d.draftLevel === level
                  const styles = LEVEL_STYLES[level]
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevel(d.standardId, level)}
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

              {d.draftLevel && (
                <input
                  type="text"
                  value={d.draftNotes}
                  onChange={(e) => setNotes(d.standardId, e.target.value)}
                  placeholder="Optional note for this assessment…"
                  className="mt-2 w-full rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              )}
            </li>
          )
        })}
      </ul>

      {/* Per-student-per-assessment file attachments */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-muted">
          Show their work (optional)
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-bg-muted bg-bg-card px-3 py-2 text-sm text-text-muted hover:bg-bg-muted/40">
          <Paperclip className="h-4 w-4" />
          <span>Choose files…</span>
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text"
              >
                <span className="truncate">
                  {f.name} <span className="text-text-light">— {(f.size / 1024).toFixed(1)} KB</span>
                </span>
                <button
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="rounded p-0.5 text-text-light hover:bg-bg-muted hover:text-text"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <span className="text-xs text-text-light">
          {dirty.length} pending {dirty.length === 1 ? 'rating' : 'ratings'}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || dirty.length === 0}
          className="flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save assessments
        </button>
      </div>
    </div>
  )
}

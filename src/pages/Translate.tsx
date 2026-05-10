import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Printer,
  Edit3,
  Check,
  X,
  ChevronRight,
  Languages,
  Users,
  BookOpen,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react'
import { usePageAccess } from '../lib/role-permissions'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { triggerTranslation } from '../lib/ai-mapping'
import {
  fetchStandardsFrameworks,
  initiateTranslation,
  saveTranslationMappings,
  updateTranslationMapping,
  markTranslationReviewed,
} from '../lib/translation-data'
import type {
  Student,
  StandardsFramework,
  TranslationRecord,
  TranslationMapping,
  TranslationMappingInsert,
  Standard,
} from '../types/database'
import type { TranslationAIResult } from '../lib/ai-mapping'
import { formatLevel } from '../lib/standards-assignment-data'

// ============================================================
// Source-side context per mapping (left column of Review step).
// Resolved client-side from skill_assessment_id → skills.
// ============================================================

interface MappingSource {
  skillName: string
  level: string | null
  /** ISO date — assessment timestamp. */
  date: string | null
}

// ============================================================
// Step indicator
// ============================================================

const STEPS = [
  { label: 'Select Student', icon: <Users className="h-4 w-4" /> },
  { label: 'Select Framework', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Generate', icon: <Sparkles className="h-4 w-4" /> },
  { label: 'Review', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Transcript', icon: <FileText className="h-4 w-4" /> },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => (
        <div key={i} className="flex items-center">
          <div
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              i === current
                ? 'bg-primary-500 text-white'
                : i < current
                  ? 'bg-success-100 text-success-700'
                  : 'bg-bg-muted text-text-light'
            )}
          >
            {i < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-text-light" />
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Confidence badge
// ============================================================

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.7
      ? 'bg-success-100 text-success-700'
      : value >= 0.4
        ? 'bg-caution-100 text-caution-700'
        : 'bg-alert-100 text-alert-700'

  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', color)}>
      {pct}%
    </span>
  )
}

// ============================================================
// Main Translate Page
// ============================================================

export default function TranslatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const { canEdit } = usePageAccess('translate')

  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Student selection
  const [students, setStudents] = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)

  // Step 2: Framework selection
  const [frameworks, setFrameworks] = useState<StandardsFramework[]>([])
  const [selectedFramework, setSelectedFramework] = useState<StandardsFramework | null>(null)
  const [loadingFrameworks, setLoadingFrameworks] = useState(false)

  // Step 3: Translation generation
  const [generating, setGenerating] = useState(false)
  const [translationRecord, setTranslationRecord] = useState<TranslationRecord | null>(null)
  const [, setAiResult] = useState<TranslationAIResult | null>(null)

  // Step 4: Review
  const [mappings, setMappings] = useState<(TranslationMapping & { standard?: Standard })[]>([])
  /** Source-side context resolved from skill_assessment_id, keyed by mapping id. */
  const [mappingSources, setMappingSources] = useState<Map<string, MappingSource>>(new Map())
  const [editingMapping, setEditingMapping] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [approvedMappings, setApprovedMappings] = useState<Set<string>>(new Set())

  // Step 5: Transcript
  const [reviewing, setReviewing] = useState(false)

  // ── Load students ──────────────────────────────────────

  useEffect(() => {
    if (!profile?.school_id) return
    setLoadingStudents(true)

    supabase
      .from('students')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('student_status', 'active')
      .order('last_name')
      .then(({ data }) => {
        setStudents((data ?? []) as Student[])
        setLoadingStudents(false)

        // Auto-select student from URL params
        const preselectedId = searchParams.get('student')
        if (preselectedId && data) {
          const found = (data as Student[]).find((s) => s.id === preselectedId)
          if (found) {
            setSelectedStudent(found)
            setStep(1) // Skip to framework selection
          }
        }
      })
  }, [profile?.school_id, searchParams])

  // ── Load frameworks when student selected ──────────────

  useEffect(() => {
    if (!selectedStudent || !profile?.school_id) return
    setLoadingFrameworks(true)

    fetchStandardsFrameworks(profile.school_id)
      .then((fws) => {
        setFrameworks(fws)
        setLoadingFrameworks(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoadingFrameworks(false)
      })
  }, [selectedStudent, profile?.school_id])

  // ── Generate translation ───────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedStudent || !selectedFramework || !profile) return
    setGenerating(true)
    setError(null)

    try {
      // 1. Call AI translation
      const result = await triggerTranslation({
        studentId: selectedStudent.id,
        schoolId: profile.school_id,
        targetFrameworkId: selectedFramework.id,
      })

      if (result.error && result.mappings.length === 0) {
        setError(result.error)
        setGenerating(false)
        return
      }

      setAiResult(result)

      // 2. Create translation record
      const record = await initiateTranslation({
        studentId: selectedStudent.id,
        schoolId: profile.school_id,
        targetFrameworkId: selectedFramework.id,
        translatedBy: profile.id,
      })
      setTranslationRecord(record)

      // 3. Save mappings — V2 skill assessments use the dedicated FK column
      // added in migration 067; V1 graded competencies still use competency_score_id.
      const mappingInserts: TranslationMappingInsert[] = result.mappings.map((m) => ({
        translation_id: record.id,
        competency_score_id: m.source_type === 'competency_score' ? m.source_id : null,
        skill_assessment_id: m.source_type === 'skill_assessment' ? m.source_id : null,
        student_skill_assignment_id: null,
        standard_id: m.standard_id,
        confidence: m.confidence,
        level_in_standard: m.level_in_standard,
        human_override: false,
        notes: m.reasoning,
      }))

      const saved = await saveTranslationMappings(mappingInserts)

      // 4. Fetch standards details for display
      const standardIds = [...new Set(saved.map((m) => m.standard_id))]
      const { data: standards } = await supabase
        .from('standards')
        .select('id, code, description, grade_level, domain')
        .in('id', standardIds)

      const standardsMap = new Map((standards ?? []).map((s: any) => [s.id, s]))
      const mappingsWithStandards = saved.map((m) => ({
        ...m,
        standard: standardsMap.get(m.standard_id) as Standard | undefined,
      }))

      setMappings(mappingsWithStandards)

      // Resolve source-side context per mapping (skill name, domain, level, date).
      // Only V2 skill_assessment-sourced mappings have rich context; V1 sources
      // get a placeholder.
      const sources = new Map<string, MappingSource>()
      const assessmentIds = saved
        .map((m) => m.skill_assessment_id)
        .filter((id): id is string => !!id)

      if (assessmentIds.length > 0) {
        const { data: assessments } = await supabase
          .from('skill_assessments')
          .select(
            'id, level, assessed_at, skill:skills(id, name)'
          )
          .in('id', assessmentIds)

        const byAssessment = new Map<string, any>(
          (assessments ?? []).map((a: any) => [a.id, a])
        )
        for (const m of saved) {
          if (!m.skill_assessment_id) continue
          const a = byAssessment.get(m.skill_assessment_id)
          if (!a) continue
          sources.set(m.id, {
            skillName: a.skill?.name ?? '(unknown skill)',
            level: a.level,
            date: a.assessed_at ?? null,
          })
        }
      }
      setMappingSources(sources)

      setStep(3) // Move to review
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setGenerating(false)
    }
  }, [selectedStudent, selectedFramework, profile])

  // ── Handle mapping approval ────────────────────────────

  const toggleApprove = (mappingId: string) => {
    setApprovedMappings((prev) => {
      const next = new Set(prev)
      if (next.has(mappingId)) next.delete(mappingId)
      else next.add(mappingId)
      return next
    })
  }

  const approveAll = () => {
    setApprovedMappings(new Set(mappings.map((m) => m.id)))
  }

  const handleEditSave = async (mappingId: string) => {
    try {
      await updateTranslationMapping(mappingId, {
        notes: editNotes,
        human_override: true,
      })
      setMappings((prev) =>
        prev.map((m) =>
          m.id === mappingId ? { ...m, notes: editNotes, human_override: true } : m
        )
      )
      setEditingMapping(null)
      setEditNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mapping')
    }
  }

  // ── Finalize review ────────────────────────────────────

  const handleFinalize = async () => {
    if (!translationRecord || !profile) return
    setReviewing(true)

    try {
      await markTranslationReviewed(translationRecord.id, profile.id)
      setTranslationRecord((prev) =>
        prev ? { ...prev, reviewed: true, reviewed_by: profile.id } : null
      )
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize review')
    } finally {
      setReviewing(false)
    }
  }

  // ── Filtered students ──────────────────────────────────

  const filteredStudents = studentSearch
    ? students.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
              <Languages className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Translate to Standards</h1>
              <p className="text-sm text-text-muted">
                Map a student&apos;s learner profile to an external standards framework
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-6 overflow-x-auto">
        <StepIndicator current={step} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-alert-200 bg-alert-50 px-4 py-3 text-sm text-alert-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================
          STEP 0: Select Student
          ============================================================ */}
      {step === 0 && (
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-text">Select a Student</h2>

          <input
            type="text"
            placeholder="Search students..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="mb-4 w-full rounded-lg border border-bg-muted bg-bg px-4 py-2.5 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />

          {loadingStudents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-light">No students found</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStudent(s)
                    setStep(1)
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-primary-50',
                    selectedStudent?.id === s.id && 'bg-primary-50 ring-1 ring-primary-300'
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {s.first_name[0]}{s.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {s.grade_level ? `Grade ${s.grade_level}` : 'No grade set'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-light" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          STEP 1: Select Framework
          ============================================================ */}
      {step === 1 && selectedStudent && (
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => setStep(0)} className="text-text-muted hover:text-text">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-text">
              Select Standards Framework
            </h2>
          </div>

          <div className="mb-4 rounded-lg bg-primary-50 p-3">
            <p className="text-sm font-medium text-primary-700">
              Translating for: {selectedStudent.first_name} {selectedStudent.last_name}
              {selectedStudent.grade_level && ` (Grade ${selectedStudent.grade_level})`}
            </p>
          </div>

          {loadingFrameworks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : frameworks.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-light">
              No standards frameworks available. Upload a framework in the Standards page first.
            </p>
          ) : (
            <div className="space-y-2">
              {frameworks.map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => {
                    setSelectedFramework(fw)
                    setStep(2)
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50',
                    selectedFramework?.id === fw.id
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-bg-muted'
                  )}
                >
                  <BookOpen className="h-5 w-5 text-primary-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{fw.name}</p>
                    {fw.description && (
                      <p className="truncate text-xs text-text-muted">{fw.description}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-light" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          STEP 2: Generate Translation
          ============================================================ */}
      {step === 2 && selectedStudent && selectedFramework && (
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={() => setStep(1)} className="text-text-muted hover:text-text">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-text">Generate Translation</h2>
          </div>

          <div className="mb-6 space-y-2">
            <div className="rounded-lg bg-bg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Student</p>
              <p className="text-sm font-medium text-text">
                {selectedStudent.first_name} {selectedStudent.last_name}
                {selectedStudent.grade_level && ` — Grade ${selectedStudent.grade_level}`}
              </p>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Target Framework</p>
              <p className="text-sm font-medium text-text">{selectedFramework.name}</p>
            </div>
          </div>

          <div className="rounded-lg border border-caution-200 bg-caution-50 p-4 text-sm text-caution-800">
            <p className="mb-1 font-semibold">How this works:</p>
            <ul className="list-inside list-disc space-y-1 text-xs">
              <li>AI will analyze the student&apos;s skill assessments and competency scores</li>
              <li>Each assessment is mapped to relevant standards in {selectedFramework.name}</li>
              <li>You&apos;ll review every mapping before the transcript is generated</li>
              <li>The human review step is the safety net — AI mapping doesn&apos;t need to be perfect</li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-bg-muted px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-bg-muted"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !canEdit}
              title={!canEdit ? 'View-only' : undefined}
              className="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Translation
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          STEP 3: Review Mappings
          ============================================================ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text">Review Mappings</h2>
                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                  {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={approveAll}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve All
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-caution-400" />
                <p className="mt-2 text-sm text-text-muted">
                  No mappings were generated. The student may not have enough assessments,
                  or the framework may not have relevant standards for this grade level.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="divide-y divide-bg-muted">
                {mappings.map((m) => {
                  const source = mappingSources.get(m.id) ?? null
                  return (
                  <div
                    key={m.id}
                    className={clsx(
                      'py-3 transition-colors',
                      approvedMappings.has(m.id) && 'bg-success-50/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Approve checkbox */}
                      <button
                        onClick={() => toggleApprove(m.id)}
                        className={clsx(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          approvedMappings.has(m.id)
                            ? 'border-success-500 bg-success-500 text-white'
                            : 'border-bg-muted hover:border-primary-400'
                        )}
                      >
                        {approvedMappings.has(m.id) && <Check className="h-3 w-3" />}
                      </button>

                      {/* Two-column source / standard layout */}
                      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                        {/* LEFT: source skill assessment */}
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-light">
                            Skill assessment
                          </p>
                          {source ? (
                            <>
                              <p className="mt-1 truncate text-sm font-medium text-text">
                                {source.skillName}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {source.level && (
                                  <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                                    {formatLevel(source.level as 'emerging' | 'developing' | 'achieving' | 'mastery')}
                                  </span>
                                )}
                                {source.date && (
                                  <span className="text-[10px] text-text-light">
                                    {format(new Date(source.date), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="mt-1 text-xs italic text-text-light">
                              Legacy source — context unavailable.
                            </p>
                          )}
                        </div>

                        {/* RIGHT: target standard */}
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-light">
                            Standard
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-primary-700">
                              {m.standard?.code || 'Unknown'}
                            </span>
                            <ConfidenceBadge value={m.confidence} />
                            {m.level_in_standard && (
                              <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                                {m.level_in_standard}
                              </span>
                            )}
                            {m.human_override && (
                              <span className="rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                                Edited
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            {m.standard?.description || ''}
                          </p>

                          {/* Notes / reasoning */}
                          {editingMapping === m.id ? (
                            <div className="mt-2 flex gap-2">
                              <input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="flex-1 rounded border border-bg-muted bg-bg px-2 py-1 text-xs text-text focus:border-primary-400 focus:outline-none"
                                placeholder="Add notes..."
                              />
                              <button
                                onClick={() => handleEditSave(m.id)}
                                className="rounded bg-primary-500 px-2 py-1 text-xs text-white hover:bg-primary-600"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingMapping(null)}
                                className="rounded bg-bg-muted px-2 py-1 text-xs text-text-muted hover:bg-bg"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            m.notes && (
                              <p className="mt-1 text-[11px] italic text-text-light">
                                {m.notes}
                              </p>
                            )
                          )}
                        </div>
                      </div>

                      {/* Edit button */}
                      {editingMapping !== m.id && (
                        <button
                          onClick={() => {
                            setEditingMapping(m.id)
                            setEditNotes(m.notes || '')
                          }}
                          className="shrink-0 rounded p-1 text-text-light hover:bg-bg-muted hover:text-text"
                          title="Edit mapping"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action bar */}
          {mappings.length > 0 && (
            <div className="flex items-center justify-between glass-card p-4">
              <p className="text-sm text-text-muted">
                {approvedMappings.size} of {mappings.length} mappings approved
              </p>
              <button
                onClick={handleFinalize}
                disabled={reviewing || approvedMappings.size === 0}
                className="flex items-center gap-2 rounded-lg bg-success-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-success-700 disabled:opacity-50"
              >
                {reviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve &amp; Generate Transcript
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          STEP 4: Transcript
          ============================================================ */}
      {step === 4 && selectedStudent && selectedFramework && translationRecord && (
        <div className="space-y-4">
          {/* Print toolbar */}
          <div className="flex items-center justify-between glass-card p-4 print:hidden">
            <p className="text-sm text-success-600 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Translation reviewed and approved
            </p>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              <Printer className="h-4 w-4" />
              Print Transcript
            </button>
          </div>

          {/* Printable transcript */}
          <div className="rounded-xl border border-bg-muted bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
            {/* Header */}
            <header className="border-b border-bg-muted pb-6">
              <h1 className="text-2xl font-bold text-text">
                Standards Translation Transcript
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-light">Student</span>
                  <p className="text-base font-bold text-text">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                </div>
                {selectedStudent.grade_level && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-light">Grade</span>
                    <p className="text-sm font-medium text-text">{selectedStudent.grade_level}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-light">Framework</span>
                  <p className="text-sm font-medium text-text">{selectedFramework.name}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-light">Generated</span>
                  <p className="text-sm font-medium text-text">
                    {format(new Date(translationRecord.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </header>

            {/* Mappings table */}
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-bold text-text">Standards Alignment</h2>
              <p className="mb-4 text-sm text-text-muted">
                This transcript maps the student&apos;s assessed competencies and skills to{' '}
                {selectedFramework.name} standards. Each mapping includes a confidence score
                indicating alignment strength.
              </p>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-muted">
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-light">
                      Standard
                    </th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-light">
                      Description
                    </th>
                    <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-text-light">
                      Level
                    </th>
                    <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-text-light">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-muted">
                  {mappings
                    .filter((m) => approvedMappings.has(m.id))
                    .sort((a, b) => (a.standard?.code || '').localeCompare(b.standard?.code || ''))
                    .map((m) => (
                      <tr key={m.id} className="break-inside-avoid">
                        <td className="py-2 pr-3 font-semibold text-primary-700">
                          {m.standard?.code}
                        </td>
                        <td className="py-2 pr-3 text-text-muted">
                          {m.standard?.description}
                          {m.notes && (
                            <p className="mt-0.5 text-[10px] italic text-text-light">
                              Note: {m.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <span className="rounded bg-bg-muted px-2 py-0.5 text-xs font-medium text-text">
                            {m.level_in_standard || '—'}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <ConfidenceBadge value={m.confidence} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>

            {/* Footer */}
            <footer className="mt-8 border-t border-bg-muted pt-4 text-center">
              <p className="text-xs text-text-light">
                This transcript was generated from the student&apos;s learner profile and
                translated to{' '}
                <span className="font-medium">{selectedFramework.name}</span> standards.
                Mappings were reviewed by an educator.
              </p>
              <p className="mt-1 text-[10px] text-text-light">
                Confidence scores indicate alignment strength. Standards with lower confidence
                may benefit from additional assessment evidence.
              </p>
            </footer>
          </div>

          {/* Print styles */}
          <style>{`
            @media print {
              body > * { visibility: hidden; }
              #root { visibility: visible; }
              nav, aside, header:not(.report-header),
              [data-sidebar], [data-topbar] { display: none !important; }
              main, [role="main"], .flex-1 {
                margin: 0 !important; padding: 0 !important; max-width: 100% !important;
              }
              @page { size: A4; margin: 1.5cm; }
              .break-inside-avoid { break-inside: avoid; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

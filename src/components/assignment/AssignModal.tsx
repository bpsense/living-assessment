/**
 * AssignModal.tsx
 *
 * Assign an assignment to a whole class or a single learner. Two modes
 * (class | individual) and a small state machine:
 *   select (Browse existing / Create new) → configure (due date, visibility)
 *   → confirm → done.
 *
 * Self-sufficient: given a classroomId or studentId it resolves the name +
 * (class) the active student list itself, so the SpeedDial can open it with
 * just an id from the route. When opened in class mode WITHOUT a classroomId
 * (e.g. from the Library's "Use This Assignment"), the configure step shows a
 * classroom picker.
 */
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { X, Loader2, Check, ChevronLeft, Heart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import {
  fetchSchoolAssignments,
  fetchClassroomStudentIds,
  assignToStudents,
  type AssignmentType,
  type AssignmentWithRelations,
} from '../../lib/assignment-data'
import AssignmentTypeSelector from './AssignmentTypeSelector'
import ProjectAssignmentForm from './ProjectAssignmentForm'
import FocusedTaskForm from './FocusedTaskForm'
import { Toggle, inputCls } from './assignmentFormShared'

interface Props {
  open: boolean
  onClose: () => void
  mode: 'class' | 'individual'
  schoolId: string
  classroomId?: string | null
  classroomName?: string
  studentId?: string | null
  studentName?: string
  preselectedAssignment?: { id: string; title: string } | null
  onAssigned?: () => void
}

type Step = 'select' | 'configure' | 'done'

export default function AssignModal({
  open,
  onClose,
  mode,
  schoolId,
  classroomId,
  classroomName,
  studentId,
  studentName,
  preselectedAssignment,
  onAssigned,
}: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('select')
  const [tab, setTab] = useState<'browse' | 'create'>('browse')
  const [createType, setCreateType] = useState<AssignmentType | null>(null)

  const [library, setLibrary] = useState<AssignmentWithRelations[]>([])
  const [loadingLib, setLoadingLib] = useState(true)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [visible, setVisible] = useState(true)

  // Class context — chosenClassroomId lets the user pick a class when none was
  // passed (Library flow). Defaults to the classroomId prop.
  const [chosenClassroomId, setChosenClassroomId] = useState<string | null>(classroomId ?? null)
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([])
  const [resolvedName, setResolvedName] = useState('')
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [resolvingClass, setResolvingClass] = useState(false)

  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)

  // Reset whenever the modal opens.
  useEffect(() => {
    if (!open) return
    setStep(preselectedAssignment ? 'configure' : 'select')
    setTab('browse')
    setCreateType(null)
    setSelected(preselectedAssignment ?? null)
    setDueDate('')
    setVisible(true)
    setResult(null)
    setSearch('')
    setChosenClassroomId(classroomId ?? null)
    if (mode === 'individual') {
      setStudentIds(studentId ? [studentId] : [])
      setResolvedName(studentName ?? '')
    }
  }, [open, mode, classroomId, studentId, studentName, preselectedAssignment])

  // Resolve an individual learner's name if not supplied.
  useEffect(() => {
    if (!open || mode !== 'individual' || !studentId || studentName) return
    let cancelled = false
    supabase
      .from('students')
      .select('first_name, last_name, preferred_name')
      .eq('id', studentId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        const s = data as { first_name: string; last_name: string; preferred_name: string | null }
        setResolvedName(`${s.preferred_name || s.first_name} ${s.last_name}`.trim())
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, studentId, studentName])

  // Class mode: resolve name + active student ids whenever the chosen classroom changes.
  useEffect(() => {
    if (!open || mode !== 'class' || !chosenClassroomId) {
      if (mode === 'class' && !chosenClassroomId) {
        setStudentIds([])
        setResolvedName('')
      }
      return
    }
    let cancelled = false
    setResolvingClass(true)
    Promise.all([
      fetchClassroomStudentIds(chosenClassroomId),
      chosenClassroomId === classroomId && classroomName
        ? Promise.resolve(classroomName)
        : supabase
            .from('classrooms')
            .select('name')
            .eq('id', chosenClassroomId)
            .single()
            .then(({ data }) => (data as { name: string } | null)?.name ?? 'Classroom'),
    ])
      .then(([ids, name]) => {
        if (cancelled) return
        setStudentIds(ids)
        setResolvedName(name)
      })
      .finally(() => !cancelled && setResolvingClass(false))
    return () => {
      cancelled = true
    }
  }, [open, mode, chosenClassroomId, classroomId, classroomName])

  // Class mode without a preset classroom: load the school's classrooms for the picker.
  useEffect(() => {
    if (!open || mode !== 'class' || classroomId) return
    let cancelled = false
    supabase
      .from('classrooms')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setClassrooms((data ?? []) as { id: string; name: string }[])
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, classroomId, schoolId])

  // Browse list.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingLib(true)
    fetchSchoolAssignments(schoolId, { sortBy: 'gratitude' })
      .then((rows) => !cancelled && setLibrary(rows))
      .catch(() => !cancelled && setLibrary([]))
      .finally(() => !cancelled && setLoadingLib(false))
    return () => {
      cancelled = true
    }
  }, [open, schoolId])

  // Escape + scroll lock
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !assigning) onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, assigning])

  if (!open) return null

  const studentCount = studentIds.length
  const filteredLib = search.trim()
    ? library.filter((a) => a.title.toLowerCase().includes(search.trim().toLowerCase()))
    : library
  const needsClassroomPick = mode === 'class' && !chosenClassroomId

  async function handleAssign() {
    if (!selected || !profile) return
    if (studentIds.length === 0) {
      toast('No learners to assign to', 'error')
      return
    }
    setAssigning(true)
    const { created, skipped, error } = await assignToStudents(
      selected.id,
      studentIds,
      mode === 'class' ? chosenClassroomId : null,
      { assignedBy: profile.id, schoolId, dueDate: dueDate || null, visibleToFamily: visible }
    )
    setAssigning(false)
    if (error) {
      toast(error, 'error')
      return
    }
    setResult({ created, skipped })
    setStep('done')
    onAssigned?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={assigning ? undefined : onClose} />

      <div className="glass-modal relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-bold text-text">
            {step === 'select' ? 'Assign an assignment' : resolvedName ? `Assign to ${resolvedName}` : 'Assign'}
          </h2>
          <button
            onClick={onClose}
            disabled={assigning}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ---- SELECT ---- */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-xl bg-bg-muted p-1">
                {(['browse', 'create'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={clsx(
                      'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === t ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
                    )}
                  >
                    {t === 'browse' ? 'Browse' : 'Create New'}
                  </button>
                ))}
              </div>

              {tab === 'browse' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assignments…"
                    className={inputCls}
                  />
                  {loadingLib ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                    </div>
                  ) : filteredLib.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-bg-muted px-4 py-6 text-center text-sm text-text-muted">
                      No assignments yet — create one in the “Create New” tab.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {filteredLib.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setSelected({ id: a.id, title: a.title })
                            setStep('configure')
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-bg-muted bg-bg-card px-3 py-2.5 text-left transition-all hover:border-primary-200"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-text">{a.title}</span>
                            <span className="text-[11px] capitalize text-text-muted">
                              {a.assignment_type.replace('_', ' ')}
                            </span>
                          </span>
                          {a.gratitude_count > 0 && (
                            <span className="flex shrink-0 items-center gap-1 text-[11px] text-text-light">
                              <Heart className="h-3 w-3 fill-current text-rose-400" />
                              {a.gratitude_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : !createType ? (
                <AssignmentTypeSelector selected={createType} onSelect={setCreateType} />
              ) : createType === 'project' ? (
                <ProjectAssignmentForm
                  schoolId={schoolId}
                  createdBy={profile?.id ?? ''}
                  onSaved={(a) => {
                    setSelected({ id: a.id, title: a.title })
                    setStep('configure')
                  }}
                  onCancel={() => setCreateType(null)}
                />
              ) : (
                <FocusedTaskForm
                  schoolId={schoolId}
                  createdBy={profile?.id ?? ''}
                  onSaved={(a) => {
                    setSelected({ id: a.id, title: a.title })
                    setStep('configure')
                  }}
                  onCancel={() => setCreateType(null)}
                />
              )}
            </div>
          )}

          {/* ---- CONFIGURE ---- */}
          {step === 'configure' && selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-bg-muted bg-bg-card px-4 py-3">
                <p className="text-xs text-text-muted">Assignment</p>
                <p className="text-sm font-semibold text-text">{selected.title}</p>
              </div>

              {needsClassroomPick ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Class</label>
                  <select
                    value={chosenClassroomId ?? ''}
                    onChange={(e) => setChosenClassroomId(e.target.value || null)}
                    className={inputCls}
                  >
                    <option value="">Select a class…</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-bg-muted bg-bg-card px-4 py-3">
                  <p className="text-xs text-text-muted">{mode === 'class' ? 'Class' : 'Learner'}</p>
                  <p className="flex items-center gap-2 text-sm font-semibold text-text">
                    {resolvedName || '…'}
                    {mode === 'class' && (
                      <span className="font-normal text-text-muted">
                        · {resolvingClass ? '…' : `${studentCount} learners`}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-text">
                  Due date <span className="ml-1 text-xs font-normal text-text-light">(optional)</span>
                </label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </div>
              <Toggle
                checked={visible}
                onChange={setVisible}
                label="Visible to family"
                description={
                  mode === 'class'
                    ? 'Applies to every learner in this assignment.'
                    : 'Overrides the template default for this learner.'
                }
              />
            </div>
          )}

          {/* ---- DONE ---- */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <Check className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-text">
                Assigned to {result.created} {result.created === 1 ? 'learner' : 'learners'}
              </p>
              {result.skipped > 0 && (
                <p className="text-xs text-text-muted">
                  {result.skipped} already had this assignment and {result.skipped === 1 ? 'was' : 'were'} skipped.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'configure' && (
          <div className="flex items-center justify-between gap-3 border-t border-bg-muted px-5 py-4">
            {!preselectedAssignment ? (
              <button
                onClick={() => setStep('select')}
                disabled={assigning}
                className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleAssign}
              disabled={assigning || studentCount === 0 || needsClassroomPick}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'class' ? `Assign to ${studentCount}` : 'Assign'}
            </button>
          </div>
        )}
        {step === 'done' && (
          <div className="flex justify-end border-t border-bg-muted px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

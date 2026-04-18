import { useState, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  X,
  Search,
  Loader2,
  AlertTriangle,
  Upload,
  FileImage,
  File as FileIcon,
  Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../Toast'
import { createIncidentReport, addIncidentAttachment } from '../../lib/incident-data'
import type {
  Student,
  Classroom,
  IncidentType,
  IncidentSeverity,
  IncidentStudentRole,
} from '../../types/database'

interface Props {
  open: boolean
  onClose: () => void
}

// ============================================================
// Constants
// ============================================================

const LOCATIONS = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'playground', label: 'Playground' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'gymnasium', label: 'Gymnasium' },
  { value: 'off-campus', label: 'Off-campus' },
  { value: 'other', label: 'Other' },
]

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'medical_injury', label: 'Medical / Injury' },
  { value: 'safety', label: 'Safety' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'emotional_welfare', label: 'Emotional / Welfare' },
  { value: 'other', label: 'Other' },
]

const SEVERITY_LEVELS: { value: IncidentSeverity; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low', color: 'text-success-700', bg: 'bg-success-50 border-success-200 ring-success-200' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200 ring-yellow-200' },
  { value: 'high', label: 'High', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200 ring-orange-200' },
  { value: 'critical', label: 'Critical', color: 'text-alert-700', bg: 'bg-alert-50 border-alert-200 ring-alert-200' },
]

const STUDENT_ROLES: { value: IncidentStudentRole; label: string }[] = [
  { value: 'involved', label: 'Involved' },
  { value: 'victim', label: 'Victim' },
  { value: 'aggressor', label: 'Aggressor' },
  { value: 'witness', label: 'Witness' },
  { value: 'bystander', label: 'Bystander' },
]

const NOTIFICATION_METHODS = ['Phone', 'Email', 'In-person', 'Via app']

// ============================================================
// Student tag type
// ============================================================

interface StudentTag {
  student_id: string
  first_name: string
  last_name: string
  role: IncidentStudentRole
  notes: string
}

// ============================================================
// Inline student search
// ============================================================

function StudentSearchInline({
  schoolId,
  educatorId,
  role,
  excludeIds,
  onSelect,
}: {
  schoolId: string
  educatorId: string
  role: string
  excludeIds: Set<string>
  onSelect: (student: Student) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAdmin = role === 'admin'

  const search = useCallback(
    async (q: string) => {
      if (q.length < 1) { setResults([]); return }
      setLoading(true)

      let query = supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .order('last_name')
        .limit(8)

      if (!isAdmin) {
        const { data: ecData } = await supabase
          .from('educator_classrooms')
          .select('classroom_id')
          .eq('educator_id', educatorId)
        const cids = (ecData ?? []).map((r) => (r as { classroom_id: string }).classroom_id)
        if (cids.length > 0) query = query.in('classroom_id', cids)
      }

      const { data } = await query
      setResults(((data ?? []) as Student[]).filter((s) => !excludeIds.has(s.id)))
      setLoading(false)
    },
    [schoolId, educatorId, isAdmin, excludeIds]
  )

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 200)
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search learner by name..."
          className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-light" />}
      </div>
      {results.length > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-lg border border-bg-muted bg-bg-card">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s); setQuery(''); setResults([]) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                {s.first_name[0]}{s.last_name[0]}
              </div>
              <span className="text-text">{s.first_name} {s.last_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Modal
// ============================================================

export default function IncidentReportModal({ open, onClose }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  // Form state
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [incidentTime, setIncidentTime] = useState('')
  const [location, setLocation] = useState('')
  const [locationOther, setLocationOther] = useState('')
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('')
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('')
  const [description, setDescription] = useState('')
  const [immediateActions, setImmediateActions] = useState('')
  const [witnesses, setWitnesses] = useState('')
  const [parentNotified, setParentNotified] = useState(false)
  const [notificationMethod, setNotificationMethod] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [assignedToName, setAssignedToName] = useState('')

  // Students
  const [students, setStudents] = useState<StudentTag[]>([])

  // Classrooms
  const [classroomIds, setClassroomIds] = useState<string[]>([])
  const [availableClassrooms, setAvailableClassrooms] = useState<Classroom[]>([])

  // Attachments
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Educator search for "assign to"
  const [educatorSearch, setEducatorSearch] = useState('')
  const [educatorResults, setEducatorResults] = useState<{ id: string; full_name: string }[]>([])
  const [showEducatorDropdown, setShowEducatorDropdown] = useState(false)

  const [saving, setSaving] = useState(false)

  // Load classrooms on open
  useEffect(() => {
    if (!open || !profile) return
    supabase
      .from('classrooms')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('name')
      .then(({ data }) => setAvailableClassrooms((data ?? []) as Classroom[]))
  }, [open, profile])

  // Reset on close
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setIncidentDate(new Date().toISOString().slice(0, 10))
        setIncidentTime('')
        setLocation('')
        setLocationOther('')
        setIncidentType('')
        setSeverity('')
        setDescription('')
        setImmediateActions('')
        setWitnesses('')
        setParentNotified(false)
        setNotificationMethod('')
        setAssignedTo('')
        setAssignedToName('')
        setStudents([])
        setClassroomIds([])
        setFiles([])
        setEducatorSearch('')
        setEducatorResults([])
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Educator search for assignment
  const searchEducators = useCallback(async (q: string) => {
    if (!profile || q.length < 1) { setEducatorResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('school_id', profile.school_id)
      .in('role', ['admin', 'educator'])
      .ilike('full_name', `%${q}%`)
      .limit(6)
    setEducatorResults((data ?? []) as { id: string; full_name: string }[])
  }, [profile])

  function handleAddStudent(student: Student) {
    setStudents((prev) => [
      ...prev,
      {
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        role: 'involved',
        notes: '',
      },
    ])
  }

  function handleRemoveStudent(studentId: string) {
    setStudents((prev) => prev.filter((s) => s.student_id !== studentId))
  }

  function handleStudentRoleChange(studentId: string, role: IncidentStudentRole) {
    setStudents((prev) => prev.map((s) => s.student_id === studentId ? { ...s, role } : s))
  }

  function handleStudentNotesChange(studentId: string, notes: string) {
    setStudents((prev) => prev.map((s) => s.student_id === studentId ? { ...s, notes } : s))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleClassroom(id: string) {
    setClassroomIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const canSubmit =
    incidentDate &&
    location &&
    (location !== 'other' || locationOther) &&
    incidentType &&
    severity &&
    description.trim().length > 0

  async function handleSubmit() {
    if (!profile || !canSubmit) return
    setSaving(true)

    try {
      const reportId = await createIncidentReport({
        report: {
          school_id: profile.school_id,
          reported_by: profile.id,
          incident_date: new Date(incidentDate).toISOString(),
          incident_time: incidentTime || null,
          location: location === 'other' ? locationOther : location,
          incident_type: incidentType as IncidentType,
          severity: severity as IncidentSeverity,
          description: description.trim(),
          immediate_actions_taken: immediateActions.trim() || null,
          witnesses: witnesses.trim() || null,
          parent_notified: parentNotified,
          parent_notification_method: parentNotified ? notificationMethod || null : null,
          assigned_to: assignedTo || null,
        },
        students: students.map((s) => ({
          student_id: s.student_id,
          role: s.role,
          notes: s.notes || undefined,
        })),
        classroom_ids: classroomIds,
      })

      // Upload attachments
      for (const file of files) {
        try {
          await addIncidentAttachment(reportId, file, profile.id)
        } catch (e) {
          console.error('Failed to upload attachment:', e)
        }
      }

      toast('Incident report filed successfully', 'success')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !profile) return null

  const excludeStudentIds = new Set(students.map((s) => s.student_id))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="glass-modal relative z-10 flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-2xl sm:rounded-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-alert-500" />
            <h2 className="text-base font-bold text-text">Incident Report</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 1. Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Incident Date *</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Time (optional)</label>
              <input
                type="text"
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>

          {/* 2. Location */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Location *</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Select location...</option>
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            {location === 'other' && (
              <input
                type="text"
                value={locationOther}
                onChange={(e) => setLocationOther(e.target.value)}
                placeholder="Specify location..."
                className="mt-2 w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            )}
          </div>

          {/* 3. Incident Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Incident Type *</label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value as IncidentType)}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Select type...</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* 4. Severity */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Severity *</label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setSeverity(level.value)}
                  className={clsx(
                    'rounded-lg border-2 px-3 py-2 text-center text-sm font-medium transition-all',
                    severity === level.value
                      ? `${level.bg} ${level.color} ring-2`
                      : 'border-bg-muted bg-bg text-text-muted hover:border-bg-muted/80'
                  )}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Students Involved */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Students Involved</label>
            <StudentSearchInline
              schoolId={profile.school_id}
              educatorId={profile.id}
              role={profile.role}
              excludeIds={excludeStudentIds}
              onSelect={handleAddStudent}
            />
            {students.length > 0 && (
              <div className="mt-2 space-y-2">
                {students.map((s) => (
                  <div key={s.student_id} className="rounded-lg border border-bg-muted bg-bg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <span className="text-sm font-medium text-text">{s.first_name} {s.last_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={s.role}
                          onChange={(e) => handleStudentRoleChange(s.student_id, e.target.value as IncidentStudentRole)}
                          className="rounded border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text focus:outline-none"
                        >
                          {STUDENT_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button onClick={() => handleRemoveStudent(s.student_id)} className="text-text-light hover:text-alert-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={s.notes}
                      onChange={(e) => handleStudentNotesChange(s.student_id, e.target.value)}
                      placeholder="Notes for this student (optional)..."
                      className="mt-2 w-full rounded border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text placeholder:text-text-light focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Classrooms Involved */}
          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Classrooms Involved (optional)</label>
            <div className="flex flex-wrap gap-2">
              {availableClassrooms.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClassroom(c.id)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    classroomIds.includes(c.id)
                      ? 'bg-primary-500 text-white'
                      : 'bg-bg-muted text-text-muted hover:bg-primary-50 hover:text-primary-600'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {classroomIds.length > 0 && (
              <p className="mt-1.5 text-[11px] text-accent-600">
                All currently enrolled students in selected classes will be linked to this incident.
              </p>
            )}
          </div>

          {/* 7. Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened in detail. Include the sequence of events, who was involved, and any relevant context."
              rows={4}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 8. Immediate Actions Taken */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Immediate Actions Taken</label>
            <textarea
              value={immediateActions}
              onChange={(e) => setImmediateActions(e.target.value)}
              placeholder="What steps were taken immediately? (e.g., first aid administered, students separated, parent called)"
              rows={2}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 9. Witnesses */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Witnesses</label>
            <input
              type="text"
              value={witnesses}
              onChange={(e) => setWitnesses(e.target.value)}
              placeholder="Names of witnesses..."
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 10. Attachments */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Attachments</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-bg-muted px-4 py-3 text-sm text-text-light transition-colors hover:border-primary-300 hover:bg-primary-50/30"
            >
              <Upload className="h-4 w-4" />
              <span>Click to add files (images, PDFs)</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-bg-muted px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type.startsWith('image/') ? (
                        <FileImage className="h-4 w-4 shrink-0 text-primary-500" />
                      ) : (
                        <FileIcon className="h-4 w-4 shrink-0 text-text-light" />
                      )}
                      <span className="truncate text-xs text-text">{file.name}</span>
                      <span className="text-[10px] text-text-light">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button onClick={() => handleRemoveFile(i)} className="shrink-0 text-text-light hover:text-alert-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 11. Parent Notification */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={parentNotified}
                onChange={(e) => setParentNotified(e.target.checked)}
                className="h-4 w-4 rounded border-bg-muted text-primary-500 focus:ring-primary-200"
              />
              <span className="text-sm text-text">Parent/guardian has been notified</span>
            </label>
            {parentNotified && (
              <select
                value={notificationMethod}
                onChange={(e) => setNotificationMethod(e.target.value)}
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="">Select notification method...</option>
                {NOTIFICATION_METHODS.map((m) => (
                  <option key={m} value={m.toLowerCase()}>{m}</option>
                ))}
              </select>
            )}
          </div>

          {/* 12. Assign Follow-up */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Assign Follow-up To (optional)</label>
            {assignedTo ? (
              <div className="flex items-center justify-between rounded-lg border border-bg-muted bg-bg px-3 py-2">
                <span className="text-sm text-text">{assignedToName}</span>
                <button onClick={() => { setAssignedTo(''); setAssignedToName('') }} className="text-text-light hover:text-alert-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={educatorSearch}
                  onChange={(e) => {
                    setEducatorSearch(e.target.value)
                    setShowEducatorDropdown(true)
                    searchEducators(e.target.value)
                  }}
                  onFocus={() => setShowEducatorDropdown(true)}
                  placeholder="Search educator or admin..."
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                {showEducatorDropdown && educatorResults.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-bg-muted bg-bg-card shadow-lg">
                    {educatorResults.map((edu) => (
                      <button
                        key={edu.id}
                        onClick={() => {
                          setAssignedTo(edu.id)
                          setAssignedToName(edu.full_name)
                          setEducatorSearch('')
                          setShowEducatorDropdown(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                          {edu.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span>{edu.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-bg-muted px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className={clsx(
              'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors',
              severity === 'critical'
                ? 'bg-alert-500 hover:bg-alert-600 disabled:bg-alert-300'
                : 'bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300'
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {saving ? 'Filing Report...' : 'File Incident Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

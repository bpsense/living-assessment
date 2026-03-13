import { useState, useEffect } from 'react'
import { X, Loader2, Search, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import type { StudentStatus } from '../../types/database'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  classroomId: string
  schoolId: string
  onSaved: () => void
}

// ============================================================
// Component
// ============================================================

export default function AddStudentModal({
  open,
  onClose,
  classroomId,
  schoolId,
  onSaved,
}: Props) {
  const { toast } = useToast()

  // Basic info
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [dob, setDob] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  // Cultural & Language
  const [nationality, setNationality] = useState('')
  const [firstLanguage, setFirstLanguage] = useState('')
  const [additionalLanguages, setAdditionalLanguages] = useState('')

  // Medical & Support
  const [medicalConditions, setMedicalConditions] = useState('')
  const [supportNeeds, setSupportNeeds] = useState('')
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [medications, setMedications] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<'create' | 'existing'>('create')

  // Existing students state
  const [existingStudents, setExistingStudents] = useState<{ id: string; first_name: string; last_name: string; classroom_name: string | null }[]>([])
  const [existingSearch, setExistingSearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Reset form on open
  useEffect(() => {
    if (open) {
      setFirstName('')
      setLastName('')
      setMiddleName('')
      setPreferredName('')
      setDob('')
      setPronouns('')
      setGradeLevel('')
      setEnrollmentDate(new Date().toISOString().split('T')[0])
      setNationality('')
      setFirstLanguage('')
      setAdditionalLanguages('')
      setMedicalConditions('')
      setSupportNeeds('')
      setDietaryRestrictions('')
      setMedications('')
      setError(null)
      setActiveTab('create')
      setExistingSearch('')
      setSelectedStudentIds(new Set())
    }
  }, [open])

  // Fetch existing students when "Add Existing" tab is selected
  useEffect(() => {
    if (!open || activeTab !== 'existing') return

    setLoadingExisting(true)
    supabase
      .from('students')
      .select('id, first_name, last_name, classroom:classrooms(name)')
      .eq('school_id', schoolId)
      .eq('student_status', 'active')
      .neq('classroom_id', classroomId) // Not already in this classroom
      .order('last_name')
      .then(({ data }) => {
        setExistingStudents(
          (data ?? []).map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            classroom_name: (s.classroom as any)?.name ?? null,
          }))
        )
        setLoadingExisting(false)
      })
  }, [open, activeTab, schoolId, classroomId])

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose, saving])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const langArray = additionalLanguages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)

      const { error: insertError } = await supabase.from('students').insert({
        school_id: schoolId,
        classroom_id: classroomId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim() || null,
        preferred_name: preferredName.trim() || null,
        pronouns: pronouns.trim() || null,
        date_of_birth: dob || null,
        grade_level: gradeLevel.trim() || null,
        nationality: nationality.trim() || null,
        first_language: firstLanguage.trim() || null,
        additional_languages: langArray.length > 0 ? langArray : null,
        medical_conditions: medicalConditions.trim() || null,
        student_support_needs: supportNeeds.trim() || null,
        dietary_restrictions: dietaryRestrictions.trim() || null,
        medications: medications.trim() || null,
        enrollment_date: enrollmentDate || null,
        student_status: 'active' as StudentStatus,
      })

      if (insertError) throw insertError

      toast('Learner added!', 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add learner')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExisting() {
    if (selectedStudentIds.size === 0) {
      setError('Select at least one student')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Update each selected student's classroom_id
      for (const studentId of selectedStudentIds) {
        const { error: updateErr } = await supabase
          .from('students')
          .update({ classroom_id: classroomId })
          .eq('id', studentId)

        if (updateErr) throw updateErr
      }

      toast(`${selectedStudentIds.size} learner${selectedStudentIds.size > 1 ? 's' : ''} added to classroom!`, 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add learners')
    } finally {
      setSaving(false)
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  if (!open) return null

  const filteredExisting = existingStudents.filter(s => {
    if (!existingSearch) return true
    const q = existingSearch.toLowerCase()
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-bg-card shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text">Add Learner</h2>
          <button
            onClick={() => !saving && onClose()}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-bg-muted">
          <button
            onClick={() => { setActiveTab('create'); setError(null) }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => { setActiveTab('existing'); setError(null) }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'existing'
                ? 'border-b-2 border-primary-500 text-primary-600'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Add Existing
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {error && (
            <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </div>
          )}

          {activeTab === 'existing' ? (
            /* ── Add Existing Tab ─────────────────────── */
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  type="text"
                  placeholder="Search students by name..."
                  value={existingSearch}
                  onChange={e => setExistingSearch(e.target.value)}
                  className="w-full rounded-lg border border-bg-muted bg-bg py-2 pl-10 pr-3 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>

              {loadingExisting ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : filteredExisting.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-light">
                  {existingSearch ? 'No students found matching your search' : 'No students available to add'}
                </p>
              ) : (
                <>
                  {selectedStudentIds.size > 0 && (
                    <p className="text-xs font-medium text-primary-600">
                      {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''} selected
                    </p>
                  )}
                  <div className="max-h-[400px] overflow-y-auto rounded-lg border border-bg-muted">
                    {filteredExisting.map(s => {
                      const isSelected = selectedStudentIds.has(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleStudentSelection(s.id)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-bg-muted ${
                            isSelected ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            isSelected ? 'border-primary-500 bg-primary-500' : 'border-bg-muted bg-bg-card'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-text">{s.first_name} {s.last_name}</span>
                            {s.classroom_name && (
                              <span className="ml-2 text-xs text-text-light">Currently in: {s.classroom_name}</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Create New Tab ──────────────────────── */
            <>

          {/* Section 1: Basic Info */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Basic Information
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="First Name" required value={firstName} onChange={setFirstName} placeholder="e.g. Amara" />
              <FormField label="Last Name" required value={lastName} onChange={setLastName} placeholder="e.g. Johnson" />
              <FormField label="Middle Name" value={middleName} onChange={setMiddleName} />
              <FormField label="Preferred Name" value={preferredName} onChange={setPreferredName} placeholder="e.g. AJ" />
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <FormField label="Pronouns" value={pronouns} onChange={setPronouns} placeholder="e.g. she/her" />
              <FormField label="Grade Level" value={gradeLevel} onChange={setGradeLevel} placeholder="e.g. 3" />
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Enrollment Date
                </label>
                <input
                  type="date"
                  value={enrollmentDate}
                  onChange={(e) => setEnrollmentDate(e.target.value)}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Cultural & Language */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Cultural & Language
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nationality" value={nationality} onChange={setNationality} />
              <FormField label="First Language" value={firstLanguage} onChange={setFirstLanguage} placeholder="e.g. English" />
              <div className="sm:col-span-2">
                <FormField
                  label="Additional Languages"
                  value={additionalLanguages}
                  onChange={setAdditionalLanguages}
                  placeholder="Comma-separated, e.g. Spanish, French"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Medical & Support */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Health & Support
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextareaField label="Medical Conditions" value={medicalConditions} onChange={setMedicalConditions} />
              <TextareaField label="Medications" value={medications} onChange={setMedications} />
              <TextareaField label="Dietary Restrictions" value={dietaryRestrictions} onChange={setDietaryRestrictions} />
              <TextareaField label="Support Needs" value={supportNeeds} onChange={setSupportNeeds} />
            </div>
          </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-4">
          <button
            onClick={() => !saving && onClose()}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
          >
            Cancel
          </button>
          {activeTab === 'existing' ? (
            <button
              onClick={handleAddExisting}
              disabled={saving || selectedStudentIds.size === 0}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {selectedStudentIds.size > 0 ? `${selectedStudentIds.size} ` : ''}Learner{selectedStudentIds.size !== 1 ? 's' : ''}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !firstName.trim() || !lastName.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Learner
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Form field helpers
// ============================================================

function FormField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {label} {required && <span className="text-alert-500">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
    </div>
  )
}

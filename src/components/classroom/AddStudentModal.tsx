import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
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
    }
  }, [open])

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

  if (!open) return null

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
          <h2 className="text-base font-semibold text-text">Add New Learner</h2>
          <button
            onClick={() => !saving && onClose()}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {error && (
            <div className="rounded-lg bg-alert-50 px-3 py-2 text-sm text-alert-600">
              {error}
            </div>
          )}

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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-bg-muted px-5 py-4">
          <button
            onClick={() => !saving && onClose()}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Learner
          </button>
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

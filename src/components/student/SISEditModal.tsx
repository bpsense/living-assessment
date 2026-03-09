import { useState, useEffect } from 'react'
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Star,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentContacts } from '../../lib/sis-data'
import { useToast } from '../Toast'
import type {
  Student,
  StudentContact,
  ContactType,
  StudentStatus,
} from '../../types/database'

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  student: Student
  onSaved: () => void
}

// ============================================================
// Contact row state
// ============================================================

interface ContactRow {
  id: string | null // null = new
  contact_type: ContactType
  full_name: string
  relationship: string
  phone: string
  email: string
  is_primary: boolean
  address: string
  notes: string
  _deleted?: boolean
}

function contactToRow(c: StudentContact): ContactRow {
  return {
    id: c.id,
    contact_type: c.contact_type,
    full_name: c.full_name,
    relationship: c.relationship ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    is_primary: c.is_primary,
    address: c.address ?? '',
    notes: c.notes ?? '',
  }
}

// ============================================================
// Component
// ============================================================

export default function SISEditModal({ open, onClose, student, onSaved }: Props) {
  const { toast } = useToast()
  const { contacts } = useStudentContacts(student.id)

  // Student fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [dob, setDob] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [nationality, setNationality] = useState('')
  const [firstLanguage, setFirstLanguage] = useState('')
  const [additionalLanguages, setAdditionalLanguages] = useState('')
  const [medicalConditions, setMedicalConditions] = useState('')
  const [supportNeeds, setSupportNeeds] = useState('')
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [medications, setMedications] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState('')
  const [studentStatus, setStudentStatus] = useState<StudentStatus>('active')

  // Contact rows
  const [contactRows, setContactRows] = useState<ContactRow[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate form on open
  useEffect(() => {
    if (!open) return
    setFirstName(student.first_name)
    setLastName(student.last_name)
    setMiddleName(student.middle_name ?? '')
    setPreferredName(student.preferred_name ?? '')
    setPronouns(student.pronouns ?? '')
    setDob(student.date_of_birth ?? '')
    setGradeLevel(student.grade_level ?? '')
    setNationality(student.nationality ?? '')
    setFirstLanguage(student.first_language ?? '')
    setAdditionalLanguages(student.additional_languages?.join(', ') ?? '')
    setMedicalConditions(student.medical_conditions ?? '')
    setSupportNeeds(student.student_support_needs ?? '')
    setDietaryRestrictions(student.dietary_restrictions ?? '')
    setMedications(student.medications ?? '')
    setEnrollmentDate(student.enrollment_date ?? '')
    setStudentStatus(student.student_status)
    setError(null)
  }, [open, student])

  // Populate contacts when loaded
  useEffect(() => {
    if (open && contacts.length > 0) {
      setContactRows(contacts.map(contactToRow))
    } else if (open) {
      setContactRows([])
    }
  }, [open, contacts])

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

  // Add contact row
  function addContactRow() {
    setContactRows((prev) => [
      ...prev,
      {
        id: null,
        contact_type: 'parent',
        full_name: '',
        relationship: '',
        phone: '',
        email: '',
        is_primary: prev.length === 0,
        address: '',
        notes: '',
      },
    ])
  }

  function updateContactRow(index: number, field: keyof ContactRow, value: unknown) {
    setContactRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function removeContactRow(index: number) {
    setContactRows((prev) => {
      const row = prev[index]
      if (row.id) {
        // Mark existing for deletion
        return prev.map((r, i) => (i === index ? { ...r, _deleted: true } : r))
      }
      // Remove new row entirely
      return prev.filter((_, i) => i !== index)
    })
  }

  // Save
  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // 1. Update student record
      const langArray = additionalLanguages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)

      const { error: studentError } = await supabase
        .from('students')
        .update({
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
          student_status: studentStatus,
        })
        .eq('id', student.id)

      if (studentError) throw studentError

      // 2. Handle contacts — delete, update, insert
      const toDelete = contactRows.filter((r) => r._deleted && r.id)
      const toUpdate = contactRows.filter((r) => !r._deleted && r.id && r.full_name.trim())
      const toInsert = contactRows.filter((r) => !r._deleted && !r.id && r.full_name.trim())

      // Delete
      for (const row of toDelete) {
        await supabase.from('student_contacts').delete().eq('id', row.id!)
      }

      // Update existing
      for (const row of toUpdate) {
        await supabase
          .from('student_contacts')
          .update({
            contact_type: row.contact_type,
            full_name: row.full_name.trim(),
            relationship: row.relationship.trim() || null,
            phone: row.phone.trim() || null,
            email: row.email.trim() || null,
            is_primary: row.is_primary,
            address: row.address.trim() || null,
            notes: row.notes.trim() || null,
          })
          .eq('id', row.id!)
      }

      // Insert new
      if (toInsert.length > 0) {
        await supabase.from('student_contacts').insert(
          toInsert.map((row) => ({
            student_id: student.id,
            school_id: student.school_id,
            contact_type: row.contact_type,
            full_name: row.full_name.trim(),
            relationship: row.relationship.trim() || null,
            phone: row.phone.trim() || null,
            email: row.email.trim() || null,
            is_primary: row.is_primary,
            address: row.address.trim() || null,
            notes: row.notes.trim() || null,
          }))
        )
      }

      toast('Learner information saved', 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const visibleContacts = contactRows.filter((r) => !r._deleted)

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
          <h2 className="text-base font-semibold text-text">Edit Learner Information</h2>
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
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  Status
                </label>
                <select
                  value={studentStatus}
                  onChange={(e) => setStudentStatus(e.target.value as StudentStatus)}
                  className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
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

          {/* Section 4: Emergency Contacts */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Emergency Contacts
              </h3>
              <button
                onClick={addContactRow}
                className="flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add Contact
              </button>
            </div>

            {visibleContacts.length === 0 ? (
              <p className="text-xs text-text-light">
                No emergency contacts. Click "Add Contact" to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {contactRows.map((row, i) => {
                  if (row._deleted) return null
                  return (
                    <div key={row.id ?? `new-${i}`} className="rounded-lg border border-bg-muted bg-bg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <select
                            value={row.contact_type}
                            onChange={(e) => updateContactRow(i, 'contact_type', e.target.value)}
                            className="rounded-lg border border-bg-muted bg-bg-card px-2 py-1 text-xs text-text focus:border-primary-400 focus:outline-none"
                          >
                            <option value="parent">Parent</option>
                            <option value="guardian">Guardian</option>
                            <option value="emergency">Emergency</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs text-text-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.is_primary}
                              onChange={(e) => updateContactRow(i, 'is_primary', e.target.checked)}
                              className="h-3 w-3 rounded border-bg-muted text-primary-500"
                            />
                            <Star className="h-3 w-3" /> Primary
                          </label>
                        </div>
                        <button
                          onClick={() => removeContactRow(i)}
                          className="rounded-lg p-1 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
                          title="Remove contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={row.full_name}
                          onChange={(e) => updateContactRow(i, 'full_name', e.target.value)}
                          placeholder="Full name *"
                          className="w-full rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                        />
                        <input
                          value={row.relationship}
                          onChange={(e) => updateContactRow(i, 'relationship', e.target.value)}
                          placeholder="Relationship (e.g. Mother)"
                          className="w-full rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                        />
                        <input
                          value={row.phone}
                          onChange={(e) => updateContactRow(i, 'phone', e.target.value)}
                          placeholder="Phone"
                          className="w-full rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                        />
                        <input
                          value={row.email}
                          onChange={(e) => updateContactRow(i, 'email', e.target.value)}
                          placeholder="Email"
                          className="w-full rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none"
                        />
                        <input
                          value={row.address}
                          onChange={(e) => updateContactRow(i, 'address', e.target.value)}
                          placeholder="Address"
                          className="w-full rounded-lg border border-bg-muted bg-bg-card px-2.5 py-1.5 text-xs text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none sm:col-span-2"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
            Save Changes
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

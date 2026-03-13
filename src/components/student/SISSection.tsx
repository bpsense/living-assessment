import { useState, useEffect } from 'react'
import { differenceInYears } from 'date-fns'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  User,
  Globe,
  Heart,
  Phone,
  Mail,
  MapPin,
  Shield,
  Star,
  Copy,
  RefreshCw,
  Check,
  Loader2,
  UserPlus,
} from 'lucide-react'
import { useStudentContacts } from '../../lib/sis-data'
import { regenerateFamilyCode, useLinkedParents } from '../../lib/family-data'
import { inviteUser } from '../../lib/invite-user'
import { supabase } from '../../lib/supabase'
import StudentDocuments from './StudentDocuments'
import type { Student, StudentContact } from '../../types/database'
import type { LinkedParent } from '../../lib/family-data'

// ============================================================
// Status badge colours
// ============================================================

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success-50 text-success-600',
  inactive: 'bg-caution-50 text-caution-600',
  withdrawn: 'bg-alert-50 text-alert-600',
}

// ============================================================
// Props
// ============================================================

interface Props {
  student: Student
  onEdit: () => void
  /** Current user's role — family code hidden from parents */
  role?: string
  /** Called after family code is regenerated */
  onRefetch?: () => void
}

// ============================================================
// Component
// ============================================================

export default function SISSection({ student, onEdit, role, onRefetch }: Props) {
  const { contacts, loading: contactsLoading } = useStudentContacts(student.id)
  const { parents: linkedParents, loading: parentsLoading } = useLinkedParents(student.id)
  const showFamilyCode = role !== 'parent'

  // Expand by default if any SIS fields are populated
  const hasData =
    student.middle_name ||
    student.preferred_name ||
    student.pronouns ||
    student.nationality ||
    student.first_language ||
    student.medical_conditions ||
    student.student_support_needs ||
    student.dietary_restrictions ||
    student.medications ||
    student.enrollment_date ||
    contacts.length > 0 ||
    linkedParents.length > 0

  const [open, setOpen] = useState(!!hasData)

  // Auto-expand when async data (contacts/parents) arrives after initial render
  useEffect(() => {
    if (linkedParents.length > 0 || contacts.length > 0) {
      setOpen(true)
    }
  }, [linkedParents.length, contacts.length])

  const age = student.date_of_birth
    ? differenceInYears(new Date(), new Date(student.date_of_birth))
    : null

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ')

  const languages = [
    student.first_language,
    ...(student.additional_languages ?? []),
  ].filter(Boolean)

  return (
    <section className="rounded-xl border border-bg-muted bg-bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5"
      >
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary-500" />
          <h2 className="text-sm font-semibold text-text">Learner Information</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="rounded-lg p-1.5 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
            title="Edit learner information"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {open ? (
            <ChevronUp className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDown className="h-5 w-5 text-text-muted" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-bg-muted px-5 pb-5 pt-4 space-y-5">
          {!hasData && !contactsLoading && !parentsLoading ? (
            <p className="text-sm text-text-light text-center py-4">
              No extended learner information recorded yet. Click the edit button to add details.
            </p>
          ) : (
            <>
              {/* ── Demographics ─────────────────────── */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  <User className="h-3.5 w-3.5" /> Demographics
                </h3>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Full Name" value={
                    student.preferred_name
                      ? `${fullName} ("${student.preferred_name}")`
                      : fullName
                  } />
                  <Field label="Pronouns" value={student.pronouns} />
                  <Field
                    label="Date of Birth"
                    value={
                      student.date_of_birth
                        ? `${new Date(student.date_of_birth + 'T00:00:00').toLocaleDateString()}${age !== null ? ` (age ${age})` : ''}`
                        : null
                    }
                  />
                </div>
              </div>

              {/* ── Cultural & Language ──────────────── */}
              {(student.nationality || languages.length > 0) && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <Globe className="h-3.5 w-3.5" /> Cultural & Language
                  </h3>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Nationality" value={student.nationality} />
                    <Field
                      label="Languages"
                      value={languages.length > 0 ? languages.join(', ') : null}
                    />
                  </div>
                </div>
              )}

              {/* ── Enrollment ──────────────────────── */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  <Shield className="h-3.5 w-3.5" /> Enrollment
                </h3>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-xs text-text-light">Status</span>
                    <span
                      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[student.student_status] ?? 'bg-bg-muted text-text-muted'}`}
                    >
                      {student.student_status.charAt(0).toUpperCase() + student.student_status.slice(1)}
                    </span>
                  </div>
                  <Field label="Learner Number" value={student.student_number} />
                  <Field label="Grade Level" value={student.grade_level} />
                  <Field
                    label="Enrollment Date"
                    value={
                      student.enrollment_date
                        ? new Date(student.enrollment_date + 'T00:00:00').toLocaleDateString()
                        : null
                    }
                  />
                  {showFamilyCode && student.family_code && (
                    <FamilyCodeField
                      code={student.family_code}
                      studentId={student.id}
                      onRegenerated={onRefetch}
                    />
                  )}
                </div>
              </div>

              {/* ── Health & Support ─────────────────── */}
              {(student.medical_conditions ||
                student.medications ||
                student.dietary_restrictions ||
                student.student_support_needs) && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <Heart className="h-3.5 w-3.5" /> Health & Support
                  </h3>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <Field label="Medical Conditions" value={student.medical_conditions} />
                    <Field label="Medications" value={student.medications} />
                    <Field label="Dietary Restrictions" value={student.dietary_restrictions} />
                    <Field label="Support Needs" value={student.student_support_needs} />
                  </div>
                </div>
              )}

              {/* ── Emergency Contacts ──────────────── */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  <Phone className="h-3.5 w-3.5" /> Emergency Contacts
                  {contacts.length > 0 && (
                    <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      {contacts.length}
                    </span>
                  )}
                </h3>

                {contactsLoading ? (
                  <p className="text-xs text-text-light">Loading contacts...</p>
                ) : contacts.length === 0 ? (
                  <p className="text-xs text-text-light">
                    No emergency contacts added yet. Click edit to add contacts.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {contacts.map((contact) => (
                      <ContactCard key={contact.id} contact={contact} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Linked Family Accounts ───────────── */}
              {showFamilyCode && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <User className="h-3.5 w-3.5" /> Linked Family Accounts
                    {linkedParents.length > 0 && (
                      <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                        {linkedParents.length}
                      </span>
                    )}
                  </h3>

                  {parentsLoading ? (
                    <p className="text-xs text-text-light">Loading...</p>
                  ) : linkedParents.length === 0 ? (
                    <p className="text-xs text-text-light">
                      No family accounts linked yet. Share the learner number with a parent to link.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {linkedParents.map((parent) => (
                        <LinkedParentCard key={parent.id} parent={parent} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Linked Learner Account ──────────── */}
              {showFamilyCode && (
                <LinkedLearnerAccount student={student} />
              )}

              {/* ── Documents ────────────────────────── */}
              <StudentDocuments studentId={student.id} schoolId={student.school_id} />
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ============================================================
// Field display helper
// ============================================================

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs text-text-light">{label}</span>
      <p className="text-sm text-text">{value}</p>
    </div>
  )
}

// ============================================================
// Contact card
// ============================================================

// ============================================================
// Family code field with copy + regenerate
// ============================================================

function FamilyCodeField({
  code,
  studentId,
  onRegenerated,
}: {
  code: string
  studentId: string
  onRegenerated?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    const { error } = await regenerateFamilyCode(studentId)
    setRegenerating(false)
    if (!error) onRegenerated?.()
  }

  return (
    <div>
      <span className="text-xs text-text-light">Family Code</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold tracking-widest text-text">
          {code}
        </span>
        <button
          onClick={handleCopy}
          className="rounded p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="rounded p-1 text-text-light transition-colors hover:bg-bg-muted hover:text-text disabled:opacity-50"
          title="Generate new code"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Contact card
// ============================================================

function ContactCard({ contact }: { contact: StudentContact }) {
  return (
    <div className="rounded-lg border border-bg-muted bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{contact.full_name}</span>
            {contact.is_primary && (
              <span className="flex items-center gap-0.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                <Star className="h-2.5 w-2.5" /> Primary
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">
              {contact.contact_type}
            </span>
            {contact.relationship && <span>{contact.relationship}</span>}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {contact.phone && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Phone className="h-3 w-3" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Mail className="h-3 w-3" />
            <span>{contact.email}</span>
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <MapPin className="h-3 w-3" />
            <span>{contact.address}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Linked parent card
// ============================================================

function LinkedParentCard({ parent }: { parent: LinkedParent }) {
  const initials = parent.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="rounded-lg border border-bg-muted bg-bg p-3">
      <div className="flex items-center gap-3">
        {parent.avatar_url ? (
          <img
            src={parent.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{parent.full_name}</p>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{parent.email}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Linked Learner Account section
// ============================================================

function LinkedLearnerAccount({ student }: { student: Student }) {
  const [linkedProfile, setLinkedProfile] = useState<{ id: string; full_name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState(`${student.first_name} ${student.last_name}`)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Check if this student already has a linked learner account
  useEffect(() => {
    setLoading(true)
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('student_id', student.id)
      .eq('role', 'learner')
      .maybeSingle()
      .then(({ data }) => {
        setLinkedProfile(data ?? null)
        setLoading(false)
      })
  }, [student.id])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteFullName.trim()) return

    setInviting(true)
    setInviteError(null)

    const { error } = await inviteUser({
      email: inviteEmail.trim(),
      fullName: inviteFullName.trim(),
      schoolId: student.school_id,
      role: 'learner',
      studentId: student.id,
    })

    if (error) {
      setInviteError(error)
    } else {
      setInviteSuccess(true)
      setShowInviteForm(false)
      // Refetch linked profile
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('student_id', student.id)
        .eq('role', 'learner')
        .maybeSingle()
      setLinkedProfile(data ?? null)
    }
    setInviting(false)
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        <UserPlus className="h-3.5 w-3.5" /> Linked Learner Account
      </h3>

      {loading ? (
        <p className="text-xs text-text-light">Loading...</p>
      ) : linkedProfile ? (
        <div className="rounded-lg border border-bg-muted bg-bg p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-50 text-xs font-bold text-success-700">
              {linkedProfile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-text">{linkedProfile.full_name}</p>
                <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
                  Linked
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{linkedProfile.email}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {inviteSuccess ? (
            <div className="rounded-lg border border-success-200 bg-success-50 p-3">
              <p className="text-xs font-medium text-success-700">
                Invitation sent! The learner will receive an email to set up their account.
              </p>
            </div>
          ) : showInviteForm ? (
            <form onSubmit={handleInvite} className="rounded-lg border border-bg-muted bg-bg p-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteFullName}
                  onChange={e => setInviteFullName(e.target.value)}
                  className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="learner@email.com"
                  className="w-full rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-300"
                />
              </div>
              {inviteError && (
                <p className="text-xs text-alert-600">{inviteError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInviteForm(false); setInviteError(null) }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-bg-muted bg-bg p-3">
              <p className="flex-1 text-xs text-text-light">
                No learner account linked. Invite someone to create an account that can access this learner's profile.
              </p>
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
              >
                <UserPlus className="h-3 w-3" />
                Invite Learner
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Building2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileText,
  Trash2,
  BookOpen,
  Heart,
  GraduationCap,
  FileUp,
  Layers,
  ExternalLink,
  CheckCircle,
  XCircle,
  ListTree,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useAccessControl } from '../lib/access-control'
import { useSchoolProfile, useSchoolProfileVisibility, updateSchoolProfileVisibility } from '../lib/school-data'
import { DimensionIcon } from '../components/student/DimensionIcon'
import type { SchoolContext, SchoolDocument, Dimension, SchoolProfileSectionKey, SchoolProfileVisibility } from '../types/database'


// ============================================================
// Category badge colors (mirrors DimensionListItem.tsx)
// ============================================================

const CATEGORY_STYLES: Record<string, string> = {
  Academic: 'bg-primary-50 text-primary-700',
  'Creative & Arts': 'bg-purple-50 text-purple-700',
  'Physical & Health': 'bg-emerald-50 text-emerald-700',
  'Social & Emotional': 'bg-amber-50 text-amber-700',
  Cognitive: 'bg-sky-50 text-sky-700',
}

// ============================================================
// Context field config
// ============================================================

interface FieldConfig {
  key: keyof SchoolContext
  label: string
  placeholder: string
  rows: number
}

const IDENTITY_FIELDS: FieldConfig[] = [
  {
    key: 'mission',
    label: 'Mission Statement',
    placeholder: 'What is your school\'s mission? e.g. "To nurture curious, compassionate learners who…"',
    rows: 3,
  },
  {
    key: 'core_values',
    label: 'Core Values',
    placeholder: 'List your school\'s core values, e.g. "Curiosity, Collaboration, Courage, Compassion"',
    rows: 2,
  },
]

const PEDAGOGY_FIELDS: FieldConfig[] = [
  {
    key: 'pedagogical_approach',
    label: 'Pedagogical Philosophy',
    placeholder:
      'Describe your pedagogical approach, e.g. "Reggio Emilia-inspired", "Project-based learning", "Montessori"…',
    rows: 4,
  },
  {
    key: 'teaching_methodologies',
    label: 'Key Teaching Methodologies',
    placeholder:
      'What teaching methods does your school emphasize? e.g. "Inquiry-based learning, collaborative projects, nature-based education…"',
    rows: 3,
  },
  {
    key: 'assessment_philosophy',
    label: 'Assessment Philosophy',
    placeholder:
      'How does your school view assessment? e.g. "We use formative, narrative-based assessment focused on growth rather than grades…"',
    rows: 3,
  },
]

const CURRICULUM_FIELDS: FieldConfig[] = [
  {
    key: 'curriculum_framework',
    label: 'Curriculum Framework',
    placeholder:
      'What curriculum framework does your school follow? e.g. "EYFS", "Common Core", "IB PYP", "Custom framework"…',
    rows: 3,
  },
  {
    key: 'standards_notes',
    label: 'Standards & Learning Goals Notes',
    placeholder:
      'Any additional notes about standards or learning goals that should inform AI suggestions…',
    rows: 3,
  },
]

// ============================================================
// Helper: format file size
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// Section component
// ============================================================

function Section({
  title,
  description,
  icon,
  children,
  sectionKey,
  visibility,
  onToggleVisibility,
  canEdit,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
  sectionKey?: SchoolProfileSectionKey
  visibility?: SchoolProfileVisibility
  onToggleVisibility?: (key: SchoolProfileSectionKey, visible: boolean) => void
  canEdit?: boolean
}) {
  return (
    <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
        {canEdit && sectionKey && visibility && onToggleVisibility && (
          <label className="flex shrink-0 items-center gap-2 cursor-pointer">
            <span className="text-[10px] text-text-light">Visible to families</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={visibility[sectionKey]}
                onChange={(e) => onToggleVisibility(sectionKey, e.target.checked)}
                className="sr-only peer"
              />
              <div className="h-5 w-9 rounded-full bg-bg-muted peer-checked:bg-primary-500 transition-colors" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        )}
      </div>
      {children}
    </div>
  )
}

// ============================================================
// ReadOnlyField — displays text content in read-only mode
// ============================================================

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-text">{label}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-sm text-text-muted">
        {value}
      </p>
    </div>
  )
}

// ============================================================
// ReadOnlyDocumentCard
// ============================================================

function ReadOnlyDocumentCard({ doc }: { doc: SchoolDocument }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-bg-muted bg-bg p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        <FileText className="h-5 w-5 text-primary-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{doc.file_name}</p>
        <p className="text-xs text-text-light">
          {formatFileSize(doc.file_size)} &middot;{' '}
          {new Date(doc.created_at).toLocaleDateString()}
        </p>
        {doc.description && (
          <p className="mt-1 text-xs text-text-muted">{doc.description}</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ContextField — auto-saving textarea
// ============================================================

function ContextField({
  config,
  value,
  onChange,
}: {
  config: FieldConfig
  value: string
  onChange: (key: keyof SchoolContext, value: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">
        {config.label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(config.key, e.target.value)}
        placeholder={config.placeholder}
        rows={config.rows}
        className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
    </div>
  )
}

// ============================================================
// DocumentCard
// ============================================================

function DocumentCard({
  doc,
  onDelete,
  onUpdateDescription,
}: {
  doc: SchoolDocument
  onDelete: () => void
  onUpdateDescription: (description: string) => void
}) {
  const [desc, setDesc] = useState(doc.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-start gap-3 rounded-lg border border-bg-muted bg-bg p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        <FileText className="h-5 w-5 text-primary-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{doc.file_name}</p>
        <p className="text-xs text-text-light">
          {formatFileSize(doc.file_size)} &middot;{' '}
          {new Date(doc.created_at).toLocaleDateString()}
        </p>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            if (desc !== (doc.description ?? '')) {
              onUpdateDescription(desc)
            }
          }}
          placeholder="Add a description…"
          className="mt-1.5 w-full rounded border border-bg-muted bg-transparent px-2 py-1 text-xs text-text-muted placeholder:text-text-light focus:border-primary-300 focus:outline-none"
        />
      </div>
      <div>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onDelete()
                setConfirmDelete(false)
              }}
              className="rounded px-2 py-1 text-xs font-medium text-alert-600 hover:bg-alert-50"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete document"
            className="rounded-md p-1.5 text-text-light transition-colors hover:bg-alert-50 hover:text-alert-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function SchoolProfile() {
  const { profile } = useAuth()
  const { canEditSchoolProfile, role } = useAccessControl()
  const {
    school,
    documents,
    dimensions,
    frameworks,
    loading,
    saving,
    error,
    saveSuccess,
    updateSchoolContext,
    uploadDocument,
    deleteDocument,
    updateDocumentDescription,
  } = useSchoolProfile(profile?.school_id)
  const { visibility, loading: visLoading } = useSchoolProfileVisibility(profile?.school_id)
  const [localVisibility, setLocalVisibility] = useState<SchoolProfileVisibility | null>(null)

  // Use local visibility state once loaded
  const effectiveVisibility = localVisibility ?? visibility

  // Group dimensions by category
  const activeDimensions = dimensions.filter((d) => d.is_active)
  const inactiveDimensions = dimensions.filter((d) => !d.is_active)
  const dimensionsByCategory = activeDimensions.reduce<Record<string, Dimension[]>>(
    (acc, dim) => {
      const cat = dim.category || 'Uncategorized'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(dim)
      return acc
    },
    {}
  )

  // Local form state for text fields
  const [formState, setFormState] = useState<SchoolContext>({})
  const [formInitialized, setFormInitialized] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadDesc, setUploadDesc] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Initialize form from school settings when loaded
  if (school && !formInitialized) {
    const settings = (school.settings ?? {}) as SchoolContext
    setFormState({
      mission: settings.mission ?? '',
      core_values: settings.core_values ?? '',
      pedagogical_approach: settings.pedagogical_approach ?? '',
      teaching_methodologies: settings.teaching_methodologies ?? '',
      assessment_philosophy: settings.assessment_philosophy ?? '',
      curriculum_framework: settings.curriculum_framework ?? '',
      standards_notes: settings.standards_notes ?? '',
      department_label: settings.department_label,
    })
    setFormInitialized(true)
  }

  const handleFieldChange = useCallback(
    (key: keyof SchoolContext, value: string) => {
      setFormState((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleSave = useCallback(async () => {
    await updateSchoolContext(formState)
  }, [formState, updateSchoolContext])

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      setUploading(true)
      for (const file of fileArray) {
        await uploadDocument(file, uploadDesc)
      }
      setUploading(false)
      setUploadDesc('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [uploadDocument, uploadDesc]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload]
  )

  const handleToggleVisibility = useCallback(
    async (sectionKey: SchoolProfileSectionKey, visible: boolean) => {
      if (!profile?.school_id) return
      // Optimistic update
      setLocalVisibility((prev) => ({
        ...(prev ?? effectiveVisibility),
        [sectionKey]: visible,
      }))
      await updateSchoolProfileVisibility(profile.school_id, sectionKey, visible)
    },
    [profile?.school_id, effectiveVisibility]
  )

  /** Should a section be shown for the current role? */
  function isSectionVisible(key: SchoolProfileSectionKey): boolean {
    if (canEditSchoolProfile) return true // Admins always see everything
    if (role === 'educator') return true  // Educators see full read-only
    // Parents: only if toggle is on
    return effectiveVisibility[key]
  }

  // ── Loading state ──────────────────────────────────────────

  if (loading || visLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">School Profile</h1>
          <p className="mt-1 text-sm text-text-muted">
            {canEditSchoolProfile
              ? 'Define your school\'s pedagogical orientation. This context is used by the AI Learning Guide to personalize suggestions.'
              : 'Your school\'s pedagogical orientation and curriculum framework.'}
          </p>
        </div>
        {canEditSchoolProfile && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              saveSuccess
                ? 'bg-success-500 text-white'
                : 'bg-primary-500 text-white hover:bg-primary-600',
              saving && 'opacity-50'
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-alert-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-alert-500" />
          <p className="text-sm text-alert-600">{error}</p>
        </div>
      )}

      {/* School name */}
      <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text">{school?.name ?? 'School'}</h2>
            <p className="text-xs text-text-muted">
              slug: {school?.slug}
            </p>
          </div>
        </div>
      </div>

      {/* Organizational terminology */}
      {canEditSchoolProfile && (
        <div className="rounded-xl border border-bg-muted bg-bg-card p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-text">Organizational Terminology</h3>
          <p className="mb-3 text-xs text-text-muted">
            Choose how classrooms are grouped in your school. This label appears throughout the interface.
          </p>
          <div className="flex gap-3">
            {(['Department', 'Location'] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  handleFieldChange('department_label', option)
                  updateSchoolContext({ ...formState, department_label: option })
                }}
                className={clsx(
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  (formState.department_label ?? 'Department') === option
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-bg-muted text-text-muted hover:border-primary-200 hover:bg-bg-muted'
                )}
              >
                {option}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section 1: School Identity */}
      {isSectionVisible('school_identity') && (
        <Section
          title="School Identity"
          description="Your school's mission and values"
          icon={<Heart className="h-5 w-5 text-primary-500" />}
          sectionKey="school_identity"
          visibility={effectiveVisibility}
          onToggleVisibility={handleToggleVisibility}
          canEdit={canEditSchoolProfile}
        >
          <div className="space-y-4">
            {canEditSchoolProfile ? (
              IDENTITY_FIELDS.map((f) => (
                <ContextField
                  key={f.key}
                  config={f}
                  value={(formState[f.key] as string) ?? ''}
                  onChange={handleFieldChange}
                />
              ))
            ) : (
              <>
                <ReadOnlyField label="Mission Statement" value={(formState.mission as string) ?? ''} />
                <ReadOnlyField label="Core Values" value={(formState.core_values as string) ?? ''} />
              </>
            )}
          </div>
        </Section>
      )}

      {/* Section 2: Pedagogical Approach */}
      {isSectionVisible('pedagogical_approach') && (
        <Section
          title="Pedagogical Approach"
          description="Your teaching philosophy and methodologies"
          icon={<BookOpen className="h-5 w-5 text-primary-500" />}
          sectionKey="pedagogical_approach"
          visibility={effectiveVisibility}
          onToggleVisibility={handleToggleVisibility}
          canEdit={canEditSchoolProfile}
        >
          <div className="space-y-4">
            {canEditSchoolProfile ? (
              PEDAGOGY_FIELDS.map((f) => (
                <ContextField
                  key={f.key}
                  config={f}
                  value={(formState[f.key] as string) ?? ''}
                  onChange={handleFieldChange}
                />
              ))
            ) : (
              <>
                <ReadOnlyField label="Pedagogical Philosophy" value={(formState.pedagogical_approach as string) ?? ''} />
                <ReadOnlyField label="Key Teaching Methodologies" value={(formState.teaching_methodologies as string) ?? ''} />
                <ReadOnlyField label="Assessment Philosophy" value={(formState.assessment_philosophy as string) ?? ''} />
              </>
            )}
          </div>
        </Section>
      )}

      {/* Section 3: Curriculum & Standards */}
      {isSectionVisible('curriculum_standards') && (
        <Section
          title="Curriculum & Standards"
          description="Curriculum frameworks and learning standards"
          icon={<GraduationCap className="h-5 w-5 text-primary-500" />}
          sectionKey="curriculum_standards"
          visibility={effectiveVisibility}
          onToggleVisibility={handleToggleVisibility}
          canEdit={canEditSchoolProfile}
        >
          <div className="space-y-4">
            {canEditSchoolProfile ? (
              CURRICULUM_FIELDS.map((f) => (
                <ContextField
                  key={f.key}
                  config={f}
                  value={(formState[f.key] as string) ?? ''}
                  onChange={handleFieldChange}
                />
              ))
            ) : (
              <>
                <ReadOnlyField label="Curriculum Framework" value={(formState.curriculum_framework as string) ?? ''} />
                <ReadOnlyField label="Standards & Learning Goals Notes" value={(formState.standards_notes as string) ?? ''} />
              </>
            )}
          </div>
        </Section>
      )}

      {/* Section 4: Dimensions Overview */}
      {isSectionVisible('dimensions_overview') && (
      <Section
        title="Dimensions"
        description={`${activeDimensions.length} active dimension${activeDimensions.length !== 1 ? 's' : ''} across ${Object.keys(dimensionsByCategory).length} categor${Object.keys(dimensionsByCategory).length !== 1 ? 'ies' : 'y'}`}
        icon={<Layers className="h-5 w-5 text-primary-500" />}
        sectionKey="dimensions_overview"
        visibility={effectiveVisibility}
        onToggleVisibility={handleToggleVisibility}
        canEdit={canEditSchoolProfile}
      >
        {activeDimensions.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-text-light">
              No dimensions configured yet.
            </p>
            <Link
              to="/admin/dimensions"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              Set up dimensions
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(dimensionsByCategory).map(([category, dims]) => (
              <div key={category}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                      CATEGORY_STYLES[category] ?? 'bg-bg-muted text-text-muted'
                    )}
                  >
                    {category}
                  </span>
                  <span className="text-[11px] text-text-light">
                    {dims.length} dimension{dims.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1">
                  {dims.map((dim) => (
                    <div
                      key={dim.id}
                      className="flex items-center gap-2.5 rounded-lg border border-bg-muted bg-bg px-3 py-2"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50">
                        <DimensionIcon
                          name={dim.icon}
                          className="h-4 w-4 text-primary-500"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text">{dim.name}</p>
                        {dim.description && (
                          <p className="truncate text-xs text-text-muted">
                            {dim.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {dim.visible_to_family ? (
                          <span className="flex items-center gap-1 text-[10px] text-success-600">
                            <CheckCircle className="h-3 w-3" />
                            Family
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-text-light">
                            <XCircle className="h-3 w-3" />
                            Hidden
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {inactiveDimensions.length > 0 && (
              <p className="text-xs text-text-light">
                + {inactiveDimensions.length} inactive dimension{inactiveDimensions.length !== 1 ? 's' : ''}
              </p>
            )}

            {canEditSchoolProfile && (
              <Link
                to="/admin/dimensions"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600"
              >
                Manage dimensions
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </Section>
      )}

      {/* Section 5: Standards Frameworks */}
      {isSectionVisible('standards_frameworks') && (
      <Section
        title="Standards Frameworks"
        description={
          frameworks.length > 0
            ? `${frameworks.length} framework${frameworks.length !== 1 ? 's' : ''} with ${frameworks.reduce((n, f) => n + f.standards.length, 0)} standards`
            : 'Learning standards linked to your dimensions'
        }
        icon={<ListTree className="h-5 w-5 text-primary-500" />}
        sectionKey="standards_frameworks"
        visibility={effectiveVisibility}
        onToggleVisibility={handleToggleVisibility}
        canEdit={canEditSchoolProfile}
      >
        {frameworks.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-text-light">
              No standards frameworks configured yet.
            </p>
            <Link
              to="/standards"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              Set up standards
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {frameworks.map((fw) => (
              <div key={fw.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-text">{fw.name}</span>
                  {fw.version && (
                    <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] text-text-light">
                      v{fw.version}
                    </span>
                  )}
                </div>
                {fw.description && (
                  <p className="mb-2 text-xs text-text-muted">{fw.description}</p>
                )}

                {/* Show top-level standards (those without a parent) */}
                {(() => {
                  const topLevel = fw.standards.filter((s) => !s.parent_id)
                  if (topLevel.length === 0) {
                    return (
                      <p className="text-xs italic text-text-light">No standards defined</p>
                    )
                  }
                  return (
                    <div className="space-y-1">
                      {topLevel.slice(0, 10).map((std) => {
                        const children = fw.standards.filter((s) => s.parent_id === std.id)
                        return (
                          <div
                            key={std.id}
                            className="rounded-lg border border-bg-muted bg-bg px-3 py-2"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-mono font-medium text-primary-700">
                                {std.code}
                              </span>
                              <p className="text-xs text-text-muted">{std.description}</p>
                            </div>
                            {children.length > 0 && (
                              <div className="ml-6 mt-1.5 space-y-1 border-l-2 border-bg-muted pl-3">
                                {children.slice(0, 5).map((child) => (
                                  <div key={child.id} className="flex items-baseline gap-2">
                                    <span className="shrink-0 text-[10px] font-mono text-text-light">
                                      {child.code}
                                    </span>
                                    <p className="text-[11px] text-text-muted">
                                      {child.description}
                                    </p>
                                  </div>
                                ))}
                                {children.length > 5 && (
                                  <p className="text-[10px] text-text-light">
                                    + {children.length - 5} more
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {topLevel.length > 10 && (
                        <p className="text-xs text-text-light">
                          + {topLevel.length - 10} more top-level standards
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}

            {canEditSchoolProfile && (
              <Link
                to="/standards"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600"
              >
                Manage standards
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </Section>
      )}

      {/* Section 6: Supporting Documents */}
      {isSectionVisible('supporting_documents') && (
      <Section
        title="Supporting Documents"
        description={canEditSchoolProfile
          ? 'Upload curriculum guides, standards documents, or pedagogical references'
          : 'Curriculum guides, standards documents, and pedagogical references'}
        icon={<FileUp className="h-5 w-5 text-primary-500" />}
        sectionKey="supporting_documents"
        visibility={effectiveVisibility}
        onToggleVisibility={handleToggleVisibility}
        canEdit={canEditSchoolProfile}
      >
        {canEditSchoolProfile ? (
          <>
            {/* Upload area */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={clsx(
                'mb-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                dragOver
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-bg-muted bg-bg hover:border-primary-300'
              )}
            >
              <Upload className="mx-auto h-8 w-8 text-text-light" />
              <p className="mt-2 text-sm text-text-muted">
                Drag &amp; drop files here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-primary-500 hover:text-primary-600"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-text-light">
                PDF, DOCX, images — up to 10 MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files)
                }}
                className="hidden"
              />
            </div>

            {/* Description for next upload */}
            <div className="mb-4">
              <input
                type="text"
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Optional description for next upload…"
                className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {/* Uploading indicator */}
            {uploading && (
              <div className="mb-4 flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </div>
            )}

            {/* Document list (editable) */}
            {documents.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-light">
                No documents uploaded yet. Upload curriculum guides, standards, or
                pedagogical reference materials.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onDelete={() => deleteDocument(doc)}
                    onUpdateDescription={(desc) =>
                      updateDocumentDescription(doc.id, desc)
                    }
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Read-only document list */
          documents.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-light">
              No documents available.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <ReadOnlyDocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )
        )}
      </Section>
      )}

      {/* Info note (admin only) */}
      {canEditSchoolProfile && (
        <div className="rounded-lg bg-primary-50 px-4 py-3">
          <p className="text-xs leading-relaxed text-primary-700">
            <span className="font-semibold">How this is used:</span> When an educator
            generates AI learning suggestions for a student, your school's pedagogical
            context — including mission, teaching methodologies, dimensions, and standards
            — is included so suggestions align with your school's unique philosophy and
            curriculum framework.
          </p>
        </div>
      )}
    </div>
  )
}

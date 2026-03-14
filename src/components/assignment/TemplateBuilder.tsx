import { useState, useEffect, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import {
  X,
  Loader2,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Tag,
  Users,
  User,
  Zap,
  AlertCircle,
  CheckCircle2,
  CircleDot,
} from 'lucide-react'
import { useToast } from '../Toast'
import { useAuth } from '../../lib/auth'
import {
  fetchCompetencyTree,
  type CompetencyTreeNode,
} from '../../lib/assignment-data'
import {
  fetchSkills,
  type SkillWithCompetencies,
} from '../../lib/skills-data'
import {
  createTemplate,
  updateTemplate,
} from '../../lib/assignment-template-data'
import { validateTemplate, type PBLValidationResult } from '../../lib/pbl-validator'
import type {
  AssignmentType,
  AssignmentTemplate,
  AssignmentTemplateInsert,
  GradeBand,
  DOKLevel,
  TemplateStatus,
  ProjectPhase,
  PhaseActivity,
  PhaseCheckpoint,
  FinalProduct,
  ChoicePoint,
  DifferentiationGuide,
  TemplateResource,
} from '../../types/database'

// ============================================================
// Helpers
// ============================================================

function uid(): string {
  return crypto.randomUUID()
}

const GRADE_BANDS: { value: GradeBand; label: string }[] = [
  { value: 'early_elementary', label: 'Early Elementary (K-2)' },
  { value: 'elementary', label: 'Elementary (3-5)' },
  { value: 'upper_elementary', label: 'Upper Elementary (4-6)' },
  { value: 'middle_school', label: 'Middle School (6-8)' },
  { value: 'mixed', label: 'Mixed' },
]

const SUBJECT_OPTIONS = [
  'Math', 'Science', 'ELA', 'Social Studies', 'Art', 'Music', 'PE',
  'World Languages', 'Technology', 'Interdisciplinary',
]

const DOK_LABELS: Record<number, string> = {
  1: 'Recall & Reproduction',
  2: 'Skill / Concept',
  3: 'Strategic Thinking',
  4: 'Extended Thinking',
}

const ACTIVITY_TYPES: PhaseActivity['activity_type'][] = [
  'investigation', 'creation', 'collaboration', 'reflection',
  'presentation', 'skill_building', 'field_work',
]

const ASSESSMENT_TYPES: PhaseCheckpoint['assessment_type'][] = [
  'self_assessment', 'peer_review', 'educator_check', 'portfolio_entry', 'group_critique',
]

const CHOICE_TYPES: ChoicePoint['choice_type'][] = [
  'topic_selection', 'research_method', 'product_format',
  'collaboration_structure', 'presentation_style',
]

const RESOURCE_TYPES: TemplateResource['type'][] = [
  'link', 'book', 'material', 'tool', 'printable', 'video',
]

// ============================================================
// Sub-components: Shared
// ============================================================

const inputCls =
  'w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text placeholder:text-text-light focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400'
const labelCls = 'mb-1.5 block text-xs font-semibold text-text-light'
const helperCls = 'mt-1 text-[11px] text-text-muted'

function ListInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs text-primary-700"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-primary-400 hover:text-primary-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault()
              onChange([...items, draft.trim()])
              setDraft('')
            }
          }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim()) {
              onChange([...items, draft.trim()])
              setDraft('')
            }
          }}
          className="shrink-0 rounded-lg border border-bg-muted bg-bg px-2.5 py-2 text-text-muted hover:bg-bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Props
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** If provided, edit mode */
  template?: AssignmentTemplate | null
}

// ============================================================
// Main Component
// ============================================================

export default function TemplateBuilder({ open, onClose, onSaved, template }: Props) {
  const { profile } = useAuth()
  const { toast } = useToast()

  // Step navigation
  const [step, setStep] = useState(0)
  const steps = ['Overview', 'Design Foundations', 'Project Phases', 'Student Agency', 'Final Product', 'Review']

  // Loading
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [competencyTree, setCompetencyTree] = useState<CompetencyTreeNode[]>([])
  const [allSkills, setAllSkills] = useState<SkillWithCompetencies[]>([])

  // --- Step 1: Overview ---
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [gradeBand, setGradeBand] = useState<GradeBand>('elementary')
  const [subjectArea, setSubjectArea] = useState<string[]>([])
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('')
  const [tags, setTags] = useState<string[]>([])
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('class')

  // --- Step 2: Design Foundations ---
  const [drivingQuestion, setDrivingQuestion] = useState('')
  const [essentialUnderstandings, setEssentialUnderstandings] = useState<string[]>([])
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set())
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [dokLevel, setDokLevel] = useState<DOKLevel>(3)
  const [authenticityHook, setAuthenticityHook] = useState('')

  // --- Step 3: Phases ---
  const [phases, setPhases] = useState<ProjectPhase[]>([])

  // --- Step 4: Agency & Differentiation ---
  const [choicePoints, setChoicePoints] = useState<ChoicePoint[]>([])
  const [critiqueProtocol, setCritiqueProtocol] = useState('')
  const [differentiation, setDifferentiation] = useState<DifferentiationGuide>({
    extending: '',
    supporting: '',
    ell_accommodations: '',
    accessibility_notes: '',
  })
  const [scaffoldingNotes, setScaffoldingNotes] = useState('')

  // --- Step 5: Final Product & Resources ---
  const [finalProduct, setFinalProduct] = useState<FinalProduct>({
    description: '',
    format_options: [],
    audience: '',
    presentation_format: '',
    quality_criteria: [],
  })
  const [resources, setResources] = useState<TemplateResource[]>([])

  // --- Step 6: Review ---
  const [status, setStatus] = useState<TemplateStatus>('draft')

  // Load data
  useEffect(() => {
    if (!open || !profile?.school_id) return
    setLoading(true)
    Promise.all([
      fetchCompetencyTree(profile.school_id),
      fetchSkills(profile.school_id),
    ])
      .then(([tree, skills]) => {
        setCompetencyTree(tree)
        setAllSkills(skills)
      })
      .catch(() => toast('Failed to load data', 'error'))
      .finally(() => setLoading(false))
  }, [open, profile?.school_id, toast])

  // Populate from template (edit mode)
  useEffect(() => {
    if (!open) {
      setStep(0)
      return
    }
    if (template) {
      setTitle(template.title)
      setDescription(template.description ?? '')
      setGradeBand(template.grade_band)
      setSubjectArea(template.subject_area)
      setEstimatedDays(template.estimated_duration_days ?? '')
      setTags(template.tags)
      setAssignmentType(template.assignment_type)
      setDrivingQuestion(template.driving_question ?? '')
      setEssentialUnderstandings(template.essential_understandings)
      setSelectedCompetencies(new Set(template.competency_ids))
      setSelectedSkills(new Set(template.skill_ids))
      setDokLevel(template.dok_level)
      setAuthenticityHook(template.authenticity_hook ?? '')
      setPhases(template.phases)
      setChoicePoints(template.choice_points)
      setCritiqueProtocol(template.critique_protocol ?? '')
      setDifferentiation(template.differentiation ?? { extending: '', supporting: '', ell_accommodations: '', accessibility_notes: '' })
      setScaffoldingNotes(template.scaffolding_notes ?? '')
      setFinalProduct(template.final_product ?? { description: '', format_options: [], audience: '', presentation_format: '', quality_criteria: [] })
      setResources(template.materials_and_resources)
      setStatus(template.status)
    } else {
      // Reset all state
      setTitle('')
      setDescription('')
      setGradeBand('elementary')
      setSubjectArea([])
      setEstimatedDays('')
      setTags([])
      setAssignmentType('class')
      setDrivingQuestion('')
      setEssentialUnderstandings([])
      setSelectedCompetencies(new Set())
      setSelectedSkills(new Set())
      setDokLevel(3)
      setAuthenticityHook('')
      setPhases([])
      setChoicePoints([])
      setCritiqueProtocol('')
      setDifferentiation({ extending: '', supporting: '', ell_accommodations: '', accessibility_notes: '' })
      setScaffoldingNotes('')
      setFinalProduct({ description: '', format_options: [], audience: '', presentation_format: '', quality_criteria: [] })
      setResources([])
      setStatus('draft')
    }
  }, [open, template])

  // Build the template payload
  const buildPayload = useCallback((): AssignmentTemplateInsert => ({
    school_id: profile!.school_id,
    created_by: profile!.id,
    title: title.trim(),
    description: description.trim() || null,
    assignment_type: assignmentType,
    competency_ids: Array.from(selectedCompetencies),
    skill_ids: Array.from(selectedSkills),
    is_shared: true,
    template_data: {},
    grade_band: gradeBand,
    subject_area: subjectArea,
    estimated_duration_days: estimatedDays || null,
    driving_question: drivingQuestion.trim() || null,
    essential_understandings: essentialUnderstandings,
    authenticity_hook: authenticityHook.trim() || null,
    final_product: finalProduct.description ? finalProduct : null,
    dok_level: dokLevel,
    phases,
    choice_points: choicePoints,
    critique_protocol: critiqueProtocol.trim() || null,
    scaffolding_notes: scaffoldingNotes.trim() || null,
    differentiation: differentiation.extending || differentiation.supporting ? differentiation : null,
    materials_and_resources: resources,
    tags,
    status,
  }), [
    profile, title, description, assignmentType, selectedCompetencies, selectedSkills,
    gradeBand, subjectArea, estimatedDays, drivingQuestion, essentialUnderstandings,
    authenticityHook, finalProduct, dokLevel, phases, choicePoints, critiqueProtocol,
    scaffoldingNotes, differentiation, resources, tags, status,
  ])

  // Validation result for review step
  const validation = useMemo<PBLValidationResult | null>(() => {
    if (step !== 5) return null
    const payload = buildPayload()
    return validateTemplate(payload as any)
  }, [step, buildPayload])

  // Save
  async function handleSave() {
    if (!title.trim()) {
      toast('Title is required', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (template) {
        const { school_id, created_by, ...updateData } = payload as any
        await updateTemplate(template.id, updateData)
        toast('Template updated', 'success')
      } else {
        await createTemplate(payload)
        toast('Template created', 'success')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Quick-start phases
  function addQuickStartPhases() {
    setPhases([
      {
        id: uid(),
        title: 'Launch & Wonder',
        description: 'Entry event, driving question introduction, and initial inquiry.',
        duration_days: 3,
        dok_level: 2,
        activities: [
          { id: uid(), title: 'Entry Event', description: 'Hook activity to spark curiosity', activity_type: 'investigation', is_required: true, estimated_minutes: 45, resources: [], educator_notes: '' },
          { id: uid(), title: 'Know/Wonder Chart', description: 'Students brainstorm what they know and wonder', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: [], educator_notes: '' },
        ],
        reflection_prompts: ['What am I most curious about?', 'What do I already know about this topic?'],
        checkpoint: null,
      },
      {
        id: uid(),
        title: 'Investigate & Discover',
        description: 'Research, data gathering, expert interviews, and field work.',
        duration_days: 6,
        dok_level: 3,
        activities: [
          { id: uid(), title: 'Research', description: 'Guided research using multiple sources', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: [], educator_notes: '' },
          { id: uid(), title: 'Expert Connection', description: 'Interview or consult with a subject expert', activity_type: 'field_work', is_required: false, estimated_minutes: 45, resources: [], educator_notes: '' },
        ],
        reflection_prompts: ['What surprised me in my research?', 'How has my thinking changed?'],
        checkpoint: { title: 'Research Check-in', description: 'Review research progress and sources', assessment_type: 'educator_check', competency_ids: [], criteria: ['Sources identified', 'Key findings documented'] },
      },
      {
        id: uid(),
        title: 'Create & Refine',
        description: 'Building the product, critique sessions, and revision cycles.',
        duration_days: 6,
        dok_level: 3,
        activities: [
          { id: uid(), title: 'Draft / Prototype', description: 'Create first version of the product', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: [], educator_notes: '' },
          { id: uid(), title: 'Peer Critique', description: 'Give and receive structured feedback', activity_type: 'collaboration', is_required: true, estimated_minutes: 45, resources: [], educator_notes: '' },
        ],
        reflection_prompts: ['What feedback was most helpful?', 'How did I improve my work?'],
        checkpoint: { title: 'Peer Review', description: 'Structured peer feedback session', assessment_type: 'peer_review', competency_ids: [], criteria: ['Addressed driving question', 'Incorporated feedback'] },
      },
      {
        id: uid(),
        title: 'Present & Reflect',
        description: 'Public presentation, self-assessment, and celebration.',
        duration_days: 3,
        dok_level: 4,
        activities: [
          { id: uid(), title: 'Final Presentation', description: 'Present work to audience', activity_type: 'presentation', is_required: true, estimated_minutes: 60, resources: [], educator_notes: '' },
          { id: uid(), title: 'Self-Assessment', description: 'Reflect on learning and growth', activity_type: 'reflection', is_required: true, estimated_minutes: 30, resources: [], educator_notes: '' },
        ],
        reflection_prompts: ['What am I most proud of?', 'What would I do differently next time?', 'How did this project change my thinking?'],
        checkpoint: { title: 'Final Reflection', description: 'Self-assessment of learning', assessment_type: 'self_assessment', competency_ids: [], criteria: ['Addressed driving question', 'Demonstrated growth'] },
      },
    ])
    toast('Quick-start phases added', 'success')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-muted px-5 py-4">
          <h3 className="text-base font-bold text-text">
            {template ? 'Edit Template' : 'New PBL Template'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-light hover:bg-bg-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-bg-muted px-5">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={clsx(
                'shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                step === i
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-text-muted hover:text-text'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
            </div>
          ) : (
            <>
              {step === 0 && (
                <StepOverview
                  title={title} setTitle={setTitle}
                  description={description} setDescription={setDescription}
                  gradeBand={gradeBand} setGradeBand={setGradeBand}
                  subjectArea={subjectArea} setSubjectArea={setSubjectArea}
                  estimatedDays={estimatedDays} setEstimatedDays={setEstimatedDays}
                  tags={tags} setTags={setTags}
                  assignmentType={assignmentType} setAssignmentType={setAssignmentType}
                />
              )}
              {step === 1 && (
                <StepDesign
                  drivingQuestion={drivingQuestion} setDrivingQuestion={setDrivingQuestion}
                  essentialUnderstandings={essentialUnderstandings} setEssentialUnderstandings={setEssentialUnderstandings}
                  selectedCompetencies={selectedCompetencies} setSelectedCompetencies={setSelectedCompetencies}
                  selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills}
                  dokLevel={dokLevel} setDokLevel={setDokLevel}
                  authenticityHook={authenticityHook} setAuthenticityHook={setAuthenticityHook}
                  competencyTree={competencyTree}
                  allSkills={allSkills}
                />
              )}
              {step === 2 && (
                <StepPhases
                  phases={phases} setPhases={setPhases}
                  onQuickStart={addQuickStartPhases}
                />
              )}
              {step === 3 && (
                <StepAgency
                  choicePoints={choicePoints} setChoicePoints={setChoicePoints}
                  critiqueProtocol={critiqueProtocol} setCritiqueProtocol={setCritiqueProtocol}
                  differentiation={differentiation} setDifferentiation={setDifferentiation}
                  scaffoldingNotes={scaffoldingNotes} setScaffoldingNotes={setScaffoldingNotes}
                  phases={phases}
                />
              )}
              {step === 4 && (
                <StepProduct
                  finalProduct={finalProduct} setFinalProduct={setFinalProduct}
                  resources={resources} setResources={setResources}
                />
              )}
              {step === 5 && (
                <StepReview
                  validation={validation}
                  status={status} setStatus={setStatus}
                  title={title}
                  drivingQuestion={drivingQuestion}
                  phases={phases}
                  competencyCount={selectedCompetencies.size}
                  skillCount={selectedSkills.size}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-bg-muted px-5 py-3">
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg bg-bg-muted px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted/80"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-bg-muted px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-muted/80"
            >
              Cancel
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {template ? 'Update' : 'Save Template'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Step 1: Overview
// ============================================================

function StepOverview({
  title, setTitle, description, setDescription,
  gradeBand, setGradeBand, subjectArea, setSubjectArea,
  estimatedDays, setEstimatedDays, tags, setTags,
  assignmentType, setAssignmentType,
}: {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  gradeBand: GradeBand; setGradeBand: (v: GradeBand) => void
  subjectArea: string[]; setSubjectArea: (v: string[]) => void
  estimatedDays: number | ''; setEstimatedDays: (v: number | '') => void
  tags: string[]; setTags: (v: string[]) => void
  assignmentType: AssignmentType; setAssignmentType: (v: AssignmentType) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Title *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Our Community Water Story" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief overview of this project template..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Grade Band</label>
        <select value={gradeBand} onChange={(e) => setGradeBand(e.target.value as GradeBand)} className={inputCls}>
          {GRADE_BANDS.map((gb) => (
            <option key={gb.value} value={gb.value}>{gb.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Subject Areas</label>
        <div className="flex flex-wrap gap-1.5">
          {SUBJECT_OPTIONS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() =>
                setSubjectArea(
                  subjectArea.includes(subj)
                    ? subjectArea.filter((s) => s !== subj)
                    : [...subjectArea, subj]
                )
              }
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                subjectArea.includes(subj)
                  ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                  : 'bg-bg-muted text-text-muted hover:bg-primary-50'
              )}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Estimated Duration (days)</label>
        <input
          type="number"
          min={1}
          value={estimatedDays}
          onChange={(e) => setEstimatedDays(e.target.value ? parseInt(e.target.value, 10) : '')}
          placeholder="e.g. 15"
          className={clsx(inputCls, 'max-w-[120px]')}
        />
      </div>

      <div>
        <label className={labelCls}>Tags</label>
        <ListInput items={tags} onChange={setTags} placeholder="Add tag and press Enter" />
      </div>

      <div>
        <label className={labelCls}>Assignment Type</label>
        <div className="flex gap-2">
          {(['class', 'individual'] as AssignmentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAssignmentType(t)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                assignmentType === t
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-bg-muted bg-bg text-text-muted hover:border-primary-200'
              )}
            >
              {t === 'class' ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {t === 'class' ? 'Class' : 'Individual'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Step 2: Design Foundations
// ============================================================

function StepDesign({
  drivingQuestion, setDrivingQuestion,
  essentialUnderstandings, setEssentialUnderstandings,
  selectedCompetencies, setSelectedCompetencies,
  selectedSkills, setSelectedSkills,
  dokLevel, setDokLevel,
  authenticityHook, setAuthenticityHook,
  competencyTree, allSkills,
}: {
  drivingQuestion: string; setDrivingQuestion: (v: string) => void
  essentialUnderstandings: string[]; setEssentialUnderstandings: (v: string[]) => void
  selectedCompetencies: Set<string>; setSelectedCompetencies: (v: Set<string>) => void
  selectedSkills: Set<string>; setSelectedSkills: (v: Set<string>) => void
  dokLevel: DOKLevel; setDokLevel: (v: DOKLevel) => void
  authenticityHook: string; setAuthenticityHook: (v: string) => void
  competencyTree: CompetencyTreeNode[]
  allSkills: SkillWithCompetencies[]
}) {
  const [compSearch, setCompSearch] = useState('')
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Driving Question</label>
        <textarea
          value={drivingQuestion}
          onChange={(e) => setDrivingQuestion(e.target.value)}
          rows={3}
          placeholder="How might we...? Why does...? What would happen if...?"
          className={inputCls}
        />
        <p className={helperCls}>An open-ended, non-Googleable question that frames the entire project.</p>
      </div>

      <div>
        <label className={labelCls}>Essential Understandings</label>
        <ListInput items={essentialUnderstandings} onChange={setEssentialUnderstandings} placeholder="What should learners deeply understand?" />
      </div>

      {/* Competency picker */}
      <div>
        <label className={labelCls}>Competencies</label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            value={compSearch}
            onChange={(e) => setCompSearch(e.target.value)}
            placeholder="Search competencies..."
            className={clsx(inputCls, 'pl-8')}
          />
        </div>
        <div className="max-h-44 overflow-y-auto rounded-lg border border-bg-muted bg-bg p-2 space-y-1">
          {competencyTree.length === 0 ? (
            <p className="py-2 text-center text-xs text-text-light">No competencies found</p>
          ) : (
            competencyTree.map((node) => {
              const comps = node.subdomains
                .flatMap((sd) => sd.competencies)
                .filter((c) =>
                  !compSearch || c.name.toLowerCase().includes(compSearch.toLowerCase()) ||
                  c.code.toLowerCase().includes(compSearch.toLowerCase())
                )
              if (comps.length === 0) return null
              return (
                <div key={node.domain.id}>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide px-1 pt-1">
                    {node.domain.name}
                  </p>
                  {comps.map((comp) => (
                    <label
                      key={comp.id}
                      className="flex items-center gap-2 rounded px-1.5 py-1 text-xs cursor-pointer hover:bg-primary-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompetencies.has(comp.id)}
                        onChange={() => {
                          const next = new Set(selectedCompetencies)
                          if (next.has(comp.id)) next.delete(comp.id)
                          else next.add(comp.id)
                          setSelectedCompetencies(next)
                        }}
                        className="rounded border-bg-muted text-primary-500 focus:ring-primary-400"
                      />
                      <span className="font-medium text-primary-700">{comp.code}</span>
                      <span className="text-text">{comp.name}</span>
                    </label>
                  ))}
                </div>
              )
            })
          )}
        </div>
        {selectedCompetencies.size > 0 && (
          <p className="mt-1 text-xs text-primary-600">{selectedCompetencies.size} selected</p>
        )}
      </div>

      {/* Skills */}
      {allSkills.length > 0 && (
        <div>
          <label className={labelCls}>Skills (optional)</label>
          <div className="flex flex-wrap gap-1.5">
            {allSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  const next = new Set(selectedSkills)
                  if (next.has(skill.id)) next.delete(skill.id)
                  else next.add(skill.id)
                  setSelectedSkills(next)
                }}
                className={clsx(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  selectedSkills.has(skill.id)
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                    : 'bg-bg-muted text-text-muted hover:bg-emerald-50 hover:text-emerald-600'
                )}
              >
                <Tag className="h-2.5 w-2.5" />
                {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>DOK Level</label>
        <select value={dokLevel} onChange={(e) => setDokLevel(Number(e.target.value) as DOKLevel)} className={inputCls}>
          {([1, 2, 3, 4] as DOKLevel[]).map((d) => (
            <option key={d} value={d}>{d} — {DOK_LABELS[d]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Authenticity Hook</label>
        <textarea
          value={authenticityHook}
          onChange={(e) => setAuthenticityHook(e.target.value)}
          rows={2}
          placeholder="What real-world problem, audience, or context makes this project matter?"
          className={inputCls}
        />
      </div>
    </div>
  )
}

// ============================================================
// Step 3: Project Phases
// ============================================================

function StepPhases({
  phases, setPhases, onQuickStart,
}: {
  phases: ProjectPhase[]
  setPhases: (v: ProjectPhase[]) => void
  onQuickStart: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updatePhase(id: string, patch: Partial<ProjectPhase>) {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function addPhase() {
    const newPhase: ProjectPhase = {
      id: uid(),
      title: '',
      description: '',
      duration_days: 5,
      dok_level: 3,
      activities: [],
      reflection_prompts: [],
      checkpoint: null,
    }
    setPhases([...phases, newPhase])
    setExpanded((prev) => new Set(prev).add(newPhase.id))
  }

  function removePhase(id: string) {
    setPhases(phases.filter((p) => p.id !== id))
  }

  function addActivity(phaseId: string) {
    updatePhase(phaseId, {
      activities: [
        ...(phases.find((p) => p.id === phaseId)?.activities ?? []),
        { id: uid(), title: '', description: '', activity_type: 'investigation', is_required: true, estimated_minutes: 30, resources: [], educator_notes: '' },
      ],
    })
  }

  function updateActivity(phaseId: string, actId: string, patch: Partial<PhaseActivity>) {
    const phase = phases.find((p) => p.id === phaseId)
    if (!phase) return
    updatePhase(phaseId, {
      activities: phase.activities.map((a) => (a.id === actId ? { ...a, ...patch } : a)),
    })
  }

  function removeActivity(phaseId: string, actId: string) {
    const phase = phases.find((p) => p.id === phaseId)
    if (!phase) return
    updatePhase(phaseId, { activities: phase.activities.filter((a) => a.id !== actId) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={labelCls}>Project Phases</label>
        <div className="flex gap-2">
          {phases.length === 0 && (
            <button
              type="button"
              onClick={onQuickStart}
              className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
            >
              <Zap className="h-3.5 w-3.5" />
              Quick Start (4 phases)
            </button>
          )}
          <button
            type="button"
            onClick={addPhase}
            className="flex items-center gap-1.5 rounded-lg border border-bg-muted bg-bg px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Phase
          </button>
        </div>
      </div>

      {phases.length === 0 && (
        <p className="text-center text-sm text-text-muted py-8">
          No phases yet. Use Quick Start or add a phase manually.
        </p>
      )}

      <div className="space-y-3">
        {phases.map((phase, idx) => (
          <div key={phase.id} className="rounded-xl border border-bg-muted bg-bg">
            {/* Phase header */}
            <button
              type="button"
              onClick={() => toggle(phase.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {expanded.has(phase.id) ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
              )}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                {idx + 1}
              </span>
              <span className="flex-1 text-sm font-semibold text-text">
                {phase.title || `Phase ${idx + 1}`}
              </span>
              <span className="text-xs text-text-muted">{phase.duration_days}d · DOK {phase.dok_level}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhase(phase.id) }}
                className="rounded p-1 text-text-light hover:bg-alert-50 hover:text-alert-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>

            {/* Phase expanded body */}
            {expanded.has(phase.id) && (
              <div className="border-t border-bg-muted px-4 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Title</label>
                    <input type="text" value={phase.title} onChange={(e) => updatePhase(phase.id, { title: e.target.value })} placeholder="Phase title" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Days</label>
                      <input type="number" min={1} value={phase.duration_days} onChange={(e) => updatePhase(phase.id, { duration_days: parseInt(e.target.value, 10) || 1 })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>DOK</label>
                      <select value={phase.dok_level} onChange={(e) => updatePhase(phase.id, { dok_level: Number(e.target.value) as DOKLevel })} className={inputCls}>
                        {([1, 2, 3, 4] as DOKLevel[]).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={phase.description} onChange={(e) => updatePhase(phase.id, { description: e.target.value })} rows={2} className={inputCls} />
                </div>

                {/* Activities */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Activities</label>
                    <button
                      type="button"
                      onClick={() => addActivity(phase.id)}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {phase.activities.map((act) => (
                      <div key={act.id} className="rounded-lg border border-bg-muted bg-bg-card p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={act.title} onChange={(e) => updateActivity(phase.id, act.id, { title: e.target.value })} placeholder="Activity title" className={clsx(inputCls, 'flex-1')} />
                          <select value={act.activity_type} onChange={(e) => updateActivity(phase.id, act.id, { activity_type: e.target.value as PhaseActivity['activity_type'] })} className={clsx(inputCls, 'w-36')}>
                            {ACTIVITY_TYPES.map((t) => (
                              <option key={t} value={t}>{t.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeActivity(phase.id, act.id)}
                            className="shrink-0 rounded p-1 text-text-light hover:bg-alert-50 hover:text-alert-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea value={act.description} onChange={(e) => updateActivity(phase.id, act.id, { description: e.target.value })} rows={1} placeholder="Description" className={inputCls} />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-text-muted">
                            <input type="checkbox" checked={act.is_required} onChange={(e) => updateActivity(phase.id, act.id, { is_required: e.target.checked })} className="rounded border-bg-muted text-primary-500" />
                            Required
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-text-muted">
                            <input type="number" min={5} step={5} value={act.estimated_minutes} onChange={(e) => updateActivity(phase.id, act.id, { estimated_minutes: parseInt(e.target.value, 10) || 5 })} className={clsx(inputCls, 'w-16 py-1')} />
                            min
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reflection prompts */}
                <div>
                  <label className={labelCls}>Reflection Prompts</label>
                  <ListInput
                    items={phase.reflection_prompts}
                    onChange={(v) => updatePhase(phase.id, { reflection_prompts: v })}
                    placeholder="Add a reflection question"
                  />
                </div>

                {/* Checkpoint */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Checkpoint</label>
                    {!phase.checkpoint ? (
                      <button
                        type="button"
                        onClick={() => updatePhase(phase.id, { checkpoint: { title: '', description: '', assessment_type: 'educator_check', competency_ids: [], criteria: [] } })}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
                        <Plus className="h-3 w-3" /> Add Checkpoint
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updatePhase(phase.id, { checkpoint: null })}
                        className="text-xs text-alert-600 hover:text-alert-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {phase.checkpoint && (
                    <div className="rounded-lg border border-bg-muted bg-bg-card p-3 space-y-2">
                      <input type="text" value={phase.checkpoint.title} onChange={(e) => updatePhase(phase.id, { checkpoint: { ...phase.checkpoint!, title: e.target.value } })} placeholder="Checkpoint title" className={inputCls} />
                      <textarea value={phase.checkpoint.description} onChange={(e) => updatePhase(phase.id, { checkpoint: { ...phase.checkpoint!, description: e.target.value } })} rows={1} placeholder="Description" className={inputCls} />
                      <select value={phase.checkpoint.assessment_type} onChange={(e) => updatePhase(phase.id, { checkpoint: { ...phase.checkpoint!, assessment_type: e.target.value as PhaseCheckpoint['assessment_type'] } })} className={inputCls}>
                        {ASSESSMENT_TYPES.map((t) => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <div>
                        <label className={labelCls}>Success Criteria</label>
                        <ListInput items={phase.checkpoint.criteria} onChange={(v) => updatePhase(phase.id, { checkpoint: { ...phase.checkpoint!, criteria: v } })} placeholder="What does success look like?" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Step 4: Student Agency & Differentiation
// ============================================================

function StepAgency({
  choicePoints, setChoicePoints,
  critiqueProtocol, setCritiqueProtocol,
  differentiation, setDifferentiation,
  scaffoldingNotes, setScaffoldingNotes,
  phases,
}: {
  choicePoints: ChoicePoint[]; setChoicePoints: (v: ChoicePoint[]) => void
  critiqueProtocol: string; setCritiqueProtocol: (v: string) => void
  differentiation: DifferentiationGuide; setDifferentiation: (v: DifferentiationGuide) => void
  scaffoldingNotes: string; setScaffoldingNotes: (v: string) => void
  phases: ProjectPhase[]
}) {
  function addChoice() {
    setChoicePoints([...choicePoints, {
      phase_id: phases[0]?.id ?? '',
      description: '',
      choice_type: 'topic_selection',
      options: [],
    }])
  }

  function updateChoice(idx: number, patch: Partial<ChoicePoint>) {
    setChoicePoints(choicePoints.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function removeChoice(idx: number) {
    setChoicePoints(choicePoints.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      {/* Choice Points */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Choice Points</label>
          <button type="button" onClick={addChoice} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {choicePoints.length === 0 && (
          <p className="text-center text-sm text-text-muted py-4">No choice points yet. Add places where learners make decisions.</p>
        )}
        <div className="space-y-2">
          {choicePoints.map((cp, idx) => (
            <div key={idx} className="rounded-lg border border-bg-muted bg-bg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select value={cp.phase_id} onChange={(e) => updateChoice(idx, { phase_id: e.target.value })} className={clsx(inputCls, 'w-44')}>
                  <option value="">Select phase</option>
                  {phases.map((p, i) => (
                    <option key={p.id} value={p.id}>{p.title || `Phase ${i + 1}`}</option>
                  ))}
                </select>
                <select value={cp.choice_type} onChange={(e) => updateChoice(idx, { choice_type: e.target.value as ChoicePoint['choice_type'] })} className={clsx(inputCls, 'w-44')}>
                  {CHOICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeChoice(idx)} className="shrink-0 rounded p-1 text-text-light hover:bg-alert-50 hover:text-alert-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea value={cp.description} onChange={(e) => updateChoice(idx, { description: e.target.value })} rows={1} placeholder="What does the learner get to decide?" className={inputCls} />
              <ListInput items={cp.options} onChange={(v) => updateChoice(idx, { options: v })} placeholder="Suggested option" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Critique Protocol</label>
        <textarea value={critiqueProtocol} onChange={(e) => setCritiqueProtocol(e.target.value)} rows={3} placeholder="Describe the peer feedback process..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Differentiation Guide</label>
        <div className="space-y-3 rounded-lg border border-bg-muted bg-bg p-3">
          <div>
            <label className={labelCls}>Extending (more challenge)</label>
            <textarea value={differentiation.extending} onChange={(e) => setDifferentiation({ ...differentiation, extending: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Supporting (more scaffolding)</label>
            <textarea value={differentiation.supporting} onChange={(e) => setDifferentiation({ ...differentiation, supporting: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ELL Accommodations</label>
            <textarea value={differentiation.ell_accommodations} onChange={(e) => setDifferentiation({ ...differentiation, ell_accommodations: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Accessibility Notes</label>
            <textarea value={differentiation.accessibility_notes} onChange={(e) => setDifferentiation({ ...differentiation, accessibility_notes: e.target.value })} rows={2} className={inputCls} />
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Scaffolding Notes</label>
        <textarea value={scaffoldingNotes} onChange={(e) => setScaffoldingNotes(e.target.value)} rows={3} placeholder="General guidance for educators on supporting all learners..." className={inputCls} />
      </div>
    </div>
  )
}

// ============================================================
// Step 5: Final Product & Resources
// ============================================================

function StepProduct({
  finalProduct, setFinalProduct,
  resources, setResources,
}: {
  finalProduct: FinalProduct; setFinalProduct: (v: FinalProduct) => void
  resources: TemplateResource[]; setResources: (v: TemplateResource[]) => void
}) {
  function addResource() {
    setResources([...resources, { title: '', type: 'link', url: null, notes: '' }])
  }

  function updateResource(idx: number, patch: Partial<TemplateResource>) {
    setResources(resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeResource(idx: number) {
    setResources(resources.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-5">
      {/* Final Product */}
      <div>
        <label className={labelCls}>Final Product</label>
        <div className="space-y-3 rounded-lg border border-bg-muted bg-bg p-3">
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={finalProduct.description} onChange={(e) => setFinalProduct({ ...finalProduct, description: e.target.value })} rows={2} placeholder="What will learners create?" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Format Options</label>
            <ListInput items={finalProduct.format_options} onChange={(v) => setFinalProduct({ ...finalProduct, format_options: v })} placeholder="e.g. presentation, documentary, model" />
          </div>
          <div>
            <label className={labelCls}>Audience</label>
            <input type="text" value={finalProduct.audience} onChange={(e) => setFinalProduct({ ...finalProduct, audience: e.target.value })} placeholder="Who will see/experience the final product?" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Presentation Format</label>
            <input type="text" value={finalProduct.presentation_format} onChange={(e) => setFinalProduct({ ...finalProduct, presentation_format: e.target.value })} placeholder="e.g. gallery walk, panel, community event" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Quality Criteria</label>
            <ListInput items={finalProduct.quality_criteria} onChange={(v) => setFinalProduct({ ...finalProduct, quality_criteria: v })} placeholder="Rubric-aligned expectations" />
          </div>
        </div>
      </div>

      {/* Resources */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Materials & Resources</label>
          <button type="button" onClick={addResource} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {resources.map((r, idx) => (
            <div key={idx} className="rounded-lg border border-bg-muted bg-bg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input type="text" value={r.title} onChange={(e) => updateResource(idx, { title: e.target.value })} placeholder="Title" className={clsx(inputCls, 'flex-1')} />
                <select value={r.type} onChange={(e) => updateResource(idx, { type: e.target.value as TemplateResource['type'] })} className={clsx(inputCls, 'w-28')}>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeResource(idx)} className="shrink-0 rounded p-1 text-text-light hover:bg-alert-50 hover:text-alert-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input type="url" value={r.url ?? ''} onChange={(e) => updateResource(idx, { url: e.target.value || null })} placeholder="URL (optional)" className={inputCls} />
              <input type="text" value={r.notes} onChange={(e) => updateResource(idx, { notes: e.target.value })} placeholder="Notes" className={inputCls} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Step 6: Review & Publish
// ============================================================

function StepReview({
  validation, status, setStatus, title, drivingQuestion, phases, competencyCount, skillCount,
}: {
  validation: PBLValidationResult | null
  status: TemplateStatus; setStatus: (v: TemplateStatus) => void
  title: string
  drivingQuestion: string
  phases: ProjectPhase[]
  competencyCount: number
  skillCount: number
}) {
  if (!validation) return null

  const strengthColor = (s: string) => {
    switch (s) {
      case 'strong': return 'text-emerald-600 bg-emerald-50'
      case 'adequate': return 'text-primary-600 bg-primary-50'
      case 'weak': return 'text-amber-600 bg-amber-50'
      default: return 'text-alert-600 bg-alert-50'
    }
  }

  const strengthIcon = (s: string) => {
    switch (s) {
      case 'strong': return <CheckCircle2 className="h-4 w-4" />
      case 'adequate': return <Check className="h-4 w-4" />
      case 'weak': return <AlertCircle className="h-4 w-4" />
      default: return <CircleDot className="h-4 w-4" />
    }
  }

  const elements = [
    { key: 'challenging_problem', label: 'Challenging Problem' },
    { key: 'sustained_inquiry', label: 'Sustained Inquiry' },
    { key: 'authenticity', label: 'Authenticity' },
    { key: 'student_voice_choice', label: 'Student Voice & Choice' },
    { key: 'reflection', label: 'Reflection' },
    { key: 'critique_revision', label: 'Critique & Revision' },
    { key: 'public_product', label: 'Public Product' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-xl border border-bg-muted bg-bg p-4 space-y-2">
        <h4 className="text-sm font-bold text-text">{title || 'Untitled Template'}</h4>
        {drivingQuestion && <p className="text-sm text-text-muted italic">"{drivingQuestion}"</p>}
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          <span>{phases.length} phase{phases.length !== 1 ? 's' : ''}</span>
          <span>{competencyCount} competenc{competencyCount !== 1 ? 'ies' : 'y'}</span>
          <span>{skillCount} skill{skillCount !== 1 ? 's' : ''}</span>
          <span>{phases.reduce((s, p) => s + p.duration_days, 0)} days total</span>
        </div>
      </div>

      {/* PBL Health */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-text">PBL Health Score</label>
          <span className={clsx(
            'rounded-full px-3 py-1 text-sm font-bold',
            validation.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
            validation.score >= 50 ? 'bg-amber-100 text-amber-700' :
            'bg-alert-100 text-alert-700'
          )}>
            {validation.score}/100
          </span>
        </div>

        <div className="space-y-2">
          {elements.map(({ key, label }) => {
            const item = validation.elements[key]
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-bg-muted bg-bg px-3 py-2.5">
                <span className={clsx('flex items-center justify-center rounded-full p-1', strengthColor(item.strength))}>
                  {strengthIcon(item.strength)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text">{label}</p>
                  <p className="text-[11px] text-text-muted">{item.feedback}</p>
                </div>
                <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', strengthColor(item.strength))}>
                  {item.strength}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Suggestions */}
      {validation.suggestions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">Suggestions</p>
          <ul className="space-y-1">
            {validation.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-amber-700">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status */}
      <div>
        <label className={labelCls}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as TemplateStatus)} className={inputCls}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>
  )
}

/**
 * Standalone preview page for the PBL Template Builder and Library UI.
 * Renders with mock data so no auth is needed.
 * Remove this file after previewing.
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  Plus,
  FileText,
  Sparkles,
  Eye,
  Pencil,
  Copy,
  Archive,
  Trash2,
  BookOpen,
  Tag,
  Clock,
  BarChart3,
  Filter,
  Search,
  X,
  ChevronDown,
  Check,
  Zap,
  Users,
  User,
  AlertCircle,
  CheckCircle2,
  CircleDot,
} from 'lucide-react'
import { validateTemplate } from '../lib/pbl-validator'
import type {
  GradeBand,
  DOKLevel,
  TemplateStatus,
  AssignmentTemplate,
} from '../types/database'

// ============================================================
// Mock data
// ============================================================

const MOCK_TEMPLATE: AssignmentTemplate = {
  id: '1',
  school_id: 'school-1',
  created_by: 'user-1',
  title: 'Our Community Water Story',
  description: 'An interdisciplinary PBL project where students investigate their community\'s water system.',
  assignment_type: 'class',
  competency_ids: ['c1', 'c2', 'c3'],
  skill_ids: ['s1', 's2'],
  is_shared: true,
  is_global: true,
  template_data: {},
  grade_band: 'elementary',
  subject_area: ['Science', 'ELA'],
  estimated_duration_days: 20,
  driving_question: 'How does water travel through our community, and what can we do to protect it?',
  essential_understandings: [
    'Water moves through natural and human-made systems.',
    'Human choices impact water quality.',
  ],
  authenticity_hook: 'Partnership with local water authority',
  final_product: {
    description: 'Multimedia awareness campaign + action proposal',
    format_options: ['Poster', 'Infographic', 'PSA video'],
    audience: 'Families and community members',
    presentation_format: 'Community showcase',
    quality_criteria: ['Uses evidence', 'Visually engaging'],
  },
  dok_level: 3,
  phases: [
    {
      id: 'p1', title: 'Launch & Wonder', description: 'Entry event and initial inquiry', duration_days: 3, dok_level: 2,
      activities: [
        { id: 'a1', title: 'Water Walk', description: 'Observe water features', activity_type: 'field_work', is_required: true, estimated_minutes: 60, resources: [], educator_notes: '' },
        { id: 'a2', title: 'Know/Wonder Chart', description: 'Brainstorm session', activity_type: 'investigation', is_required: true, estimated_minutes: 30, resources: [], educator_notes: '' },
      ],
      reflection_prompts: ['What surprised you?', 'What are you curious about?'],
      checkpoint: null,
    },
    {
      id: 'p2', title: 'Investigate & Discover', description: 'Research and data gathering', duration_days: 7, dok_level: 3,
      activities: [
        { id: 'a3', title: 'Water Quality Testing', description: 'Test local water samples', activity_type: 'investigation', is_required: true, estimated_minutes: 90, resources: [], educator_notes: '' },
      ],
      reflection_prompts: ['What data surprised you?'],
      checkpoint: { title: 'Research Check', description: 'Review findings', assessment_type: 'educator_check', competency_ids: [], criteria: ['Sources identified'] },
    },
    {
      id: 'p3', title: 'Create & Refine', description: 'Build campaign and proposal', duration_days: 7, dok_level: 3,
      activities: [
        { id: 'a4', title: 'Campaign Design', description: 'Create awareness campaign', activity_type: 'creation', is_required: true, estimated_minutes: 120, resources: [], educator_notes: '' },
      ],
      reflection_prompts: ['What feedback helped most?'],
      checkpoint: { title: 'Peer Review', description: 'Gallery walk feedback', assessment_type: 'peer_review', competency_ids: [], criteria: ['Addresses water issue'] },
    },
    {
      id: 'p4', title: 'Present & Reflect', description: 'Community showcase', duration_days: 3, dok_level: 4,
      activities: [
        { id: 'a5', title: 'Community Showcase', description: 'Present to audience', activity_type: 'presentation', is_required: true, estimated_minutes: 90, resources: [], educator_notes: '' },
      ],
      reflection_prompts: ['What am I most proud of?', 'What would I change?'],
      checkpoint: { title: 'Self-Assessment', description: 'Reflect on learning', assessment_type: 'self_assessment', competency_ids: [], criteria: ['Addressed driving question'] },
    },
  ],
  choice_points: [
    { phase_id: 'p2', description: 'Choose water topic', choice_type: 'topic_selection', options: ['Water cycle', 'Conservation', 'Treatment'] },
    { phase_id: 'p3', description: 'Choose campaign format', choice_type: 'product_format', options: ['Poster', 'Video', 'Infographic'] },
  ],
  critique_protocol: 'I Notice / I Wonder / What If protocol',
  scaffolding_notes: 'Front-load vocabulary. Use thinking routines.',
  differentiation: {
    extending: 'Research water issues in other communities.',
    supporting: 'Provide sentence starters and graphic organizers.',
    ell_accommodations: 'Bilingual glossaries, visual sources.',
    accessibility_notes: 'Alternative observation methods.',
  },
  materials_and_resources: [
    { title: 'EPA Water Sense', type: 'link', url: 'https://epa.gov/watersense', notes: 'Water conservation info' },
    { title: 'Proposal Template', type: 'printable', url: null, notes: 'Scaffolded template' },
  ],
  tags: ['water', 'community', 'science'],
  version: 1,
  parent_template_id: null,
  original_template_id: null,
  status: 'published',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Place-based, culturally immersive templates
const PLACE_BASED_TEMPLATES: AssignmentTemplate[] = [
  {
    ...MOCK_TEMPLATE,
    id: 'pb-1',
    title: 'Our Roots, Our Table: A Community Food Story',
    description: 'Students investigate local food systems, interview family elders about food traditions, test recipes, and create a community cookbook launched at a potluck feast.',
    grade_band: 'elementary' as GradeBand,
    subject_area: ['Science', 'Social Studies', 'ELA'],
    dok_level: 3 as DOKLevel,
    driving_question: 'Where does our food come from, and what do the foods we share tell us about who we are?',
    status: 'published' as TemplateStatus,
    tags: ['place-based', 'culturally-immersive', 'food', 'community', 'oral-history'],
    estimated_duration_days: 21,
    authenticity_hook: 'Families are co-creators: elders share recipes and stories, the class produces a real cookbook, and the project culminates in a community feast.',
    final_product: {
      description: 'A class community cookbook combining family recipes, food stories, cultural illustrations, and the science of local food — launched at a community potluck feast.',
      format_options: ['Printed cookbook + potluck feast', 'Digital cookbook + virtual food story sharing'],
      audience: 'Families, school community, local organizations, and elders who contributed',
      presentation_format: 'Community potluck feast with recipe stations and cookbook launch',
      quality_criteria: ['Recipe is accurate and includes measurements', 'Food story weaves personal memory and cultural meaning', 'Illustration reflects cultural identity', 'Student can share the story behind their dish'],
    },
  },
  {
    ...MOCK_TEMPLATE,
    id: 'pb-2',
    title: 'Guardians of This Place: Caring for Our Land',
    description: 'Students investigate the ecology of their school grounds, learn from community elders about cultural relationships with land, and implement a real stewardship project.',
    grade_band: 'upper_elementary' as GradeBand,
    subject_area: ['Science', 'Social Studies'],
    dok_level: 3 as DOKLevel,
    driving_question: 'How have the people of this place cared for the land, and what is our responsibility to carry that forward?',
    status: 'published' as TemplateStatus,
    tags: ['place-based', 'culturally-immersive', 'ecology', 'stewardship', 'indigenous-knowledge'],
    estimated_duration_days: 21,
    authenticity_hook: 'Students create a REAL, lasting change on their school grounds informed by community knowledge holders.',
    final_product: {
      description: 'A real land stewardship project implemented on school grounds, combining ecological science with cultural land-care knowledge, celebrated through a community dedication ceremony.',
      format_options: ['Garden/restoration + dedication ceremony', 'Garden/restoration + documentary video'],
      audience: 'School community, families, local environmental organizations, and community knowledge holders',
      presentation_format: 'Community land dedication ceremony with student presentations',
      quality_criteria: ['Project addresses genuine ecological need', 'Design integrates scientific and cultural knowledge', 'Students can explain reasoning behind choices', 'Community voice authentically incorporated'],
    },
  },
  {
    ...MOCK_TEMPLATE,
    id: 'pb-3',
    title: 'Voices of Our Place: A Living Community Atlas',
    description: 'Students explore their neighborhood, conduct oral history interviews, and create a Living Community Atlas documenting the cultural significance of local places.',
    grade_band: 'upper_elementary' as GradeBand,
    subject_area: ['Social Studies', 'ELA', 'Art'],
    dok_level: 3 as DOKLevel,
    driving_question: 'What stories, memories, and meanings live in the places around us, and how can we make sure they are never lost?',
    status: 'published' as TemplateStatus,
    tags: ['place-based', 'culturally-immersive', 'oral-history', 'community-mapping', 'atlas'],
    estimated_duration_days: 22,
    authenticity_hook: 'Students produce a real, published atlas gifted back to the community. Interviewees see their stories honored in print.',
    final_product: {
      description: 'A Living Community Atlas — a published collection of oral histories, photographs, artwork, and maps documenting culturally significant local places.',
      format_options: ['Printed atlas + launch event', 'Interactive digital atlas + community event'],
      audience: 'Community interviewees, families, school library, local historical society',
      presentation_format: 'Community atlas launch event with student presentations and atlas distribution',
      quality_criteria: ['Entries preserve interviewees\' voices with respect', 'Stories connected to places through maps and photos', 'Atlas represents community diversity', 'Visual design reflects cultural richness'],
    },
  },
  {
    ...MOCK_TEMPLATE,
    id: 'pb-4',
    title: 'Rhythm of Our People: Music, Movement, and Memory',
    description: 'Students explore family musical traditions, interview musicians, compose original music inspired by heritage, and perform at a community concert.',
    grade_band: 'mixed' as GradeBand,
    subject_area: ['Music', 'Social Studies', 'ELA'],
    dok_level: 3 as DOKLevel,
    driving_question: 'How does the music of our families and community carry the stories, struggles, and celebrations of who we are?',
    status: 'published' as TemplateStatus,
    tags: ['place-based', 'culturally-immersive', 'music', 'performance', 'oral-history'],
    estimated_duration_days: 20,
    authenticity_hook: 'Families and community musicians are central — as interviewees, guest performers, and audience. The concert is a genuine cultural celebration.',
    final_product: {
      description: 'An original musical composition inspired by family and cultural traditions, performed at a community concert celebrating musical diversity.',
      format_options: ['Live concert + printed program', 'Concert + recorded album', 'Concert + documentary video'],
      audience: 'Families, community musicians, school community, and cultural organizations',
      presentation_format: 'Community concert with cultural program notes and family musician participation',
      quality_criteria: ['Composition draws from personal/cultural traditions', 'Program note explains cultural context', 'Performance communicates meaning', 'Student understands how music carries cultural memory'],
    },
  },
  {
    ...MOCK_TEMPLATE,
    id: 'pb-5',
    title: 'Building Together: Designing Spaces Our Community Needs',
    description: 'Students survey community needs, study how different cultures gather, and design a culturally responsive community space with scale models and formal proposals.',
    grade_band: 'middle_school' as GradeBand,
    subject_area: ['Math', 'Social Studies', 'Art'],
    dok_level: 4 as DOKLevel,
    driving_question: 'What spaces does our community need, and how can we design them so they honor who we are and how we gather?',
    status: 'published' as TemplateStatus,
    tags: ['place-based', 'culturally-immersive', 'math', 'design', 'community-planning'],
    estimated_duration_days: 20,
    authenticity_hook: 'Community members drive the design through real listening sessions. Students present to real stakeholders — school board, city officials, parks department.',
    final_product: {
      description: 'A scale model and written design proposal for a community gathering space — presented to real community stakeholders.',
      format_options: ['Physical model + written proposal + presentation', 'Digital 3D model + proposal + video walkthrough'],
      audience: 'School board, city council, parks department, neighborhood association, and families',
      presentation_format: 'Formal design proposal presentation to community stakeholders with scale models',
      quality_criteria: ['Design responds to community-identified needs', 'Cultural gathering practices reflected', 'Model built to scale with accurate math', 'Proposal is professional and persuasive'],
    },
  },
]

const MOCK_TEMPLATES = [...PLACE_BASED_TEMPLATES]

// ============================================================
// Style constants
// ============================================================

const GRADE_BAND_LABELS: Record<GradeBand, string> = {
  early_elementary: 'Early Elem',
  elementary: 'Elementary',
  upper_elementary: 'Upper Elem',
  middle_school: 'Middle School',
  mixed: 'Mixed',
}

const STATUS_STYLES: Record<TemplateStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

const DOK_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700',
  2: 'bg-indigo-100 text-indigo-700',
  3: 'bg-violet-100 text-violet-700',
  4: 'bg-fuchsia-100 text-fuchsia-700',
}

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400'
const labelCls = 'mb-1.5 block text-xs font-semibold text-gray-500'

// ============================================================
// Preview Page
// ============================================================

export default function TemplatePreview() {
  const [view, setView] = useState<'library' | 'builder' | 'validator'>('library')
  const [selectedTemplate, setSelectedTemplate] = useState<typeof MOCK_TEMPLATE | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">PBL Template System Preview</h1>
        <p className="text-sm text-gray-500 mt-1">Preview of the Assignment Template Builder, Library, and PBL Validator</p>
        <div className="flex gap-2 mt-3">
          {(['library', 'builder', 'validator'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); setSelectedTemplate(null) }}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                view === v ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {v === 'library' ? 'Template Library' : v === 'builder' ? 'Template Builder' : 'PBL Validator'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {view === 'library' && (
          <LibraryPreview
            templates={MOCK_TEMPLATES}
            onView={setSelectedTemplate}
          />
        )}
        {view === 'builder' && <BuilderPreview />}
        {view === 'validator' && <ValidatorPreview template={MOCK_TEMPLATE} />}
      </div>

      {/* Template detail modal */}
      {selectedTemplate && (
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// Library Preview
// ============================================================

function LibraryPreview({
  templates,
  onView,
}: {
  templates: typeof MOCK_TEMPLATES
  onView: (t: typeof MOCK_TEMPLATE) => void
}) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = templates.filter(
    (t) => !search || t.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Search + Filter + Add */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
              showFilters
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600">
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <select className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
              <option>All grades</option>
              <option>Early Elementary</option>
              <option>Elementary</option>
              <option>Upper Elementary</option>
              <option>Middle School</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
              <option>All subjects</option>
              <option>Math</option>
              <option>Science</option>
              <option>ELA</option>
              <option>Social Studies</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
              <option>All DOK</option>
              <option>DOK 1</option>
              <option>DOK 2</option>
              <option>DOK 3</option>
              <option>DOK 4</option>
            </select>
            <select className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
              <option>All statuses</option>
              <option>Draft</option>
              <option>Published</option>
              <option>Archived</option>
            </select>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-4 transition-colors hover:border-indigo-200"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                <FileText className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                  <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', STATUS_STYLES[t.status])}>
                    {t.status}
                  </span>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                    {GRADE_BAND_LABELS[t.grade_band]}
                  </span>
                  <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', DOK_COLORS[t.dok_level])}>
                    DOK {t.dok_level}
                  </span>
                </div>
                {t.subject_area.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.subject_area.map((s) => (
                      <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{s}</span>
                    ))}
                  </div>
                )}
                {t.driving_question && (
                  <p className="mt-1 text-xs text-gray-500 italic line-clamp-1">"{t.driving_question}"</p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{t.phases.length} phases</span>
                  {t.estimated_duration_days && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.estimated_duration_days}d</span>}
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{t.competency_ids.length} competencies</span>
                  <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{t.skill_ids.length} skills</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => onView(t)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Eye className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Copy className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600"><Archive className="h-4 w-4" /></button>
                <button className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600">
                  <Sparkles className="h-3.5 w-3.5" />Use
                </button>
                <button className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Builder Preview (Step 1: Overview)
// ============================================================

function BuilderPreview() {
  const [step, setStep] = useState(0)
  const steps = ['Overview', 'Design Foundations', 'Project Phases', 'Student Agency', 'Final Product', 'Review']
  const [title, setTitle] = useState('Our Community Water Story')
  const [description, setDescription] = useState('An interdisciplinary PBL project where students investigate their community\'s water system.')
  const [gradeBand, setGradeBand] = useState<GradeBand>('elementary')
  const [subjects, setSubjects] = useState(['Science', 'ELA'])
  const [assignmentType, setAssignmentType] = useState<'class' | 'individual'>('class')

  const SUBJECT_OPTIONS = ['Math', 'Science', 'ELA', 'Social Studies', 'Art', 'Music', 'PE', 'World Languages', 'Technology', 'Interdisciplinary']
  const GRADE_BANDS: { value: GradeBand; label: string }[] = [
    { value: 'early_elementary', label: 'Early Elementary (K-2)' },
    { value: 'elementary', label: 'Elementary (3-5)' },
    { value: 'upper_elementary', label: 'Upper Elementary (4-6)' },
    { value: 'middle_school', label: 'Middle School (6-8)' },
    { value: 'mixed', label: 'Mixed' },
  ]

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h3 className="text-base font-bold text-gray-900">New PBL Template</h3>
        <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-5">
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={clsx(
              'shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
              step === i ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grade Band</label>
              <select value={gradeBand} onChange={(e) => setGradeBand(e.target.value as GradeBand)} className={inputCls}>
                {GRADE_BANDS.map((gb) => <option key={gb.value} value={gb.value}>{gb.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subject Areas</label>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_OPTIONS.map((subj) => (
                  <button
                    key={subj}
                    onClick={() => setSubjects(subjects.includes(subj) ? subjects.filter(s => s !== subj) : [...subjects, subj])}
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      subjects.includes(subj) ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-500 hover:bg-indigo-50'
                    )}
                  >{subj}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Estimated Duration (days)</label>
              <input type="number" value={20} className={clsx(inputCls, 'max-w-[120px]')} readOnly />
            </div>
            <div>
              <label className={labelCls}>Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {['water', 'community', 'science'].map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">
                    {tag} <X className="h-3 w-3 text-indigo-400" />
                  </span>
                ))}
              </div>
              <input type="text" placeholder="Add tag and press Enter" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assignment Type</label>
              <div className="flex gap-2">
                {(['class', 'individual'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAssignmentType(t)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                      assignmentType === t ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'
                    )}
                  >
                    {t === 'class' ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    {t === 'class' ? 'Class' : 'Individual'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Project Phases</label>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
                  <Zap className="h-3.5 w-3.5" />Quick Start (4 phases)
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500">
                  <Plus className="h-3.5 w-3.5" />Add Phase
                </button>
              </div>
            </div>
            {MOCK_TEMPLATE.phases.map((phase, idx) => (
              <div key={phase.id} className="rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3 px-4 py-3">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{idx + 1}</span>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{phase.title}</span>
                  <span className="text-xs text-gray-400">{phase.duration_days}d · DOK {phase.dok_level}</span>
                  <Trash2 className="h-3.5 w-3.5 text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 5 && <ValidatorPreview template={MOCK_TEMPLATE} />}

        {step !== 0 && step !== 2 && step !== 5 && (
          <div className="text-center py-12 text-sm text-gray-400">
            Step "{steps[step]}" — Click the Overview, Phases, or Review tab to see populated previews
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
        <div>{step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">Back</button>}</div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">Cancel</button>
          {step < steps.length - 1
            ? <button onClick={() => setStep(step + 1)} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white">Next</button>
            : <button className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white">Save Template</button>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Validator Preview
// ============================================================

function ValidatorPreview({ template }: { template: AssignmentTemplate }) {
  const validation = validateTemplate(template)

  const strengthColor = (s: string) => {
    switch (s) {
      case 'strong': return 'text-emerald-600 bg-emerald-50'
      case 'adequate': return 'text-indigo-600 bg-indigo-50'
      case 'weak': return 'text-amber-600 bg-amber-50'
      default: return 'text-red-600 bg-red-50'
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
        <h4 className="text-sm font-bold text-gray-900">{template.title}</h4>
        {template.driving_question && <p className="text-sm text-gray-500 italic">"{template.driving_question}"</p>}
        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
          <span>{template.phases.length} phases</span>
          <span>{template.competency_ids.length} competencies</span>
          <span>{template.phases.reduce((s, p) => s + p.duration_days, 0)} days total</span>
        </div>
      </div>

      {/* Score */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-gray-900">PBL Health Score</label>
          <span className={clsx(
            'rounded-full px-3 py-1 text-sm font-bold',
            validation.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
            validation.score >= 50 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          )}>
            {validation.score}/100
          </span>
        </div>

        <div className="space-y-2">
          {elements.map(({ key, label }) => {
            const item = validation.elements[key]
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <span className={clsx('flex items-center justify-center rounded-full p-1', strengthColor(item.strength))}>
                  {strengthIcon(item.strength)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-500">{item.feedback}</p>
                </div>
                <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', strengthColor(item.strength))}>
                  {item.strength}
                </span>
              </div>
            )
          })}
        </div>
      </div>

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
    </div>
  )
}

// ============================================================
// Template Detail Modal
// ============================================================

function TemplateDetailModal({ template, onClose }: { template: AssignmentTemplate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{template.title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize', STATUS_STYLES[template.status])}>{template.status}</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700">{GRADE_BAND_LABELS[template.grade_band]}</span>
            <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-medium', DOK_COLORS[template.dok_level])}>DOK {template.dok_level}</span>
            {template.subject_area.map((s) => <span key={s} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">{s}</span>)}
          </div>

          {template.description && <p className="text-sm text-gray-500">{template.description}</p>}

          {template.driving_question && (
            <div className="rounded-lg bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Driving Question</p>
              <p className="text-sm text-indigo-800 italic">"{template.driving_question}"</p>
            </div>
          )}

          {template.phases.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Project Phases</p>
              <div className="space-y-2">
                {template.phases.map((phase, i) => (
                  <div key={phase.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{i + 1}</span>
                      <p className="text-sm font-semibold text-gray-900">{phase.title}</p>
                      <span className="text-xs text-gray-400">{phase.duration_days}d · DOK {phase.dok_level}</span>
                    </div>
                    {phase.description && <p className="mt-1 text-xs text-gray-500">{phase.description}</p>}
                    {phase.activities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {phase.activities.map((a) => <span key={a.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{a.title}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {template.final_product?.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Final Product</p>
              <p className="text-sm text-gray-500">{template.final_product.description}</p>
              {template.final_product.audience && <p className="mt-1 text-xs text-gray-400">Audience: {template.final_product.audience}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

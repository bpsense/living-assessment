// database.ts — Manual TypeScript types matching the Supabase schema.
// Replace with auto-generated types from `supabase gen types typescript` later.

export type UserRole = 'admin' | 'educator' | 'parent' | 'learner'

/**
 * Numeric access level hierarchy:
 * 6 = System Admin, 5 = School Admin, 4 = Department Admin,
 * 3 = Educator, 2 = Family/Parent, 1 = Learner
 */
export type AccessLevel = 1 | 2 | 3 | 4 | 5 | 6
/** Numeric competency rating on a 1-4 scale with 1/3 increments.
 *  Valid values: 0.33, 0.67, 1, 1.33, 1.67, 2, 2.33, 2.67, 3, 3.33, 3.67, 4 */
export type ObservationRating = number

// ============================================================
// Row types (what you get back from SELECT)
// ============================================================

export interface School {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  school_id: string
  role: UserRole
  full_name: string
  email: string
  avatar_url: string | null
  /** Links a learner auth account to their student record */
  student_id: string | null
  /** Soft deactivation — inactive users cannot access the platform */
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Classroom {
  id: string
  school_id: string
  name: string
  grade_level: string | null
  /** Inclusive lower bound of the classroom's expected age range. */
  age_min: number | null
  /** Inclusive upper bound of the classroom's expected age range. */
  age_max: number | null
  department_id: string | null
  /** Admin-controlled sort position within its (school, department) group. */
  display_order: number | null
  created_at: string
  updated_at: string
}

export interface EducatorClassroom {
  id: string
  educator_id: string
  classroom_id: string
  school_id: string
  created_at: string
}

export type StudentClassroomStatus = 'active' | 'archived'

export interface StudentClassroom {
  id: string
  student_id: string
  classroom_id: string
  school_id: string
  is_primary: boolean
  status: StudentClassroomStatus
  created_at: string
}

export type StudentClassroomInsert = Omit<StudentClassroom, 'id' | 'created_at'> & {
  id?: string
  is_primary?: boolean
  status?: StudentClassroomStatus
}

export type StudentStatus = 'active' | 'inactive' | 'withdrawn'

export interface Student {
  id: string
  school_id: string
  classroom_id: string
  first_name: string
  last_name: string
  middle_name: string | null
  preferred_name: string | null
  pronouns: string | null
  date_of_birth: string | null
  grade_level: string | null
  nationality: string | null
  first_language: string | null
  additional_languages: string[] | null
  medical_conditions: string | null
  student_support_needs: string | null
  dietary_restrictions: string | null
  medications: string | null
  enrollment_date: string | null
  student_status: StudentStatus
  avatar_url: string | null
  family_code: string | null
  student_number: string | null
  created_at: string
  updated_at: string
}

export interface ParentStudent {
  id: string
  parent_id: string
  student_id: string
  school_id: string
  created_at: string
}

export interface Dimension {
  id: string
  school_id: string
  name: string
  description: string | null
  display_order: number
  icon: string | null
  category: string
  is_active: boolean
  visible_to_family: boolean
  created_at: string
  updated_at: string
}

export interface Observation {
  id: string
  school_id: string
  student_id: string
  dimension_id: string
  observer_id: string
  rating: ObservationRating
  notes: string | null
  observed_at: string
  /** Optional link to an assignment this observation relates to */
  assignment_id: string | null
  /** Optional link to the specific student-assignment instance */
  student_assignment_id: string | null
  created_at: string
  updated_at: string
}

export interface InterestSurvey {
  id: string
  school_id: string
  student_id: string
  responses: Record<string, unknown>
  submitted_at: string
  created_at: string
  updated_at: string
}

export interface StandardsFramework {
  id: string
  school_id: string
  name: string
  description: string | null
  version: string | null
  global_framework_id: string | null
  created_at: string
  updated_at: string
}

export interface GlobalStandardsFramework {
  id: string
  name: string
  description: string | null
  version: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface GlobalStandard {
  id: string
  framework_id: string
  code: string
  description: string
  grade_level: string | null
  parent_id: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface Standard {
  id: string
  framework_id: string
  school_id: string
  code: string
  description: string
  grade_level: string | null
  parent_id: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface DimensionStandard {
  id: string
  dimension_id: string
  standard_id: string
  school_id: string
  created_at: string
}

export interface StudentSession {
  id: string
  student_id: string
  school_id: string
  token: string
  expires_at: string
  created_at: string
}

// ============================================================
// Insert types (omit server-generated fields)
// ============================================================

export type SchoolInsert = Omit<School, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  settings?: Record<string, unknown>
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'> & {
  avatar_url?: string | null
}

export type ClassroomInsert = Omit<Classroom, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  grade_level?: string | null
}

export type StudentInsert = Omit<Student, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  middle_name?: string | null
  preferred_name?: string | null
  pronouns?: string | null
  date_of_birth?: string | null
  grade_level?: string | null
  nationality?: string | null
  first_language?: string | null
  additional_languages?: string[] | null
  medical_conditions?: string | null
  student_support_needs?: string | null
  dietary_restrictions?: string | null
  medications?: string | null
  enrollment_date?: string | null
  student_status?: StudentStatus
  avatar_url?: string | null
  family_code?: string | null
  student_number?: string | null
}

export type ObservationInsert = Omit<Observation, 'id' | 'created_at' | 'updated_at' | 'observed_at'> & {
  id?: string
  observed_at?: string
  assignment_id?: string | null
  student_assignment_id?: string | null
}

export type InterestSurveyInsert = Omit<InterestSurvey, 'id' | 'created_at' | 'updated_at' | 'submitted_at'> & {
  id?: string
  submitted_at?: string
}

export type DimensionInsert = Omit<Dimension, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  description?: string | null
  display_order?: number
  icon?: string | null
  category?: string
  is_active?: boolean
  visible_to_family?: boolean
}

export type StandardInsert = Omit<Standard, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  grade_level?: string | null
  parent_id?: string | null
  display_order?: number
}

// ============================================================
// Update types (all fields optional except id)
// ============================================================

export type SchoolUpdate = Partial<Omit<School, 'id' | 'created_at' | 'updated_at'>>
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
export type ClassroomUpdate = Partial<Omit<Classroom, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
export type StudentUpdate = Partial<Omit<Student, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
export type ObservationUpdate = Partial<Omit<Observation, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
export type DimensionUpdate = Partial<Omit<Dimension, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

// ============================================================
// Function return types
// ============================================================

export interface CompetencyScore {
  dimension_id: string
  dimension_name: string
  score: number
}

// ============================================================
// Composite types for UI convenience
// ============================================================

export interface StudentWithScores extends Student {
  scores: CompetencyScore[]
}

export interface ObservationWithDetails extends Observation {
  student?: Student
  dimension?: Dimension
  observer?: Profile
}

// ============================================================
// School Pedagogical Context
// ============================================================

export interface SchoolContext {
  mission?: string
  core_values?: string
  pedagogical_approach?: string
  teaching_methodologies?: string
  assessment_philosophy?: string
  curriculum_framework?: string
  standards_notes?: string
  department_label?: 'Department' | 'Location'
}

export interface SchoolDocument {
  id: string
  school_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  description: string | null
  uploaded_by: string
  created_at: string
}

// ============================================================
// Student Information System (SIS)
// ============================================================

export type ContactType = 'parent' | 'guardian' | 'emergency'

export interface StudentContact {
  id: string
  student_id: string
  school_id: string
  contact_type: ContactType
  full_name: string
  relationship: string | null
  phone: string | null
  email: string | null
  is_primary: boolean
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type StudentContactInsert = Omit<StudentContact, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  relationship?: string | null
  phone?: string | null
  email?: string | null
  is_primary?: boolean
  address?: string | null
  notes?: string | null
}

export type StudentContactUpdate = Partial<Omit<StudentContact, 'id' | 'school_id' | 'student_id' | 'created_at' | 'updated_at'>>

export type NoteType = 'general' | 'academic' | 'behavioral' | 'social-emotional' | 'medical'

export interface TeacherNote {
  id: string
  student_id: string
  school_id: string
  author_id: string
  content: string
  note_type: NoteType
  is_confidential: boolean
  created_at: string
  updated_at: string
}

export interface TeacherNoteWithAuthor extends TeacherNote {
  author_name: string
}

export type TeacherNoteInsert = Omit<TeacherNote, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  note_type?: NoteType
  is_confidential?: boolean
}

export type TeacherNoteUpdate = Partial<Omit<TeacherNote, 'id' | 'school_id' | 'student_id' | 'author_id' | 'created_at' | 'updated_at'>>

// ============================================================
// Parent Notes
// ============================================================

export type ParentNoteType = 'home-interests' | 'strengths' | 'concerns' | 'context' | 'general'

export interface ParentNote {
  id: string
  student_id: string
  school_id: string
  author_id: string
  content: string
  note_type: ParentNoteType
  created_at: string
  updated_at: string
}

export interface ParentNoteWithAuthor extends ParentNote {
  author_name: string
}

export type ParentNoteInsert = Omit<ParentNote, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  note_type?: ParentNoteType
}

export type ParentNoteUpdate = Partial<Omit<ParentNote, 'id' | 'school_id' | 'student_id' | 'author_id' | 'created_at' | 'updated_at'>>

// ============================================================
// Student Context Documents
// ============================================================

export interface StudentContextDocument {
  id: string
  student_id: string
  school_id: string
  content_hash: string
  markdown: string
  compiled_at: string
  compiled_by: string | null
  token_estimate: number
  created_at: string
  updated_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'tardy' | 'excused'

export interface AttendanceRecord {
  id: string
  student_id: string
  classroom_id: string
  school_id: string
  date: string
  status: AttendanceStatus
  notes: string | null
  recorded_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// Student Documents (SIS file uploads)
// ============================================================

export interface StudentDocument {
  id: string
  student_id: string
  school_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  description: string | null
  uploaded_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// Teacher Note Files & Folders
// ============================================================

export interface TeacherNoteFolder {
  id: string
  student_id: string
  school_id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface TeacherNoteFile {
  id: string
  folder_id: string | null
  student_id: string
  school_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// AI Learning Suggestions
// ============================================================

export type SuggestionActivityType =
  | 'project'
  | 'exploration'
  | 'practice'
  | 'challenge'
  | 'connection'

export type SuggestionPriority = 'high' | 'medium' | 'low'

export interface LearningSuggestion {
  id: string
  zone: string
  dimension_name: string
  title: string
  description: string
  activity_type: SuggestionActivityType
  priority: SuggestionPriority
  parent_friendly_summary: string | null
}

export interface EducatorAction {
  dismissed?: boolean
  saved?: boolean
  shared_with_parent?: boolean
}

export interface LearningSuggestionsRow {
  id: string
  school_id: string
  student_id: string
  zone_hash: string
  zone_data: unknown
  suggestions: LearningSuggestion[]
  educator_actions: Record<string, EducatorAction>
  requested_by: string
  prompt_version: string
  created_at: string
  updated_at: string
}

// ============================================================
// Multi-School / System Admin
// ============================================================

export interface SystemAdmin {
  user_id: string
  created_at: string
  created_by: string | null
}

// ============================================================
// Departments / Locations
// ============================================================

export interface Department {
  id: string
  school_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type DepartmentInsert = Omit<Department, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  description?: string | null
}

export type DepartmentUpdate = Partial<Omit<Department, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export interface DepartmentAdmin {
  id: string
  user_id: string
  department_id: string
  school_id: string
  created_at: string
}

// ============================================================
// Family Support AI Suggestions
// ============================================================

export type FamilySuggestionCategory =
  | 'daily-routine'
  | 'weekend-activity'
  | 'reading'
  | 'conversation'
  | 'creative-play'
  | 'outdoor'
  | 'social'

export interface FamilySuggestion {
  id: string
  category: FamilySuggestionCategory
  dimension_name: string
  title: string
  description: string
  why_it_helps: string
  materials_needed: string
}

export interface EducatorNote {
  note: string
  author_id: string
  author_name: string
  updated_at: string
}

export interface FamilySupportRow {
  id: string
  school_id: string
  student_id: string
  zone_hash: string
  zone_data: unknown
  suggestions: FamilySuggestion[]
  educator_notes: Record<string, EducatorNote>
  requested_by: string
  prompt_version: string
  created_at: string
  updated_at: string
}

// ============================================================
// Competency Frameworks
// ============================================================

export interface CompetencyFramework {
  id: string
  school_id: string
  name: string
  description: string | null
  version: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type CompetencyFrameworkInsert = Omit<CompetencyFramework, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  description?: string | null
  version?: string | null
  is_default?: boolean
}

export interface CompetencyDomain {
  id: string
  framework_id: string
  name: string
  display_order: number
  code_prefix: string | null
  created_at: string
}

export type CompetencyDomainInsert = Omit<CompetencyDomain, 'id' | 'created_at'> & {
  id?: string
  display_order?: number
  code_prefix?: string | null
}

export interface CompetencySubdomain {
  id: string
  domain_id: string
  name: string
  display_order: number
  created_at: string
}

export type CompetencySubdomainInsert = Omit<CompetencySubdomain, 'id' | 'created_at'> & {
  id?: string
  display_order?: number
}

/** Step descriptor keys: E1-E6 (early years) and 1-10 (grade levels) */
export type StepDescriptors = Record<string, string>

export interface Competency {
  id: string
  subdomain_id: string
  framework_id: string
  code: string
  name: string
  objective: string | null
  step_descriptors: StepDescriptors
  /** Inclusive lower bound of the typical age this competency targets. */
  age_band_start: number | null
  /** Inclusive upper bound of the typical age this competency targets. */
  age_band_end: number | null
  created_at: string
}

export type CompetencyInsert = Omit<Competency, 'id' | 'created_at' | 'age_band_start' | 'age_band_end'> & {
  id?: string
  objective?: string | null
  age_band_start?: number | null
  age_band_end?: number | null
}

// ============================================================
// Assignments & Grading
// ============================================================

export type AssignmentType = 'individual' | 'class'
export type AssignmentStatus = 'draft' | 'active' | 'completed'
export type StudentAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'graded'
export type LearnerColumn = 'on_deck' | 'researching' | 'actively_exploring' | 'blocked'
export type CompetencyScoreSource = 'teacher' | 'ai_inferred' | 'observation' | 'skill_assessment'

export interface Assignment {
  id: string
  school_id: string
  classroom_id: string | null
  teacher_id: string
  title: string
  description: string | null
  due_date: string | null
  assignment_type: AssignmentType
  status: AssignmentStatus
  template_id: string | null
  project_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AssignmentInsert = Omit<Assignment, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  classroom_id?: string | null
  description?: string | null
  due_date?: string | null
  assignment_type?: AssignmentType
  status?: AssignmentStatus
  template_id?: string | null
  project_data?: Record<string, unknown>
}

export type AssignmentUpdate = Partial<Omit<Assignment, 'id' | 'school_id' | 'teacher_id' | 'created_at' | 'updated_at'>>

export interface AssignmentCompetency {
  id: string
  assignment_id: string
  competency_id: string
  created_at: string
}

export interface AiInferredScore {
  competency_id: string
  suggested_score: number
  reasoning: string
}

export interface StudentAssignment {
  id: string
  assignment_id: string
  student_id: string
  status: StudentAssignmentStatus
  learner_column: LearnerColumn
  assigned_at: string
  submitted_at: string | null
  graded_at: string | null
  qualitative_feedback: string | null
  ai_inferred_scores: AiInferredScore[] | null
  graded_by: string | null
  created_at: string
  updated_at: string
}

export type StudentAssignmentInsert = Pick<StudentAssignment, 'assignment_id' | 'student_id'> & {
  id?: string
  status?: StudentAssignmentStatus
  learner_column?: LearnerColumn
  assigned_at?: string
  submitted_at?: string | null
  graded_at?: string | null
  qualitative_feedback?: string | null
  ai_inferred_scores?: AiInferredScore[] | null
  graded_by?: string | null
}

export type StudentAssignmentUpdate = Partial<Omit<StudentAssignment, 'id' | 'assignment_id' | 'student_id' | 'created_at' | 'updated_at'>>

// ============================================================
// Community Messaging
// ============================================================

export type ConversationType = 'direct' | 'class' | 'group' | 'admin_inbox'

export interface Conversation {
  id: string
  school_id: string
  conversation_type: ConversationType
  title: string | null
  classroom_id: string | null
  /** Set when an admin "claims" an admin_inbox thread; null otherwise. */
  admin_assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ConversationInsert = Pick<Conversation, 'school_id' | 'conversation_type' | 'created_by'> & {
  id?: string
  title?: string | null
  classroom_id?: string | null
  admin_assigned_to?: string | null
}

export interface ConversationParticipant {
  id: string
  conversation_id: string
  user_id: string
  role: string
  joined_at: string
  last_read_at: string | null
}

export type ConversationParticipantInsert = Pick<ConversationParticipant, 'conversation_id' | 'user_id'> & {
  id?: string
  role?: string
  last_read_at?: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_flagged: boolean
  flagged_by: string | null
  created_at: string
  updated_at: string
}

export type MessageInsert = Pick<Message, 'conversation_id' | 'sender_id' | 'content'> & {
  id?: string
  is_flagged?: boolean
  flagged_by?: string | null
}

export interface CompetencyScoreRow {
  id: string
  student_assignment_id: string | null
  student_skill_assignment_id: string | null
  competency_id: string
  student_id: string
  school_id: string
  score: number
  source: CompetencyScoreSource
  notes: string | null
  is_above_grade: boolean
  scored_at: string
  created_at: string
}

export type CompetencyScoreInsert = Omit<CompetencyScoreRow, 'id' | 'created_at' | 'student_skill_assignment_id' | 'is_above_grade'> & {
  id?: string
  student_assignment_id?: string | null
  student_skill_assignment_id?: string | null
  source?: CompetencyScoreSource
  notes?: string | null
  is_above_grade?: boolean
  scored_at?: string
}

// ============================================================
// AI Competency → Dimension Mapping
// ============================================================

export interface CompetencyDimensionMapping {
  id: string
  school_id: string
  competency_id: string
  dimension_id: string
  confidence: number
  reasoning: string | null
  created_at: string
  updated_at: string
}

export type CompetencyDimensionMappingInsert = Omit<CompetencyDimensionMapping, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  confidence?: number
  reasoning?: string | null
}

// ============================================================
// Skills Library
// ============================================================

export interface Skill {
  id: string
  /** NULL = system/baseline skill visible to all schools (read-only to non-system-admins). */
  school_id: string | null
  name: string
  description: string | null
  category: string | null
  min_grade: string | null
  max_grade: string | null
  is_default: boolean
  created_by: string | null
  is_assessable: boolean
  source_framework: string
  source_standard_code: string | null
  progression_domain: string | null
  progression_strand: string | null
  /** V2: FK to learner_profile_domains.id. NULLABLE during migration; new skills should set this. */
  domain_id: string | null
  /** V2: optional age-band start (inclusive), e.g. 6. */
  age_band_start: number | null
  /** V2: optional age-band end (inclusive), e.g. 8. */
  age_band_end: number | null
  /** V2: free-text upstream provenance (e.g. "CCSS-Math K.CC", "NGSS Practices 1-3"). */
  source_reference: string | null
  created_at: string
  updated_at: string
}

export type SkillInsert = Pick<Skill, 'name'> & {
  id?: string
  /** Required for school-owned skills; pass `null` only as a system admin to create a baseline skill. */
  school_id: string | null
  description?: string | null
  category?: string | null
  min_grade?: string | null
  max_grade?: string | null
  is_default?: boolean
  created_by?: string | null
  is_assessable?: boolean
  source_framework?: string
  source_standard_code?: string | null
  progression_domain?: string | null
  progression_strand?: string | null
  domain_id?: string | null
  age_band_start?: number | null
  age_band_end?: number | null
  source_reference?: string | null
}

export type SkillUpdate = Partial<Omit<Skill, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export interface SkillCompetency {
  id: string
  skill_id: string
  competency_id: string
  created_at: string
}

export interface AssignmentSkill {
  id: string
  assignment_id: string
  skill_id: string
  created_at: string
}

// ============================================================
// Assignment Templates (PBL Project Templates)
// ============================================================

export type GradeBand = 'early_elementary' | 'elementary' | 'upper_elementary' | 'middle_school' | 'mixed'
export type TemplateStatus = 'draft' | 'published' | 'archived'
export type DOKLevel = 1 | 2 | 3 | 4

export interface ProjectPhase {
  id: string
  title: string
  description: string
  duration_days: number
  dok_level: DOKLevel
  activities: PhaseActivity[]
  reflection_prompts: string[]
  checkpoint: PhaseCheckpoint | null
}

export interface PhaseActivity {
  id: string
  title: string
  description: string
  activity_type: 'investigation' | 'creation' | 'collaboration' | 'reflection' | 'presentation' | 'skill_building' | 'field_work'
  is_required: boolean
  estimated_minutes: number
  resources: string[]
  educator_notes: string
}

export interface PhaseCheckpoint {
  title: string
  description: string
  assessment_type: 'self_assessment' | 'peer_review' | 'educator_check' | 'portfolio_entry' | 'group_critique'
  competency_ids: string[]
  criteria: string[]
}

export interface FinalProduct {
  description: string
  format_options: string[]
  audience: string
  presentation_format: string
  quality_criteria: string[]
}

export interface ChoicePoint {
  phase_id: string
  description: string
  choice_type: 'topic_selection' | 'research_method' | 'product_format' | 'collaboration_structure' | 'presentation_style'
  options: string[]
}

export interface DifferentiationGuide {
  extending: string
  supporting: string
  ell_accommodations: string
  accessibility_notes: string
}

export interface TemplateResource {
  title: string
  type: 'link' | 'book' | 'material' | 'tool' | 'printable' | 'video'
  url: string | null
  notes: string
}

export interface AssignmentTemplate {
  id: string
  school_id: string
  created_by: string | null
  title: string
  description: string | null
  assignment_type: AssignmentType
  competency_ids: string[]
  skill_ids: string[]
  is_shared: boolean
  is_global: boolean
  template_data: Record<string, unknown>

  // PBL-specific fields
  grade_band: GradeBand
  subject_area: string[]
  estimated_duration_days: number | null
  driving_question: string | null
  essential_understandings: string[]
  authenticity_hook: string | null
  final_product: FinalProduct | null
  dok_level: DOKLevel
  phases: ProjectPhase[]
  choice_points: ChoicePoint[]
  critique_protocol: string | null
  scaffolding_notes: string | null
  differentiation: DifferentiationGuide | null
  materials_and_resources: TemplateResource[]
  tags: string[]
  version: number
  parent_template_id: string | null
  original_template_id: string | null
  status: TemplateStatus

  created_at: string
  updated_at: string
}

/** Fields that have DB defaults or are nullable — optional on insert */
type PBLOptionalFields =
  | 'grade_band'
  | 'subject_area'
  | 'estimated_duration_days'
  | 'driving_question'
  | 'essential_understandings'
  | 'authenticity_hook'
  | 'final_product'
  | 'dok_level'
  | 'phases'
  | 'choice_points'
  | 'critique_protocol'
  | 'scaffolding_notes'
  | 'differentiation'
  | 'materials_and_resources'
  | 'tags'
  | 'version'
  | 'parent_template_id'
  | 'original_template_id'
  | 'status'
  | 'is_global'

export type AssignmentTemplateInsert =
  Omit<AssignmentTemplate, 'id' | 'created_at' | 'updated_at' | PBLOptionalFields> &
  Partial<Pick<AssignmentTemplate, PBLOptionalFields>>

export type AssignmentTemplateUpdate = Partial<
  Omit<AssignmentTemplate, 'id' | 'school_id' | 'created_at' | 'updated_at'>
>

// ============================================================
// Grade/Age Step Mapping Utility
// ============================================================

/** Maps grade_level strings to competency step keys */
export const GRADE_TO_STEP: Record<string, string> = {
  'Pre-K': 'E4',
  'TK': 'E5',
  'K': 'E6',
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  // Age-based fallbacks
  '0': 'E1', '1y': 'E2', '2y': 'E3', '3y': 'E4', '4y': 'E5', '5y': 'E6',
}

// ============================================================
// School Profile Visibility
// ============================================================

export type SchoolProfileSectionKey =
  | 'school_identity'
  | 'pedagogical_approach'
  | 'curriculum_standards'
  | 'dimensions_overview'
  | 'standards_frameworks'
  | 'supporting_documents'

export type SchoolProfileVisibility = Record<SchoolProfileSectionKey, boolean>

export const DEFAULT_PROFILE_VISIBILITY: SchoolProfileVisibility = {
  school_identity: true,
  pedagogical_approach: true,
  curriculum_standards: true,
  dimensions_overview: true,
  standards_frameworks: true,
  supporting_documents: true,
}

// ============================================================
// Skill Progressions
// ============================================================

export interface SkillProgressionStep {
  id: string
  skill_id: string
  school_id: string
  grade_level: string
  expectation_description: string
  example_tasks: string | null
  prerequisite_step_id: string | null
  competency_ids: string[]
  created_at: string
  updated_at: string
}

export type SkillProgressionStepInsert = Omit<SkillProgressionStep, 'id' | 'created_at' | 'updated_at'>
export type SkillProgressionStepUpdate = Partial<Omit<SkillProgressionStep, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export interface SkillWithProgression extends Skill {
  steps: SkillProgressionStep[]
}

// ============================================================
// Skill Assignments
// ============================================================

export type SkillAssignmentStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface SkillAssignment {
  id: string
  school_id: string
  classroom_id: string | null
  skill_id: string
  assigned_step_id: string
  assigned_by: string
  assignment_type: AssignmentType
  title: string | null
  instructions: string | null
  due_date: string | null
  status: SkillAssignmentStatus
  created_at: string
  updated_at: string
}

export type SkillAssignmentInsert = Omit<SkillAssignment, 'id' | 'created_at' | 'updated_at'>
export type SkillAssignmentUpdate = Partial<Omit<SkillAssignment, 'id' | 'school_id' | 'created_at' | 'updated_at'>>

export type StudentSkillAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'graded'

export interface StudentSkillAssignment {
  id: string
  skill_assignment_id: string
  student_id: string
  student_step_id: string
  status: StudentSkillAssignmentStatus
  score: number | null
  scored_by: string | null
  scored_at: string | null
  notes: string | null
  is_above_grade: boolean
  created_at: string
  updated_at: string
}

export type StudentSkillAssignmentInsert = Omit<StudentSkillAssignment, 'id' | 'created_at' | 'updated_at'>

// ============================================================
// Extended types for Skill UI
// ============================================================

export interface SkillAssignmentWithDetails extends SkillAssignment {
  skill: Skill
  assigned_step: SkillProgressionStep
  student_assignments: StudentSkillAssignmentWithStudent[]
  assignor_name: string
}

export interface StudentSkillAssignmentWithStudent extends StudentSkillAssignment {
  student: Pick<Student, 'id' | 'first_name' | 'last_name' | 'grade_level'>
  step: SkillProgressionStep
}

// Grade zone indicator for UI
export type GradeZone = 'remediation' | 'current' | 'extension'

// ============================================================
// Incident Reports
// ============================================================

export type IncidentType = 'behavioral' | 'medical_injury' | 'safety' | 'bullying' | 'property_damage' | 'emotional_welfare' | 'other'
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type IncidentStudentRole = 'involved' | 'victim' | 'aggressor' | 'witness' | 'bystander'
export type IncidentNotificationType = 'new_incident' | 'assigned' | 'follow_up' | 'status_change' | 'tagged'

export interface IncidentReport {
  id: string
  school_id: string
  reported_by: string
  incident_date: string
  incident_time: string | null
  location: string
  incident_type: IncidentType
  severity: IncidentSeverity
  description: string
  immediate_actions_taken: string | null
  witnesses: string | null
  parent_notified: boolean
  parent_notification_method: string | null
  shared_with_family: boolean
  status: IncidentStatus
  assigned_to: string | null
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type IncidentReportInsert = Omit<IncidentReport, 'id' | 'created_at' | 'updated_at' | 'incident_time' | 'immediate_actions_taken' | 'witnesses' | 'parent_notified' | 'parent_notification_method' | 'shared_with_family' | 'status' | 'assigned_to' | 'resolution_notes' | 'resolved_at'> & {
  id?: string
  incident_time?: string | null
  immediate_actions_taken?: string | null
  witnesses?: string | null
  parent_notified?: boolean
  parent_notification_method?: string | null
  shared_with_family?: boolean
  status?: IncidentStatus
  assigned_to?: string | null
  resolution_notes?: string | null
  resolved_at?: string | null
}

export type IncidentReportUpdate = Partial<Omit<IncidentReport, 'id' | 'school_id' | 'reported_by' | 'created_at' | 'updated_at'>>

export interface IncidentReportStudent {
  id: string
  incident_report_id: string
  student_id: string
  role: IncidentStudentRole
  notes: string | null
}

export type IncidentReportStudentInsert = Omit<IncidentReportStudent, 'id'> & {
  id?: string
  role?: IncidentStudentRole
  notes?: string | null
}

export interface IncidentReportClassroom {
  id: string
  incident_report_id: string
  classroom_id: string
}

export interface IncidentReportAttachment {
  id: string
  incident_report_id: string
  file_name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

export interface IncidentReportFollowUp {
  id: string
  incident_report_id: string
  author_id: string
  notes: string
  status_change: string | null
  created_at: string
}

export interface IncidentReportNotification {
  id: string
  incident_report_id: string
  recipient_id: string
  notification_type: IncidentNotificationType
  read: boolean
  created_at: string
}

export interface IncidentReportTaggedUser {
  id: string
  incident_report_id: string
  user_id: string
  tagged_by: string
  created_at: string
}

// Composite types for UI
export interface IncidentReportWithDetails extends IncidentReport {
  reporter?: Profile
  assigned_person?: Profile
  students?: (IncidentReportStudent & { student?: Student })[]
  classrooms?: (IncidentReportClassroom & { classroom?: Classroom })[]
  attachments?: IncidentReportAttachment[]
  follow_ups?: (IncidentReportFollowUp & { author?: Profile })[]
  tagged_users?: (IncidentReportTaggedUser & { user?: Profile })[]
}

export interface IncidentReportListItem extends IncidentReport {
  reporter_name?: string
  student_names?: string[]
  student_count?: number
  /** Set when current user has at least one unread notification for this incident */
  has_unread?: boolean
  /** Set when current user is on the tagged_users list (cc'd) */
  is_tagged?: boolean
}

// ============================================================
// Translation Engine
// ============================================================

export interface TranslationRecord {
  id: string
  student_id: string
  school_id: string
  target_framework_id: string
  translated_by: string
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type TranslationRecordInsert = Omit<TranslationRecord, 'id' | 'created_at' | 'reviewed' | 'reviewed_by' | 'reviewed_at'> & {
  id?: string
  reviewed?: boolean
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export type TranslationRecordUpdate = Partial<Omit<TranslationRecord, 'id' | 'student_id' | 'school_id' | 'created_at'>>

export interface TranslationMapping {
  id: string
  translation_id: string
  /** V1 source: a graded competency score. */
  competency_score_id: string | null
  /** V1 legacy source: row in legacy_student_skill_assignments. */
  student_skill_assignment_id: string | null
  /** V2 source: row in skill_assessments (Phase 4). Preferred for new translations. */
  skill_assessment_id: string | null
  standard_id: string
  confidence: number
  level_in_standard: string | null
  human_override: boolean
  notes: string | null
  created_at: string
}

export type TranslationMappingInsert = Omit<TranslationMapping, 'id' | 'created_at'> & {
  id?: string
  competency_score_id?: string | null
  student_skill_assignment_id?: string | null
  skill_assessment_id?: string | null
  confidence?: number
  level_in_standard?: string | null
  human_override?: boolean
  notes?: string | null
}

export type TranslationMappingUpdate = Partial<Omit<TranslationMapping, 'id' | 'translation_id' | 'created_at'>>

/** Translation mapping with joined standard details for UI */
export interface TranslationMappingWithDetails extends TranslationMapping {
  standard?: Standard
  competency_score?: CompetencyScoreRow
}

/** Translation record with joined details for UI */
export interface TranslationRecordWithDetails extends TranslationRecord {
  framework?: StandardsFramework
  mappings?: TranslationMappingWithDetails[]
  translator_name?: string
  reviewer_name?: string
}

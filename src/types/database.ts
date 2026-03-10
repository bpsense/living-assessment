// database.ts — Manual TypeScript types matching the Supabase schema.
// Replace with auto-generated types from `supabase gen types typescript` later.

export type UserRole = 'admin' | 'educator' | 'parent'
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
  created_at: string
  updated_at: string
}

export interface Classroom {
  id: string
  school_id: string
  name: string
  grade_level: string | null
  department_id: string | null
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

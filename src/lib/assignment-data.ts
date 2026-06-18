/**
 * assignment-data.ts
 *
 * Data-access layer for the assignment subsystem (migration 101).
 *
 * Shape conventions match the rest of the codebase:
 *   - pure fetches return data and throw on error (callers wrap in try/catch,
 *     like useStudentProfile)
 *   - mutations return `{ data?, error }` with `error: string | null`
 *     (like snapshot-visibility / classroom-data)
 *
 * The amoeba feed is handled entirely in the DB: inserting an
 * assignment_observation with feeds_amoeba=true mirrors a row into
 * `observations` via the sync trigger. Nothing here writes `observations`.
 *
 * Feature-local row types live here (not database.ts) since the data layer is
 * their only consumer; the shared AssessmentLevel scale is reused from
 * standards-assignment-data.ts.
 */
import { supabase } from './supabase'
import { fetchAllRows } from './supabase-paged'
import type { AssessmentLevel } from './standards-assignment-data'

// ============================================================
// Enum string-unions (mirror the Postgres enums / CHECKs in 101)
// ============================================================
export type AssignmentType = 'project' | 'focused_task'
export type ScaffoldingLevel = 'introductory' | 'developing' | 'extending'
export type AssignmentStatus = 'draft' | 'published' | 'archived'
export type LibraryStatus = 'private' | 'school_library'
export type TaskFormat =
  | 'written' | 'practical' | 'presentation' | 'creative'
  | 'research' | 'observation' | 'discussion' | 'other'
export type CollaborationType = 'individual' | 'small_group' | 'whole_class'
export type StudentAssignmentStatus = 'assigned' | 'in_progress' | 'complete' | 'archived'
export type AssignmentObservationType = 'formative' | 'summative' | 'anecdotal'

export type PblPhaseKey = 'launch' | 'inquiry' | 'critique' | 'product'

export interface PblPhase {
  phase: PblPhaseKey
  title: string
  description: string
  learning_goals: string[]
  key_activities: string[]
  milestone: string | null
}

// ============================================================
// Row types
// ============================================================
export interface Assignment {
  id: string
  school_id: string
  created_by: string
  assignment_type: AssignmentType
  title: string
  description: string | null
  driving_question: string | null
  authentic_context: string | null
  learner_voice: string | null
  pbl_phases: PblPhase[] | null
  focus_area: string | null
  learning_intention: string | null
  instructions: string | null
  success_criteria: string | null
  scaffolding_level: ScaffoldingLevel | null
  task_format: TaskFormat | null
  collaboration_type: CollaborationType | null
  reflection_prompts: string[] | null
  age_min: number | null
  age_max: number | null
  duration_estimate: string | null
  materials: string | null
  status: AssignmentStatus
  library_status: LibraryStatus
  visible_to_family: boolean
  created_at: string
  updated_at: string
}

export interface StudentAssignment {
  id: string
  assignment_id: string
  student_id: string
  classroom_id: string | null
  school_id: string
  assigned_by: string
  assigned_at: string
  due_date: string | null
  status: StudentAssignmentStatus
  visible_to_family: boolean | null
  created_at: string
  updated_at: string
}

export interface AssignmentObservation {
  id: string
  student_assignment_id: string
  student_id: string
  school_id: string
  dimension_id: string
  competency_id: string | null
  observer_id: string
  observation_type: AssignmentObservationType
  level: AssessmentLevel
  notes: string | null
  observed_at: string
  feeds_amoeba: boolean
  linked_observation_id: string | null
  created_at: string
}

// ---- Composite shapes returned by the fetchers ----
export interface AssignmentWithRelations extends Assignment {
  dimension_ids: string[]
  competency_ids: string[]
  gratitude_count: number
  created_by_name: string | null
}

/** student_assignments row + the bits the family/profile views render. */
export interface StudentAssignmentWithMeta extends StudentAssignment {
  assignment_title: string
  assignment_type: AssignmentType
  /** Resolved visibility (COALESCE(per-student, template)). */
  resolved_visible_to_family: boolean
  observation_count: number
}

/** Roster row for the assignment-detail left panel. */
export interface AssignmentRosterEntry extends StudentAssignment {
  student_name: string
  student_avatar_url: string | null
  observation_count: number
}

// ============================================================
// Inputs
// ============================================================
export interface AssignmentInput {
  assignment_type: AssignmentType
  title: string
  description?: string | null
  driving_question?: string | null
  authentic_context?: string | null
  learner_voice?: string | null
  pbl_phases?: PblPhase[] | null
  focus_area?: string | null
  learning_intention?: string | null
  instructions?: string | null
  success_criteria?: string | null
  scaffolding_level?: ScaffoldingLevel | null
  task_format?: TaskFormat | null
  collaboration_type?: CollaborationType | null
  reflection_prompts?: string[] | null
  age_min?: number | null
  age_max?: number | null
  duration_estimate?: string | null
  materials?: string | null
  status?: AssignmentStatus
  library_status?: LibraryStatus
  visible_to_family?: boolean
  /** Replace the dimension links with exactly these (omit to leave unchanged on update). */
  dimension_ids?: string[]
  /** Replace the competency links with exactly these (omit to leave unchanged on update). */
  competency_ids?: string[]
}

export type CreateAssignmentInput = AssignmentInput & {
  school_id: string
  created_by: string
}

export interface SchoolAssignmentFilters {
  ageMin?: number
  ageMax?: number
  dimensionIds?: string[]
  competencyIds?: string[]
  assignmentType?: AssignmentType
  libraryStatus?: LibraryStatus
  /** Free-text match on title/description. */
  search?: string
  sortBy?: 'gratitude' | 'recent'
  /** Include archived templates (default false). */
  includeArchived?: boolean
}

export interface AssignToStudentsPayload {
  assignedBy: string
  schoolId: string
  dueDate?: string | null
  visibleToFamily?: boolean | null
  status?: StudentAssignmentStatus
}

export interface AddObservationPayload {
  student_assignment_id: string
  student_id: string
  school_id: string
  dimension_id: string
  competency_id?: string | null
  observer_id: string
  observation_type: AssignmentObservationType
  level: AssessmentLevel
  notes?: string | null
  observed_at?: string
  feeds_amoeba?: boolean
}

// ============================================================
// Internal helpers
// ============================================================
const ASSIGNMENT_COLUMNS = [
  'assignment_type', 'title', 'description', 'driving_question', 'authentic_context',
  'learner_voice', 'pbl_phases', 'focus_area', 'learning_intention', 'instructions',
  'success_criteria', 'scaffolding_level', 'task_format', 'collaboration_type',
  'reflection_prompts', 'age_min', 'age_max', 'duration_estimate', 'materials',
  'status', 'library_status', 'visible_to_family',
] as const

/** Strip relation arrays + pick only assignment table columns from an input. */
function pickAssignmentColumns(input: Partial<AssignmentInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ASSIGNMENT_COLUMNS) {
    if (key in input && (input as Record<string, unknown>)[key] !== undefined) {
      out[key] = (input as Record<string, unknown>)[key]
    }
  }
  return out
}

/** Count assignment_observations grouped by student_assignment_id. */
async function countObservationsBySa(saIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (saIds.length === 0) return counts
  const rows = await fetchAllRows<{ student_assignment_id: string }>(() =>
    supabase
      .from('assignment_observations')
      .select('student_assignment_id', { count: 'exact' })
      .in('student_assignment_id', saIds)
  )
  for (const r of rows) {
    counts.set(r.student_assignment_id, (counts.get(r.student_assignment_id) ?? 0) + 1)
  }
  return counts
}

// ============================================================
// Templates
// ============================================================

/** Full assignment with its dimension + competency links and gratitude count. */
export async function fetchAssignment(id: string): Promise<AssignmentWithRelations | null> {
  const { data: a, error } = await supabase.from('assignments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!a) return null
  const assignment = a as Assignment

  const [dimsRes, compsRes, gratRes, creatorRes] = await Promise.all([
    supabase.from('assignment_dimensions').select('dimension_id').eq('assignment_id', id),
    supabase.from('assignment_competencies').select('competency_id').eq('assignment_id', id),
    supabase.from('assignment_library_gratitude').select('id', { count: 'exact', head: true }).eq('assignment_id', id),
    supabase.from('profiles').select('full_name').eq('id', assignment.created_by).maybeSingle(),
  ])
  if (dimsRes.error) throw dimsRes.error
  if (compsRes.error) throw compsRes.error

  return {
    ...assignment,
    dimension_ids: (dimsRes.data ?? []).map((r) => (r as { dimension_id: string }).dimension_id),
    competency_ids: (compsRes.data ?? []).map((r) => (r as { competency_id: string }).competency_id),
    gratitude_count: gratRes.count ?? 0,
    created_by_name: (creatorRes.data as { full_name: string } | null)?.full_name ?? null,
  }
}

/**
 * Assignments for a school, for the library / index views. Default sort:
 * gratitude_count DESC, updated_at DESC. Gratitude counts + dimension links are
 * resolved client-side (assignment counts per school stay small).
 */
export async function fetchSchoolAssignments(
  schoolId: string,
  filters: SchoolAssignmentFilters = {}
): Promise<AssignmentWithRelations[]> {
  // Optional dimension/competency pre-filter → assignment id allowlist.
  const idsFrom = async (
    table: 'assignment_dimensions' | 'assignment_competencies',
    col: string,
    ids: string[]
  ): Promise<Set<string>> => {
    const { data, error } = await supabase.from(table).select('assignment_id').in(col, ids)
    if (error) throw error
    return new Set((data ?? []).map((r) => (r as { assignment_id: string }).assignment_id))
  }
  let idAllowlist: Set<string> | null = null
  if (filters.dimensionIds?.length) {
    idAllowlist = await idsFrom('assignment_dimensions', 'dimension_id', filters.dimensionIds)
  }
  if (filters.competencyIds?.length) {
    const set = await idsFrom('assignment_competencies', 'competency_id', filters.competencyIds)
    idAllowlist = idAllowlist ? new Set([...idAllowlist].filter((x) => set.has(x))) : set
  }
  if (idAllowlist && idAllowlist.size === 0) return []

  let q = supabase.from('assignments').select('*').eq('school_id', schoolId)
  if (!filters.includeArchived) q = q.neq('status', 'archived')
  if (filters.assignmentType) q = q.eq('assignment_type', filters.assignmentType)
  if (filters.libraryStatus) q = q.eq('library_status', filters.libraryStatus)
  if (filters.ageMax != null) q = q.lte('age_min', filters.ageMax)
  if (filters.ageMin != null) q = q.gte('age_max', filters.ageMin)
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`
    q = q.or(`title.ilike.${term},description.ilike.${term}`)
  }
  if (idAllowlist) q = q.in('id', [...idAllowlist])

  const { data, error } = await q
  if (error) throw error
  const assignments = (data ?? []) as Assignment[]
  if (assignments.length === 0) return []

  const ids = assignments.map((a) => a.id)
  const [dimRows, compRows, gratRows, creators] = await Promise.all([
    supabase.from('assignment_dimensions').select('assignment_id, dimension_id').in('assignment_id', ids),
    supabase.from('assignment_competencies').select('assignment_id, competency_id').in('assignment_id', ids),
    supabase.from('assignment_library_gratitude').select('assignment_id').in('assignment_id', ids),
    supabase.from('profiles').select('id, full_name').in('id', [...new Set(assignments.map((a) => a.created_by))]),
  ])

  const dimsByA = new Map<string, string[]>()
  for (const r of (dimRows.data ?? []) as { assignment_id: string; dimension_id: string }[]) {
    dimsByA.set(r.assignment_id, [...(dimsByA.get(r.assignment_id) ?? []), r.dimension_id])
  }
  const compsByA = new Map<string, string[]>()
  for (const r of (compRows.data ?? []) as { assignment_id: string; competency_id: string }[]) {
    compsByA.set(r.assignment_id, [...(compsByA.get(r.assignment_id) ?? []), r.competency_id])
  }
  const gratByA = new Map<string, number>()
  for (const r of (gratRows.data ?? []) as { assignment_id: string }[]) {
    gratByA.set(r.assignment_id, (gratByA.get(r.assignment_id) ?? 0) + 1)
  }
  const nameById = new Map<string, string>()
  for (const r of (creators.data ?? []) as { id: string; full_name: string }[]) {
    nameById.set(r.id, r.full_name)
  }

  const withRel: AssignmentWithRelations[] = assignments.map((a) => ({
    ...a,
    dimension_ids: dimsByA.get(a.id) ?? [],
    competency_ids: compsByA.get(a.id) ?? [],
    gratitude_count: gratByA.get(a.id) ?? 0,
    created_by_name: nameById.get(a.created_by) ?? null,
  }))

  withRel.sort((x, y) => {
    if (filters.sortBy === 'recent') {
      return new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime()
    }
    // default: gratitude DESC, then updated_at DESC
    if (y.gratitude_count !== x.gratitude_count) return y.gratitude_count - x.gratitude_count
    return new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime()
  })
  return withRel
}

/** Create a template + its dimension/competency links. */
export async function createAssignment(
  input: CreateAssignmentInput
): Promise<{ data: Assignment | null; error: string | null }> {
  const row = {
    ...pickAssignmentColumns(input),
    school_id: input.school_id,
    created_by: input.created_by,
  }
  const { data, error } = await supabase.from('assignments').insert(row).select('*').single()
  if (error || !data) return { data: null, error: error?.message ?? 'Failed to create assignment' }
  const assignment = data as Assignment

  const linkErr = await replaceLinks(assignment.id, assignment.school_id, input.dimension_ids, input.competency_ids)
  if (linkErr) return { data: assignment, error: linkErr }
  return { data: assignment, error: null }
}

/** Update a template; replaces dimension/competency links when those arrays are supplied. */
export async function updateAssignment(
  id: string,
  input: Partial<AssignmentInput>
): Promise<{ data: Assignment | null; error: string | null }> {
  const cols = pickAssignmentColumns(input)
  const { data, error } = await supabase.from('assignments').update(cols).eq('id', id).select('*').single()
  if (error || !data) return { data: null, error: error?.message ?? 'Failed to update assignment' }
  const assignment = data as Assignment

  if (input.dimension_ids !== undefined || input.competency_ids !== undefined) {
    const linkErr = await replaceLinks(id, assignment.school_id, input.dimension_ids, input.competency_ids)
    if (linkErr) return { data: assignment, error: linkErr }
  }
  return { data: assignment, error: null }
}

/** Replace a template's dimension/competency join rows. Undefined arg = leave as-is. */
async function replaceLinks(
  assignmentId: string,
  schoolId: string,
  dimensionIds?: string[],
  competencyIds?: string[]
): Promise<string | null> {
  if (dimensionIds !== undefined) {
    const del = await supabase.from('assignment_dimensions').delete().eq('assignment_id', assignmentId)
    if (del.error) return del.error.message
    if (dimensionIds.length) {
      const ins = await supabase.from('assignment_dimensions').insert(
        dimensionIds.map((dimension_id) => ({ assignment_id: assignmentId, dimension_id, school_id: schoolId }))
      )
      if (ins.error) return ins.error.message
    }
  }
  if (competencyIds !== undefined) {
    const del = await supabase.from('assignment_competencies').delete().eq('assignment_id', assignmentId)
    if (del.error) return del.error.message
    if (competencyIds.length) {
      const ins = await supabase.from('assignment_competencies').insert(
        competencyIds.map((competency_id) => ({ assignment_id: assignmentId, competency_id, school_id: schoolId }))
      )
      if (ins.error) return ins.error.message
    }
  }
  return null
}

/** Soft-delete: archive the template (preserves student work + amoeba history). */
export async function deleteAssignment(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('assignments').update({ status: 'archived' }).eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================================
// Assigning to students
// ============================================================

/** Active student ids enrolled in a classroom (the bulk-assign source). */
export async function fetchClassroomStudentIds(classroomId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('student_classrooms')
    .select('student_id')
    .eq('classroom_id', classroomId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []).map((r) => (r as { student_id: string }).student_id)
}

/**
 * Assign a template to many students in one insert. Students who already have
 * the assignment are skipped (reported, not silently dropped) so a class assign
 * never fails just because some learners already have it.
 */
export async function assignToStudents(
  assignmentId: string,
  studentIds: string[],
  classroomId: string | null,
  payload: AssignToStudentsPayload
): Promise<{ created: number; skipped: number; data: StudentAssignment[]; error: string | null }> {
  const uniqueIds = [...new Set(studentIds)]
  if (uniqueIds.length === 0) return { created: 0, skipped: 0, data: [], error: null }

  // Skip students already assigned this template.
  const { data: existing, error: exErr } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('assignment_id', assignmentId)
    .in('student_id', uniqueIds)
  if (exErr) return { created: 0, skipped: 0, data: [], error: exErr.message }
  const already = new Set((existing ?? []).map((r) => (r as { student_id: string }).student_id))
  const toInsert = uniqueIds.filter((id) => !already.has(id))
  if (toInsert.length === 0) return { created: 0, skipped: uniqueIds.length, data: [], error: null }

  const rows = toInsert.map((student_id) => ({
    assignment_id: assignmentId,
    student_id,
    classroom_id: classroomId,
    school_id: payload.schoolId,
    assigned_by: payload.assignedBy,
    due_date: payload.dueDate ?? null,
    status: payload.status ?? 'assigned',
    visible_to_family: payload.visibleToFamily ?? null,
  }))
  const { data, error } = await supabase.from('student_assignments').insert(rows).select('*')
  if (error) return { created: 0, skipped: already.size, data: [], error: error.message }
  return { created: rows.length, skipped: already.size, data: (data ?? []) as StudentAssignment[], error: null }
}

// ============================================================
// Per-student fetches
// ============================================================

/**
 * All assignments for one student (assignment title/type joined, observation
 * count + resolved family visibility computed). When visibleToFamilyOnly, only
 * rows whose COALESCE(per-student, template) visibility is true are returned —
 * the gate is applied here, not just in the UI (educators previewing the family
 * view bypass RLS, so the filter must be explicit).
 */
export async function fetchStudentAssignments(
  studentId: string,
  visibleToFamilyOnly = false
): Promise<StudentAssignmentWithMeta[]> {
  const { data, error } = await supabase
    .from('student_assignments')
    .select('*, assignment:assignments(title, assignment_type, visible_to_family)')
    .eq('student_id', studentId)
    .order('assigned_at', { ascending: false })
  if (error) throw error

  type Row = StudentAssignment & {
    assignment: { title: string; assignment_type: AssignmentType; visible_to_family: boolean } | null
  }
  const rows = (data ?? []) as Row[]
  const counts = await countObservationsBySa(rows.map((r) => r.id))

  const mapped: StudentAssignmentWithMeta[] = rows.map((r) => {
    const resolved = r.visible_to_family ?? r.assignment?.visible_to_family ?? true
    return {
      ...r,
      assignment_title: r.assignment?.title ?? 'Untitled',
      assignment_type: r.assignment?.assignment_type ?? 'focused_task',
      resolved_visible_to_family: resolved,
      observation_count: counts.get(r.id) ?? 0,
    }
  })
  return visibleToFamilyOnly ? mapped.filter((r) => r.resolved_visible_to_family) : mapped
}

/** Roster for one assignment: every assigned student with status + obs count. */
export async function fetchAssignmentRoster(assignmentId: string): Promise<AssignmentRosterEntry[]> {
  const { data, error } = await supabase
    .from('student_assignments')
    .select('*, student:students(first_name, last_name, preferred_name, avatar_url)')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })
  if (error) throw error

  type Row = StudentAssignment & {
    student: { first_name: string; last_name: string; preferred_name: string | null; avatar_url: string | null } | null
  }
  const rows = (data ?? []) as Row[]
  const counts = await countObservationsBySa(rows.map((r) => r.id))

  return rows.map((r) => {
    const first = r.student?.preferred_name || r.student?.first_name || ''
    const name = `${first} ${r.student?.last_name ?? ''}`.trim() || 'Learner'
    return {
      ...r,
      student_name: name,
      student_avatar_url: r.student?.avatar_url ?? null,
      observation_count: counts.get(r.id) ?? 0,
    }
  })
}

/** Chronological observations recorded for one student's assignment instance. */
export async function fetchAssignmentObservations(
  studentAssignmentId: string
): Promise<(AssignmentObservation & { observer_name: string | null })[]> {
  const { data, error } = await supabase
    .from('assignment_observations')
    .select('*, observer:profiles(full_name)')
    .eq('student_assignment_id', studentAssignmentId)
    .order('observed_at', { ascending: false })
  if (error) throw error
  type Row = AssignmentObservation & { observer: { full_name: string } | null }
  return ((data ?? []) as Row[]).map((r) => ({ ...r, observer_name: r.observer?.full_name ?? null }))
}

/** Update a student-assignment's status (educator/admin). */
export async function setStudentAssignmentStatus(
  studentAssignmentId: string,
  status: StudentAssignmentStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('student_assignments')
    .update({ status })
    .eq('id', studentAssignmentId)
  return { error: error?.message ?? null }
}

// ============================================================
// Observations (the amoeba feed)
// ============================================================

/**
 * Record an assignment observation. The DB trigger writes the mirrored
 * `observations` row when feeds_amoeba=true — callers should refetch the
 * student profile to see the amoeba update.
 */
export async function addObservation(
  payload: AddObservationPayload
): Promise<{ data: AssignmentObservation | null; error: string | null }> {
  const { data, error } = await supabase
    .from('assignment_observations')
    .insert({
      student_assignment_id: payload.student_assignment_id,
      student_id: payload.student_id,
      school_id: payload.school_id,
      dimension_id: payload.dimension_id,
      competency_id: payload.competency_id ?? null,
      observer_id: payload.observer_id,
      observation_type: payload.observation_type,
      level: payload.level,
      notes: payload.notes ?? null,
      observed_at: payload.observed_at ?? new Date().toISOString(),
      feeds_amoeba: payload.feeds_amoeba ?? true,
    })
    .select('*')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Failed to add observation' }
  return { data: data as AssignmentObservation, error: null }
}

// ============================================================
// Gratitude (school library appreciation)
// ============================================================

/**
 * Toggle the current educator's appreciation for a library assignment.
 * The unique(assignment_id, educator_id) constraint enforces dedup at the DB.
 * Returns the new total count and whether the educator now appreciates it.
 */
export async function toggleGratitude(
  assignmentId: string,
  educatorId: string
): Promise<{ count: number; gratified: boolean; error: string | null }> {
  const { data: existing, error: selErr } = await supabase
    .from('assignment_library_gratitude')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('educator_id', educatorId)
    .maybeSingle()
  if (selErr) return { count: 0, gratified: false, error: selErr.message }

  let gratified: boolean
  if (existing) {
    const { error } = await supabase
      .from('assignment_library_gratitude')
      .delete()
      .eq('id', (existing as { id: string }).id)
    if (error) return { count: 0, gratified: true, error: error.message }
    gratified = false
  } else {
    // school_id is required by the row + RLS; derive it from the template.
    const { data: a, error: aErr } = await supabase
      .from('assignments').select('school_id').eq('id', assignmentId).single()
    if (aErr || !a) return { count: 0, gratified: false, error: aErr?.message ?? 'Assignment not found' }
    const { error } = await supabase
      .from('assignment_library_gratitude')
      .insert({ assignment_id: assignmentId, educator_id: educatorId, school_id: (a as { school_id: string }).school_id })
    if (error) return { count: 0, gratified: false, error: error.message }
    gratified = true
  }

  const { count, error: cntErr } = await supabase
    .from('assignment_library_gratitude')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
  if (cntErr) return { count: 0, gratified, error: cntErr.message }
  return { count: count ?? 0, gratified, error: null }
}

/** Which of these assignments the educator has already appreciated. */
export async function fetchMyGratitude(assignmentIds: string[], educatorId: string): Promise<Set<string>> {
  if (assignmentIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('assignment_library_gratitude')
    .select('assignment_id')
    .eq('educator_id', educatorId)
    .in('assignment_id', assignmentIds)
  if (error) throw error
  return new Set((data ?? []).map((r) => (r as { assignment_id: string }).assignment_id))
}

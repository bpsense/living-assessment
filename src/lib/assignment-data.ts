import { supabase } from './supabase'
import type {
  Assignment,
  AssignmentInsert,
  AssignmentUpdate,
  AssignmentCompetency,
  AssignmentSkill,
  StudentAssignment,
  StudentAssignmentInsert,
  Competency,
  CompetencyDomain,
  CompetencySubdomain,
  Skill,
  Student,
} from '../types/database'

// ============================================================
// Assignment CRUD
// ============================================================

export async function createAssignment(
  data: AssignmentInsert,
  competencyIds: string[],
  studentIds: string[],
  skillIds?: string[]
): Promise<string> {
  // 1. Create assignment
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .insert(data)
    .select('id')
    .single()

  if (aErr || !assignment) throw new Error(`Failed to create assignment: ${aErr?.message}`)

  const assignmentId = assignment.id

  // 2. Link competencies
  if (competencyIds.length > 0) {
    const { error: acErr } = await supabase
      .from('assignment_competencies')
      .insert(competencyIds.map((cid) => ({ assignment_id: assignmentId, competency_id: cid })))

    if (acErr) throw new Error(`Failed to link competencies: ${acErr.message}`)
  }

  // 3. Create student assignments
  if (studentIds.length > 0) {
    const inserts: StudentAssignmentInsert[] = studentIds.map((sid) => ({
      assignment_id: assignmentId,
      student_id: sid,
    }))

    const { error: saErr } = await supabase
      .from('student_assignments')
      .insert(inserts)

    if (saErr) throw new Error(`Failed to assign students: ${saErr.message}`)
  }

  // 4. Link skills
  if (skillIds && skillIds.length > 0) {
    const { error: skErr } = await supabase
      .from('assignment_skills')
      .insert(skillIds.map((sid) => ({ assignment_id: assignmentId, skill_id: sid })))

    if (skErr) throw new Error(`Failed to link skills: ${skErr.message}`)
  }

  return assignmentId
}

export async function updateAssignment(id: string, data: AssignmentUpdate): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .update(data)
    .eq('id', id)

  if (error) throw error
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================================
// Fetch Operations
// ============================================================

export interface AssignmentWithDetails extends Assignment {
  competencies: (AssignmentCompetency & { competency: Competency })[]
  skills: (AssignmentSkill & { skill: Skill })[]
  student_assignments: (StudentAssignment & { student: Student })[]
  teacher_name: string
}

export async function fetchAssignments(
  schoolId: string,
  filters?: { classroomId?: string; teacherId?: string; status?: string }
): Promise<AssignmentWithDetails[]> {
  let query = supabase
    .from('assignments')
    .select(`
      *,
      teacher:profiles!assignments_teacher_id_fkey(full_name),
      assignment_competencies(*, competency:competencies(*)),
      assignment_skills(*, skill:skills(*)),
      student_assignments(*, student:students(*))
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (filters?.classroomId) query = query.eq('classroom_id', filters.classroomId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((a: any) => ({
    ...a,
    teacher_name: a.teacher?.full_name || 'Unknown',
    competencies: a.assignment_competencies || [],
    skills: a.assignment_skills || [],
    student_assignments: a.student_assignments || [],
  }))
}

export async function fetchAssignment(id: string): Promise<AssignmentWithDetails> {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      teacher:profiles!assignments_teacher_id_fkey(full_name),
      assignment_competencies(*, competency:competencies(*)),
      assignment_skills(*, skill:skills(*)),
      student_assignments(*, student:students(*))
    `)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('Assignment not found')

  return {
    ...data,
    teacher_name: (data as any).teacher?.full_name || 'Unknown',
    competencies: (data as any).assignment_competencies || [],
    skills: (data as any).assignment_skills || [],
    student_assignments: (data as any).student_assignments || [],
  } as AssignmentWithDetails
}

// ============================================================
// Competency Browsing (for assignment creation)
// ============================================================

export interface CompetencyTreeNode {
  domain: CompetencyDomain
  subdomains: {
    subdomain: CompetencySubdomain
    competencies: Competency[]
  }[]
}

export async function fetchCompetencyTree(schoolId: string): Promise<CompetencyTreeNode[]> {
  // Get the school's active framework (prefer non-default, fall back to default)
  const { data: frameworks, error: fwErr } = await supabase
    .from('competency_frameworks')
    .select('id')
    .eq('school_id', schoolId)
    .order('is_default', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)

  if (fwErr) {
    console.error('[fetchCompetencyTree] frameworks query failed:', fwErr.message)
    return []
  }
  if (!frameworks || frameworks.length === 0) {
    console.warn('[fetchCompetencyTree] no frameworks found for school', schoolId)
    return []
  }

  const frameworkId = frameworks[0].id

  const { data: domains, error: domErr } = await supabase
    .from('competency_domains')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('display_order')

  if (domErr) {
    console.error('[fetchCompetencyTree] domains query failed:', domErr.message)
    return []
  }
  if (!domains || domains.length === 0) return []

  const { data: subdomains, error: sdErr } = await supabase
    .from('competency_subdomains')
    .select('*')
    .in('domain_id', domains.map((d) => d.id))
    .order('display_order')

  if (sdErr) console.error('[fetchCompetencyTree] subdomains query failed:', sdErr.message)

  const { data: competencies, error: compErr } = await supabase
    .from('competencies')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('code')

  if (compErr) console.error('[fetchCompetencyTree] competencies query failed:', compErr.message)

  const tree: CompetencyTreeNode[] = domains.map((domain) => {
    const domainSubdomains = (subdomains || []).filter((sd) => sd.domain_id === domain.id)
    return {
      domain,
      subdomains: domainSubdomains.map((sd) => ({
        subdomain: sd,
        competencies: (competencies || []).filter((c) => c.subdomain_id === sd.id),
      })),
    }
  })

  return tree
}

// ============================================================
// Classroom students fetch
// ============================================================

export async function fetchClassroomStudents(classroomId: string): Promise<Student[]> {
  // Fetch student IDs actively enrolled in this classroom via junction table
  const { data: scData, error: scError } = await supabase
    .from('student_classrooms')
    .select('student_id')
    .eq('classroom_id', classroomId)
    .eq('status', 'active')

  if (scError) throw scError
  const studentIds = (scData ?? []).map((r) => r.student_id)
  if (studentIds.length === 0) return []

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .in('id', studentIds)
    .eq('student_status', 'active')
    .order('last_name')

  if (error) throw error
  return data || []
}

import { supabase } from './supabase'
import type {
  AssignmentTemplate,
  AssignmentTemplateInsert,
  AssignmentTemplateUpdate,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface TemplateWithCreator extends AssignmentTemplate {
  creator_name: string
}

// ============================================================
// Fetch
// ============================================================

export async function fetchTemplates(
  schoolId: string,
  filters?: { search?: string }
): Promise<TemplateWithCreator[]> {
  let query = supabase
    .from('assignment_templates')
    .select('*, creator:profiles!assignment_templates_created_by_fkey(full_name)')
    .eq('school_id', schoolId)
    .order('updated_at', { ascending: false })

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to load templates: ${error.message}`)

  return (data ?? []).map((t: any) => ({
    ...t,
    competency_ids: t.competency_ids ?? [],
    skill_ids: t.skill_ids ?? [],
    template_data: t.template_data ?? {},
    creator_name: t.creator?.full_name ?? 'Unknown',
  }))
}

// ============================================================
// Create
// ============================================================

export async function createTemplate(
  data: AssignmentTemplateInsert
): Promise<string> {
  const { data: row, error } = await supabase
    .from('assignment_templates')
    .insert(data)
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create template: ${error.message}`)
  return row.id
}

// ============================================================
// Create from existing assignment
// ============================================================

export async function createTemplateFromAssignment(
  assignmentId: string,
  schoolId: string,
  createdBy: string
): Promise<string> {
  // Fetch the assignment with its competencies and skills
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('title, description, assignment_type')
    .eq('id', assignmentId)
    .single()

  if (aErr || !assignment) {
    throw new Error('Assignment not found')
  }

  const { data: competencies } = await supabase
    .from('assignment_competencies')
    .select('competency_id')
    .eq('assignment_id', assignmentId)

  const { data: skills } = await supabase
    .from('assignment_skills')
    .select('skill_id')
    .eq('assignment_id', assignmentId)

  const templateData: AssignmentTemplateInsert = {
    school_id: schoolId,
    created_by: createdBy,
    title: assignment.title,
    description: assignment.description,
    assignment_type: assignment.assignment_type,
    competency_ids: (competencies ?? []).map((c) => c.competency_id),
    skill_ids: (skills ?? []).map((s) => s.skill_id),
    is_shared: true,
    template_data: {},
  }

  return createTemplate(templateData)
}

// ============================================================
// Update
// ============================================================

export async function updateTemplate(
  id: string,
  data: AssignmentTemplateUpdate
): Promise<void> {
  const { error } = await supabase
    .from('assignment_templates')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(`Failed to update template: ${error.message}`)
}

// ============================================================
// Delete
// ============================================================

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('assignment_templates')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete template: ${error.message}`)
}

import { supabase } from './supabase'
import type {
  AssignmentTemplate,
  AssignmentTemplateInsert,
  AssignmentTemplateUpdate,
  GradeBand,
  TemplateStatus,
  DOKLevel,
} from '../types/database'

// ============================================================
// Types
// ============================================================

export interface TemplateWithCreator extends AssignmentTemplate {
  creator_name: string
}

export interface TemplateFilters {
  search?: string
  gradeBand?: GradeBand
  subjectArea?: string
  dokLevel?: DOKLevel
  tags?: string[]
  status?: TemplateStatus
}

// ============================================================
// Helpers
// ============================================================

function mapRow(t: any): TemplateWithCreator {
  return {
    ...t,
    competency_ids: t.competency_ids ?? [],
    skill_ids: t.skill_ids ?? [],
    template_data: t.template_data ?? {},
    // PBL fields with safe defaults
    phases: t.phases ?? [],
    choice_points: t.choice_points ?? [],
    materials_and_resources: t.materials_and_resources ?? [],
    essential_understandings: t.essential_understandings ?? [],
    tags: t.tags ?? [],
    subject_area: t.subject_area ?? [],
    final_product: t.final_product && Object.keys(t.final_product).length > 0
      ? t.final_product
      : null,
    differentiation: t.differentiation && Object.keys(t.differentiation).length > 0
      ? t.differentiation
      : null,
    grade_band: t.grade_band ?? 'elementary',
    dok_level: t.dok_level ?? 3,
    version: t.version ?? 1,
    status: t.status ?? 'draft',
    estimated_duration_days: t.estimated_duration_days ?? null,
    driving_question: t.driving_question ?? null,
    authenticity_hook: t.authenticity_hook ?? null,
    critique_protocol: t.critique_protocol ?? null,
    scaffolding_notes: t.scaffolding_notes ?? null,
    parent_template_id: t.parent_template_id ?? null,
    creator_name: t.creator?.full_name ?? 'Unknown',
  }
}

// ============================================================
// Fetch
// ============================================================

export async function fetchTemplates(
  schoolId: string,
  filters?: TemplateFilters
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

  if (filters?.gradeBand) {
    query = query.eq('grade_band', filters.gradeBand)
  }

  if (filters?.subjectArea) {
    query = query.contains('subject_area', [filters.subjectArea])
  }

  if (filters?.dokLevel) {
    query = query.eq('dok_level', filters.dokLevel)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to load templates: ${error.message}`)

  return (data ?? []).map(mapRow)
}

export async function fetchPublishedTemplates(
  schoolId: string
): Promise<TemplateWithCreator[]> {
  return fetchTemplates(schoolId, { status: 'published' })
}

export async function fetchTemplatesByTag(
  schoolId: string,
  tag: string
): Promise<TemplateWithCreator[]> {
  return fetchTemplates(schoolId, { tags: [tag] })
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
    status: 'draft',
  }

  return createTemplate(templateData)
}

// ============================================================
// Duplicate
// ============================================================

export async function duplicateTemplate(
  templateId: string,
  schoolId: string,
  createdBy: string
): Promise<string> {
  const { data: original, error: fetchErr } = await supabase
    .from('assignment_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (fetchErr || !original) {
    throw new Error('Template not found')
  }

  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...rest
  } = original

  const duplicate: AssignmentTemplateInsert = {
    ...rest,
    school_id: schoolId,
    created_by: createdBy,
    title: `${original.title} (Copy)`,
    parent_template_id: templateId,
    version: (original.version ?? 1) + 1,
    status: 'draft' as const,
  }

  return createTemplate(duplicate)
}

// ============================================================
// Status transitions
// ============================================================

export async function publishTemplate(templateId: string): Promise<void> {
  return updateTemplate(templateId, { status: 'published' })
}

export async function archiveTemplate(templateId: string): Promise<void> {
  return updateTemplate(templateId, { status: 'archived' })
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

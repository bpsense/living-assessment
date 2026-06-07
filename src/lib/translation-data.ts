import { supabase } from './supabase'
import type {
  TranslationRecord,
  TranslationRecordInsert,
  TranslationMapping,
  TranslationMappingInsert,
  TranslationMappingUpdate,
  TranslationRecordWithDetails,
  StandardsFramework,
  Standard,
} from '../types/database'

// ============================================================
// Fetch available standards frameworks for a school
// ============================================================

export async function fetchStandardsFrameworks(schoolId: string): Promise<StandardsFramework[]> {
  const { data, error } = await supabase
    .from('standards_frameworks')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')

  if (error) throw error
  return (data ?? []) as StandardsFramework[]
}

// ============================================================
// Fetch standards for a specific framework
// ============================================================

export async function fetchStandardsForFramework(frameworkId: string): Promise<Standard[]> {
  const { data, error } = await supabase
    .from('standards')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('display_order')

  if (error) throw error
  return (data ?? []) as Standard[]
}

// ============================================================
// Initiate a translation
// ============================================================

export async function initiateTranslation(params: {
  studentId: string
  schoolId: string
  targetFrameworkId: string
  translatedBy: string
}): Promise<TranslationRecord> {
  const insert: TranslationRecordInsert = {
    student_id: params.studentId,
    school_id: params.schoolId,
    target_framework_id: params.targetFrameworkId,
    translated_by: params.translatedBy,
  }

  const { data, error } = await supabase
    .from('translation_records')
    .insert(insert)
    .select()
    .single()

  if (error) throw error
  return data as TranslationRecord
}

// ============================================================
// Save translation mappings (batch)
// ============================================================

export async function saveTranslationMappings(
  mappings: TranslationMappingInsert[]
): Promise<TranslationMapping[]> {
  if (mappings.length === 0) return []

  const { data, error } = await supabase
    .from('translation_mappings')
    .insert(mappings)
    .select()

  if (error) throw error
  return (data ?? []) as TranslationMapping[]
}

// ============================================================
// Get translation history for a student
// ============================================================

export async function fetchTranslationHistory(
  studentId: string
): Promise<TranslationRecordWithDetails[]> {
  const { data, error } = await supabase
    .from('translation_records')
    .select(`
      *,
      framework:standards_frameworks(id, name, description, framework_type),
      translator:profiles!translation_records_translated_by_fkey(full_name),
      reviewer:profiles!translation_records_reviewed_by_fkey(full_name)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    framework: row.framework ?? undefined,
    translator_name: row.translator?.full_name ?? null,
    reviewer_name: row.reviewer?.full_name ?? null,
  }))
}

// ============================================================
// Update a single mapping (human review/override)
// ============================================================

export async function updateTranslationMapping(
  mappingId: string,
  updates: TranslationMappingUpdate
): Promise<TranslationMapping> {
  const { data, error } = await supabase
    .from('translation_mappings')
    .update(updates)
    .eq('id', mappingId)
    .select()
    .single()

  if (error) throw error
  return data as TranslationMapping
}

// ============================================================
// Mark a translation as reviewed
// ============================================================

export async function markTranslationReviewed(
  translationId: string,
  reviewedBy: string
): Promise<TranslationRecord> {
  const { data, error } = await supabase
    .from('translation_records')
    .update({
      reviewed: true,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', translationId)
    .select()
    .single()

  if (error) throw error
  return data as TranslationRecord
}

/**
 * assignment-visibility.ts
 *
 * Mirrors snapshot-visibility.ts for assignments. Two write paths:
 *  - per-student override on student_assignments.visible_to_family
 *    (null = inherit the template default)
 *  - the template default on assignments.visible_to_family
 *
 * Resolution is COALESCE(student_assignments.visible_to_family,
 * assignments.visible_to_family) — enforced in RLS and in
 * fetchStudentAssignments. Bulk "visible to whole class" at assign time is set
 * via the assignToStudents payload, not here.
 */
import { supabase } from './supabase'

/** Per-student override. Pass null to clear the override (re-inherit template). */
export async function setStudentAssignmentVisibility(
  studentAssignmentId: string,
  visible: boolean | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('student_assignments')
    .update({ visible_to_family: visible })
    .eq('id', studentAssignmentId)
  return { error: error?.message ?? null }
}

/** Template default — applies to every student_assignment that hasn't overridden it. */
export async function setAssignmentVisibility(
  assignmentId: string,
  visible: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assignments')
    .update({ visible_to_family: visible })
    .eq('id', assignmentId)
  return { error: error?.message ?? null }
}

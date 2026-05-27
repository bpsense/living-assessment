/**
 * snapshot-visibility.ts
 *
 * Helpers for the per-student `family_snapshot_visible` flag on `students`
 * (added in migration 082). Controls whether the Competency Snapshot section
 * is rendered in the family/learner view of the student profile.
 *
 * Two write paths use these helpers:
 *  - StudentProfile (per-student toggle in the snapshot header)
 *  - /admin/snapshot-visibility (per-class bulk + per-student rows)
 */
import { supabase } from './supabase'

export async function setStudentSnapshotVisibility(
  studentId: string,
  visible: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('students')
    .update({ family_snapshot_visible: visible })
    .eq('id', studentId)
  return { error: error?.message ?? null }
}

/**
 * Bulk-set the flag for every student currently enrolled in the classroom.
 * Returns the number of rows updated.
 */
export async function setClassroomSnapshotVisibility(
  classroomId: string,
  visible: boolean
): Promise<{ updated: number; error: string | null }> {
  const { data: scRows, error: scErr } = await supabase
    .from('student_classrooms')
    .select('student_id')
    .eq('classroom_id', classroomId)
  if (scErr) return { updated: 0, error: scErr.message }

  const ids = (scRows ?? []).map((r) => (r as { student_id: string }).student_id)
  if (ids.length === 0) return { updated: 0, error: null }

  const { error } = await supabase
    .from('students')
    .update({ family_snapshot_visible: visible })
    .in('id', ids)
  return { updated: ids.length, error: error?.message ?? null }
}

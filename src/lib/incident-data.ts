/**
 * incident-data.ts
 * Data hooks and CRUD operations for the Incident Report feature.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  IncidentReport,
  IncidentReportInsert,
  IncidentReportUpdate,
  IncidentReportWithDetails,
  IncidentReportListItem,
  IncidentReportStudentInsert,
  IncidentReportAttachment,
  IncidentReportNotification,
  IncidentReportTaggedUser,
  IncidentStudentRole,
  IncidentStatus,
  IncidentSeverity,
  IncidentFamilyStudent,
  Profile,
} from '../types/database'

// ============================================================
// Filters
// ============================================================

export interface IncidentFilters {
  status?: string
  incident_type?: string
  severity?: string
  date_from?: string
  date_to?: string
  student_id?: string
  classroom_id?: string
  /** ilike-match on the free-text location field */
  location?: string
  /** When set, restrict to incidents where the current user is assignee or tagged */
  involved_user_id?: string
  search?: string
}

// ============================================================
// Hooks
// ============================================================

export function useIncidentReports(
  schoolId: string | undefined,
  filters?: IncidentFilters
) {
  const [incidents, setIncidents] = useState<IncidentReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('incident_reports')
          .select('*, profiles!incident_reports_reported_by_fkey(full_name)')
          .eq('school_id', schoolId)
          .order('incident_date', { ascending: false })

        if (filters?.status) query = query.eq('status', filters.status)
        if (filters?.incident_type) query = query.eq('incident_type', filters.incident_type)
        if (filters?.severity) query = query.eq('severity', filters.severity)
        if (filters?.date_from) query = query.gte('incident_date', filters.date_from)
        if (filters?.date_to) query = query.lte('incident_date', filters.date_to)
        if (filters?.location) query = query.ilike('location', `%${filters.location}%`)
        if (filters?.search) query = query.ilike('description', `%${filters.search}%`)

        const { data, error: err } = await query

        if (err) throw new Error(err.message)
        if (cancelled) return

        let items = (data ?? []) as (IncidentReport & { profiles?: { full_name: string } })[]

        // If filtering by student, we need to cross-reference junction table
        if (filters?.student_id) {
          const { data: studentLinks } = await supabase
            .from('incident_report_students')
            .select('incident_report_id')
            .eq('student_id', filters.student_id)

          const linkedIds = new Set((studentLinks ?? []).map((l) => l.incident_report_id))
          items = items.filter((i) => linkedIds.has(i.id))
        }

        // If filtering by classroom
        if (filters?.classroom_id) {
          const { data: classroomLinks } = await supabase
            .from('incident_report_classrooms')
            .select('incident_report_id')
            .eq('classroom_id', filters.classroom_id)

          const linkedIds = new Set((classroomLinks ?? []).map((l) => l.incident_report_id))
          items = items.filter((i) => linkedIds.has(i.id))
        }

        // Filter by involvement (assignee or tagged) — applied client-side
        // by intersecting with the tag set for the current user.
        const involvedUserId = filters?.involved_user_id
        let involvedTaggedIncidentIds: Set<string> | null = null
        if (involvedUserId) {
          const { data: myTags } = await supabase
            .from('incident_report_tagged_users')
            .select('incident_report_id')
            .eq('user_id', involvedUserId)
          involvedTaggedIncidentIds = new Set((myTags ?? []).map((t) => t.incident_report_id as string))
          items = items.filter(
            (i) => i.assigned_to === involvedUserId || involvedTaggedIncidentIds!.has(i.id)
          )
        }

        // Fetch student names + tag list + unread state for each incident
        const incidentIds = items.map((i) => i.id)
        const studentMap: Record<string, string[]> = {}
        const studentCountMap: Record<string, number> = {}
        const taggedIncidentIds = new Set<string>()
        const unreadIncidentIds = new Set<string>()

        if (incidentIds.length > 0) {
          // Resolve "current user" for the tag/unread enrichment — prefer the
          // explicit involved_user_id filter, else use auth.user
          const currentUserId =
            involvedUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null

          const [studentsRes, tagsRes, notifsRes] = await Promise.all([
            supabase
              .from('incident_report_students')
              .select('incident_report_id, students(first_name, last_name)')
              .in('incident_report_id', incidentIds),
            currentUserId
              ? supabase
                  .from('incident_report_tagged_users')
                  .select('incident_report_id')
                  .eq('user_id', currentUserId)
                  .in('incident_report_id', incidentIds)
              : Promise.resolve({ data: [] as { incident_report_id: string }[] }),
            currentUserId
              ? supabase
                  .from('incident_report_notifications')
                  .select('incident_report_id')
                  .eq('recipient_id', currentUserId)
                  .eq('read', false)
                  .in('incident_report_id', incidentIds)
              : Promise.resolve({ data: [] as { incident_report_id: string }[] }),
          ])

          const students = studentsRes.data
          if (students) {
            for (const row of students as unknown as { incident_report_id: string; students: { first_name: string; last_name: string } | null }[]) {
              if (!studentMap[row.incident_report_id]) {
                studentMap[row.incident_report_id] = []
                studentCountMap[row.incident_report_id] = 0
              }
              if (row.students) {
                studentMap[row.incident_report_id].push(
                  `${row.students.first_name} ${row.students.last_name}`
                )
              }
              studentCountMap[row.incident_report_id]++
            }
          }

          for (const t of (tagsRes.data ?? []) as { incident_report_id: string }[]) {
            taggedIncidentIds.add(t.incident_report_id)
          }
          for (const n of (notifsRes.data ?? []) as { incident_report_id: string }[]) {
            unreadIncidentIds.add(n.incident_report_id)
          }
        }

        const result: IncidentReportListItem[] = items.map((item) => ({
          ...item,
          reporter_name: item.profiles?.full_name,
          student_names: studentMap[item.id] ?? [],
          student_count: studentCountMap[item.id] ?? 0,
          is_tagged: taggedIncidentIds.has(item.id),
          has_unread: unreadIncidentIds.has(item.id),
        }))

        setIncidents(result)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [schoolId, fetchCount, filters?.status, filters?.incident_type, filters?.severity, filters?.date_from, filters?.date_to, filters?.student_id, filters?.classroom_id, filters?.location, filters?.involved_user_id, filters?.search])

  return { incidents, loading, error, refetch }
}

export function useIncidentReport(id: string | undefined) {
  const [incident, setIncident] = useState<IncidentReportWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Fetch main report + reporter + assigned person
        const { data: report, error: err } = await supabase
          .from('incident_reports')
          .select('*')
          .eq('id', id)
          .single()

        if (err || !report) throw new Error(err?.message ?? 'Incident not found')
        if (cancelled) return

        // Parallel fetches for related data
        const [
          reporterRes,
          assignedRes,
          studentsRes,
          classroomsRes,
          attachmentsRes,
          followUpsRes,
          taggedRes,
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', report.reported_by).single(),
          report.assigned_to
            ? supabase.from('profiles').select('*').eq('id', report.assigned_to).single()
            : Promise.resolve({ data: null }),
          supabase
            .from('incident_report_students')
            .select('*, students(*)')
            .eq('incident_report_id', id),
          supabase
            .from('incident_report_classrooms')
            .select('*, classrooms(*)')
            .eq('incident_report_id', id),
          supabase
            .from('incident_report_attachments')
            .select('*')
            .eq('incident_report_id', id)
            .order('created_at'),
          supabase
            .from('incident_report_follow_ups')
            .select('*, profiles!incident_report_follow_ups_author_id_fkey(*)')
            .eq('incident_report_id', id)
            .order('created_at'),
          supabase
            .from('incident_report_tagged_users')
            .select('*, profiles!incident_report_tagged_users_user_id_fkey(*)')
            .eq('incident_report_id', id)
            .order('created_at'),
        ])

        if (cancelled) return

        const result: IncidentReportWithDetails = {
          ...report as IncidentReport,
          reporter: reporterRes.data as Profile | undefined,
          assigned_person: assignedRes.data as Profile | undefined,
          students: (studentsRes.data ?? []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            incident_report_id: s.incident_report_id as string,
            student_id: s.student_id as string,
            role: s.role as string,
            notes: s.notes as string | null,
            severity: (s.severity ?? null) as IncidentSeverity | null,
            shared_with_family: (s.shared_with_family ?? false) as boolean,
            student: s.students as { id: string; first_name: string; last_name: string } | undefined,
          })) as IncidentReportWithDetails['students'],
          classrooms: (classroomsRes.data ?? []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            incident_report_id: c.incident_report_id as string,
            classroom_id: c.classroom_id as string,
            classroom: c.classrooms as { id: string; name: string } | undefined,
          })) as IncidentReportWithDetails['classrooms'],
          attachments: (attachmentsRes.data ?? []) as IncidentReportAttachment[],
          follow_ups: (followUpsRes.data ?? []).map((f: Record<string, unknown>) => ({
            id: f.id as string,
            incident_report_id: f.incident_report_id as string,
            author_id: f.author_id as string,
            notes: f.notes as string,
            status_change: f.status_change as string | null,
            created_at: f.created_at as string,
            author: f.profiles as Profile | undefined,
          })) as IncidentReportWithDetails['follow_ups'],
          tagged_users: (taggedRes.data ?? []).map((t: Record<string, unknown>) => ({
            id: t.id as string,
            incident_report_id: t.incident_report_id as string,
            user_id: t.user_id as string,
            tagged_by: t.tagged_by as string,
            created_at: t.created_at as string,
            user: t.profiles as Profile | undefined,
          })) as IncidentReportWithDetails['tagged_users'],
        }

        setIncident(result)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, fetchCount])

  return { incident, loading, error, refetch }
}

export function useStudentIncidents(studentId: string | undefined) {
  const [incidents, setIncidents] = useState<IncidentReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!studentId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Get this student's junction rows (one per incident) along with the
        // per-student role, severity override, and family-visibility flag.
        const { data: links } = await supabase
          .from('incident_report_students')
          .select('incident_report_id, role, severity, shared_with_family')
          .eq('student_id', studentId)

        if (!links || links.length === 0) {
          setIncidents([])
          setLoading(false)
          return
        }

        const linkMap = new Map<
          string,
          { role: IncidentStudentRole; severity: IncidentSeverity | null; shared_with_family: boolean }
        >()
        for (const l of links as {
          incident_report_id: string
          role: IncidentStudentRole
          severity: IncidentSeverity | null
          shared_with_family: boolean
        }[]) {
          linkMap.set(l.incident_report_id, {
            role: l.role,
            severity: l.severity,
            shared_with_family: l.shared_with_family,
          })
        }

        const ids = [...linkMap.keys()]

        const { data, error: err } = await supabase
          .from('incident_reports')
          .select('*, profiles!incident_reports_reported_by_fkey(full_name)')
          .in('id', ids)
          .order('incident_date', { ascending: false })

        if (err) throw new Error(err.message)
        if (cancelled) return

        const result: IncidentReportListItem[] = (data ?? []).map((item: IncidentReport & { profiles?: { full_name: string } }) => {
          const link = linkMap.get(item.id)
          return {
            ...item,
            reporter_name: item.profiles?.full_name,
            student_names: [],
            student_count: 0,
            student_role: link?.role,
            student_severity: link?.severity ?? null,
            student_shared_with_family: link?.shared_with_family ?? false,
            // Per-student override wins over the incident's overall severity.
            effective_severity: (link?.severity ?? item.severity) as IncidentSeverity,
          }
        })

        setIncidents(result)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [studentId, fetchCount])

  return { incidents, loading, error, refetch }
}

export function useUnreadIncidentNotifications(profileId: string | undefined) {
  const [count, setCount] = useState(0)
  const [notifications, setNotifications] = useState<IncidentReportNotification[]>([])
  const [fetchCount, setFetchCount] = useState(0)

  const refetch = useCallback(() => setFetchCount((c) => c + 1), [])

  useEffect(() => {
    if (!profileId) return
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('incident_report_notifications')
        .select('*')
        .eq('recipient_id', profileId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!cancelled && !error) {
        setNotifications((data ?? []) as IncidentReportNotification[])
        setCount((data ?? []).length)
      }
    }

    load()
    return () => { cancelled = true }
  }, [profileId, fetchCount])

  return { count, notifications, refetch }
}

// ============================================================
// CRUD Operations
// ============================================================

export interface CreateIncidentData {
  report: IncidentReportInsert
  students: {
    student_id: string
    role: IncidentStudentRole
    notes?: string
    /** Per-student severity override (null = inherit incident severity). */
    severity?: IncidentSeverity | null
    /** Whether this student's family may see the incident. */
    shared_with_family?: boolean
  }[]
  classroom_ids: string[]
}

export async function createIncidentReport(data: CreateIncidentData): Promise<string> {
  // 1. Insert the report
  const { data: report, error } = await supabase
    .from('incident_reports')
    .insert(data.report)
    .select('id, school_id')
    .single()

  if (error || !report) throw new Error(`Failed to create incident: ${error?.message}`)

  const reportId = report.id as string
  const schoolId = report.school_id as string

  // 2. Insert student links
  if (data.students.length > 0) {
    const studentRows: IncidentReportStudentInsert[] = data.students.map((s) => ({
      incident_report_id: reportId,
      student_id: s.student_id,
      role: s.role,
      notes: s.notes ?? null,
      severity: s.severity ?? null,
      shared_with_family: s.shared_with_family ?? false,
    }))

    const { error: studErr } = await supabase
      .from('incident_report_students')
      .insert(studentRows)

    if (studErr) console.error('Failed to link students:', studErr.message)
  }

  // 3. Insert classroom links + auto-link enrolled students
  if (data.classroom_ids.length > 0) {
    const classroomRows = data.classroom_ids.map((cid) => ({
      incident_report_id: reportId,
      classroom_id: cid,
    }))

    const { error: clsErr } = await supabase
      .from('incident_report_classrooms')
      .insert(classroomRows)

    if (clsErr) console.error('Failed to link classrooms:', clsErr.message)

    // Auto-link all active students in tagged classrooms
    const { data: enrolledStudents } = await supabase
      .from('students')
      .select('id')
      .in('classroom_id', data.classroom_ids)
      .eq('student_status', 'active')

    if (enrolledStudents && enrolledStudents.length > 0) {
      // Deduplicate against already-linked students
      const existingStudentIds = new Set(data.students.map((s) => s.student_id))
      const newStudents = enrolledStudents
        .filter((s) => !existingStudentIds.has(s.id))
        .map((s) => ({
          incident_report_id: reportId,
          student_id: s.id,
          role: 'involved' as IncidentStudentRole,
        }))

      if (newStudents.length > 0) {
        await supabase.from('incident_report_students').insert(newStudents)
      }
    }
  }

  // 4. Notify school admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'admin')

  if (admins && admins.length > 0) {
    const notifRows = admins
      .filter((a) => a.id !== data.report.reported_by) // Don't notify reporter
      .map((a) => ({
        incident_report_id: reportId,
        recipient_id: a.id,
        notification_type: 'new_incident' as const,
      }))

    if (notifRows.length > 0) {
      await supabase.from('incident_report_notifications').insert(notifRows)
    }
  }

  // 5. Notify assigned person
  if (data.report.assigned_to && data.report.assigned_to !== data.report.reported_by) {
    await supabase.from('incident_report_notifications').insert({
      incident_report_id: reportId,
      recipient_id: data.report.assigned_to,
      notification_type: 'assigned',
    })
  }

  return reportId
}

export async function addFollowUp(
  incidentId: string,
  authorId: string,
  notes: string,
  statusChange?: string
): Promise<void> {
  // 1. Insert follow-up
  const { error } = await supabase
    .from('incident_report_follow_ups')
    .insert({
      incident_report_id: incidentId,
      author_id: authorId,
      notes,
      status_change: statusChange ?? null,
    })

  if (error) throw new Error(`Failed to add follow-up: ${error.message}`)

  // 2. Update status if changed
  if (statusChange) {
    const update: IncidentReportUpdate = { status: statusChange as IncidentReport['status'] }
    // Stamp resolved_at when resolving/closing; clear it when re-opening so a
    // re-opened incident doesn't keep showing a stale "Resolved on …" date.
    update.resolved_at =
      statusChange === 'resolved' || statusChange === 'closed'
        ? new Date().toISOString()
        : null
    await supabase.from('incident_reports').update(update).eq('id', incidentId)
  }

  // 3. Notify reporter and assigned person
  const { data: incident } = await supabase
    .from('incident_reports')
    .select('reported_by, assigned_to')
    .eq('id', incidentId)
    .single()

  if (incident) {
    const recipients = new Set<string>()
    if (incident.reported_by !== authorId) recipients.add(incident.reported_by)
    if (incident.assigned_to && incident.assigned_to !== authorId) recipients.add(incident.assigned_to)

    const notifType = statusChange ? 'status_change' : 'follow_up'
    const notifRows = Array.from(recipients).map((rid) => ({
      incident_report_id: incidentId,
      recipient_id: rid,
      notification_type: notifType,
    }))

    if (notifRows.length > 0) {
      await supabase.from('incident_report_notifications').insert(notifRows)
    }
  }
}

export async function addIncidentAttachment(
  incidentId: string,
  file: File,
  uploadedBy: string
): Promise<void> {
  const filePath = `${incidentId}/${Date.now()}_${file.name}`

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from('incident-attachments')
    .upload(filePath, file)

  if (uploadErr) throw new Error(`Failed to upload file: ${uploadErr.message}`)

  // Insert attachment record
  const { error: insertErr } = await supabase
    .from('incident_report_attachments')
    .insert({
      incident_report_id: incidentId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: uploadedBy,
    })

  if (insertErr) throw new Error(`Failed to record attachment: ${insertErr.message}`)
}

export async function deleteIncidentAttachment(id: string): Promise<void> {
  // Get file path first
  const { data: attachment } = await supabase
    .from('incident_report_attachments')
    .select('file_path')
    .eq('id', id)
    .single()

  if (attachment?.file_path) {
    await supabase.storage.from('incident-attachments').remove([attachment.file_path])
  }

  const { error } = await supabase
    .from('incident_report_attachments')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete attachment: ${error.message}`)
}

// ============================================================
// Status changes (close / reopen / resolve)
// ============================================================

const STATUS_CHANGE_NOTE: Record<IncidentStatus, string> = {
  open: 'Re-opened the incident.',
  in_progress: 'Marked the incident in progress.',
  resolved: 'Marked the incident resolved.',
  closed: 'Closed the incident.',
}

/**
 * Change an incident's status from the header control. Writes an audit
 * follow-up (so the change shows in the timeline and notifies the
 * reporter/assignee) and updates the status + resolved_at via addFollowUp.
 */
export async function changeIncidentStatus(
  incidentId: string,
  authorId: string,
  newStatus: IncidentStatus,
  note?: string
): Promise<void> {
  const trimmed = note?.trim()
  const finalNote = trimmed && trimmed.length > 0 ? trimmed : STATUS_CHANGE_NOTE[newStatus]
  await addFollowUp(incidentId, authorId, finalNote, newStatus)
}

// ============================================================
// Per-student controls (admin-only via RLS)
// ============================================================

/** Set a per-student severity override (null = inherit incident severity). */
export async function setIncidentStudentSeverity(
  rowId: string,
  severity: IncidentSeverity | null
): Promise<void> {
  const { error } = await supabase
    .from('incident_report_students')
    .update({ severity })
    .eq('id', rowId)

  if (error) throw new Error(`Failed to update student severity: ${error.message}`)
}

/** Toggle whether a single involved student's family can see the incident. */
export async function setIncidentStudentVisibility(
  rowId: string,
  shared: boolean
): Promise<void> {
  const { error } = await supabase
    .from('incident_report_students')
    .update({ shared_with_family: shared })
    .eq('id', rowId)

  if (error) throw new Error(`Failed to update family visibility: ${error.message}`)
}

/** Bulk-set family visibility for every involved student on an incident. */
export async function setAllIncidentStudentsVisibility(
  incidentId: string,
  shared: boolean
): Promise<void> {
  const { error } = await supabase
    .from('incident_report_students')
    .update({ shared_with_family: shared })
    .eq('incident_report_id', incidentId)

  if (error) throw new Error(`Failed to update family visibility: ${error.message}`)
}

// ============================================================
// Family communication (staff-only narrative)
// ============================================================

export interface IncidentCommunicationFields {
  parent_notified: boolean
  parent_notification_method: string | null
  family_communication_log: string | null
  family_communication_followup: string | null
}

export async function updateIncidentCommunication(
  incidentId: string,
  fields: IncidentCommunicationFields
): Promise<void> {
  const { error } = await supabase
    .from('incident_reports')
    .update(fields)
    .eq('id', incidentId)

  if (error) throw new Error(`Failed to update communication: ${error.message}`)
}

/**
 * Family-facing involved-student list with redaction. Returns the viewing
 * family's own children revealed and every other involved student redacted.
 * Backed by the get_incident_family_students SECURITY DEFINER RPC.
 */
export async function getIncidentFamilyStudents(
  incidentId: string
): Promise<IncidentFamilyStudent[]> {
  const { data, error } = await supabase.rpc('get_incident_family_students', {
    p_incident_id: incidentId,
  })

  if (error) throw new Error(`Failed to load incident students: ${error.message}`)
  return (data ?? []) as IncidentFamilyStudent[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('incident_report_notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) throw new Error(`Failed to mark notification read: ${error.message}`)
}

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from('incident-attachments')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (!data?.signedUrl) throw new Error('Failed to get attachment URL')
  return data.signedUrl
}

// ============================================================
// Staff tagging (CC / FYI)
// ============================================================

export async function addIncidentTags(
  incidentId: string,
  userIds: string[],
  taggedBy: string
): Promise<void> {
  if (userIds.length === 0) return

  const rows = userIds.map((uid) => ({
    incident_report_id: incidentId,
    user_id: uid,
    tagged_by: taggedBy,
  }))

  // Upsert against the unique (incident, user) pair so re-tagging a person
  // is a no-op rather than an error.
  const { error } = await supabase
    .from('incident_report_tagged_users')
    .upsert(rows, { onConflict: 'incident_report_id,user_id', ignoreDuplicates: true })

  if (error) throw new Error(`Failed to tag staff: ${error.message}`)

  // Notify each newly tagged user (skip self)
  const notifRows = userIds
    .filter((uid) => uid !== taggedBy)
    .map((uid) => ({
      incident_report_id: incidentId,
      recipient_id: uid,
      notification_type: 'tagged' as const,
    }))

  if (notifRows.length > 0) {
    await supabase.from('incident_report_notifications').insert(notifRows)
  }
}

export async function removeIncidentTag(incidentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('incident_report_tagged_users')
    .delete()
    .eq('incident_report_id', incidentId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to remove tag: ${error.message}`)
}

/**
 * Mark all unread notifications for the current user on a given incident as
 * read — call when the user opens the incident detail page so the bold
 * indicator clears.
 */
export async function markIncidentNotificationsRead(
  incidentId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('incident_report_notifications')
    .update({ read: true })
    .eq('incident_report_id', incidentId)
    .eq('recipient_id', userId)
    .eq('read', false)
}

export type { IncidentReportTaggedUser }


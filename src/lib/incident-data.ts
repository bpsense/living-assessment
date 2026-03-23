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
  IncidentStudentRole,
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

        // Fetch student names for each incident
        const incidentIds = items.map((i) => i.id)
        let studentMap: Record<string, string[]> = {}
        let studentCountMap: Record<string, number> = {}

        if (incidentIds.length > 0) {
          const { data: students } = await supabase
            .from('incident_report_students')
            .select('incident_report_id, students(first_name, last_name)')
            .in('incident_report_id', incidentIds)

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
        }

        const result: IncidentReportListItem[] = items.map((item) => ({
          ...item,
          reporter_name: item.profiles?.full_name,
          student_names: studentMap[item.id] ?? [],
          student_count: studentCountMap[item.id] ?? 0,
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
  }, [schoolId, fetchCount, filters?.status, filters?.incident_type, filters?.severity, filters?.date_from, filters?.date_to, filters?.student_id, filters?.classroom_id, filters?.search])

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
        // Get incident IDs linked to this student
        const { data: links } = await supabase
          .from('incident_report_students')
          .select('incident_report_id')
          .eq('student_id', studentId)

        if (!links || links.length === 0) {
          setIncidents([])
          setLoading(false)
          return
        }

        const ids = links.map((l) => l.incident_report_id)

        const { data, error: err } = await supabase
          .from('incident_reports')
          .select('*, profiles!incident_reports_reported_by_fkey(full_name)')
          .in('id', ids)
          .order('incident_date', { ascending: false })

        if (err) throw new Error(err.message)
        if (cancelled) return

        const result: IncidentReportListItem[] = (data ?? []).map((item: IncidentReport & { profiles?: { full_name: string } }) => ({
          ...item,
          reporter_name: item.profiles?.full_name,
          student_names: [],
          student_count: 0,
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
  students: { student_id: string; role: IncidentStudentRole; notes?: string }[]
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

export async function updateIncidentReport(
  id: string,
  data: IncidentReportUpdate
): Promise<void> {
  const { error } = await supabase
    .from('incident_reports')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(`Failed to update incident: ${error.message}`)
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
    if (statusChange === 'resolved' || statusChange === 'closed') {
      update.resolved_at = new Date().toISOString()
    }
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

export async function toggleFamilySharing(
  incidentId: string,
  shared: boolean
): Promise<void> {
  const { error } = await supabase
    .from('incident_reports')
    .update({ shared_with_family: shared })
    .eq('id', incidentId)

  if (error) throw new Error(`Failed to update sharing: ${error.message}`)
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

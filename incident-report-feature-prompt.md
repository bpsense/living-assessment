# Incident Report Feature — Claude Code Prompt

Build an Incident Report feature for the Living Assessment app. This is a school-based incident reporting system accessible to educators (access level 3+) and admins. It integrates into the existing SpeedDial FAB, links to student profiles, and follows all existing codebase patterns (Supabase, React 19, TypeScript, Tailwind, Lucide icons, toast notifications).

---

## 1. DATABASE SCHEMA

Create a new Supabase migration with these tables:

### `incident_reports`

- `id` UUID primary key (default gen_random_uuid())
- `school_id` UUID not null references schools(id)
- `reported_by` UUID not null references profiles(id) — the educator/admin filing
- `incident_date` timestamptz not null — when the incident occurred
- `incident_time` text — optional time-of-day string (e.g. "10:30 AM", "During lunch")
- `location` text not null — where it happened (classroom, playground, hallway, cafeteria, off-campus, other)
- `incident_type` text not null — enum: 'behavioral', 'medical_injury', 'safety', 'bullying', 'property_damage', 'emotional_welfare', 'other'
- `severity` text not null — enum: 'low', 'medium', 'high', 'critical'
- `description` text not null — detailed narrative of what happened
- `immediate_actions_taken` text — what was done in the moment
- `witnesses` text — names of witnesses (free text)
- `parent_notified` boolean default false
- `parent_notification_method` text — phone, email, in-person, app
- `shared_with_family` boolean default false — controls parent visibility
- `status` text not null default 'open' — enum: 'open', 'in_progress', 'resolved', 'closed'
- `assigned_to` UUID references profiles(id) — follow-up person
- `resolution_notes` text
- `resolved_at` timestamptz
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### `incident_report_students` (junction table)

- `id` UUID primary key
- `incident_report_id` UUID not null references incident_reports(id) on delete cascade
- `student_id` UUID not null references students(id)
- `role` text default 'involved' — enum: 'involved', 'victim', 'aggressor', 'witness', 'bystander'
- `notes` text — student-specific notes
- unique constraint on (incident_report_id, student_id)

### `incident_report_classrooms` (junction to tag entire classes)

- `id` UUID primary key
- `incident_report_id` UUID not null references incident_reports(id) on delete cascade
- `classroom_id` UUID not null references classrooms(id)
- unique constraint on (incident_report_id, classroom_id)

### `incident_report_attachments`

- `id` UUID primary key
- `incident_report_id` UUID not null references incident_reports(id) on delete cascade
- `file_name` text not null
- `file_path` text not null — Supabase storage path
- `file_type` text
- `file_size` integer
- `uploaded_by` UUID references profiles(id)
- `created_at` timestamptz default now()

### `incident_report_follow_ups` (follow-up notes chain)

- `id` UUID primary key
- `incident_report_id` UUID not null references incident_reports(id) on delete cascade
- `author_id` UUID not null references profiles(id)
- `notes` text not null
- `status_change` text — if this follow-up changed the status
- `created_at` timestamptz default now()

### `incident_report_notifications`

- `id` UUID primary key
- `incident_report_id` UUID not null references incident_reports(id) on delete cascade
- `recipient_id` UUID not null references profiles(id)
- `notification_type` text not null — 'new_incident', 'assigned', 'follow_up', 'status_change'
- `read` boolean default false
- `created_at` timestamptz default now()

### RLS & Storage

All tables must include `school_id` where applicable for multi-tenancy. Add RLS policies matching existing patterns: educators can read incidents for students in their classrooms, admins can read all incidents in their school, parents can only read incidents where `shared_with_family = true` and the student is linked to them via `parent_students`.

Create a Supabase storage bucket `incident-attachments` with appropriate policies (upload by educators/admins, read by those with access to the incident).

---

## 2. TYPE DEFINITIONS

Add to `src/types/database.ts` following the existing pattern (Row, Insert, Update variants for each table).

---

## 3. DATA LAYER

Create `src/lib/incident-data.ts` following the patterns in `observation-form.ts` and `assignment-data.ts`:

- `useIncidentReports(schoolId, filters?)` — list hook with filtering by status, type, severity, date range, student, classroom
- `useIncidentReport(id)` — single report with students, classrooms, attachments, follow-ups loaded
- `useStudentIncidents(studentId)` — incidents linked to a specific student (for student profile)
- `createIncidentReport(data)` — insert report + junction rows + create notifications for school admins
- `updateIncidentReport(id, data)` — admin-only update
- `addFollowUp(incidentId, notes, statusChange?)` — append follow-up note, optionally change status, notify assigned person
- `addIncidentAttachment(incidentId, file)` — upload to Supabase storage + insert attachment record
- `deleteIncidentAttachment(id)` — admin-only
- `toggleFamilySharing(incidentId, shared)` — toggle `shared_with_family`
- `useUnreadIncidentNotifications(profileId)` — for notification badge count
- `markNotificationRead(notificationId)`

**Critical behavior:** When a classroom is tagged on an incident, auto-link all students currently enrolled in that classroom (via `student_classrooms` where status = 'active') to the `incident_report_students` junction table with role 'involved'. This ensures the incident appears on each student's profile.

---

## 4. SPEED DIAL INTEGRATION

In `src/components/Layout.tsx`, add a third action to the SpeedDial actions array:

```ts
{
  label: 'Incident Report',
  icon: AlertTriangle, // from lucide-react
  onClick: () => setIncidentReportOpen(true),
  color: 'bg-red-500 hover:bg-red-600'
}
```

Visibility: Same as existing actions (educators + admins, not during impersonation, not on "All Schools" view). The SpeedDial already only renders for access level 3+, so this inherits that.

Add state `const [incidentReportOpen, setIncidentReportOpen] = useState(false)` and render `<IncidentReportModal>` when true.

---

## 5. INCIDENT REPORT FORM (Modal)

Create `src/components/incident/IncidentReportModal.tsx` — full-screen modal following the pattern of `QuickObserveModal.tsx` and `CreateAssignmentModal.tsx`.

### Form fields in order:

1. **Incident Date & Time** — Date picker (default today) + optional time text input
2. **Location** — Dropdown: Classroom, Playground, Hallway, Cafeteria, Gymnasium, Off-campus, Other (with free text for "Other")
3. **Incident Type** — Dropdown: Behavioral, Medical/Injury, Safety, Bullying, Property Damage, Emotional/Welfare, Other
4. **Severity** — Visual selector (like the observation rating picker): Low (green), Medium (yellow), High (orange), Critical (red)
5. **Students Involved** — Multi-select student search (reuse the `StudentSearch` pattern from QuickObserveModal). Each tagged student gets a role dropdown (Involved, Victim, Aggressor, Witness, Bystander) and optional per-student notes.
6. **Classrooms Involved** — Optional multi-select classroom picker. When a classroom is selected, show a note: "All currently enrolled students in this class will be linked to this incident."
7. **Description** — Large textarea, required. Placeholder: "Describe what happened in detail. Include the sequence of events, who was involved, and any relevant context."
8. **Immediate Actions Taken** — Textarea. Placeholder: "What steps were taken immediately? (e.g., first aid administered, students separated, parent called)"
9. **Witnesses** — Text input for witness names
10. **Attachments** — File upload area (drag-and-drop or click to select). Accept images and PDFs. Show thumbnails for images.
11. **Parent Notification** — Checkbox "Parent/guardian has been notified" + conditional dropdown for method (Phone, Email, In-person, Via app)
12. **Assign Follow-up To** — Optional educator/admin search picker. Defaults to empty.

Submit button: "File Incident Report". Red/urgent styling for critical severity selection.

On submit: call `createIncidentReport`, show success toast, close modal, trigger notifications.

---

## 6. INCIDENT REPORT DETAIL VIEW

Create `src/pages/IncidentReport.tsx` at route `/incident/:id`.

### Layout:

- Header with incident type badge, severity badge, status badge, date/time, location
- Reporter name and timestamp
- Description section
- Immediate actions section
- Students involved (clickable links to student profiles) with their roles
- Classrooms involved (clickable links)
- Attachments (viewable/downloadable)
- Witnesses
- Parent notification status
- **Family sharing toggle** (switch to control `shared_with_family`, visible to admins only)

### Follow-up section:

- Timeline of follow-up notes (author, timestamp, any status changes)
- "Add Follow-up" form at bottom: textarea + optional status change dropdown (Open, In Progress, Resolved, Closed)
- Status change auto-records who changed it and when
- Only the assigned follow-up person and admins can add follow-ups

### Edit capability:

- Admin-only edit button that opens the form in edit mode (pre-populated)
- Educators who filed the report can view but not edit after submission

---

## 7. ADMIN INCIDENT LIST PAGE

Create `src/pages/admin/IncidentsPage.tsx` at route `/admin/incidents`.

### Features:

- Table/list view of all incidents in the school
- Filters: status, type, severity, date range, specific student, specific classroom
- Search by description text
- Sort by date (default newest first), severity, status
- Each row shows: date, type badge, severity badge, students involved (truncated), status, reported by
- Click row to navigate to detail view
- Summary stats at top: total open, by severity, by type (small counters)

Add to admin nav in Layout.tsx with `ShieldAlert` icon (lucide-react), label "Incidents". Visible to access level 4+ (department admin and above).

---

## 8. STUDENT PROFILE INTEGRATION

In the student profile page (`src/pages/StudentProfile.tsx` and `src/components/student/`), add a new section/tab called "Incident Reports."

- Uses `useStudentIncidents(studentId)` to fetch linked incidents
- Shows list of incidents: date, type, severity, status, brief description preview
- Each item clickable to navigate to `/incident/:id`
- Section visible only to educators (level 3+) and admins, never to parents or learners
- If `shared_with_family` is true on an incident AND the viewer is a parent linked to this student, show a simplified read-only view (description, date, type, any resolution notes — omit internal follow-ups and other students' info)
- Badge count on the section header showing number of open incidents

---

## 9. IN-APP NOTIFICATIONS

Add an incident notification indicator to the existing UI:

- When an incident is created, insert notifications for: all school admins, the assigned follow-up person (if set)
- When a follow-up is added, notify the original reporter and the assigned person
- When status changes, notify the original reporter
- Show unread count on a bell icon or similar in the header (if no notification system exists yet, add a simple one: bell icon in Layout header, dropdown showing recent unread notifications, click to navigate to the incident)
- Mark as read when the notification is clicked/viewed

---

## 10. ROUTE REGISTRATION

In `src/App.tsx`, add:

- `/incident/:id` — IncidentReport detail page, protected for access level 3+ (educators and admins)
- `/admin/incidents` — IncidentsPage, protected for access level 4+ (department admin and above)

---

## 11. IMPLEMENTATION NOTES

- Follow the existing pattern of `useAuth()` and `useAccessControl()` for all permission checks
- Use the existing toast system for success/error notifications
- Use the existing Supabase client from `src/lib/supabase.ts`
- Match the existing UI styling (Tailwind classes, card patterns, badge patterns visible throughout the codebase)
- All queries must be scoped by `school_id` for multi-tenancy
- Use `date-fns` for date formatting, matching existing usage
- Educator student access must respect classroom assignments (educators only see incidents for students in their classrooms, unless they are the reporter or assigned follow-up person)
- The incident form should work well on mobile (educators often file these on the spot from phones)

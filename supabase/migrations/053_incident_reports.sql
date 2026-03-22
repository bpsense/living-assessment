-- 026_incident_reports.sql
-- Incident Report feature: tables, RLS policies, and storage bucket

-- ============================================================
-- 1. incident_reports — main table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  reported_by uuid NOT NULL REFERENCES public.profiles(id),
  incident_date timestamptz NOT NULL,
  incident_time text,
  location text NOT NULL,
  incident_type text NOT NULL
    CHECK (incident_type IN ('behavioral', 'medical_injury', 'safety', 'bullying', 'property_damage', 'emotional_welfare', 'other')),
  severity text NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  immediate_actions_taken text,
  witnesses text,
  parent_notified boolean DEFAULT false,
  parent_notification_method text,
  shared_with_family boolean DEFAULT false,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.profiles(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. incident_report_students — junction table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id),
  role text DEFAULT 'involved'
    CHECK (role IN ('involved', 'victim', 'aggressor', 'witness', 'bystander')),
  notes text,
  UNIQUE (incident_report_id, student_id)
);

-- ============================================================
-- 3. incident_report_classrooms — junction for tagging classes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id),
  UNIQUE (incident_report_id, classroom_id)
);

-- ============================================================
-- 4. incident_report_attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5. incident_report_follow_ups — follow-up notes chain
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  notes text NOT NULL,
  status_change text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 6. incident_report_notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  notification_type text NOT NULL
    CHECK (notification_type IN ('new_incident', 'assigned', 'follow_up', 'status_change')),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 7. Updated_at trigger for incident_reports
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_incident_report_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_incident_report_updated_at ON public.incident_reports;
CREATE TRIGGER set_incident_report_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_incident_report_timestamp();

-- ============================================================
-- 8. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_incident_reports_school ON public.incident_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_reported_by ON public.incident_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_date ON public.incident_reports(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_incident_report_students_report ON public.incident_report_students(incident_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_report_students_student ON public.incident_report_students(student_id);
CREATE INDEX IF NOT EXISTS idx_incident_report_classrooms_report ON public.incident_report_classrooms(incident_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_report_follow_ups_report ON public.incident_report_follow_ups(incident_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_report_notifications_recipient ON public.incident_report_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_incident_report_notifications_unread ON public.incident_report_notifications(recipient_id, read) WHERE read = false;

-- ============================================================
-- 9. RLS Policies
-- ============================================================

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_notifications ENABLE ROW LEVEL SECURITY;

-- incident_reports: admins see all in their school, educators see incidents
-- for students in their classrooms or incidents they reported/are assigned to
CREATE POLICY incident_reports_admin_all ON public.incident_reports
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR
    -- System admin
    EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY incident_reports_educator_select ON public.incident_reports
  FOR SELECT TO authenticated
  USING (
    -- Educator: can see incidents they reported
    reported_by = auth.uid()
    OR
    -- Educator: assigned to follow up
    assigned_to = auth.uid()
    OR
    -- Educator: incidents involving students in their classrooms
    EXISTS (
      SELECT 1 FROM public.incident_report_students irs
      JOIN public.students s ON s.id = irs.student_id
      JOIN public.educator_classrooms ec ON ec.classroom_id = s.classroom_id AND ec.educator_id = auth.uid()
      WHERE irs.incident_report_id = incident_reports.id
    )
  );

CREATE POLICY incident_reports_educator_insert ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- Parent: can only see incidents shared with family for their linked students
CREATE POLICY incident_reports_parent_select ON public.incident_reports
  FOR SELECT TO authenticated
  USING (
    shared_with_family = true
    AND EXISTS (
      SELECT 1 FROM public.incident_report_students irs
      JOIN public.parent_students ps ON ps.student_id = irs.student_id AND ps.parent_id = auth.uid()
      WHERE irs.incident_report_id = incident_reports.id
    )
  );

-- incident_report_students: follow parent table access
CREATE POLICY irs_select ON public.incident_report_students
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
    )
  );

CREATE POLICY irs_insert ON public.incident_report_students
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
      AND (ir.reported_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
    )
  );

CREATE POLICY irs_delete ON public.incident_report_students
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- incident_report_classrooms: follow parent table access
CREATE POLICY irc_select ON public.incident_report_classrooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
    )
  );

CREATE POLICY irc_insert ON public.incident_report_classrooms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
      AND (ir.reported_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
    )
  );

-- incident_report_attachments: follow parent table access
CREATE POLICY ira_select ON public.incident_report_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
    )
  );

CREATE POLICY ira_insert ON public.incident_report_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
      AND (ir.reported_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
    )
  );

CREATE POLICY ira_delete ON public.incident_report_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- incident_report_follow_ups: educators (reporter/assigned) + admins can insert; all with incident access can read
CREATE POLICY irfu_select ON public.incident_report_follow_ups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
    )
  );

CREATE POLICY irfu_insert ON public.incident_report_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.incident_reports ir
      WHERE ir.id = incident_report_id
      AND (
        ir.assigned_to = auth.uid()
        OR ir.reported_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    )
  );

-- incident_report_notifications: users can only read/update their own
CREATE POLICY irn_select ON public.incident_report_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY irn_insert ON public.incident_report_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY irn_update ON public.incident_report_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ============================================================
-- 10. Storage bucket for attachments
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-attachments', 'incident-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: educators/admins can upload, those with access can read
CREATE POLICY incident_attachments_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY incident_attachments_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator', 'parent')
    )
  );

CREATE POLICY incident_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'incident-attachments'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 061_educator_classroom_role.sql
-- Add a role label to each educator-classroom assignment so admins can
-- distinguish a Lead teacher from a Support teacher in the same classroom.
-- Existing rows default to 'lead' to preserve current behavior.

ALTER TABLE public.educator_classrooms
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'lead'
  CHECK (role IN ('lead', 'support'));

CREATE INDEX IF NOT EXISTS idx_educator_classrooms_classroom_role
  ON public.educator_classrooms(classroom_id, role);

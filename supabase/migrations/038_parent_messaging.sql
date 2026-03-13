-- 038_parent_messaging.sql
-- Enable parents to create conversations with educators/admins connected to their children.
-- Add targeted learner conversation lookup for student profile view.

-- ============================================================
-- 1. Allow parents to create direct/group conversations
-- ============================================================

CREATE POLICY "conversations_insert_parent"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'parent'
    AND created_by = auth.uid()
    AND conversation_type IN ('direct', 'group')
  );

-- ============================================================
-- 2. RPC: Search educators/admins a parent can message
--    Returns educators assigned to the parent's children's classrooms,
--    plus school admins in the same school.
-- ============================================================

CREATE OR REPLACE FUNCTION search_parent_contactable_users(
  p_parent_id uuid,
  p_query text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role text
) AS $$
  SELECT DISTINCT pr.id, pr.full_name, pr.avatar_url, pr.role::text
  FROM profiles pr
  WHERE pr.is_active = true
    AND pr.id != p_parent_id
    AND pr.full_name ILIKE '%' || p_query || '%'
    AND (
      -- Educators assigned to classrooms of the parent's linked children
      (
        pr.role = 'educator'
        AND pr.id IN (
          SELECT ec.educator_id
          FROM educator_classrooms ec
          JOIN students s ON s.classroom_id = ec.classroom_id
          JOIN parent_students ps ON ps.student_id = s.id
          WHERE ps.parent_id = p_parent_id
            AND s.student_status = 'active'
        )
      )
      OR
      -- School admins in the same school
      (
        pr.role = 'admin'
        AND pr.school_id = (SELECT school_id FROM profiles WHERE id = p_parent_id)
      )
    )
  ORDER BY pr.full_name
  LIMIT 20;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. Function: Get conversation IDs for a specific linked child
--    More targeted than get_parent_visible_conversation_ids
--    which returns conversations for ALL linked children.
-- ============================================================

CREATE OR REPLACE FUNCTION get_learner_conversation_ids(
  p_parent_id uuid,
  p_student_id uuid
)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT cp.conversation_id
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.user_id
  JOIN parent_students ps ON ps.student_id = p.student_id
  WHERE ps.parent_id = p_parent_id
    AND ps.student_id = p_student_id
    AND p.role = 'learner'
$$ LANGUAGE sql STABLE SECURITY DEFINER;

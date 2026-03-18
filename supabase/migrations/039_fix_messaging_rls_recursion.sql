-- 039_fix_messaging_rls_recursion.sql
-- Fix infinite recursion in messaging RLS policies.
--
-- Root cause: conversation_participants policies sub-select from conversations,
-- and conversations policies sub-select from conversation_participants, creating
-- an infinite RLS evaluation loop. The messages table has the same issue.
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS for cross-table lookups,
-- following the same pattern used in 034_fix_rls_recursion.sql.

-- ============================================================
-- 1. SECURITY DEFINER helper functions
-- ============================================================

-- Get conversation IDs where a user is a direct participant
CREATE OR REPLACE FUNCTION get_user_conversation_ids(p_user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get conversation IDs belonging to a school (for admin lookups)
CREATE OR REPLACE FUNCTION get_school_conversation_ids(p_school_id uuid)
RETURNS SETOF uuid AS $$
  SELECT id FROM conversations WHERE school_id = p_school_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if a conversation was created by a specific user within their school
CREATE OR REPLACE FUNCTION is_conversation_creator(p_conversation_id uuid, p_user_id uuid, p_school_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id
      AND school_id = p_school_id
      AND created_by = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if a conversation belongs to a specific school
CREATE OR REPLACE FUNCTION is_school_conversation(p_conversation_id uuid, p_school_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id
      AND school_id = p_school_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. Fix conversations SELECT policies
-- ============================================================

-- conversations_select_participant was querying conversation_participants directly
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (
    id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- (conversations_select_parent, conversations_select_admin, conversations_select_system_admin
--  are fine — they use SECURITY DEFINER functions or simple role checks already)

-- ============================================================
-- 3. Fix conversation_participants policies
-- ============================================================

-- SELECT: was self-referential (queried conversation_participants from conversation_participants)
DROP POLICY IF EXISTS "conv_participants_select_participant" ON conversation_participants;
CREATE POLICY "conv_participants_select_participant"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- SELECT admin: was querying conversations (which queried conversation_participants)
DROP POLICY IF EXISTS "conv_participants_select_admin" ON conversation_participants;
CREATE POLICY "conv_participants_select_admin"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (SELECT get_school_conversation_ids(auth_school_id()))
  );

-- INSERT: was querying conversations (which queried conversation_participants)
DROP POLICY IF EXISTS "conv_participants_insert_member" ON conversation_participants;
CREATE POLICY "conv_participants_insert_member"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    -- Creator of the conversation can add participants
    is_conversation_creator(conversation_id, auth.uid(), auth_school_id())
    OR (
      -- Educators and admins can add participants to school conversations
      auth_role() IN ('educator', 'admin')
      AND is_school_conversation(conversation_id, auth_school_id())
    )
  );

-- DELETE admin: was querying conversations
DROP POLICY IF EXISTS "conv_participants_delete_admin" ON conversation_participants;
CREATE POLICY "conv_participants_delete_admin"
  ON conversation_participants FOR DELETE TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (SELECT get_school_conversation_ids(auth_school_id()))
  );

-- ============================================================
-- 4. Fix messages policies
-- ============================================================

-- SELECT participant: was querying conversation_participants directly
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- SELECT admin: was querying conversations (which queried conversation_participants)
DROP POLICY IF EXISTS "messages_select_admin" ON messages;
CREATE POLICY "messages_select_admin"
  ON messages FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (SELECT get_school_conversation_ids(auth_school_id()))
  );

-- INSERT participant: was querying conversation_participants directly
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- INSERT parent own: was querying conversation_participants directly
DROP POLICY IF EXISTS "messages_insert_parent_own" ON messages;
CREATE POLICY "messages_insert_parent_own"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'parent'
    AND sender_id = auth.uid()
    AND conversation_id IN (SELECT get_user_conversation_ids(auth.uid()))
  );

-- UPDATE moderator: was querying conversations (which queried conversation_participants)
DROP POLICY IF EXISTS "messages_update_moderator" ON messages;
CREATE POLICY "messages_update_moderator"
  ON messages FOR UPDATE TO authenticated
  USING (
    auth_role() IN ('educator', 'admin')
    AND conversation_id IN (SELECT get_school_conversation_ids(auth_school_id()))
  );

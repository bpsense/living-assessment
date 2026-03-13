-- 036_messaging.sql
-- Community messaging system with mandatory family visibility for youth protection.
-- All learner messages are visible to linked parents via RLS policies.

-- ============================================================
-- 1. Enum
-- ============================================================

CREATE TYPE conversation_type AS ENUM ('direct', 'class', 'group');

-- ============================================================
-- 2. Tables
-- ============================================================

CREATE TABLE conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  conversation_type conversation_type NOT NULL DEFAULT 'direct',
  title             text,
  classroom_id      uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  created_by        uuid NOT NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'member',
  joined_at         timestamptz NOT NULL DEFAULT now(),
  last_read_at      timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         uuid NOT NULL REFERENCES profiles(id),
  content           text NOT NULL,
  is_flagged        boolean NOT NULL DEFAULT false,
  flagged_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX idx_conversations_school_id ON conversations(school_id);
CREATE INDEX idx_conversations_classroom_id ON conversations(classroom_id);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ============================================================
-- 4. Updated_at triggers
-- ============================================================

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. SECURITY DEFINER helper for family visibility
--    Returns conversation IDs where a linked child (learner) participates.
--    This bypasses RLS to prevent recursion cycles.
-- ============================================================

CREATE OR REPLACE FUNCTION get_parent_visible_conversation_ids(p_parent_id uuid)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT cp.conversation_id
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.user_id
  JOIN parent_students ps ON ps.student_id = p.student_id
  WHERE ps.parent_id = p_parent_id
    AND p.role = 'learner'
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 6. Enable RLS
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS Policies — conversations
-- ============================================================

-- Participants can see their conversations
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Parents can see conversations their children are in (youth protection)
CREATE POLICY "conversations_select_parent"
  ON conversations FOR SELECT TO authenticated
  USING (
    auth_role() = 'parent'
    AND id IN (SELECT get_parent_visible_conversation_ids(auth.uid()))
  );

-- School admins can see all conversations in their school (moderation)
CREATE POLICY "conversations_select_admin"
  ON conversations FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_role() = 'admin'
  );

-- System admins can see all conversations
CREATE POLICY "conversations_select_system_admin"
  ON conversations FOR SELECT TO authenticated
  USING (is_system_admin());

-- School members (not parents) can create conversations
CREATE POLICY "conversations_insert_member"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('learner', 'educator', 'admin')
    AND created_by = auth.uid()
  );

-- Conversation creator or admin can update (e.g. title)
CREATE POLICY "conversations_update_owner"
  ON conversations FOR UPDATE TO authenticated
  USING (
    school_id = auth_school_id()
    AND (created_by = auth.uid() OR auth_role() = 'admin')
  );

-- System admins can manage all conversations
CREATE POLICY "conversations_manage_system_admin"
  ON conversations FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- ============================================================
-- 8. RLS Policies — conversation_participants
-- ============================================================

-- Participants can see who's in their conversations
CREATE POLICY "conv_participants_select_participant"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Parents can see participants in children's conversations
CREATE POLICY "conv_participants_select_parent"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    auth_role() = 'parent'
    AND conversation_id IN (SELECT get_parent_visible_conversation_ids(auth.uid()))
  );

-- Admins can see all participants in their school
CREATE POLICY "conv_participants_select_admin"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (
      SELECT id FROM conversations WHERE school_id = auth_school_id()
    )
  );

-- System admins can see all
CREATE POLICY "conv_participants_select_system_admin"
  ON conversation_participants FOR SELECT TO authenticated
  USING (is_system_admin());

-- Conversation creator can add participants; educators/admins can add to their school conversations
CREATE POLICY "conv_participants_insert_member"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE school_id = auth_school_id()
        AND (created_by = auth.uid() OR auth_role() IN ('educator', 'admin'))
    )
  );

-- Participants can remove themselves (leave conversation)
CREATE POLICY "conv_participants_delete_self"
  ON conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can remove participants from their school conversations
CREATE POLICY "conv_participants_delete_admin"
  ON conversation_participants FOR DELETE TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (
      SELECT id FROM conversations WHERE school_id = auth_school_id()
    )
  );

-- System admins can manage all participants
CREATE POLICY "conv_participants_manage_system_admin"
  ON conversation_participants FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Participants can update their own record (e.g. last_read_at)
CREATE POLICY "conv_participants_update_self"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 9. RLS Policies — messages
-- ============================================================

-- Participants can read messages in their conversations
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Parents can read messages in children's conversations (READ-ONLY family visibility)
CREATE POLICY "messages_select_parent"
  ON messages FOR SELECT TO authenticated
  USING (
    auth_role() = 'parent'
    AND conversation_id IN (SELECT get_parent_visible_conversation_ids(auth.uid()))
  );

-- Admins can read all messages in their school (moderation)
CREATE POLICY "messages_select_admin"
  ON messages FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (
      SELECT id FROM conversations WHERE school_id = auth_school_id()
    )
  );

-- System admins can read all messages
CREATE POLICY "messages_select_system_admin"
  ON messages FOR SELECT TO authenticated
  USING (is_system_admin());

-- Only conversation participants can send messages
-- (Parents are NOT participants — they only have read access through family visibility)
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Parents can send messages in conversations where they are DIRECT participants
-- (their own conversations with educators/admins, not their children's conversations)
CREATE POLICY "messages_insert_parent_own"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'parent'
    AND sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Educators and admins can flag messages (update is_flagged)
CREATE POLICY "messages_update_moderator"
  ON messages FOR UPDATE TO authenticated
  USING (
    auth_role() IN ('educator', 'admin')
    AND conversation_id IN (
      SELECT id FROM conversations WHERE school_id = auth_school_id()
    )
  );

-- System admins can manage all messages
CREATE POLICY "messages_manage_system_admin"
  ON messages FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- ============================================================
-- 10. Enable Realtime for messages
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

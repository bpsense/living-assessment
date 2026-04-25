-- 058_admin_inbox_setup.sql
-- Column, RLS, and trigger plumbing for the admin_inbox conversation type
-- introduced in 057. Split out because the new enum value must be committed
-- in a prior transaction before it can be referenced in predicates.
--
-- Behavior:
--   - Any user in the school can create an 'admin_inbox' conversation.
--   - All school admins are auto-added as participants by trigger so they
--     can see and respond.
--   - admin_assigned_to lets one admin "claim" a thread; others can still
--     see and contribute (it's an ownership hint, not a hard restriction).

-- ============================================================
-- 1. Column for "claim" / assignment
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS admin_assigned_to uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_conversations_admin_assigned
  ON conversations(admin_assigned_to)
  WHERE conversation_type = 'admin_inbox';

-- ============================================================
-- 2. RLS — admins see/update all admin_inbox threads in their school
-- ============================================================

DROP POLICY IF EXISTS "conversations_select_admin_inbox" ON conversations;
CREATE POLICY "conversations_select_admin_inbox"
  ON conversations FOR SELECT TO authenticated
  USING (
    conversation_type = 'admin_inbox'
    AND auth_role() = 'admin'
    AND school_id = auth_school_id()
  );

DROP POLICY IF EXISTS "conversations_update_admin_inbox" ON conversations;
CREATE POLICY "conversations_update_admin_inbox"
  ON conversations FOR UPDATE TO authenticated
  USING (
    conversation_type = 'admin_inbox'
    AND auth_role() = 'admin'
    AND school_id = auth_school_id()
  )
  WITH CHECK (
    conversation_type = 'admin_inbox'
    AND auth_role() = 'admin'
    AND school_id = auth_school_id()
  );

-- ============================================================
-- 3. Messages in admin_inbox: any school admin can read + post
-- ============================================================

DROP POLICY IF EXISTS "messages_select_admin_inbox" ON messages;
CREATE POLICY "messages_select_admin_inbox"
  ON messages FOR SELECT TO authenticated
  USING (
    auth_role() = 'admin'
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE conversation_type = 'admin_inbox'
        AND school_id = auth_school_id()
    )
  );

DROP POLICY IF EXISTS "messages_insert_admin_inbox" ON messages;
CREATE POLICY "messages_insert_admin_inbox"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND auth_role() = 'admin'
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE conversation_type = 'admin_inbox'
        AND school_id = auth_school_id()
    )
  );

-- ============================================================
-- 4. Trigger: auto-add the sender + every school admin as participants
-- ============================================================

CREATE OR REPLACE FUNCTION public.populate_admin_inbox_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.conversation_type = 'admin_inbox' THEN
    -- Sender (creator) — already-a-participant case is a no-op via ON CONFLICT
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'sender')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- Every active admin in the school
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    SELECT NEW.id, p.id, 'admin'
    FROM profiles p
    WHERE p.school_id = NEW.school_id
      AND p.role = 'admin'
      AND p.is_active = true
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_admin_inbox_participants ON conversations;
CREATE TRIGGER trg_populate_admin_inbox_participants
  AFTER INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_admin_inbox_participants();

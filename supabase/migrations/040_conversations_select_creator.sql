-- 040_conversations_select_creator.sql
-- Fix: parents (and any user) can SELECT a conversation they just created.
--
-- Root cause: PostgreSQL 17 enforces SELECT policies on INSERT…RETURNING.
-- When a parent creates a conversation they are not yet a participant,
-- so conversations_select_participant rejects the RETURNING clause,
-- causing PostgREST to surface "new row violates row-level security policy".
--
-- Fix: allow the creator to always read their own conversations.

CREATE POLICY "conversations_select_creator"
  ON conversations FOR SELECT TO authenticated
  USING (created_by = auth.uid());

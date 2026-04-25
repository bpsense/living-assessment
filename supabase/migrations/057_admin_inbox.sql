-- 057_admin_inbox.sql
-- Adds the 'admin_inbox' value to the conversation_type enum.
-- Postgres requires ALTER TYPE … ADD VALUE to commit before the new value
-- can be referenced (e.g. in WHERE clauses or partial indexes), so the rest
-- of the admin inbox setup (column, policies, trigger) lives in 058.

ALTER TYPE conversation_type ADD VALUE IF NOT EXISTS 'admin_inbox';

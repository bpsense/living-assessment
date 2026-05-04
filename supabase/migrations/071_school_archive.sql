-- 071_school_archive.sql
-- Adds soft-archive capability for schools. System admins can archive a school
-- to hide it from the active rosters without losing historical data.

alter table schools add column archived_at timestamptz;
alter table schools add column archived_by uuid references auth.users(id);

create index schools_archived_at_idx on schools(archived_at)
  where archived_at is null;

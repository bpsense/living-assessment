-- 082_student_family_snapshot_visibility.sql
--
-- Per-student toggle controlling whether the Competency Snapshot section is
-- shown in the family/learner view of the student profile. Educators and
-- admins always see the snapshot; this flag only gates the family-facing
-- rendering. Defaults to true to preserve current behavior.
--
-- The admin "snapshot visibility" page batch-updates this flag across a
-- whole classroom; individual educators can still flip it per student from
-- the snapshot header.

alter table students
  add column if not exists family_snapshot_visible boolean not null default true;

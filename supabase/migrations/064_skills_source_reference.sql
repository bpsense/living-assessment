-- 064_skills_source_reference.sql
-- Phase 3 of the V2 refactor: record the upstream source (CCSS, NGSS, CDC,
-- CASEL, EYFS, ISTE, etc.) for baseline skills imported from
-- skill-baseline.json. Free-text — not parsed; surfaced in UI for provenance.

alter table skills
  add column if not exists source_reference text;

create index if not exists idx_skills_source_reference
  on skills(source_reference)
  where source_reference is not null;

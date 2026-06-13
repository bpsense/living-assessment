-- 085_remap_legacy_dimension_observations.sql
-- Phase ③ of the Boundless framework adoption: re-home observations that were
-- recorded against a school's pre-Boundless ("legacy") dimensions onto the
-- best-fitting Boundless 8 dimension, then deactivate the legacy dimensions so
-- the amoeba shows a clean 8.
--
-- Legacy dimensions are the still-active ones with no `strand` (Boundless dims
-- all have a strand set by the seeder). Best-fit mapping by name:
--   "Critical Thinking" / "Critical Thinking & Problem Solving"  -> Think Deeply
--   "projects" (project-based learning)                          -> Think Deeply
--   "Self-Direction & Executive Function"                        -> Know Yourself
--
-- Observations only move dimension; rating/notes/competency_id are untouched.
-- Resolved by name (no hardcoded ids) and scoped per school.

with legacy as (
  select d.id as legacy_id, d.school_id,
    case
      when d.name ilike '%critical thinking%'                          then 'Think Deeply'
      when d.name ilike '%project%'                                    then 'Think Deeply'
      when d.name ilike '%self-direction%' or d.name ilike '%executive%' then 'Know Yourself'
      else null
    end as target_name
  from dimensions d
  where d.strand is null and d.is_active
),
resolved as (
  select l.legacy_id, t.id as target_id
  from legacy l
  join dimensions t
    on t.school_id = l.school_id
   and t.name = l.target_name
   and t.strand is not null
  where l.target_name is not null
)
update observations o
   set dimension_id = r.target_id
  from resolved r
 where o.dimension_id = r.legacy_id;

-- Deactivate the legacy dimensions we just drained (history preserved on the
-- row; reactivatable from the builder if ever needed).
update dimensions d
   set is_active = false
 where d.strand is null
   and d.is_active
   and (
     d.name ilike '%critical thinking%'
     or d.name ilike '%project%'
     or d.name ilike '%self-direction%'
     or d.name ilike '%executive%'
   );

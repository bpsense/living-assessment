-- 075_drop_v2_learner_profile_tables.sql
-- The V2 learner-profile tables (introduced in 062 / 065) are obsolete:
-- the per-school `dimensions` table is once again the single source of truth
-- for amoeba lobes, and rollup from standards happens via the new
-- competency_domain_dimension_map bridge (074).
--
-- Also drops skills.domain_id (introduced in 063): a skill's domain is now
-- derived through skill_competencies -> competency_domains, not a direct FK.

-- ---- Drop skills.domain_id ----------------------------------
drop index if exists idx_skills_domain;
alter table skills drop column if exists domain_id;

-- ---- Drop V2 learner-profile tables and their seed helpers --
drop trigger if exists seed_learner_profile_on_school_create on schools;
drop function if exists trigger_seed_default_learner_profile() cascade;
drop function if exists seed_default_learner_profile(uuid) cascade;
drop function if exists seed_global_default_learner_profile() cascade;

drop table if exists learner_profile_domains cascade;
drop table if exists learner_profiles cascade;

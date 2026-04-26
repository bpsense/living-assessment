-- 065_global_default_learner_profile.sql
-- Convert the per-school default Learner Profile to a single global template
-- (school_id IS NULL). Baseline skills (and their domain_id FKs) keep pointing
-- at the same domain rows — we just promote the canonical default profile and
-- delete the redundant per-school copies.
--
-- After this migration:
--   * Exactly one default profile exists, with school_id = NULL.
--   * Schools that customize the profile create a school-owned, non-default
--     copy as before. The school's "active" profile is its own copy if any,
--     otherwise the global default (resolved client-side).
--   * The new-school trigger no longer creates a per-school default.

-- ============================================================
-- 1. Drop the per-school seed trigger and old seed function.
-- ============================================================

drop trigger if exists seed_learner_profile_on_school_create on schools;
drop function if exists trigger_seed_default_learner_profile();
drop function if exists seed_default_learner_profile(uuid);

-- ============================================================
-- 2. Allow school_id to be NULL.
-- ============================================================

drop index if exists uq_learner_profiles_one_default_per_school;
alter table learner_profiles alter column school_id drop not null;

-- ============================================================
-- 3. Pick a canonical default to keep, drop the rest.
-- ============================================================
-- The canonical row is whichever default has the most domain children with
-- baseline skills attached (skills.school_id IS NULL). Tie-break by
-- created_at (oldest wins). All other defaults get deleted; their domains
-- cascade-delete. Their child skills, if any, would lose their FK — but
-- skills.domain_id is ON DELETE SET NULL so they survive as "Unmapped".
-- (Today there's only one default with skills attached, so the tie-break
-- never fires.)

do $$
declare
  v_keep uuid;
  v_kept_school uuid;
  v_kept_skills bigint;
  v_dropped int;
begin
  select lp.id, lp.school_id
    into v_keep, v_kept_school
    from learner_profiles lp
    where lp.is_default = true
    order by (
      select count(*) from skills sk
      where sk.school_id is null
        and sk.domain_id in (
          select d.id from learner_profile_domains d where d.profile_id = lp.id
        )
    ) desc,
    lp.created_at asc
    limit 1;

  if v_keep is null then
    raise notice 'No default learner_profile found; nothing to promote.';
    return;
  end if;

  -- Promote to global.
  update learner_profiles
     set school_id = null
   where id = v_keep;

  -- Drop the other defaults (their domains cascade).
  delete from learner_profiles
   where is_default = true
     and id <> v_keep;
  get diagnostics v_dropped = row_count;

  select count(*) into v_kept_skills
    from skills sk
    where sk.school_id is null
      and sk.domain_id in (
        select d.id from learner_profile_domains d where d.profile_id = v_keep
      );

  raise notice 'Promoted profile % (originally school %) to global; dropped % redundant default(s); % baseline skill(s) preserved.',
    v_keep, v_kept_school, v_dropped, v_kept_skills;
end $$;

-- ============================================================
-- 4. Enforce singleton: at most one default profile, ever.
-- ============================================================

create unique index if not exists uq_learner_profiles_singleton_default
  on learner_profiles ((is_default))
  where is_default = true;

-- ============================================================
-- 5. RLS — allow everyone (auth'd) to read the global default and its
--    domains; writes to default rows still require a system admin.
-- ============================================================

drop policy if exists "learner_profiles_select" on learner_profiles;
create policy "learner_profiles_select"
  on learner_profiles for select to authenticated
  using (
    school_id is null
    or school_id in (select school_id from profiles where id = auth.uid())
    or is_system_admin()
  );

-- INSERT / UPDATE / DELETE policies from migration 062 already require
-- `is_default = false AND school_id IN user's schools` for non-system-admins,
-- so they can't accidentally write to the global default. No change needed
-- there — they just continue to work with the new singleton default.

drop policy if exists "learner_profile_domains_select" on learner_profile_domains;
create policy "learner_profile_domains_select"
  on learner_profile_domains for select to authenticated
  using (
    profile_id in (
      select id from learner_profiles
      where school_id is null
         or school_id in (select school_id from profiles where id = auth.uid())
    )
    or is_system_admin()
  );

-- ============================================================
-- 6. Idempotent seed for the global default. Used if the singleton ever
--    needs to be reseeded from scratch (e.g. fresh dev DB). Safe to call
--    repeatedly — short-circuits when a default already exists.
-- ============================================================

create or replace function seed_global_default_learner_profile()
returns uuid
language plpgsql
security definer
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
    from learner_profiles
    where is_default = true
    limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  insert into learner_profiles (school_id, name, description, is_default, is_active)
  values (
    null,
    'Default Learner Profile',
    'Global, system-owned template. Schools clone this to create an editable, school-owned version.',
    true,
    true
  )
  returning id into v_profile_id;

  insert into learner_profile_domains (profile_id, name, description, color, sort_order) values
    (v_profile_id, 'Language & Communication',
      'Reading, writing, speaking, listening, and multimodal expression across languages and contexts.',
      '#0EA5E9', 0),
    (v_profile_id, 'Mathematical Thinking',
      'Number sense, reasoning with quantity and pattern, problem solving, and modelling the world mathematically.',
      '#6366F1', 1),
    (v_profile_id, 'Scientific & Environmental Inquiry',
      'Observation, hypothesis, evidence, and the dispositions of a curious investigator of natural and built systems.',
      '#10B981', 2),
    (v_profile_id, 'Creative Expression & Making',
      'Visual art, music, performance, design, and craft — generating ideas and bringing them into the world.',
      '#F59E0B', 3),
    (v_profile_id, 'Inner Self & Well Being',
      'Self-awareness, emotional regulation, identity, agency, and the capacity to flourish.',
      '#EC4899', 4),
    (v_profile_id, 'Physical Wellbeing & Movement',
      'Gross and fine motor development, body awareness, healthy habits, and physical confidence.',
      '#EF4444', 5),
    (v_profile_id, 'Collaboration & Relational Skills',
      'Listening, perspective-taking, conflict navigation, and contributing to shared work with care.',
      '#8B5CF6', 6),
    (v_profile_id, 'Global Citizenship & Contribution',
      'Curiosity about cultures and systems, ethical reasoning, and the impulse to act for the common good.',
      '#14B8A6', 7);

  return v_profile_id;
end;
$$;

-- Ensure one exists right now (no-op if step 3 promoted one).
select seed_global_default_learner_profile();

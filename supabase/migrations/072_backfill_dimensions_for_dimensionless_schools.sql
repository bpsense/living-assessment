-- 072_backfill_dimensions_for_dimensionless_schools.sql
-- Phase 1 of the per-school learner-profile consolidation.
--
-- Any school that currently has zero rows in `dimensions` (latent bug — the
-- post-create seed never fired) gets the eight V2 baseline dimensions seeded.
-- Boundless (10 dims) and Embark (11 dims, incl. custom "projects") are
-- untouched because the WHERE NOT EXISTS gate skips any school with at
-- least one existing dimension.

do $$
declare
  s_id uuid;
begin
  for s_id in
    select s.id from schools s
    where not exists (select 1 from dimensions d where d.school_id = s.id)
  loop
    insert into dimensions (school_id, name, description, display_order, category, is_active) values
      (s_id, 'Language & Communication', 'Reading, writing, speaking, and listening skills across genres and modalities.', 1, 'Academic', true),
      (s_id, 'Mathematical Thinking', 'Number sense, operations, patterns, algebraic reasoning, and problem solving.', 2, 'Academic', true),
      (s_id, 'Scientific & Environmental Inquiry', 'Observation, hypothesis formation, experimentation, and evidence-based reasoning.', 3, 'Academic', true),
      (s_id, 'Creative Expression & Making', 'Visual arts, music, dance, drama, and imaginative design thinking.', 4, 'Academic', true),
      (s_id, 'Inner Self & Well Being', 'Resilience, self-awareness, growth mindset.', 5, 'Social & Emotional', true),
      (s_id, 'Physical Wellbeing & Movement', 'Body Awareness, health, physical vitality.', 6, 'Social & Emotional', true),
      (s_id, 'Collaboration & Relational Skills', 'Empathy, teamwork, interpersonal integrity.', 7, 'Social & Emotional', true),
      (s_id, 'Global Citizenship & Contribution', 'Civic purpose, cultural knowledge, action.', 8, 'Social & Emotional', true);
  end loop;
end $$;

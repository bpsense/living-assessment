-- 073_seed_default_dimensions_trigger.sql
-- After this migration, every newly-INSERTed school gets the 8 V2 baseline
-- dimensions automatically. Replaces any prior seed-on-create wiring for
-- dimensions; runs alongside (not instead of) the existing competency
-- framework auto-seed (031 -> 076).

create or replace function seed_default_dimensions(p_school_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if exists (select 1 from dimensions where school_id = p_school_id) then
    return;
  end if;

  insert into dimensions (school_id, name, description, display_order, category, is_active) values
    (p_school_id, 'Language & Communication', 'Reading, writing, speaking, and listening skills across genres and modalities.', 1, 'Academic', true),
    (p_school_id, 'Mathematical Thinking', 'Number sense, operations, patterns, algebraic reasoning, and problem solving.', 2, 'Academic', true),
    (p_school_id, 'Scientific & Environmental Inquiry', 'Observation, hypothesis formation, experimentation, and evidence-based reasoning.', 3, 'Academic', true),
    (p_school_id, 'Creative Expression & Making', 'Visual arts, music, dance, drama, and imaginative design thinking.', 4, 'Academic', true),
    (p_school_id, 'Inner Self & Well Being', 'Resilience, self-awareness, growth mindset.', 5, 'Social & Emotional', true),
    (p_school_id, 'Physical Wellbeing & Movement', 'Body Awareness, health, physical vitality.', 6, 'Social & Emotional', true),
    (p_school_id, 'Collaboration & Relational Skills', 'Empathy, teamwork, interpersonal integrity.', 7, 'Social & Emotional', true),
    (p_school_id, 'Global Citizenship & Contribution', 'Civic purpose, cultural knowledge, action.', 8, 'Social & Emotional', true);
end;
$$;

create or replace function trigger_seed_default_dimensions()
returns trigger
language plpgsql
security definer
as $$
begin
  perform seed_default_dimensions(new.id);
  return new;
end;
$$;

drop trigger if exists seed_dimensions_on_school_create on schools;
create trigger seed_dimensions_on_school_create
  after insert on schools
  for each row execute function trigger_seed_default_dimensions();

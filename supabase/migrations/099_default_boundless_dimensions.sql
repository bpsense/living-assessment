-- 099_default_boundless_dimensions.sql
-- Make the BOUNDLESS framework the seed-on-create default for new schools.
--
-- Every school in the product runs the Boundless 8 dimensions ("Think Deeply",
-- "Create Boldly", …) — until now they were converted from the generic
-- "Language & Communication" defaults by hand (scripts/seed-boundless-framework.ts).
-- This rewrites seed_default_dimensions() so a freshly-INSERTed school carries
-- the Boundless identity (name + strand + learner_profile + area_of_development
-- + icon, 0-indexed display_order) from the start — matching the existing
-- `seed_dimensions_on_school_create` trigger.
--
-- Competencies are NOT seeded here (avoids 73 JSONB literals in SQL); they are
-- applied by the `seed-school-demo` edge function (invoked on school creation)
-- / scripts/seed-school-demo.ts, which reads supabase/seed/boundless_framework.json.
-- Idempotent: early-returns if the school already has dimensions.

create or replace function seed_default_dimensions(p_school_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if exists (select 1 from dimensions where school_id = p_school_id) then
    return;
  end if;

  insert into dimensions
    (school_id, name, description, display_order, category, strand, learner_profile, area_of_development, icon, is_active, visible_to_family)
  values
    (p_school_id, 'Think Deeply',              'Scientific Thinking & Inquiry',            0, 'Academic',         'Academic',         'Thinker',         'Scientific Thinking & Inquiry',            'microscope', true, true),
    (p_school_id, 'Create Boldly',             'Creative expression and innovation',       1, 'Academic',         'Academic',         'Creative',        'Creative expression and innovation',       'palette',    true, true),
    (p_school_id, 'Reason & Solve',            'Mathematical thinking & Problem solving',  2, 'Academic',         'Academic',         'Problem solver',  'Mathematical thinking & Problem solving',  'calculator', true, true),
    (p_school_id, 'Communicate with Impact',   'Literacy & Communication',                 3, 'Academic',         'Academic',         'Communicator',    'Literacy & Communication',                 'book-open',  true, true),
    (p_school_id, 'Know Yourself',             'Inner self & Wellbeing',                   4, 'Social Emotional', 'Social Emotional', 'Self-aware',      'Inner self & Wellbeing',                   'heart',      true, true),
    (p_school_id, 'Keep Growing',              'Physical Wellbeing & Spirit of Growth',    5, 'Social Emotional', 'Social Emotional', 'Balanced',        'Physical Wellbeing & Spirit of Growth',    'activity',   true, true),
    (p_school_id, 'Connect Across Difference', 'Collaborative & Relational Skills',        6, 'Social Emotional', 'Social Emotional', 'Open-minded',     'Collaborative & Relational Skills',        'users',      true, true),
    (p_school_id, 'Navigate the World',        'Global Citizenship & Practical Life',      7, 'Social Emotional', 'Social Emotional', 'Global Citizen',  'Global Citizenship & Practical Life',      'globe',      true, true);
end;
$$;

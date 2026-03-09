-- 004_dimensions_category_soft_delete.sql
-- Add category and soft-delete support to dimensions table
-- for the Dimension Management admin feature.

-- ============================================================
-- Schema changes
-- ============================================================

-- Soft-delete: deactivated dimensions keep historical data intact
alter table dimensions
  add column is_active boolean not null default true;

-- Category grouping for organizing dimensions
alter table dimensions
  add column category text not null default 'Academic';

-- Composite index for the most common query pattern
create index idx_dimensions_school_active
  on dimensions(school_id, is_active);

-- ============================================================
-- Backfill categories for existing seed dimensions
-- ============================================================

update dimensions set category = 'Academic'
  where name in (
    'Language & Literacy',
    'Mathematical Thinking',
    'Scientific Inquiry',
    'Social Studies & Global Awareness'
  );

update dimensions set category = 'Creative & Arts'
  where name = 'Creative Expression';

update dimensions set category = 'Physical & Health'
  where name = 'Physical Development & Wellness';

update dimensions set category = 'Social & Emotional'
  where name in (
    'Social-Emotional Learning',
    'Communication & Collaboration'
  );

update dimensions set category = 'Cognitive'
  where name in (
    'Critical Thinking & Problem Solving',
    'Self-Direction & Executive Function'
  );

-- ============================================================
-- Update compute_all_competency_scores to respect is_active
-- ============================================================

create or replace function compute_all_competency_scores(p_student_id uuid)
returns table(dimension_id uuid, dimension_name text, score numeric) as $$
  select
    d.id as dimension_id,
    d.name as dimension_name,
    coalesce(round(avg(sub.rating_val), 2), 0) as score
  from dimensions d
  left join lateral (
    select (o.rating::text)::numeric as rating_val
    from observations o
    where o.student_id = p_student_id
      and o.dimension_id = d.id
    order by o.observed_at desc
    limit 5
  ) sub on true
  where d.school_id = (select school_id from students where id = p_student_id)
    and d.is_active = true
  group by d.id, d.name, d.display_order
  order by d.display_order;
$$ language sql stable;

-- ============================================================
-- Migration 015: Convert observation rating from enum to numeric
-- Enables granular 1/3-step competency ratings (12 levels)
-- ============================================================

-- 1. Add a temporary numeric column
alter table observations add column rating_num numeric;

-- 2. Copy existing enum values to numeric
update observations set rating_num = (rating::text)::numeric;

-- 3. Drop the old enum column
alter table observations drop column rating;

-- 4. Rename the numeric column to "rating"
alter table observations rename column rating_num to rating;

-- 5. Add NOT NULL constraint
alter table observations alter column rating set not null;

-- 6. Add CHECK constraint for valid range (0.33 to 4.0)
alter table observations add constraint observations_rating_range
  check (rating >= 0.33 and rating <= 4.0);

-- 7. Drop the old enum type (no longer needed)
drop type if exists observation_rating;

-- 8. Recreate the competency_scores function to work with numeric rating directly
-- (Previously it cast rating::text::numeric — now rating is already numeric)
create or replace function competency_scores(p_student_id uuid)
returns table(dimension_id uuid, dimension_name text, score numeric) as $$
begin
  return query
    select
      d.id as dimension_id,
      d.name as dimension_name,
      coalesce(round(avg(sub.rating_val), 2), 0) as score
    from dimensions d
    left join lateral (
      select o.rating as rating_val
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
end;
$$ language plpgsql stable;

-- 068_classroom_age_range_and_competency_age_bands.sql
-- Adds an age range to classrooms and an optional age band to competencies so
-- the assignment flow can default the visible competencies/skills to the
-- classroom's expected age range, and expand below/above for exceptional work.

-- ============================================================
-- classrooms.age_min / age_max
-- ============================================================

alter table classrooms
  add column if not exists age_min integer,
  add column if not exists age_max integer;

alter table classrooms
  drop constraint if exists classrooms_age_range_chk;

alter table classrooms
  add constraint classrooms_age_range_chk
  check (
    (age_min is null and age_max is null)
    or (age_min is not null and age_max is not null and age_min <= age_max)
  );

-- ============================================================
-- competencies.age_band_start / age_band_end
-- ============================================================

alter table competencies
  add column if not exists age_band_start integer,
  add column if not exists age_band_end   integer;

alter table competencies
  drop constraint if exists competencies_age_band_chk;

alter table competencies
  add constraint competencies_age_band_chk
  check (
    (age_band_start is null and age_band_end is null)
    or (age_band_start is not null and age_band_end is not null and age_band_start <= age_band_end)
  );

create index if not exists idx_competencies_age_band
  on competencies(age_band_start, age_band_end);

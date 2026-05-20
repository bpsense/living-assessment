-- 079_standards_age_bands.sql
-- Adds an integer age band to `standards`, mirroring the convention already
-- in place on `competencies` (migration 068). This lets the Competency
-- Snapshot classify each assessed standard as above / at / below the
-- learner's age, with no joins or string-parsing in the UI.
--
-- Rule recorded with this migration:
--   For a learner whose current age falls inside [age_band_start, age_band_end],
--   "achieving" on that standard is the on-track expectation. Mastery means
--   the learner is working into older age bands; anything below achieving
--   means the learner is below expectation for their age.
--
-- The backfill is best-effort. Standards with unparseable codes / grade
-- levels are left NULL — the UI treats NULL as "no expectation available".

-- ============================================================
-- 1. Columns + constraint + index
-- ============================================================

alter table standards
  add column if not exists age_band_start integer,
  add column if not exists age_band_end   integer;

alter table standards
  drop constraint if exists standards_age_band_chk;

alter table standards
  add constraint standards_age_band_chk
  check (
    (age_band_start is null and age_band_end is null)
    or (age_band_start is not null and age_band_end is not null
        and age_band_start <= age_band_end)
  );

create index if not exists idx_standards_age_band
  on standards(age_band_start, age_band_end);

-- ============================================================
-- 2. Backfill — code-pattern first, grade_level fallback
-- ============================================================

-- Helper: convert a grade token (K, PreK, 0-12) to an inclusive age range.
-- Returns NULL for tokens we don't recognize.
create or replace function _grade_token_to_age_range(token text)
returns int4range
language plpgsql
immutable
as $$
declare
  t text;
  n int;
begin
  if token is null then return null; end if;
  t := lower(trim(token));
  if t in ('prek', 'pre-k', 'pk') then return int4range(4, 5, '[]'); end if;
  if t in ('k', 'kindergarten') then return int4range(5, 6, '[]'); end if;
  begin
    n := t::int;
    if n between 0 and 12 then
      return int4range(n + 5, n + 6, '[]');
    end if;
  exception when others then
    return null;
  end;
  return null;
end $$;

-- 2a. Boundless-style codes embed the age range directly, e.g. "LC.4-5.1",
--     "MC.10-11.3", "PD.12-14.2". Regex pulls the (lo, hi) pair from the
--     second segment.
update standards
   set age_band_start = (regexp_match(code, '^[A-Z]+\.(\d+)-(\d+)\.'))[1]::int,
       age_band_end   = (regexp_match(code, '^[A-Z]+\.(\d+)-(\d+)\.'))[2]::int
 where age_band_start is null
   and code ~ '^[A-Z]+\.\d+-\d+\.';

-- 2b. Grade-range strings in grade_level, e.g. "K-2", "3-5", "6-8" (CCSS seed).
--     Lower bound from the first token, upper bound from the second.
update standards
   set age_band_start = lower((_grade_token_to_age_range(split_part(grade_level, '-', 1)))),
       age_band_end   = upper((_grade_token_to_age_range(split_part(grade_level, '-', 2)))) - 1
 where age_band_start is null
   and grade_level ~ '^(PreK|Pre-K|K|\d{1,2})-(K|\d{1,2})$'
   and _grade_token_to_age_range(split_part(grade_level, '-', 1)) is not null
   and _grade_token_to_age_range(split_part(grade_level, '-', 2)) is not null;

-- 2c. Single-grade strings in grade_level, e.g. "K", "1", "2".
update standards
   set age_band_start = lower(_grade_token_to_age_range(grade_level)),
       age_band_end   = upper(_grade_token_to_age_range(grade_level)) - 1
 where age_band_start is null
   and grade_level is not null
   and _grade_token_to_age_range(grade_level) is not null
   and grade_level !~ '-';

-- Cleanup helper (kept around if we want to re-run; safe to drop)
drop function if exists _grade_token_to_age_range(text);

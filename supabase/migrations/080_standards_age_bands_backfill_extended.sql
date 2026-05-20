-- 080_standards_age_bands_backfill_extended.sql
--
-- Extends the 079 backfill to cover the two patterns we found unmatched in
-- production data after applying 079:
--
--   - 160 rows: grade_level uses literal "Ages X-Y" format (Boundless seed
--     where the upload put the age string into grade_level instead of the
--     hyphenated grade tokens we expected).
--   - 3,873 rows: CCSS uploaded standards with codes like
--     "CCSS.ELA.5.Reading_Information.x" and grade_level = NULL. The grade
--     sits in the THIRD dot-segment as K or 1-12.
--
-- Same shape as 079: nullable columns already exist, this is a pure UPDATE.
-- Leaves anything we still can't parse at NULL.
--
-- Helper is defined and dropped within this migration so it doesn't leak
-- into the public namespace.

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

-- ============================================================
-- 1. "Ages X-Y" or "Ages X" grade_level (Boundless seed, literal age string)
-- ============================================================
update standards
   set age_band_start = (regexp_match(grade_level, '^Ages?\s+(\d+)(?:\s*[-–]\s*(\d+))?$'))[1]::int,
       age_band_end   = coalesce(
         (regexp_match(grade_level, '^Ages?\s+(\d+)(?:\s*[-–]\s*(\d+))?$'))[2]::int,
         (regexp_match(grade_level, '^Ages?\s+(\d+)(?:\s*[-–]\s*(\d+))?$'))[1]::int
       )
 where age_band_start is null
   and grade_level ~ '^Ages?\s+\d+(?:\s*[-–]\s*\d+)?$';

-- ============================================================
-- 2. CCSS-style codes: grade lives in the third dot-segment.
--    Examples:
--      CCSS.ELA.K.Reading_Information.1   -> grade K
--      CCSS.ELA.5.Reading_Literature.3    -> grade 5
--      CCSS.Math.3.NF.2                   -> grade 3
-- ============================================================
update standards
   set age_band_start = lower(_grade_token_to_age_range(split_part(code, '.', 3))),
       age_band_end   = upper(_grade_token_to_age_range(split_part(code, '.', 3))) - 1
 where age_band_start is null
   and code ~ '^CCSS\.[^.]+\.(K|\d{1,2})\.'
   and _grade_token_to_age_range(split_part(code, '.', 3)) is not null;

drop function if exists _grade_token_to_age_range(text);

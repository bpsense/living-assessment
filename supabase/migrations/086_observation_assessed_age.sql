-- 086_observation_assessed_age.sql
-- Lets an observation record the AGE STEP a competency was assessed against,
-- which may differ from the learner's actual age (±3 years for remedial/stretch).
--
-- The competency snapshot uses (assessed_age vs the learner's current age) to
-- position each competency on the below / at / above-expectation spectrum:
--   * assessed above age  -> "above" side (even at "developing")
--   * assessed at age      -> positioned by rating
--   * assessed below age   -> "below" side, unless "achieving"+ (then it drops
--                             off as below-age content the learner has mastered)
--
-- NULL = a dimension-level observation, or one recorded before this column
-- existed; such rows are positioned by rating alone.

alter table observations
  add column if not exists assessed_age integer;

-- 100_classroom_current_scores.sql
-- Roster performance: aggregate the per-student per-dimension CURRENT competency
-- server-side instead of shipping every raw observation to the browser. A dense
-- class (e.g. the demo class, ~36k observations) made the roster pull tens of
-- thousands of rows just to draw mini-amoebas; this returns ~ (students × 8) rows.
--
-- Mirrors computeObservationScores: current-month average per dimension, else the
-- latest single observation. Also returns each student's earliest observation so
-- the client can apply the same Dec-1 age-rescale decay the profile uses.
--
-- SECURITY INVOKER → RLS on observations/student_classrooms applies to the caller,
-- so an educator only aggregates the students they can already see.

create or replace function classroom_current_scores(p_classroom_id uuid)
returns table (
  student_id uuid,
  dimension_id uuid,
  competency numeric,
  current_month_count integer,
  earliest_observed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with cls_students as (
    select sc.student_id
    from student_classrooms sc
    where sc.classroom_id = p_classroom_id
  ),
  earliest as (
    select o.student_id, min(o.observed_at) as earliest_observed_at
    from observations o
    where o.student_id in (select student_id from cls_students)
    group by o.student_id
  ),
  agg as (
    select
      o.student_id,
      o.dimension_id,
      avg(o.rating) filter (where o.observed_at >= date_trunc('month', now())) as cm_avg,
      count(*)     filter (where o.observed_at >= date_trunc('month', now())) as cm_count,
      (array_agg(o.rating order by o.observed_at desc))[1] as latest_rating
    from observations o
    where o.student_id in (select student_id from cls_students)
    group by o.student_id, o.dimension_id
  )
  select
    a.student_id,
    a.dimension_id,
    (case when a.cm_count > 0 then a.cm_avg else a.latest_rating end)::numeric as competency,
    coalesce(a.cm_count, 0)::integer as current_month_count,
    e.earliest_observed_at
  from agg a
  join earliest e on e.student_id = a.student_id;
$$;

grant execute on function classroom_current_scores(uuid) to authenticated;

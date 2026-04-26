-- 070_classroom_display_order.sql
-- Adds a `display_order` column to classrooms so admins can drag-to-reorder
-- the cards on the Classrooms page and the rows on the Departments / Locations
-- page. Order is scoped per (school_id, department_id) — each group has its
-- own 1..N sequence.

alter table classrooms
  add column if not exists display_order integer;

-- Backfill: stable order per group, alphabetical by name.
-- Uses row_number() partitioned by (school_id, department_id) so each
-- department's classrooms get a fresh 1..N sequence. NULL department_id is
-- treated as a single "Unassigned" group per school.
update classrooms c
set display_order = sub.rn
from (
  select
    id,
    row_number() over (
      partition by school_id, coalesce(department_id::text, '__unassigned__')
      order by name
    ) as rn
  from classrooms
) sub
where c.id = sub.id
  and c.display_order is null;

-- Composite index used when fetching classrooms grouped by department and
-- sorted by display_order.
create index if not exists idx_classrooms_school_dept_order
  on classrooms(school_id, department_id, display_order);

-- 018_student_number_linking.sql
-- Add student_number column and RPC for family linking by student number.

-- 1. Add student_number column
alter table students add column if not exists student_number text;

create unique index if not exists idx_students_student_number
  on students(student_number) where student_number is not null;

-- 2. Auto-generate student numbers for existing students that don't have one.
--    Format: school-prefix + sequential number, e.g. "1001", "1002", ...
do $$
declare
  s record;
  seq int := 1001;
begin
  for s in
    select id from students
    where student_number is null
    order by created_at
  loop
    -- Find next unused number
    while exists (select 1 from students where student_number = seq::text) loop
      seq := seq + 1;
    end loop;
    update students set student_number = seq::text where id = s.id;
    seq := seq + 1;
  end loop;
end $$;

-- 3. Auto-assign student_number on insert if not provided
create or replace function assign_student_number()
returns trigger as $$
declare
  next_num int;
begin
  if new.student_number is null then
    select coalesce(max(student_number::int), 1000) + 1
    into next_num
    from students
    where student_number ~ '^\d+$';

    new.student_number := next_num::text;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_students_assign_student_number on students;
create trigger trg_students_assign_student_number
  before insert on students
  for each row execute function assign_student_number();

-- 4. RPC for parents to link by student number
create or replace function link_student_by_number(p_number text)
returns json as $$
declare
  v_student_id uuid;
  v_school_id uuid;
  v_parent_school_id uuid;
  v_parent_role user_role;
begin
  -- Get caller's school and role
  select school_id, role into v_parent_school_id, v_parent_role
  from profiles where id = auth.uid();

  if v_parent_school_id is null then
    return json_build_object('error', 'Profile not found');
  end if;

  if v_parent_role <> 'parent' then
    return json_build_object('error', 'Only family accounts can link learners.');
  end if;

  -- Look up student by student_number
  select id, school_id into v_student_id, v_school_id
  from students
  where trim(student_number) = trim(p_number)
    and student_status = 'active';

  if v_student_id is null then
    return json_build_object('error', 'No active student found with that number. Please check and try again.');
  end if;

  -- Must be same school
  if v_school_id <> v_parent_school_id then
    return json_build_object('error', 'No active student found with that number. Please check and try again.');
  end if;

  -- Already linked?
  if exists (
    select 1 from parent_students
    where parent_id = auth.uid() and student_id = v_student_id
  ) then
    return json_build_object('error', 'This learner is already linked to your account.');
  end if;

  -- Insert the link
  insert into parent_students (parent_id, student_id, school_id)
  values (auth.uid(), v_student_id, v_school_id);

  return json_build_object('success', true, 'student_id', v_student_id);
end;
$$ language plpgsql security definer;

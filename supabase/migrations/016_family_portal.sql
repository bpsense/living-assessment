-- 016_family_portal.sql
-- Family portal: unique student codes, parent self-linking, family invite support.

-- ============================================================
-- 1. Generate a random 6-char uppercase alphanumeric code
--    Uses confusable-free charset (no I, O, 0, 1).
-- ============================================================
create or replace function generate_family_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- ============================================================
-- 2. Add family_code column to students
-- ============================================================
alter table students add column family_code text;

create unique index idx_students_family_code
  on students(family_code) where family_code is not null;

-- ============================================================
-- 3. Backfill existing students with generated codes
-- ============================================================
do $$
declare
  s record;
  new_code text;
  done boolean;
begin
  for s in select id from students where family_code is null loop
    done := false;
    while not done loop
      new_code := generate_family_code();
      begin
        update students set family_code = new_code where id = s.id;
        done := true;
      exception when unique_violation then
        done := false;
      end;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- 4. Auto-assign family_code on new student insert
-- ============================================================
create or replace function assign_family_code()
returns trigger as $$
declare
  new_code text;
  collision boolean := true;
begin
  if new.family_code is null then
    while collision loop
      new_code := generate_family_code();
      -- Check if code already exists
      if not exists (select 1 from students where family_code = new_code) then
        new.family_code := new_code;
        collision := false;
      end if;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_students_assign_family_code
  before insert on students
  for each row execute function assign_family_code();

-- ============================================================
-- 5. Regenerate a student's family code (admin / educator use)
-- ============================================================
create or replace function regenerate_family_code(p_student_id uuid)
returns text as $$
declare
  new_code text;
  done boolean := false;
begin
  while not done loop
    new_code := generate_family_code();
    begin
      update students set family_code = new_code where id = p_student_id;
      done := true;
    exception when unique_violation then
      done := false;
    end;
  end loop;
  return new_code;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 6. Parent self-links to a student via family code
-- ============================================================
create or replace function link_student_by_code(p_code text)
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

  -- Look up student by family_code (case-insensitive)
  select id, school_id into v_student_id, v_school_id
  from students
  where upper(family_code) = upper(p_code)
    and student_status = 'active';

  if v_student_id is null then
    return json_build_object('error', 'Invalid code. Please check and try again.');
  end if;

  -- Must be same school
  if v_school_id <> v_parent_school_id then
    return json_build_object('error', 'Invalid code. Please check and try again.');
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

-- ============================================================
-- 7. Allow parents to unlink themselves from a student
-- ============================================================
create policy "parent_students_delete_own"
  on parent_students for delete
  using (parent_id = auth.uid());

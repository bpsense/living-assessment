-- 019_random_student_numbers.sql
-- Switch student numbers from sequential integers to random 8-char
-- alphanumeric codes (upper + lower + digits) to prevent guessing.

-- 1. Helper: generate a random 8-char code (A-Z, a-z, 0-9)
create or replace function generate_random_student_number()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- 2. Replace the trigger function to use random codes instead of sequential
create or replace function assign_student_number()
returns trigger as $$
declare
  candidate text;
begin
  if new.student_number is null then
    loop
      candidate := generate_random_student_number();
      -- Ensure uniqueness (unique index will also enforce this)
      exit when not exists (
        select 1 from students where student_number = candidate
      );
    end loop;
    new.student_number := candidate;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3. Backfill existing students that still have sequential numeric codes
--    Replace them with random codes so they can't be guessed either.
do $$
declare
  s record;
  candidate text;
begin
  for s in
    select id from students
    where student_number ~ '^\d+$'
    order by created_at
  loop
    loop
      candidate := generate_random_student_number();
      exit when not exists (
        select 1 from students where student_number = candidate
      );
    end loop;
    update students set student_number = candidate where id = s.id;
  end loop;
end $$;

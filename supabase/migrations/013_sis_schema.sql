-- 013_sis_schema.sql
-- Student Information System: extended student fields, contacts, teacher notes, attendance

-- ============================================================
-- 1. Extend students table with SIS fields
-- ============================================================
alter table students add column middle_name text;
alter table students add column preferred_name text;
alter table students add column pronouns text;
alter table students add column nationality text;
alter table students add column first_language text;
alter table students add column additional_languages text[];
alter table students add column medical_conditions text;
alter table students add column student_support_needs text;
alter table students add column dietary_restrictions text;
alter table students add column medications text;
alter table students add column enrollment_date date;
alter table students add column student_status text not null default 'active'
  check (student_status in ('active', 'inactive', 'withdrawn'));

-- ============================================================
-- 2. student_contacts
-- ============================================================
create table student_contacts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  contact_type  text not null check (contact_type in ('parent', 'guardian', 'emergency')),
  full_name     text not null,
  relationship  text,
  phone         text,
  email         text,
  is_primary    boolean not null default false,
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_student_contacts_student on student_contacts(student_id);
create index idx_student_contacts_school  on student_contacts(school_id);

-- ============================================================
-- 3. teacher_notes
-- ============================================================
create table teacher_notes (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  author_id       uuid not null references profiles(id) on delete cascade,
  content         text not null,
  note_type       text not null default 'general'
    check (note_type in ('general', 'academic', 'behavioral', 'social-emotional', 'medical')),
  is_confidential boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_teacher_notes_student on teacher_notes(student_id);
create index idx_teacher_notes_author  on teacher_notes(author_id);
create index idx_teacher_notes_school  on teacher_notes(school_id);

-- ============================================================
-- 4. attendance_records (schema only — future UI)
-- ============================================================
create table attendance_records (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  classroom_id  uuid not null references classrooms(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  date          date not null,
  status        text not null check (status in ('present', 'absent', 'tardy', 'excused')),
  notes         text,
  recorded_by   uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, date)
);

create index idx_attendance_student   on attendance_records(student_id);
create index idx_attendance_classroom on attendance_records(classroom_id);
create index idx_attendance_date      on attendance_records(date);
create index idx_attendance_school    on attendance_records(school_id);

-- ============================================================
-- 5. updated_at triggers for new tables
-- ============================================================
create trigger trg_student_contacts_updated_at
  before update on student_contacts
  for each row execute function set_updated_at();

create trigger trg_teacher_notes_updated_at
  before update on teacher_notes
  for each row execute function set_updated_at();

create trigger trg_attendance_records_updated_at
  before update on attendance_records
  for each row execute function set_updated_at();

-- ============================================================
-- 6. RLS — student_contacts
-- ============================================================
alter table student_contacts enable row level security;

create policy "student_contacts_select_staff"
  on student_contacts for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_contacts_select_parent"
  on student_contacts for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

create policy "student_contacts_insert"
  on student_contacts for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_contacts_update"
  on student_contacts for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "student_contacts_delete_admin"
  on student_contacts for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- 7. RLS — teacher_notes
-- ============================================================
alter table teacher_notes enable row level security;

create policy "teacher_notes_select_admin"
  on teacher_notes for select
  using (school_id = auth_school_id() and auth_role() = 'admin');

create policy "teacher_notes_select_educator"
  on teacher_notes for select
  using (school_id = auth_school_id() and auth_role() = 'educator');

create policy "teacher_notes_select_parent"
  on teacher_notes for select
  using (
    auth_role() = 'parent'
    and is_confidential = false
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

create policy "teacher_notes_insert"
  on teacher_notes for insert
  with check (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
    and author_id = auth.uid()
  );

create policy "teacher_notes_update"
  on teacher_notes for update
  using (
    school_id = auth_school_id()
    and (author_id = auth.uid() or auth_role() = 'admin')
  )
  with check (school_id = auth_school_id());

create policy "teacher_notes_delete"
  on teacher_notes for delete
  using (
    school_id = auth_school_id()
    and (author_id = auth.uid() or auth_role() = 'admin')
  );

-- ============================================================
-- 8. RLS — attendance_records
-- ============================================================
alter table attendance_records enable row level security;

create policy "attendance_select_staff"
  on attendance_records for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "attendance_select_parent"
  on attendance_records for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

create policy "attendance_insert"
  on attendance_records for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "attendance_update"
  on attendance_records for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "attendance_delete_admin"
  on attendance_records for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

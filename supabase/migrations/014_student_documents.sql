-- 014_student_documents.sql
-- Document uploads for student profiles and teacher-note file manager with folders.
-- Reuses the existing "school-documents" storage bucket from migration 012.

-- ============================================================
-- 1. student_documents — files attached to a student's SIS profile
-- ============================================================

create table student_documents (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  file_type   text not null,
  file_size   bigint not null,
  description text,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_student_documents_student on student_documents(student_id);
create index idx_student_documents_school  on student_documents(school_id);

create trigger trg_student_documents_updated_at
  before update on student_documents
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table student_documents enable row level security;

create policy "student_documents_select_staff"
  on student_documents for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_documents_select_parent"
  on student_documents for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

create policy "student_documents_insert"
  on student_documents for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_documents_update"
  on student_documents for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "student_documents_delete"
  on student_documents for delete
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

-- ============================================================
-- 2. teacher_note_folders — folders for organising teacher files
-- ============================================================

create table teacher_note_folders (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  created_by  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_teacher_note_folders_student on teacher_note_folders(student_id);
create index idx_teacher_note_folders_school  on teacher_note_folders(school_id);

create trigger trg_teacher_note_folders_updated_at
  before update on teacher_note_folders
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table teacher_note_folders enable row level security;

create policy "teacher_note_folders_select_staff"
  on teacher_note_folders for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "teacher_note_folders_insert"
  on teacher_note_folders for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "teacher_note_folders_update"
  on teacher_note_folders for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "teacher_note_folders_delete"
  on teacher_note_folders for delete
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

-- ============================================================
-- 3. teacher_note_files — files inside (or outside) folders
-- ============================================================

create table teacher_note_files (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid references teacher_note_folders(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  file_type   text not null,
  file_size   bigint not null,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_teacher_note_files_folder  on teacher_note_files(folder_id);
create index idx_teacher_note_files_student on teacher_note_files(student_id);
create index idx_teacher_note_files_school  on teacher_note_files(school_id);

create trigger trg_teacher_note_files_updated_at
  before update on teacher_note_files
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table teacher_note_files enable row level security;

create policy "teacher_note_files_select_staff"
  on teacher_note_files for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "teacher_note_files_insert"
  on teacher_note_files for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "teacher_note_files_update"
  on teacher_note_files for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "teacher_note_files_delete"
  on teacher_note_files for delete
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

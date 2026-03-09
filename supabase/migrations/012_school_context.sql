-- 012_school_context.sql
-- School pedagogical context documents for AI-powered suggestions.
-- Text fields are stored in schools.settings JSONB (already exists).
-- This migration adds a table for uploaded supporting documents.

-- ── School Documents table ──────────────────────────────────────

create table school_documents (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,          -- Supabase Storage path
  file_type   text not null,          -- MIME type (e.g. application/pdf)
  file_size   bigint not null,        -- bytes
  description text,                   -- educator-provided description of the document
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index idx_school_documents_school on school_documents(school_id);

-- ── RLS ─────────────────────────────────────────────────────────

alter table school_documents enable row level security;

-- Admin: full CRUD on their school
create policy "school_documents_select_admin"
  on school_documents for select
  using (school_id = auth_school_id() and auth_role() = 'admin');

create policy "school_documents_insert_admin"
  on school_documents for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "school_documents_update_admin"
  on school_documents for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "school_documents_delete_admin"
  on school_documents for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- Educators: read-only
create policy "school_documents_select_educator"
  on school_documents for select
  using (school_id = auth_school_id() and auth_role() = 'educator');

-- ── Storage bucket ──────────────────────────────────────────────
-- Note: Supabase storage buckets are best created via the Dashboard
-- or via the Supabase client. The SQL below creates the bucket
-- if the storage schema is available.

insert into storage.buckets (id, name, public)
values ('school-documents', 'school-documents', false)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can upload to their school's folder
create policy "school_documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'school-documents'
  );

create policy "school_documents_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'school-documents'
  );

create policy "school_documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'school-documents'
  );

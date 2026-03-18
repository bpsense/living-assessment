-- 021_global_standards.sql
-- "All Schools" standards: global template tables + auto-distribution.
--
-- When an admin uploads a framework from the "All Schools" view, it is stored
-- in global_standards_frameworks / global_standards (the canonical template).
-- A SECURITY DEFINER function then copies it to every school's
-- standards_frameworks / standards.  A trigger ensures new schools
-- automatically receive all global templates on creation.
-- Individual school admins can delete their copy without affecting others.

-- ============================================================
-- 1. Global template tables
-- ============================================================

create table global_standards_frameworks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  version     text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table global_standards (
  id              uuid primary key default gen_random_uuid(),
  framework_id    uuid not null references global_standards_frameworks(id) on delete cascade,
  code            text not null,
  description     text not null,
  grade_level     text,
  parent_id       uuid references global_standards(id),
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 2. Add tracking column to existing standards_frameworks
-- ============================================================

alter table standards_frameworks
  add column if not exists global_framework_id uuid
    references global_standards_frameworks(id) on delete set null;

-- ============================================================
-- 3. RLS
-- ============================================================

alter table global_standards_frameworks enable row level security;
alter table global_standards            enable row level security;

-- All authenticated users can read global templates
create policy "global_fw_select"
  on global_standards_frameworks for select
  using (auth.role() = 'authenticated');

create policy "global_std_select"
  on global_standards for select
  using (auth.role() = 'authenticated');

-- Only admins can manage global templates
create policy "global_fw_insert_admin"
  on global_standards_frameworks for insert
  with check (auth_role() = 'admin');

create policy "global_fw_update_admin"
  on global_standards_frameworks for update
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy "global_fw_delete_admin"
  on global_standards_frameworks for delete
  using (auth_role() = 'admin');

create policy "global_std_insert_admin"
  on global_standards for insert
  with check (auth_role() = 'admin');

create policy "global_std_update_admin"
  on global_standards for update
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy "global_std_delete_admin"
  on global_standards for delete
  using (auth_role() = 'admin');

-- ============================================================
-- 4. distribute_global_framework(p_global_framework_id)
--    Copies a single global framework + standards to every school
--    that doesn't already have a copy (checked via global_framework_id).
-- ============================================================

create or replace function distribute_global_framework(p_global_framework_id uuid)
returns void as $$
declare
  v_school   record;
  v_gfw      record;
  v_new_fw_id uuid;
  v_id_map   jsonb;    -- maps global_standard.id → new standard.id
  v_gs       record;
begin
  -- Fetch the global framework
  select * into v_gfw
    from global_standards_frameworks
   where id = p_global_framework_id;

  if v_gfw.id is null then
    raise exception 'Global framework % not found', p_global_framework_id;
  end if;

  -- Iterate over every school
  for v_school in select id from schools loop
    -- Skip if this school already has a copy
    if exists (
      select 1 from standards_frameworks
       where school_id = v_school.id
         and global_framework_id = p_global_framework_id
    ) then
      continue;
    end if;

    -- Insert framework copy
    v_new_fw_id := gen_random_uuid();
    insert into standards_frameworks (id, school_id, name, description, version, global_framework_id)
    values (v_new_fw_id, v_school.id, v_gfw.name, v_gfw.description, v_gfw.version, p_global_framework_id);

    -- Build ID mapping for parent references
    -- First pass: insert standards with no parent (parent_id is null)
    v_id_map := '{}'::jsonb;

    for v_gs in
      select * from global_standards
       where framework_id = p_global_framework_id
         and parent_id is null
       order by display_order
    loop
      declare
        v_new_std_id uuid := gen_random_uuid();
      begin
        insert into standards (id, framework_id, school_id, code, description, grade_level, parent_id, display_order)
        values (v_new_std_id, v_new_fw_id, v_school.id, v_gs.code, v_gs.description, v_gs.grade_level, null, v_gs.display_order);

        v_id_map := v_id_map || jsonb_build_object(v_gs.id::text, v_new_std_id::text);
      end;
    end loop;

    -- Second pass: insert standards with parents (recursively handle depth)
    -- Use a recursive CTE to process level by level
    declare
      v_remaining int := 1;
    begin
      while v_remaining > 0 loop
        v_remaining := 0;
        for v_gs in
          select * from global_standards
           where framework_id = p_global_framework_id
             and parent_id is not null
             and v_id_map ? parent_id::text          -- parent already mapped
             and not (v_id_map ? id::text)           -- this one not yet mapped
           order by display_order
        loop
          declare
            v_new_std_id uuid := gen_random_uuid();
            v_new_parent_id uuid := (v_id_map ->> v_gs.parent_id::text)::uuid;
          begin
            insert into standards (id, framework_id, school_id, code, description, grade_level, parent_id, display_order)
            values (v_new_std_id, v_new_fw_id, v_school.id, v_gs.code, v_gs.description, v_gs.grade_level, v_new_parent_id, v_gs.display_order);

            v_id_map := v_id_map || jsonb_build_object(v_gs.id::text, v_new_std_id::text);
            v_remaining := v_remaining + 1;
          end;
        end loop;
      end loop;
    end;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 5. provision_school_global_standards(p_school_id)
--    Copies ALL global frameworks to a single school.
--    Called by the trigger when a new school is created.
-- ============================================================

create or replace function provision_school_global_standards(p_school_id uuid)
returns void as $$
declare
  v_gfw      record;
  v_new_fw_id uuid;
  v_id_map   jsonb;
  v_gs       record;
begin
  for v_gfw in select * from global_standards_frameworks order by name loop
    -- Skip if already provisioned
    if exists (
      select 1 from standards_frameworks
       where school_id = p_school_id
         and global_framework_id = v_gfw.id
    ) then
      continue;
    end if;

    -- Insert framework copy
    v_new_fw_id := gen_random_uuid();
    insert into standards_frameworks (id, school_id, name, description, version, global_framework_id)
    values (v_new_fw_id, p_school_id, v_gfw.name, v_gfw.description, v_gfw.version, v_gfw.id);

    -- Copy standards: roots first
    v_id_map := '{}'::jsonb;

    for v_gs in
      select * from global_standards
       where framework_id = v_gfw.id
         and parent_id is null
       order by display_order
    loop
      declare
        v_new_std_id uuid := gen_random_uuid();
      begin
        insert into standards (id, framework_id, school_id, code, description, grade_level, parent_id, display_order)
        values (v_new_std_id, v_new_fw_id, p_school_id, v_gs.code, v_gs.description, v_gs.grade_level, null, v_gs.display_order);
        v_id_map := v_id_map || jsonb_build_object(v_gs.id::text, v_new_std_id::text);
      end;
    end loop;

    -- Copy standards: children level by level
    declare
      v_remaining int := 1;
    begin
      while v_remaining > 0 loop
        v_remaining := 0;
        for v_gs in
          select * from global_standards
           where framework_id = v_gfw.id
             and parent_id is not null
             and v_id_map ? parent_id::text
             and not (v_id_map ? id::text)
           order by display_order
        loop
          declare
            v_new_std_id uuid := gen_random_uuid();
            v_new_parent_id uuid := (v_id_map ->> v_gs.parent_id::text)::uuid;
          begin
            insert into standards (id, framework_id, school_id, code, description, grade_level, parent_id, display_order)
            values (v_new_std_id, v_new_fw_id, p_school_id, v_gs.code, v_gs.description, v_gs.grade_level, v_new_parent_id, v_gs.display_order);
            v_id_map := v_id_map || jsonb_build_object(v_gs.id::text, v_new_std_id::text);
            v_remaining := v_remaining + 1;
          end;
        end loop;
      end loop;
    end;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 6. Trigger: auto-provision new schools with global standards
-- ============================================================

create or replace function on_school_created_provision_standards()
returns trigger as $$
begin
  perform provision_school_global_standards(new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_school_created_provision_standards on schools;
create trigger trg_school_created_provision_standards
  after insert on schools
  for each row execute function on_school_created_provision_standards();

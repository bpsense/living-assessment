-- 028_competency_frameworks.sql
-- Competency framework tables: school-scoped curriculum competency definitions
-- with hierarchical structure (framework → domain → subdomain → competency)
-- and developmental step descriptors per grade/age level.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists competency_frameworks (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  description text,
  version     text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists competency_domains (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid not null references competency_frameworks(id) on delete cascade,
  name          text not null,
  display_order integer not null default 0,
  code_prefix   text,
  created_at    timestamptz not null default now()
);

create table if not exists competency_subdomains (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null references competency_domains(id) on delete cascade,
  name          text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists competencies (
  id                uuid primary key default gen_random_uuid(),
  subdomain_id      uuid not null references competency_subdomains(id) on delete cascade,
  framework_id      uuid not null references competency_frameworks(id) on delete cascade,
  code              text not null,
  name              text not null,
  objective         text,
  step_descriptors  jsonb not null default '{}',
  -- step_descriptors shape:
  -- { "E1": "descriptor text", "E2": "...", ..., "E6": "...",
  --   "1": "...", "2": "...", ..., "10": "..." }
  -- Keys E1-E6 = early years, 1-10 = grade levels
  created_at        timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_comp_frameworks_school on competency_frameworks(school_id);
create index idx_comp_frameworks_default on competency_frameworks(school_id, is_default);
create index idx_comp_domains_framework on competency_domains(framework_id);
create index idx_comp_subdomains_domain on competency_subdomains(domain_id);
create index idx_competencies_subdomain on competencies(subdomain_id);
create index idx_competencies_framework on competencies(framework_id);
create index idx_competencies_code on competencies(framework_id, code);

-- ============================================================
-- Triggers
-- ============================================================

create trigger set_competency_frameworks_updated_at
  before update on competency_frameworks
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table competency_frameworks enable row level security;
alter table competency_domains enable row level security;
alter table competency_subdomains enable row level security;
alter table competencies enable row level security;

-- Frameworks: school members can read, admins/educators can write
create policy "competency_frameworks_select"
  on competency_frameworks for select to authenticated
  using (school_id in (select school_id from profiles where id = auth.uid()));

create policy "competency_frameworks_insert"
  on competency_frameworks for insert to authenticated
  with check (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "competency_frameworks_update"
  on competency_frameworks for update to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "competency_frameworks_delete"
  on competency_frameworks for delete to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Domains: readable by school members (inherits from framework FK)
create policy "competency_domains_select"
  on competency_domains for select to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "competency_domains_insert"
  on competency_domains for insert to authenticated
  with check (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competency_domains_update"
  on competency_domains for update to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competency_domains_delete"
  on competency_domains for delete to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

-- Subdomains: same pattern
create policy "competency_subdomains_select"
  on competency_subdomains for select to authenticated
  using (
    domain_id in (
      select cd.id from competency_domains cd
      join competency_frameworks cf on cf.id = cd.framework_id
      where cf.school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "competency_subdomains_insert"
  on competency_subdomains for insert to authenticated
  with check (
    domain_id in (
      select cd.id from competency_domains cd
      join competency_frameworks cf on cf.id = cd.framework_id
      where cf.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competency_subdomains_update"
  on competency_subdomains for update to authenticated
  using (
    domain_id in (
      select cd.id from competency_domains cd
      join competency_frameworks cf on cf.id = cd.framework_id
      where cf.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competency_subdomains_delete"
  on competency_subdomains for delete to authenticated
  using (
    domain_id in (
      select cd.id from competency_domains cd
      join competency_frameworks cf on cf.id = cd.framework_id
      where cf.school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

-- Competencies: same pattern
create policy "competencies_select"
  on competencies for select to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "competencies_insert"
  on competencies for insert to authenticated
  with check (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competencies_update"
  on competencies for update to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "competencies_delete"
  on competencies for delete to authenticated
  using (
    framework_id in (
      select id from competency_frameworks
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

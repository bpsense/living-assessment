-- 074_competency_domain_dimension_map.sql
-- The bridge table that lets a school's competency framework (standards) feed
-- the school's amoeba dimensions (Learner Profile lobes). Because each school
-- now owns both layers independently, a name-match rollup is no longer valid.
--
-- One competency_domain may map to a single dimension per school; a single
-- dimension may receive from multiple domains. Domains without a row do not
-- contribute to any amoeba lobe.

create table if not exists competency_domain_dimension_map (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  competency_domain_id  uuid not null references competency_domains(id) on delete cascade,
  dimension_id          uuid not null references dimensions(id) on delete cascade,
  created_at            timestamptz not null default now(),
  unique (school_id, competency_domain_id, dimension_id)
);

-- Single mapping target per school+domain (a domain maps to ONE dimension)
create unique index if not exists uq_cddm_one_dimension_per_domain
  on competency_domain_dimension_map(school_id, competency_domain_id);

create index if not exists idx_cddm_school     on competency_domain_dimension_map(school_id);
create index if not exists idx_cddm_dimension  on competency_domain_dimension_map(dimension_id);

-- ============================================================
-- RLS
-- ============================================================

alter table competency_domain_dimension_map enable row level security;

create policy "cddm_select"
  on competency_domain_dimension_map for select to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  );

create policy "cddm_insert"
  on competency_domain_dimension_map for insert to authenticated
  with check (
    is_system_admin()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "cddm_update"
  on competency_domain_dimension_map for update to authenticated
  using (
    is_system_admin()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    is_system_admin()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "cddm_delete"
  on competency_domain_dimension_map for delete to authenticated
  using (
    is_system_admin()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 020_student_context.sql
-- Adds parent notes, student context documents, and the compile RPC.

-- ============================================================
-- 1. parent_notes — parents contribute context about their child
-- ============================================================

create table parent_notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  content     text not null,
  note_type   text not null default 'general'
    check (note_type in ('home-interests', 'strengths', 'concerns', 'context', 'general')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_parent_notes_student on parent_notes(student_id);
create index idx_parent_notes_author  on parent_notes(author_id);
create index idx_parent_notes_school  on parent_notes(school_id);

create trigger trg_parent_notes_updated_at
  before update on parent_notes
  for each row execute function set_updated_at();

-- ============================================================
-- 2. student_context_documents — cached compiled context per student
-- ============================================================

create table student_context_documents (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  content_hash    text not null,
  markdown        text not null,
  compiled_at     timestamptz not null default now(),
  compiled_by     uuid references profiles(id) on delete set null,
  token_estimate  int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id)
);

create index idx_student_context_student on student_context_documents(student_id);
create index idx_student_context_school  on student_context_documents(school_id);

create trigger trg_student_context_updated_at
  before update on student_context_documents
  for each row execute function set_updated_at();

-- ============================================================
-- 3. RLS — parent_notes
-- ============================================================

alter table parent_notes enable row level security;

-- Staff can read all parent notes in their school
create policy "parent_notes_select_staff"
  on parent_notes for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

-- Parents can see their own notes for linked students
create policy "parent_notes_select_parent"
  on parent_notes for select
  using (
    auth_role() = 'parent'
    and author_id = auth.uid()
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Parents can insert notes for linked students
create policy "parent_notes_insert_parent"
  on parent_notes for insert
  with check (
    auth_role() = 'parent'
    and author_id = auth.uid()
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Parents can update their own notes
create policy "parent_notes_update_parent"
  on parent_notes for update
  using (author_id = auth.uid() and auth_role() = 'parent')
  with check (author_id = auth.uid());

-- Parents can delete their own notes
create policy "parent_notes_delete_parent"
  on parent_notes for delete
  using (author_id = auth.uid() and auth_role() = 'parent');

-- Admins can delete any parent note in their school
create policy "parent_notes_delete_admin"
  on parent_notes for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- 4. RLS — student_context_documents
-- ============================================================

alter table student_context_documents enable row level security;

create policy "context_docs_select_staff"
  on student_context_documents for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "context_docs_select_parent"
  on student_context_documents for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

create policy "context_docs_insert_staff"
  on student_context_documents for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "context_docs_update_staff"
  on student_context_documents for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

-- ============================================================
-- 5. compile_student_context RPC
-- ============================================================

create or replace function compile_student_context(p_student_id uuid)
returns json as $$
declare
  v_student    record;
  v_classroom  record;
  v_school     record;
  v_md         text := '';
  v_obs_count  int;
  v_hash       text;
  r            record;
  v_survey_id  uuid;
begin
  -- 1. Fetch student
  select * into v_student from students where id = p_student_id;
  if v_student is null then
    return json_build_object('error', 'Student not found');
  end if;

  -- 2. Fetch classroom & school
  select * into v_classroom from classrooms where id = v_student.classroom_id;
  select * into v_school from schools where id = v_student.school_id;

  -- ================================================================
  -- BUILD MARKDOWN DOCUMENT
  -- ================================================================

  -- Section 1: Identity & Background
  v_md := '# Student Context: ' || v_student.first_name || ' ' || v_student.last_name || E'\n\n';
  v_md := v_md || '## Identity & Background' || E'\n';
  v_md := v_md || '- **Name:** ' || coalesce(v_student.preferred_name, v_student.first_name) || ' ' || v_student.last_name || E'\n';
  if v_student.pronouns is not null then
    v_md := v_md || '- **Pronouns:** ' || v_student.pronouns || E'\n';
  end if;
  v_md := v_md || '- **Grade:** ' || coalesce(v_student.grade_level, 'Not specified') || E'\n';
  if v_classroom is not null then
    v_md := v_md || '- **Classroom:** ' || v_classroom.name || E'\n';
  end if;
  if v_student.date_of_birth is not null then
    v_md := v_md || '- **Age:** ' || extract(year from age(v_student.date_of_birth))::text || ' years' || E'\n';
  end if;
  if v_student.nationality is not null then
    v_md := v_md || '- **Nationality:** ' || v_student.nationality || E'\n';
  end if;
  if v_student.first_language is not null then
    v_md := v_md || '- **First Language:** ' || v_student.first_language || E'\n';
  end if;
  if v_student.additional_languages is not null and array_length(v_student.additional_languages, 1) > 0 then
    v_md := v_md || '- **Additional Languages:** ' || array_to_string(v_student.additional_languages, ', ') || E'\n';
  end if;
  if v_student.student_support_needs is not null then
    v_md := v_md || '- **Support Needs:** ' || v_student.student_support_needs || E'\n';
  end if;
  v_md := v_md || E'\n';

  -- Section 2: Current Competency Profile
  v_md := v_md || '## Current Competency Profile' || E'\n';
  for r in
    select * from compute_all_competency_scores(p_student_id)
  loop
    if r.score > 0 then
      v_md := v_md || '- **' || r.dimension_name || ':** ' || round(r.score, 1)::text || '/4' || E'\n';
    else
      v_md := v_md || '- **' || r.dimension_name || ':** No observations yet' || E'\n';
    end if;
  end loop;
  v_md := v_md || E'\n';

  -- Section 3: Interest Profile (latest survey)
  v_md := v_md || '## Interest Profile (Latest Survey)' || E'\n';

  select id into v_survey_id
    from interest_surveys
    where student_id = p_student_id
    order by submitted_at desc
    limit 1;

  if v_survey_id is null then
    v_md := v_md || '_No interest survey completed yet._' || E'\n';
  else
    for r in
      select d.name as dimension_name,
             (is2.responses->>d.id::text)::numeric as interest_score
      from interest_surveys is2
      cross join dimensions d
      where is2.id = v_survey_id
        and d.school_id = v_student.school_id
        and d.is_active = true
      order by d.display_order
    loop
      if r.interest_score is not null then
        v_md := v_md || '- **' || r.dimension_name || ':** ' || round(r.interest_score, 1)::text || '/5' || E'\n';
      end if;
    end loop;
  end if;
  v_md := v_md || E'\n';

  -- Section 4: Learning Zones
  v_md := v_md || '## Learning Zones' || E'\n';
  v_md := v_md || '_Growth = high interest + developing skill, Mastery = high interest + strong skill, ';
  v_md := v_md || 'Cruise = strong skill + lower interest, Explore = developing in both._' || E'\n\n';

  for r in
    with scores as (
      select d.name as dim_name,
             coalesce(cs.score, 0) as comp,
             coalesce((
               select (is2.responses->>d.id::text)::numeric
               from interest_surveys is2
               where is2.student_id = p_student_id
               order by is2.submitted_at desc limit 1
             ), 0) as intr
      from dimensions d
      left join compute_all_competency_scores(p_student_id) cs on cs.dimension_id = d.id
      where d.school_id = v_student.school_id and d.is_active = true
      order by d.display_order
    )
    select dim_name, comp, intr,
           case
             when intr >= 2.5 and comp < 2.5 then 'Growth'
             when intr >= 2.5 and comp >= 2.5 then 'Mastery'
             when intr < 2.5 and comp >= 2.5 then 'Cruise'
             else 'Explore'
           end as zone
    from scores
    where comp > 0 or intr > 0
  loop
    v_md := v_md || '- **' || r.dim_name || ':** ' || r.zone;
    v_md := v_md || ' (competency ' || round(r.comp, 1)::text || ', interest ' || round(r.intr, 1)::text || ')' || E'\n';
  end loop;
  v_md := v_md || E'\n';

  -- Section 5: Recent Observations (last 6 months, max 30)
  v_md := v_md || '## Recent Educator Observations (Last 6 Months)' || E'\n';
  select count(*) into v_obs_count
    from observations
    where student_id = p_student_id
      and observed_at >= now() - interval '6 months';

  if v_obs_count = 0 then
    v_md := v_md || '_No observations in the last 6 months._' || E'\n';
  else
    for r in
      select o.observed_at, d.name as dim_name,
             round(o.rating::numeric, 1)::text as rating_text,
             o.notes, p.full_name as observer_name
      from observations o
      join dimensions d on d.id = o.dimension_id
      join profiles p on p.id = o.observer_id
      where o.student_id = p_student_id
        and o.observed_at >= now() - interval '6 months'
      order by o.observed_at desc
      limit 30
    loop
      v_md := v_md || '- **' || to_char(r.observed_at, 'YYYY-MM-DD') || '** ';
      v_md := v_md || r.dim_name || ' — rated ' || r.rating_text || '/4';
      if r.notes is not null and length(r.notes) > 0 then
        v_md := v_md || E'\n  > ' || left(r.notes, 300);
        if length(r.notes) > 300 then v_md := v_md || '…'; end if;
      end if;
      v_md := v_md || E'\n';
    end loop;
    if v_obs_count > 30 then
      v_md := v_md || '_(' || (v_obs_count - 30)::text || ' older observations omitted)_' || E'\n';
    end if;
  end if;
  v_md := v_md || E'\n';

  -- Section 6: Educator Notes (non-confidential, last 6 months, max 20)
  v_md := v_md || '## Educator Notes (Last 6 Months)' || E'\n';

  perform 1 from teacher_notes
    where student_id = p_student_id
      and is_confidential = false
      and created_at >= now() - interval '6 months'
    limit 1;

  if not found then
    v_md := v_md || '_No educator notes in the last 6 months._' || E'\n';
  else
    for r in
      select tn.created_at, tn.note_type, tn.content, p.full_name as author_name
      from teacher_notes tn
      join profiles p on p.id = tn.author_id
      where tn.student_id = p_student_id
        and tn.is_confidential = false
        and tn.created_at >= now() - interval '6 months'
      order by tn.created_at desc
      limit 20
    loop
      v_md := v_md || '- **' || to_char(r.created_at, 'YYYY-MM-DD') || '** [' || r.note_type || '] ';
      v_md := v_md || '(' || r.author_name || '): ';
      v_md := v_md || left(r.content, 500);
      if length(r.content) > 500 then v_md := v_md || '…'; end if;
      v_md := v_md || E'\n';
    end loop;
  end if;
  v_md := v_md || E'\n';

  -- Section 7: Family Input (last 6 months, max 15)
  v_md := v_md || '## Family Input' || E'\n';

  perform 1 from parent_notes
    where student_id = p_student_id
      and created_at >= now() - interval '6 months'
    limit 1;

  if not found then
    v_md := v_md || '_No family input recorded yet._' || E'\n';
  else
    for r in
      select pn.created_at, pn.note_type, pn.content, p.full_name as author_name
      from parent_notes pn
      join profiles p on p.id = pn.author_id
      where pn.student_id = p_student_id
        and pn.created_at >= now() - interval '6 months'
      order by pn.created_at desc
      limit 15
    loop
      v_md := v_md || '- **' || to_char(r.created_at, 'YYYY-MM-DD') || '** [' || r.note_type || '] ';
      v_md := v_md || '(' || r.author_name || '): ';
      v_md := v_md || left(r.content, 500);
      if length(r.content) > 500 then v_md := v_md || '…'; end if;
      v_md := v_md || E'\n';
    end loop;
  end if;
  v_md := v_md || E'\n';

  -- Section 8: School Context
  if v_school.settings is not null then
    v_md := v_md || '## School Context' || E'\n';
    if v_school.settings->>'pedagogical_approach' is not null then
      v_md := v_md || '- **Pedagogy:** ' || left(v_school.settings->>'pedagogical_approach', 300) || E'\n';
    end if;
    if v_school.settings->>'assessment_philosophy' is not null then
      v_md := v_md || '- **Assessment:** ' || left(v_school.settings->>'assessment_philosophy', 300) || E'\n';
    end if;
    if v_school.settings->>'curriculum_framework' is not null then
      v_md := v_md || '- **Curriculum:** ' || left(v_school.settings->>'curriculum_framework', 300) || E'\n';
    end if;
  end if;

  -- ================================================================
  -- COMPUTE HASH & UPSERT
  -- ================================================================
  v_hash := encode(digest(v_md, 'sha256'), 'hex');

  insert into student_context_documents (
    student_id, school_id, content_hash, markdown,
    compiled_at, compiled_by, token_estimate
  ) values (
    p_student_id, v_student.school_id, v_hash, v_md,
    now(), auth.uid(), length(v_md) / 4
  )
  on conflict (student_id) do update set
    content_hash   = excluded.content_hash,
    markdown       = excluded.markdown,
    compiled_at    = excluded.compiled_at,
    compiled_by    = excluded.compiled_by,
    token_estimate = excluded.token_estimate,
    updated_at     = now();

  return json_build_object(
    'success', true,
    'token_estimate', length(v_md) / 4,
    'content_hash', v_hash
  );
end;
$$ language plpgsql security definer;

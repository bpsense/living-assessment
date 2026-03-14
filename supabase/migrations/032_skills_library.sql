-- 032_skills_library.sql
-- Skills library: school-scoped, teacher-authored planning tags for assignments.
-- Skills are tagged (not scored) — they help with assignment planning,
-- portfolio search, and parent communication.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists skills (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  description text,
  category    text,          -- free-text grouping: "Communication", "Research", etc.
  min_grade   text,          -- nullable = all grades. Values match GRADE_TO_STEP keys.
  max_grade   text,          -- nullable = all grades.
  is_default  boolean not null default false,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists skill_competencies (
  id            uuid primary key default gen_random_uuid(),
  skill_id      uuid not null references skills(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (skill_id, competency_id)
);

create table if not exists assignment_skills (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  skill_id      uuid not null references skills(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, skill_id)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_skills_school on skills(school_id);
create index idx_skills_category on skills(school_id, category);
create index idx_skill_competencies_skill on skill_competencies(skill_id);
create index idx_skill_competencies_competency on skill_competencies(competency_id);
create index idx_assignment_skills_assignment on assignment_skills(assignment_id);
create index idx_assignment_skills_skill on assignment_skills(skill_id);

-- ============================================================
-- Updated_at trigger
-- ============================================================

create trigger set_skills_updated_at
  before update on skills
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table skills enable row level security;
alter table skill_competencies enable row level security;
alter table assignment_skills enable row level security;

-- Skills: readable by school members, writable by educators/admins
create policy "skills_select"
  on skills for select to authenticated
  using (
    school_id in (select school_id from profiles where id = auth.uid())
  );

create policy "skills_insert"
  on skills for insert to authenticated
  with check (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "skills_update"
  on skills for update to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "skills_delete"
  on skills for delete to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
    or created_by = auth.uid()
  );

-- Skill-competency links: readable by school, writable by educators/admins
create policy "skill_competencies_select"
  on skill_competencies for select to authenticated
  using (
    skill_id in (
      select id from skills
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "skill_competencies_insert"
  on skill_competencies for insert to authenticated
  with check (
    skill_id in (
      select id from skills
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "skill_competencies_delete"
  on skill_competencies for delete to authenticated
  using (
    skill_id in (
      select id from skills
      where school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

-- Assignment-skill links: same pattern as assignment_competencies
create policy "assignment_skills_select"
  on assignment_skills for select to authenticated
  using (
    assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "assignment_skills_insert"
  on assignment_skills for insert to authenticated
  with check (
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

create policy "assignment_skills_delete"
  on assignment_skills for delete to authenticated
  using (
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

-- ============================================================
-- Function: seed_default_skills(school_id)
-- ============================================================

create or replace function seed_default_skills(p_school_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_skill_id uuid;
  v_comp_id uuid;
  v_fw_id uuid;
begin
  -- Check if school already has default skills
  if exists (select 1 from skills where school_id = p_school_id and is_default = true limit 1) then
    return;
  end if;

  -- Find the school's default framework (needed to link skills to competencies)
  select id into v_fw_id
    from competency_frameworks
    where school_id = p_school_id and is_default = true
    limit 1;

  -- ============================================================
  -- Category: Communication & Writing
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Persuasive Writing', 'Constructing arguments and opinion pieces with supporting evidence', 'Communication & Writing', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.W.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Active Listening', 'Attending to and processing spoken communication from peers and teachers', 'Communication & Writing', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SEL.RS.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Oral Presentation', 'Communicating ideas verbally to an audience with clarity and confidence', 'Communication & Writing', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.R.3' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Creative Writing', 'Expressing ideas through narrative, poetry, or imaginative composition', 'Communication & Writing', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.W.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Research & Inquiry
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Research Skills', 'Gathering, evaluating, and synthesizing information from multiple sources', 'Research & Inquiry', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.R.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.CT.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Data Collection & Analysis', 'Systematically gathering data and interpreting patterns or results', 'Research & Inquiry', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'MATH.N.2' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SCI.P.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Evidence-Based Reasoning', 'Constructing arguments supported by data, facts, and logical analysis', 'Research & Inquiry', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.CT.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SCI.L.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Quantitative Reasoning
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Data Visualization', 'Creating charts, graphs, and visual representations of numerical data', 'Quantitative Reasoning', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'MATH.G.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Mathematical Problem Solving', 'Applying mathematical concepts and strategies to solve real-world problems', 'Quantitative Reasoning', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'MATH.N.2' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Estimation & Mental Math', 'Making reasonable numerical estimates and performing mental calculations', 'Quantitative Reasoning', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'MATH.N.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Measurement & Units', 'Using tools and standard units to measure and compare quantities', 'Quantitative Reasoning', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'MATH.G.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Scientific Thinking
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Experimental Design', 'Planning and conducting investigations with controlled variables', 'Scientific Thinking', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SCI.P.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Scientific Observation', 'Making systematic and detailed observations of natural phenomena', 'Scientific Thinking', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SCI.L.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Hypothesis Formation', 'Developing testable predictions based on prior knowledge and observations', 'Scientific Thinking', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SCI.P.2' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Creative Expression
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Visual Design', 'Creating visual compositions using color, layout, and design principles', 'Creative Expression', true)
  returning id into v_skill_id;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Storytelling', 'Crafting and delivering compelling narratives across modalities', 'Creative Expression', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.W.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Media Creation', 'Producing digital media including video, audio, or interactive content', 'Creative Expression', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.DL.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Collaboration & Leadership
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Collaborative Problem-Solving', 'Working with peers to define problems and develop solutions together', 'Collaboration & Leadership', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SEL.RS.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Conflict Resolution', 'Navigating disagreements constructively and finding mutually acceptable solutions', 'Collaboration & Leadership', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SEL.RS.2' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Peer Feedback', 'Giving and receiving constructive criticism to improve work quality', 'Collaboration & Leadership', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SEL.RS.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'ELA.W.2' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Self-Reflection', 'Evaluating own learning process, strengths, and areas for growth', 'Collaboration & Leadership', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'SEL.SA.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  -- ============================================================
  -- Category: Digital & Media Literacy
  -- ============================================================

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Digital Research', 'Using digital tools and databases to locate and evaluate information', 'Digital & Media Literacy', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.DL.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Source Evaluation', 'Assessing the credibility, bias, and reliability of information sources', 'Digital & Media Literacy', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.DL.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.CT.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

  insert into skills (school_id, name, description, category, is_default)
  values (p_school_id, 'Digital Presentation', 'Creating effective slides, videos, or interactive content for communication', 'Digital & Media Literacy', true)
  returning id into v_skill_id;
  if v_fw_id is not null then
    select id into v_comp_id from competencies where framework_id = v_fw_id and code = 'C21.DL.1' limit 1;
    if v_comp_id is not null then
      insert into skill_competencies (skill_id, competency_id) values (v_skill_id, v_comp_id);
    end if;
  end if;

end;
$$;

-- ============================================================
-- Trigger: auto-seed skills after framework is seeded
-- We chain off the existing school creation trigger — skills
-- are seeded after the framework trigger has run.
-- ============================================================

create or replace function trigger_seed_default_skills()
returns trigger
language plpgsql
security definer
as $$
begin
  perform seed_default_skills(new.id);
  return new;
end;
$$;

create trigger seed_skills_on_school_create
  after insert on schools
  for each row
  execute function trigger_seed_default_skills();

-- ============================================================
-- Backfill: seed default skills for existing schools
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select s.id from schools s
    where not exists (
      select 1 from skills sk
      where sk.school_id = s.id and sk.is_default = true
    )
  loop
    perform seed_default_skills(r.id);
  end loop;
end;
$$;

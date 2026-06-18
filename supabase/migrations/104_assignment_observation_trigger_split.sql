-- 104_assignment_observation_trigger_split.sql
--
-- Fix the amoeba-sync trigger (101). When feeds_amoeba was toggled true→false (or
-- an assignment_observation was deleted), the BEFORE trigger deleted the mirrored
-- `observations` row; the linked_observation_id FK (ON DELETE SET NULL) then tried
-- to null that column on the SAME assignment_observations row still being modified
-- by the command → ERROR 27000 "tuple to be updated was already modified".
--
-- Fix: split timing. BEFORE INSERT/UPDATE still owns NEW.linked_observation_id and
-- the mirror INSERT/UPDATE (no row-write-back). The mirror DELETE (toggle-off and
-- row delete/cascade) moves to an AFTER trigger, where the row is settled and no
-- longer references the deleted observation, so the FK SET NULL is a harmless no-op.

create or replace function sync_assignment_observation_before()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_rating numeric; v_obs uuid;
begin
  v_rating := case new.level
    when 'emerging' then 1.0 when 'developing' then 2.0
    when 'achieving' then 3.0 when 'mastery' then 4.0 end;

  if tg_op = 'INSERT' then
    if new.feeds_amoeba then
      insert into observations (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
        values (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
        returning id into v_obs;
      new.linked_observation_id := v_obs;
    end if;
    return new;
  end if;

  -- UPDATE
  if old.feeds_amoeba and not new.feeds_amoeba then
    new.linked_observation_id := null;            -- AFTER trigger deletes old.linked_observation_id
  elsif not old.feeds_amoeba and new.feeds_amoeba then
    insert into observations (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
      values (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
      returning id into v_obs;
    new.linked_observation_id := v_obs;
  elsif new.feeds_amoeba and old.feeds_amoeba then
    if new.linked_observation_id is not null then
      update observations
        set rating = v_rating, dimension_id = new.dimension_id, competency_id = new.competency_id,
            notes = new.notes, observed_at = new.observed_at
        where id = new.linked_observation_id;
    else
      insert into observations (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
        values (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
        returning id into v_obs;
      new.linked_observation_id := v_obs;
    end if;
  end if;
  return new;
end $$;

create or replace function sync_assignment_observation_after()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.linked_observation_id is not null then
      delete from observations where id = old.linked_observation_id;
    end if;
    return old;
  end if;
  -- UPDATE toggled off: remove the now-unreferenced mirror.
  if old.feeds_amoeba and not new.feeds_amoeba and old.linked_observation_id is not null then
    delete from observations where id = old.linked_observation_id;
  end if;
  return null;
end $$;

revoke execute on function sync_assignment_observation_before() from public, anon, authenticated;
revoke execute on function sync_assignment_observation_after() from public, anon, authenticated;

drop trigger if exists trg_sync_assignment_observation on assignment_observations;
drop trigger if exists trg_sync_assignment_observation_before on assignment_observations;
drop trigger if exists trg_sync_assignment_observation_after on assignment_observations;

create trigger trg_sync_assignment_observation_before
  before insert or update on assignment_observations
  for each row execute function sync_assignment_observation_before();
create trigger trg_sync_assignment_observation_after
  after update or delete on assignment_observations
  for each row execute function sync_assignment_observation_after();

drop function if exists sync_assignment_observation_to_amoeba();

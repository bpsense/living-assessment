-- 093_fix_search_parent_contactable_users.sql
-- P1 fix: this SECURITY DEFINER RPC trusted a caller-supplied p_parent_id, letting
-- any caller enumerate another family's contactable staff (educators of that parent's
-- children + school admins) by passing an arbitrary parent id. Scope the search to the
-- authenticated caller (auth.uid()) instead. The p_parent_id parameter is kept for
-- signature compatibility with the existing client call but is no longer trusted.
create or replace function public.search_parent_contactable_users(p_parent_id uuid, p_query text)
returns table(id uuid, full_name text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select distinct pr.id, pr.full_name, pr.avatar_url, pr.role::text
  from profiles pr
  where pr.is_active = true
    and pr.id <> auth.uid()
    and pr.full_name ilike '%' || p_query || '%'
    and (
      -- Educators assigned to classrooms of the caller's linked children
      (
        pr.role = 'educator'
        and pr.id in (
          select ec.educator_id
          from educator_classrooms ec
          join student_classrooms sc on sc.classroom_id = ec.classroom_id
          join parent_students ps on ps.student_id = sc.student_id
          where ps.parent_id = auth.uid()
        )
      )
      or
      -- School admins in the caller's own school
      (
        pr.role = 'admin'
        and pr.school_id = (select school_id from profiles where id = auth.uid())
      )
    )
  order by pr.full_name
  limit 20;
$function$;

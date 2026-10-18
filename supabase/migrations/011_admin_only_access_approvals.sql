-- ASAKenya: access-request review and approval is administrator-only.
begin;

create or replace function public.list_access_requests()
returns table (
  user_id uuid,
  email text,
  full_name text,
  registered_at timestamptz,
  email_confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      ''
    )::text,
    u.created_at,
    u.email_confirmed_at
  from auth.users as u
  left join public.staff_roles as sr on sr.user_id = u.id
  where public.is_admin()
    and sr.user_id is null
  order by u.created_at desc;
$$;

create or replace function public.approve_editor_access(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_confirmed_at timestamptz;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'not_admin';
  end if;

  if p_email is null or length(btrim(p_email)) = 0 then
    raise exception 'no_user';
  end if;

  select u.id, u.email_confirmed_at
    into target_user_id, target_confirmed_at
  from auth.users as u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'no_user';
  end if;

  if target_confirmed_at is null then
    raise exception 'email_not_verified';
  end if;

  if exists (
    select 1 from public.staff_roles as sr
    where sr.user_id = target_user_id
  ) then
    raise exception 'already_staff';
  end if;

  -- Even an administrator using this approval queue grants editor only.
  insert into public.staff_roles (user_id, role)
  values (target_user_id, 'editor');
end;
$$;

revoke all on function public.list_access_requests() from public, anon;
revoke all on function public.approve_editor_access(text) from public, anon;
grant execute on function public.list_access_requests() to authenticated;
grant execute on function public.approve_editor_access(text) to authenticated;

commit;

-- 004_staff_management.sql
-- Staff management for the admin dashboard ("Staff and roles" page).
-- Run once in the Supabase SQL Editor after 001-003. Safe to run again.
--
-- The staff_roles table itself still has no insert/update/delete policies:
-- all changes go through these SECURITY DEFINER functions, which check
-- public.is_admin() on every call. Nobody can grant themselves a role.

-- List staff (admins only). Emails come from auth.users, which the browser
-- cannot read directly; this function is the controlled doorway.
create or replace function public.list_staff()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select sr.user_id, u.email::text, sr.role, sr.created_at
  from public.staff_roles sr
  join auth.users u on u.id = sr.user_id
  where public.is_admin()
  order by sr.created_at;
$$;

-- Add a role, or change the role of an email that already has one (admins only).
create or replace function public.set_staff_role(p_email text, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_role not in ('editor', 'admin') then raise exception 'bad_role'; end if;
  select id into uid from auth.users where email = p_email;
  if uid is null then raise exception 'no_user'; end if;
  if uid = auth.uid() then raise exception 'cannot_change_self'; end if;
  insert into public.staff_roles (user_id, role) values (uid, p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

-- Remove someone's staff access (admins only). Their login account is untouched.
create or replace function public.remove_staff(p_email text)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into uid from auth.users where email = p_email;
  if uid is null then raise exception 'no_user'; end if;
  if uid = auth.uid() then raise exception 'cannot_change_self'; end if;
  if (select role from public.staff_roles where user_id = uid) = 'admin'
     and (select count(*) from public.staff_roles where role = 'admin') <= 1 then
    raise exception 'last_admin';
  end if;
  delete from public.staff_roles where user_id = uid;
end $$;

revoke all on function public.list_staff() from public, anon;
revoke all on function public.set_staff_role(text, text) from public, anon;
revoke all on function public.remove_staff(text) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.set_staff_role(text, text) to authenticated;
grant execute on function public.remove_staff(text) to authenticated;

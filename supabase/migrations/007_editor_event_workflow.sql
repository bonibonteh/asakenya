-- 007_editor_event_workflow.sql
-- Allow authenticated staff editors to create/manage their own event drafts and submit them for approval.
-- Admins retain publish/archive/delete control. RLS remains enabled.
begin;

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('draft','pending','published','archived'));

drop policy if exists ev_admin_read on public.events;
drop policy if exists ev_admin_insert on public.events;
drop policy if exists ev_admin_update on public.events;
drop policy if exists ev_admin_delete on public.events;
drop policy if exists ev_staff_read_own on public.events;
drop policy if exists ev_staff_insert on public.events;
drop policy if exists ev_staff_update on public.events;

create policy ev_admin_read on public.events for select to authenticated
  using ((select public.is_admin()));
create policy ev_staff_read_own on public.events for select to authenticated
  using (created_by = (select auth.uid()) and (select public.is_staff()));
create policy ev_admin_insert on public.events for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy ev_staff_insert on public.events for insert to authenticated
  with check ((select public.is_staff()) and created_by = (select auth.uid()) and status in ('draft','pending'));
create policy ev_admin_update on public.events for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ev_staff_update on public.events for update to authenticated
  using ((select public.is_staff()) and created_by = (select auth.uid()) and status in ('draft','pending'))
  with check (created_by = (select auth.uid()) and status in ('draft','pending'));
create policy ev_admin_delete on public.events for delete to authenticated
  using ((select public.is_admin()));

commit;

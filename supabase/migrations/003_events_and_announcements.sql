-- ============================================================================
-- ASA Kenya - Migration 003: events and announcements (managed from /admin)
-- Run AFTER 001 and 002 (uses public.is_admin()). Safe to re-run.
-- Only administrators can create, edit, publish or delete these. The public can read
-- PUBLISHED rows only. Nothing here uses a secret key.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(btrim(title)) between 3 and 200),
  association      text not null default 'ASA Kenya' check (association in ('ASA Kenya','ASA TUK','ASA KU','ASA JKUAT','ASA UoN','ASA TUM')),
  description      text not null check (char_length(btrim(description)) between 10 and 5000),
  event_date       date not null,
  start_time       time,
  end_time         time,
  venue            text check (venue is null or char_length(venue) <= 300),
  online_url       text check (online_url is null or (online_url ~* '^https://[^[:space:]]+$' and char_length(online_url) <= 2000)),
  registration_url text check (registration_url is null or (registration_url ~* '^https://[^[:space:]]+$' and char_length(registration_url) <= 2000)),
  image_url        text check (image_url is null or (image_url ~* '^https://[^[:space:]]+$' and char_length(image_url) <= 2000)),
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint events_time_order_ck check (end_time is null or start_time is null or end_time >= start_time),
  constraint events_place_ck check (venue is not null or online_url is not null)
);
create index if not exists events_status_date_idx on public.events (status, event_date);

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS / NEWS
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 3 and 200),
  kind         text not null default 'Announcement' check (kind in ('Announcement', 'News', 'Update')),
  body         text not null check (char_length(btrim(body)) between 10 and 8000),
  image_url    text check (image_url is null or (image_url ~* '^https://[^[:space:]]+$' and char_length(image_url) <= 2000)),
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists announcements_status_pub_idx on public.announcements (status, published_at desc);

-- Server-controlled housekeeping, shared by both tables (browser cannot forge these).
create or replace function public.content_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at   := now();
    new.updated_at   := now();
    new.published_at := case when new.status = 'published' then now() else null end;
  else
    new.id           := old.id;
    new.created_by   := old.created_by;
    new.created_at   := old.created_at;
    new.updated_at   := now();
    new.published_at := case
                          when new.status = 'published' and old.status <> 'published' then now()
                          else old.published_at
                        end;
  end if;
  return new;
end;
$$;

drop trigger if exists events_guard_trg on public.events;
create trigger events_guard_trg before insert or update on public.events
  for each row execute function public.content_guard();
drop trigger if exists announcements_guard_trg on public.announcements;
create trigger announcements_guard_trg before insert or update on public.announcements
  for each row execute function public.content_guard();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.announcements enable row level security;
revoke all on public.events, public.announcements from anon, authenticated;

-- Public: published rows, public columns only (not created_by).
grant select (id, title, association, description, event_date, start_time, end_time, venue,
              online_url, registration_url, image_url, status, published_at, created_at, updated_at)
  on public.events to anon;
grant select (id, title, kind, body, image_url, status, published_at, created_at, updated_at)
  on public.announcements to anon;
-- Signed-in users: table privileges; the policies below decide the rows.
grant select, insert, update, delete on public.events, public.announcements to authenticated;

drop policy if exists ev_public_read   on public.events;
drop policy if exists ev_admin_read    on public.events;
drop policy if exists ev_admin_insert  on public.events;
drop policy if exists ev_admin_update  on public.events;
drop policy if exists ev_admin_delete  on public.events;
create policy ev_public_read  on public.events for select to anon, authenticated using (status = 'published');
create policy ev_admin_read   on public.events for select to authenticated using ((select public.is_admin()));
create policy ev_admin_insert on public.events for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy ev_admin_update on public.events for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ev_admin_delete on public.events for delete to authenticated using ((select public.is_admin()));

drop policy if exists an_public_read   on public.announcements;
drop policy if exists an_admin_read    on public.announcements;
drop policy if exists an_admin_insert  on public.announcements;
drop policy if exists an_admin_update  on public.announcements;
drop policy if exists an_admin_delete  on public.announcements;
create policy an_public_read  on public.announcements for select to anon, authenticated using (status = 'published');
create policy an_admin_read   on public.announcements for select to authenticated using ((select public.is_admin()));
create policy an_admin_insert on public.announcements for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy an_admin_update on public.announcements for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy an_admin_delete on public.announcements for delete to authenticated using ((select public.is_admin()));

commit;

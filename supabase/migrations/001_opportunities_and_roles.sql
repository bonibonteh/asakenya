-- ============================================================================
-- ASA Kenya - Migration 001: staff roles, opportunities, file storage
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Nothing here uses a secret key; the website only ever uses the publishable key.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. STAFF ROLES
--    Who may log in to the admin dashboard, and with what power.
--    'editor' = may add and edit own drafts and submit for approval.
--    'admin'  = may also approve, publish, archive and delete.
--    Browsers can only READ their own row. Nobody can insert/update/delete a role
--    from the website, so users cannot make themselves administrators.
--    Roles are granted by you in the SQL Editor (see SETUP-SUPABASE.md).
-- ---------------------------------------------------------------------------
create table if not exists public.staff_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('editor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon, authenticated;
grant select on public.staff_roles to authenticated;

drop policy if exists staff_roles_read_own on public.staff_roles;
create policy staff_roles_read_own on public.staff_roles
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Deliberately NO insert/update/delete policies and NO such grants.

-- Helper functions. SECURITY DEFINER lets policies check roles without giving
-- the browser access to the whole staff_roles table.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff_roles where user_id = auth.uid()); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'admin'); $$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. OPPORTUNITIES
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 3 and 200),
  organisation text not null check (char_length(btrim(organisation)) between 2 and 200),
  category     text not null check (category in (
                 'Competitions','Internships','Scholarships','Mentorship','Workshops',
                 'Site visits','Exhibitions','Fellowships','Calls for papers','Research',
                 'Volunteering','Jobs','Traineeships','Grants','Paid projects')),
  description  text not null check (char_length(btrim(description)) between 10 and 5000),
  location     text check (location is null or char_length(location) <= 200),
  apply_url    text check (apply_url is null or (apply_url ~* '^https://[^[:space:]]+$' and char_length(apply_url) <= 2000)),
  deadline     date,
  file_url     text check (file_url  is null or (file_url  ~* '^https://[^[:space:]]+$' and char_length(file_url)  <= 2000)),
  eligibility  text check (eligibility is null or char_length(eligibility) <= 1000),
  source       text check (source is null or char_length(source) <= 300),
  audience     text not null default 'both' check (audience in ('students', 'graduates', 'both')),
  status       text not null default 'draft' check (status in ('draft', 'pending', 'published', 'archived')),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists opportunities_status_deadline_idx on public.opportunities (status, deadline);
create index if not exists opportunities_category_idx        on public.opportunities (category);
create index if not exists opportunities_created_by_idx      on public.opportunities (created_by);

-- Server-side housekeeping so the browser cannot forge these fields.
create or replace function public.opportunities_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at   := now();
    new.updated_at   := now();
    new.published_at := case when new.status = 'published' then now() else null end;
  else
    new.id           := old.id;
    new.created_by   := old.created_by;      -- authorship can never be changed
    new.created_at   := old.created_at;
    new.updated_at   := now();
    new.published_at := case
                          when new.status = 'published' and old.status <> 'published' then now()
                          when new.status = 'published' then old.published_at
                          else old.published_at
                        end;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_guard_trg on public.opportunities;
create trigger opportunities_guard_trg
  before insert or update on public.opportunities
  for each row execute function public.opportunities_guard();

-- Row Level Security
alter table public.opportunities enable row level security;

-- Start from nothing, then grant only what is needed.
revoke all on public.opportunities from anon, authenticated;

-- Public visitors may read only these columns (note: created_by is NOT included).
grant select (id, title, organisation, category, description, location, apply_url,
              deadline, file_url, eligibility, audience, status,
              published_at, created_at, updated_at)
  on public.opportunities to anon;
-- Logged-in users get table privileges; the policies below decide which ROWS.
grant select, insert, update, delete on public.opportunities to authenticated;

drop policy if exists opp_public_read      on public.opportunities;
drop policy if exists opp_staff_read_own   on public.opportunities;
drop policy if exists opp_admin_read_all   on public.opportunities;
drop policy if exists opp_editor_insert    on public.opportunities;
drop policy if exists opp_admin_insert     on public.opportunities;
drop policy if exists opp_editor_update    on public.opportunities;
drop policy if exists opp_admin_update     on public.opportunities;
drop policy if exists opp_admin_delete     on public.opportunities;

-- READ: the public sees published, not-yet-expired opportunities only.
create policy opp_public_read on public.opportunities
  for select to anon, authenticated
  using (status = 'published' and (deadline is null or deadline >= current_date));

-- READ: editors also see their own records (drafts, pending, anything they created).
create policy opp_staff_read_own on public.opportunities
  for select to authenticated
  using (created_by = (select auth.uid()) and (select public.is_staff()));

-- READ: administrators see everything (including expired and archived).
create policy opp_admin_read_all on public.opportunities
  for select to authenticated
  using ((select public.is_admin()));

-- INSERT: editors may create records only as draft or pending, only as themselves.
create policy opp_editor_insert on public.opportunities
  for insert to authenticated
  with check ((select public.is_staff())
              and created_by = (select auth.uid())
              and status in ('draft', 'pending'));

-- INSERT: administrators may create records in any status (still as themselves).
create policy opp_admin_insert on public.opportunities
  for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

-- UPDATE: editors may change their OWN draft/pending records and keep them draft/pending.
-- They cannot publish or archive, and cannot edit a record once it is published.
create policy opp_editor_update on public.opportunities
  for update to authenticated
  using      ((select public.is_staff()) and created_by = (select auth.uid()) and status in ('draft', 'pending'))
  with check (created_by = (select auth.uid()) and status in ('draft', 'pending'));

-- UPDATE: administrators may approve, publish, archive and edit anything.
create policy opp_admin_update on public.opportunities
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- DELETE: administrators only.
create policy opp_admin_delete on public.opportunities
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. FILE STORAGE (posters and PDFs)
--    Public bucket so published posters load on the website. Files are saved under
--    <uploader-id>/<random-name>, so URLs of unpublished items cannot be guessed.
--    25 MB limit; JPEG, PNG, WebP and PDF only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('opportunity-files', 'opportunity-files', true, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "opp files staff upload"  on storage.objects;
drop policy if exists "opp files staff list"    on storage.objects;
drop policy if exists "opp files owner update"  on storage.objects;
drop policy if exists "opp files owner delete"  on storage.objects;

create policy "opp files staff upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'opportunity-files'
              and (select public.is_staff())
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "opp files staff list" on storage.objects
  for select to authenticated
  using (bucket_id = 'opportunity-files' and (select public.is_staff()));

create policy "opp files owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'opportunity-files'
         and ((select public.is_admin()) or (storage.foldername(name))[1] = (select auth.uid())::text));

create policy "opp files owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'opportunity-files'
         and ((select public.is_admin()) or (storage.foldername(name))[1] = (select auth.uid())::text));

commit;

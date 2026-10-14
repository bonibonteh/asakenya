-- ============================================================================
-- ASA Kenya - Migration 005: Student Hub submissions (with optional attachment)
-- Run AFTER 001-003 (uses public.is_admin()). Safe to re-run. Nothing is deleted.
--
-- Students submit an opportunity from the Student Hub page. The public can only
-- INSERT (status is always 'pending'). Only administrators can read, review or delete.
-- Attachments live in a PRIVATE bucket; only administrators can open them (signed links).
-- Approving a submission does not publish anything by itself: the administrator turns it
-- into an opportunity through the normal review/publish flow.
-- ============================================================================
begin;

create table if not exists public.student_submissions (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(btrim(title)) between 3 and 200),
  organisation     text not null check (char_length(btrim(organisation)) between 2 and 200),
  category         text not null check (category in (
                     'Competitions','Internships','Scholarships','Mentorship','Workshops',
                     'Site visits','Exhibitions','Fellowships','Calls for papers','Research',
                     'Volunteering','Jobs','Traineeships','Grants','Paid projects')),
  description      text not null check (char_length(btrim(description)) between 10 and 5000),
  location         text check (location is null or char_length(location) <= 200),
  deadline         date,
  apply_url        text check (apply_url is null or (apply_url ~* '^https://[^[:space:]]+$' and char_length(apply_url) <= 2000)),
  submitter_name   text not null check (char_length(btrim(submitter_name)) between 2 and 120),
  submitter_email  text not null check (char_length(submitter_email) <= 254 and submitter_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  university       text not null check (char_length(btrim(university)) between 2 and 160),
  attachment_path  text check (attachment_path is null or attachment_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$'),
  attachment_name  text check (attachment_name is null or char_length(attachment_name) <= 200),
  attachment_type  text check (attachment_type is null or attachment_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  attachment_size  integer check (attachment_size is null or attachment_size between 1 and 5242880),
  consent          boolean not null check (consent is true),
  privacy_version  text not null default 'v1',
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note      text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint student_submissions_attachment_ck check (
    (attachment_path is null and attachment_type is null and attachment_size is null)
    or (attachment_path is not null and attachment_type is not null and attachment_size is not null))
);
create index if not exists student_submissions_status_idx  on public.student_submissions (status, created_at desc);
create index if not exists student_submissions_category_idx on public.student_submissions (category);

create or replace function public.student_submissions_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists student_submissions_guard_trg on public.student_submissions;
create trigger student_submissions_guard_trg
  before update on public.student_submissions
  for each row execute function public.student_submissions_guard();

alter table public.student_submissions enable row level security;
revoke all on public.student_submissions from anon, authenticated;
-- Public INSERT only, and only these columns: status, review fields and timestamps are server-controlled.
grant insert (title, organisation, category, description, location, deadline, apply_url,
              submitter_name, submitter_email, university,
              attachment_path, attachment_name, attachment_type, attachment_size, consent)
  on public.student_submissions to anon, authenticated;
grant select, delete on public.student_submissions to authenticated;
grant update (status, review_note) on public.student_submissions to authenticated;

drop policy if exists ss_public_insert on public.student_submissions;
drop policy if exists ss_admin_read    on public.student_submissions;
drop policy if exists ss_admin_update  on public.student_submissions;
drop policy if exists ss_admin_delete  on public.student_submissions;
create policy ss_public_insert on public.student_submissions
  for insert to anon, authenticated with check (consent is true);
create policy ss_admin_read on public.student_submissions
  for select to authenticated using ((select public.is_admin()));
create policy ss_admin_update on public.student_submissions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ss_admin_delete on public.student_submissions
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- PRIVATE attachment bucket. Visitors can upload (never list, read or replace);
-- administrators can read (signed links) and delete.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-submissions', 'student-submissions', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student files public upload" on storage.objects;
drop policy if exists "student files admin read"    on storage.objects;
drop policy if exists "student files admin delete"  on storage.objects;
create policy "student files public upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'student-submissions'
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$');
create policy "student files admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'student-submissions' and (select public.is_admin()));
create policy "student files admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'student-submissions' and (select public.is_admin()));

commit;

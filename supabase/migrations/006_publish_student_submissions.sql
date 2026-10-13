-- ============================================================================
-- ASA Kenya - Migration 006: publish Student Hub submissions
-- Run AFTER 001-005. Safe to re-run. Nothing is deleted; submissions are kept as history.
--
-- Adds publish_student_submission(id, note): ONE database transaction that (a) checks the caller
-- is an administrator, (b) refuses duplicates, (c) creates a PUBLISHED opportunity from the
-- submission and (d) links it back and marks the submission approved. The browser can never set
-- the link column itself (not in the UPDATE grant), so it cannot fake a "published" state.
-- A published submission cannot be rejected or moved back; unpublish it by archiving the
-- opportunity in Opportunities.
-- ============================================================================
begin;

alter table public.student_submissions
  add column if not exists published_opportunity_id uuid references public.opportunities (id) on delete set null,
  add column if not exists published_at timestamptz;
create unique index if not exists student_submissions_published_uq
  on public.student_submissions (published_opportunity_id) where published_opportunity_id is not null;

create or replace function public.student_submissions_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- link/publication fields are only ever written by publish_student_submission()
    if (new.published_opportunity_id is distinct from old.published_opportunity_id
        or new.published_at is distinct from old.published_at)
       and coalesce(current_setting('asa.publishing', true), '') <> 'on' then
      new.published_opportunity_id := old.published_opportunity_id;
      new.published_at := old.published_at;
    end if;
    if old.published_opportunity_id is not null and new.status is distinct from 'approved' then
      raise exception 'This submission is already published. Archive the opportunity to take it down.' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.publish_student_submission(p_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare s public.student_submissions; oid uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can publish submissions.' using errcode = '42501';
  end if;
  select * into s from public.student_submissions where id = p_id for update;
  if not found then raise exception 'Submission not found.' using errcode = 'P0002'; end if;
  if s.published_opportunity_id is not null then
    raise exception 'This submission has already been published.' using errcode = 'P0001';
  end if;
  if s.status = 'rejected' then
    raise exception 'Rejected submissions cannot be published. Move it back to awaiting review first.' using errcode = 'P0001';
  end if;
  if s.deadline is not null and s.deadline < current_date then
    raise exception 'The deadline has already passed, so it would not be shown publicly.' using errcode = 'P0001';
  end if;

  insert into public.opportunities (title, organisation, category, description, location, apply_url, deadline, audience, status, source, created_by)
  values (s.title, s.organisation, s.category, s.description, s.location, s.apply_url, s.deadline, 'students', 'published',
          left('Student Hub submission by ' || s.submitter_name || ', ' || s.university, 300), auth.uid())
  returning id into oid;

  perform set_config('asa.publishing', 'on', true);
  update public.student_submissions
     set status = 'approved', published_opportunity_id = oid, published_at = now(),
         review_note = coalesce(nullif(btrim(p_note), ''), review_note)
   where id = p_id;
  perform set_config('asa.publishing', 'off', true);
  return oid;
end;
$$;
revoke all on function public.publish_student_submission(uuid, text) from public, anon;
grant execute on function public.publish_student_submission(uuid, text) to authenticated;

commit;

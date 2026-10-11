-- ============================================================================
-- LOCAL TESTING STUB ONLY.
-- Mimics the small parts of Supabase (roles, auth, storage) that the migrations
-- depend on, so they can be run on a plain PostgreSQL server.
-- NEVER run this file in a real Supabase project: it would clash with the real
-- auth/storage schemas. Run it BEFORE migrations 001 and 002.
-- ============================================================================
create role anon          nologin;
create role authenticated nologin;
create role service_role  nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase default privileges: every new table in public is fully open to the API
-- roles, so the migrations' REVOKE statements are what is really being tested.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(current_setting('request.jwt.claim.sub', true),
             (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')),
    '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- (real Supabase does not let API roles read auth.users; none granted here)

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid default gen_random_uuid() primary key,
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
  language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema storage to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

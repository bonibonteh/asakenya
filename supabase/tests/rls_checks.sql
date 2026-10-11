-- ============================================================================
-- ASA Kenya - Row Level Security checks for migrations 001 + 002
--
-- HOW TO USE: Supabase Dashboard -> SQL Editor -> New query -> paste ALL of this
-- -> Run. It runs as the `postgres` role. Everything happens inside one
-- transaction that ends with ROLLBACK, so no test data is left behind.
-- Expected result: every row says PASS and the last row says "0 failed".
--
-- NOTE: the very last statement is ROLLBACK. If your SQL Editor shows only
-- "Success. No rows returned" instead of the table of results, run it again
-- after temporarily deleting the final line "rollback;" ONLY IF you then run
-- "rollback;" by itself straight afterwards. Never leave the transaction open.
--
-- Real Supabase auth.users has many more columns, but only `id` and `email`
-- are needed here (the others are nullable or have defaults). If your project
-- has a trigger on auth.users that inserts into other tables, it will fire
-- here too, and rolls back with everything else.
--
-- Limits NOT testable in SQL: the 5 MB size limit and the allowed mime types
-- (JPEG/PNG/WebP/PDF) of bucket 'opportunity-files' are enforced by the
-- Storage API, not by Postgres.
-- Storage tests need bucket 'opportunity-files' (created by migration 001).
-- ============================================================================
begin;

-- ---------------------------------------------------------------- results ---
create table public.zz_rls_results (name text, passed boolean, detail text);
grant insert on public.zz_rls_results to anon, authenticated;

-- ---------------------------------------------------------------- helpers ---
-- All helpers are SECURITY INVOKER: they run with whatever role is active.
create function public.zz_rec(p_name text, p_ok boolean, p_detail text) returns void
language sql as $$ insert into public.zz_rls_results values (p_name, coalesce(p_ok, false), p_detail) $$;

create function public.zz_uid(k text) returns uuid
language sql stable as $$ select current_setting('zz.' || k)::uuid $$;

-- Pass if the statement fails with a message matching the regex.
create function public.zz_err(p_name text, p_sql text, p_pattern text) returns void
language plpgsql as $$
declare m text;
begin
  begin
    execute p_sql;
  exception when others then
    m := sqlerrm;
  end;
  if m is null then
    perform public.zz_rec(p_name, false, 'NO ERROR: statement succeeded but should have been rejected');
  elsif m ~* p_pattern then
    perform public.zz_rec(p_name, true, 'rejected: ' || m);
  else
    perform public.zz_rec(p_name, false, 'WRONG ERROR: ' || m || '  (expected /' || p_pattern || '/)');
  end if;
end $$;

-- Pass if the statement succeeds (no error).
create function public.zz_ok(p_name text, p_sql text) returns void
language plpgsql as $$
begin
  execute p_sql;
  perform public.zz_rec(p_name, true, 'succeeded');
exception when others then
  perform public.zz_rec(p_name, false, 'UNEXPECTED ERROR: ' || sqlerrm);
end $$;

-- Pass if a DML statement affects exactly p_expected rows.
create function public.zz_rows(p_name text, p_sql text, p_expected int) returns void
language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  perform public.zz_rec(p_name, n = p_expected, 'rows affected = ' || n || ', expected ' || p_expected);
exception when others then
  perform public.zz_rec(p_name, false, 'UNEXPECTED ERROR: ' || sqlerrm);
end $$;

-- Pass if a one-value query (cast to text) equals p_expected.
create function public.zz_val(p_name text, p_sql text, p_expected text) returns void
language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  perform public.zz_rec(p_name, v is not distinct from p_expected,
                        'got [' || coalesce(v, 'NULL') || '], expected [' || coalesce(p_expected, 'NULL') || ']');
exception when others then
  perform public.zz_rec(p_name, false, 'UNEXPECTED ERROR: ' || sqlerrm);
end $$;

grant execute on function
  public.zz_rec(text, boolean, text), public.zz_uid(text), public.zz_err(text, text, text),
  public.zz_ok(text, text), public.zz_rows(text, text, int), public.zz_val(text, text, text)
  to anon, authenticated;

-- ------------------------------------------------------------- test users ---
select set_config('zz.admin',    gen_random_uuid()::text, true);
select set_config('zz.editor1',  gen_random_uuid()::text, true);
select set_config('zz.editor2',  gen_random_uuid()::text, true);
select set_config('zz.outsider', gen_random_uuid()::text, true);

insert into auth.users (id, email) values
  (public.zz_uid('admin'),    'zz-admin-'    || public.zz_uid('admin')    || '@example.test'),
  (public.zz_uid('editor1'),  'zz-editor1-'  || public.zz_uid('editor1')  || '@example.test'),
  (public.zz_uid('editor2'),  'zz-editor2-'  || public.zz_uid('editor2')  || '@example.test'),
  (public.zz_uid('outsider'), 'zz-outsider-' || public.zz_uid('outsider') || '@example.test');

insert into public.staff_roles (user_id, role) values
  (public.zz_uid('admin'),   'admin'),
  (public.zz_uid('editor1'), 'editor'),
  (public.zz_uid('editor2'), 'editor');

-- ------------------------------------------------------ opportunity fixtures ---
insert into public.opportunities (title, organisation, category, description, status, deadline, created_by) values
  ('ZZ-pub-null',    'Org', 'Jobs', 'Published, no deadline',      'published', null,                         public.zz_uid('editor1')),
  ('ZZ-pub-future',  'Org', 'Jobs', 'Published, future deadline',  'published', current_date + 30,            public.zz_uid('editor1')),
  ('ZZ-pub-expired', 'Org', 'Jobs', 'Published but deadline over', 'published', current_date - 1,             public.zz_uid('editor2')),
  ('ZZ-draft-e1',    'Org', 'Jobs', 'Draft by editor one',         'draft',     null,                         public.zz_uid('editor1')),
  ('ZZ-pending-e1',  'Org', 'Jobs', 'Pending by editor one',       'pending',   null,                         public.zz_uid('editor1')),
  ('ZZ-draft-e2',    'Org', 'Jobs', 'Draft by editor two',         'draft',     null,                         public.zz_uid('editor2')),
  ('ZZ-archived-e2', 'Org', 'Jobs', 'Archived by editor two',      'archived',  null,                         public.zz_uid('editor2'));

-- ============================================================================
-- ACTOR: anon (public website visitor)
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

select public.zz_val('opp/anon: sees exactly the 2 published non-expired rows (null + future deadline)',
  $q$select coalesce(string_agg(title, ',' order by title), '') from public.opportunities where title like 'ZZ-%'$q$,
  'ZZ-pub-future,ZZ-pub-null');
select public.zz_val('opp/anon: does not see draft/pending/archived/expired (count of those = 0)',
  $q$select count(*) from public.opportunities where title in ('ZZ-draft-e1','ZZ-draft-e2','ZZ-pending-e1','ZZ-archived-e2','ZZ-pub-expired')$q$, '0');
select public.zz_err('opp/anon: select * is denied (created_by not granted)',
  $q$select * from public.opportunities$q$, 'permission denied for (table|relation) opportunities');
select public.zz_val('opp/anon: explicit list of the 16 public columns works',
  $q$select count(*) from (select id, title, organisation, category, description, location, apply_url, deadline, file_url, eligibility, source, audience, status, published_at, created_at, updated_at from public.opportunities where title like 'ZZ-%') s$q$, '2');
select public.zz_err('opp/anon: cannot select created_by',
  $q$select created_by from public.opportunities$q$, 'permission denied for (table|relation) opportunities');
select public.zz_err('opp/anon: cannot insert',
  $q$insert into public.opportunities (title, organisation, category, description) values ('ZZ-anon','Org','Jobs','anon should not insert')$q$, 'permission denied for (table|relation) opportunities');
select public.zz_err('opp/anon: cannot update',
  $q$update public.opportunities set title = 'ZZ-hacked'$q$, 'permission denied for (table|relation) opportunities');
select public.zz_err('opp/anon: cannot delete',
  $q$delete from public.opportunities$q$, 'permission denied for (table|relation) opportunities');
select public.zz_err('roles/anon: cannot read staff_roles',
  $q$select * from public.staff_roles$q$, 'permission denied for (table|relation) staff_roles');
reset role;

select public.zz_val('opp/anon: nothing was changed by the anon attempts (7 fixtures, none renamed)',
  $q$select count(*) from public.opportunities where title like 'ZZ-%' and title <> 'ZZ-hacked' and title <> 'ZZ-anon'$q$, '7');

-- ============================================================================
-- ACTOR: outsider (logged in, no staff role)
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('outsider'), 'role','authenticated')::text, true);

select public.zz_val('opp/outsider: sees only published non-expired rows',
  $q$select coalesce(string_agg(title, ',' order by title), '') from public.opportunities where title like 'ZZ-%'$q$,
  'ZZ-pub-future,ZZ-pub-null');
select public.zz_err('opp/outsider: cannot insert (even as themselves, draft)',
  $q$insert into public.opportunities (title, organisation, category, description, status, created_by)
     values ('ZZ-outsider','Org','Jobs','outsider should not insert','draft', public.zz_uid('outsider'))$q$,
  'row-level security');
select public.zz_err('roles/outsider: cannot insert a staff role for themselves',
  $q$insert into public.staff_roles (user_id, role) values (public.zz_uid('outsider'), 'admin')$q$,
  'permission denied for (table|relation) staff_roles');
select public.zz_val('roles/outsider: sees no staff_roles rows',
  $q$select count(*) from public.staff_roles$q$, '0');
reset role;

-- ============================================================================
-- ACTOR: editor1
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('editor1'), 'role','authenticated')::text, true);

select public.zz_val('opp/editor: sees own draft/pending + public rows, nothing of editor2 or expired/archived',
  $q$select coalesce(string_agg(title, ',' order by title), '') from public.opportunities where title like 'ZZ-%'$q$,
  'ZZ-draft-e1,ZZ-pending-e1,ZZ-pub-future,ZZ-pub-null');
select public.zz_val('opp/editor: does NOT see another editor''s draft',
  $q$select count(*) from public.opportunities where title = 'ZZ-draft-e2'$q$, '0');
select public.zz_ok('opp/editor: can insert own draft',
  $q$insert into public.opportunities (title, organisation, category, description, status) values ('ZZ-new-draft','Org','Jobs','Editor draft description','draft')$q$);
select public.zz_ok('opp/editor: can insert own pending',
  $q$insert into public.opportunities (title, organisation, category, description, status) values ('ZZ-new-pending','Org','Jobs','Editor pending description','pending')$q$);
select public.zz_err('opp/editor: cannot insert status published',
  $q$insert into public.opportunities (title, organisation, category, description, status) values ('ZZ-bad-pub','Org','Jobs','Editor tries to publish','published')$q$, 'row-level security');
select public.zz_err('opp/editor: cannot insert status archived',
  $q$insert into public.opportunities (title, organisation, category, description, status) values ('ZZ-bad-arch','Org','Jobs','Editor tries to archive','archived')$q$, 'row-level security');
select public.zz_err('opp/editor: cannot insert with created_by = another user',
  $q$insert into public.opportunities (title, organisation, category, description, status, created_by) values ('ZZ-bad-owner','Org','Jobs','Editor forges author','draft', public.zz_uid('editor2'))$q$, 'row-level security');
select public.zz_val('opp/editor: sees the rows it just inserted',
  $q$select count(*) from public.opportunities where title in ('ZZ-new-draft','ZZ-new-pending')$q$, '2');
select public.zz_rows('opp/editor: can update own draft to pending',
  $q$update public.opportunities set status = 'pending' where title = 'ZZ-draft-e1'$q$, 1);
select public.zz_err('opp/editor: cannot update own row to published',
  $q$update public.opportunities set status = 'published' where title = 'ZZ-new-draft'$q$, 'row-level security');
select public.zz_err('opp/editor: cannot update own row to archived',
  $q$update public.opportunities set status = 'archived' where title = 'ZZ-new-draft'$q$, 'row-level security');
select public.zz_rows('opp/editor: cannot update a row once it is published (0 rows)',
  $q$update public.opportunities set title = 'ZZ-hacked-pub' where title = 'ZZ-pub-null'$q$, 0);
select public.zz_rows('opp/editor: cannot update another user''s row (0 rows)',
  $q$update public.opportunities set title = 'ZZ-hacked-e2' where title = 'ZZ-draft-e2'$q$, 0);
select public.zz_rows('opp/editor: cannot delete own row (0 rows)',
  $q$delete from public.opportunities where title = 'ZZ-new-draft'$q$, 0);
select public.zz_rows('opp/editor: cannot delete others'' rows (0 rows)',
  $q$delete from public.opportunities where title in ('ZZ-draft-e2','ZZ-pub-null','ZZ-pub-future')$q$, 0);
-- the trigger silently reverts these two fields
select public.zz_rows('opp/editor: update that tries to change created_by and set published_at is accepted',
  $q$update public.opportunities set created_by = public.zz_uid('editor2'), published_at = now() where title = 'ZZ-new-draft'$q$, 1);

select public.zz_val('roles/editor: sees only their own staff_roles row',
  $q$select count(*) || ':' || bool_and(user_id = public.zz_uid('editor1'))::text from public.staff_roles$q$, '1:true');
select public.zz_err('roles/editor: cannot INSERT a role granting self admin',
  $q$insert into public.staff_roles (user_id, role) values (public.zz_uid('editor1'), 'admin')$q$, 'permission denied for (table|relation) staff_roles');
select public.zz_err('roles/editor: cannot INSERT an admin role for someone else',
  $q$insert into public.staff_roles (user_id, role) values (public.zz_uid('outsider'), 'admin')$q$, 'permission denied for (table|relation) staff_roles');
select public.zz_err('roles/editor: cannot UPDATE own role to admin',
  $q$update public.staff_roles set role = 'admin' where user_id = public.zz_uid('editor1')$q$, 'permission denied for (table|relation) staff_roles');
select public.zz_err('roles/editor: cannot delete roles',
  $q$delete from public.staff_roles$q$, 'permission denied for (table|relation) staff_roles');
reset role;

-- verify (as postgres, bypassing RLS) that the editor attempts really had no effect
select public.zz_val('opp/editor: verify trigger kept created_by and ignored published_at',
  $q$select (created_by = public.zz_uid('editor1'))::text || ':' || (published_at is null)::text from public.opportunities where title = 'ZZ-new-draft'$q$, 'true:true');
select public.zz_val('opp/editor: verify published row untouched and nothing deleted',
  $q$select count(*) from public.opportunities where title in ('ZZ-pub-null','ZZ-pub-future','ZZ-draft-e2','ZZ-new-draft','ZZ-new-pending')$q$, '5');
select public.zz_val('opp/editor: verify draft became pending, status of new-draft still draft',
  $q$select (select status from public.opportunities where title='ZZ-draft-e1') || ',' || (select status from public.opportunities where title='ZZ-new-draft')$q$, 'pending,draft');
select public.zz_val('roles/editor: verify roles unchanged (editor1 still editor, 3 staff rows)',
  $q$select (select role from public.staff_roles where user_id = public.zz_uid('editor1')) || ',' || (select count(*) from public.staff_roles where user_id in (public.zz_uid('admin'),public.zz_uid('editor1'),public.zz_uid('editor2'),public.zz_uid('outsider')))$q$, 'editor,3');

-- ============================================================================
-- ACTOR: admin
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('admin'), 'role','authenticated')::text, true);

select public.zz_val('opp/admin: sees every fixture row incl. drafts, expired, archived (7 of 7)',
  $q$select count(*) from public.opportunities where title in ('ZZ-pub-null','ZZ-pub-future','ZZ-pub-expired','ZZ-draft-e1','ZZ-pending-e1','ZZ-draft-e2','ZZ-archived-e2')$q$, '7');
select public.zz_val('opp/admin: specifically sees draft, expired and archived rows of others',
  $q$select count(*) from public.opportunities where title in ('ZZ-draft-e2','ZZ-pub-expired','ZZ-archived-e2')$q$, '3');
select public.zz_val('opp/admin: can insert published directly, published_at gets set',
  $q$with i as (insert into public.opportunities (title, organisation, category, description, status) values ('ZZ-admin-pub','Org','Jobs','Admin publishes directly','published') returning published_at) select (published_at is not null)::text from i$q$, 'true');
select public.zz_val('opp/admin: approves pending -> published, published_at becomes set',
  $q$with u as (update public.opportunities set status = 'published' where title = 'ZZ-pending-e1' returning status, published_at) select status || ':' || (published_at is not null)::text from u$q$, 'published:true');
select public.zz_val('opp/admin: can archive',
  $q$with u as (update public.opportunities set status = 'archived' where title = 'ZZ-draft-e2' returning status) select status from u$q$, 'archived');
select public.zz_rows('opp/admin: update setting created_by to someone else is accepted (trigger reverts it)',
  $q$update public.opportunities set created_by = public.zz_uid('outsider') where title = 'ZZ-pub-null'$q$, 1);
select public.zz_rows('opp/admin: can delete',
  $q$delete from public.opportunities where title = 'ZZ-archived-e2'$q$, 1);

-- data validation (as admin so RLS cannot be the reason for rejection)
select public.zz_err('opp/validation: apply_url starting http:// rejected',
  $q$insert into public.opportunities (title, organisation, category, description, apply_url) values ('ZZ-v1','Org','Jobs','Valid description here','http://example.com/apply')$q$,
  'violates check constraint "opportunities_apply_url_check"');
select public.zz_err('opp/validation: category Nonsense rejected',
  $q$insert into public.opportunities (title, organisation, category, description) values ('ZZ-v2','Org','Nonsense','Valid description here')$q$,
  'violates check constraint "opportunities_category_check"');
select public.zz_err('opp/validation: 1-character title rejected',
  $q$insert into public.opportunities (title, organisation, category, description) values ('Z','Org','Jobs','Valid description here')$q$,
  'violates check constraint "opportunities_title_check"');
select public.zz_ok('opp/validation: control - the same row with valid values IS accepted',
  $q$insert into public.opportunities (title, organisation, category, description, apply_url) values ('ZZ-v-ok','Org','Jobs','Valid description here','https://example.com/apply')$q$);
reset role;

select public.zz_val('opp/admin: verify created_by of ZZ-pub-null unchanged (still editor1)',
  $q$select (created_by = public.zz_uid('editor1'))::text from public.opportunities where title = 'ZZ-pub-null'$q$, 'true');
select public.zz_val('opp/admin: verify deleted row is gone',
  $q$select count(*) from public.opportunities where title = 'ZZ-archived-e2'$q$, '0');

-- ============================================================================
-- GRADUATE INTEREST
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

select public.zz_ok('grad/anon: insert with consent=true succeeds',
  $q$insert into public.graduate_interest (interest_type, full_name, email, university, graduation_year, consent) values ('graduate','ZZ Grad One','zz-grad1@example.test','University of Nairobi',2022,true)$q$);
select public.zz_err('grad/anon: consent=false rejected',
  $q$insert into public.graduate_interest (interest_type, full_name, email, university, graduation_year, consent) values ('graduate','ZZ Grad Two','zz-grad2@example.test','University of Nairobi',2022,false)$q$,
  'row-level security|graduate_interest_consent_check');
select public.zz_err('grad/anon: graduate with no university rejected (study constraint)',
  $q$insert into public.graduate_interest (interest_type, full_name, email, graduation_year, consent) values ('graduate','ZZ Grad Three','zz-grad3@example.test',2022,true)$q$,
  'graduate_interest_study_ck');
select public.zz_ok('grad/anon: mentor with no university succeeds',
  $q$insert into public.graduate_interest (interest_type, full_name, email, consent) values ('mentor','ZZ Mentor','zz-mentor@example.test',true)$q$);
select public.zz_err('grad/anon: cannot SELECT',
  $q$select count(*) from public.graduate_interest$q$, 'permission denied for (table|relation) graduate_interest');
select public.zz_err('grad/anon: cannot set id',
  $q$insert into public.graduate_interest (id, full_name, email, university, graduation_year, consent) values (gen_random_uuid(),'ZZ Grad Id','zz-gradid@example.test','University of Nairobi',2022,true)$q$,
  'permission denied for (table|relation) graduate_interest');
select public.zz_err('grad/anon: cannot set created_at',
  $q$insert into public.graduate_interest (full_name, email, university, graduation_year, consent, created_at) values ('ZZ Grad Ts','zz-gradts@example.test','University of Nairobi',2022,true,'2000-01-01')$q$,
  'permission denied for (table|relation) graduate_interest');
reset role;

select public.zz_val('grad: verify exactly the 2 valid rows landed (graduate + mentor)',
  $q$select count(*) from public.graduate_interest where email in ('zz-grad1@example.test','zz-mentor@example.test')$q$, '2');
select public.zz_val('grad: verify rejected rows did not land',
  $q$select count(*) from public.graduate_interest where email in ('zz-grad2@example.test','zz-grad3@example.test','zz-gradid@example.test','zz-gradts@example.test')$q$, '0');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('admin'), 'role','authenticated')::text, true);
select public.zz_val('grad/admin: can read the 2 rows',
  $q$select count(*) from public.graduate_interest where email like 'zz-%@example.test'$q$, '2');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('editor1'), 'role','authenticated')::text, true);
select public.zz_val('grad/editor (non-admin): reads 0 rows (while admin reads 2)',
  $q$select count(*) from public.graduate_interest$q$, '0');
reset role;

-- ============================================================================
-- ALERT SUBSCRIPTIONS
-- ============================================================================
select set_config('zz.alert_email', 'zz-alert-' || md5(random()::text) || '@example.test', true);

set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_ok('alert/anon: insert succeeds',
  $q$insert into public.alert_subscriptions (email, categories, consent) values (current_setting('zz.alert_email'), array['Jobs','Grants'], true)$q$);
select public.zz_err('alert/anon: duplicate email differing only by case rejected',
  $q$insert into public.alert_subscriptions (email, categories, consent) values (upper(current_setting('zz.alert_email')), array['Jobs'], true)$q$,
  'alert_subscriptions_email_uq');
select public.zz_err('alert/anon: cannot read',
  $q$select email from public.alert_subscriptions$q$, 'permission denied for (table|relation) alert_subscriptions');
select public.zz_err('alert/anon: cannot insert confirmed_at',
  $q$insert into public.alert_subscriptions (email, categories, consent, confirmed_at) values ('zz-alert-x@example.test', array['Jobs'], true, now())$q$,
  'permission denied for (table|relation) alert_subscriptions');
select public.zz_val('alert/anon: confirm_alert_subscription(random uuid) returns false',
  $q$select public.confirm_alert_subscription(gen_random_uuid())::text$q$, 'false');
select public.zz_val('alert/anon: unsubscribe_alert(random uuid) returns false',
  $q$select public.unsubscribe_alert(gen_random_uuid())::text$q$, 'false');
reset role;

select set_config('zz.confirm_token',     (select confirm_token::text     from public.alert_subscriptions where lower(email) = lower(current_setting('zz.alert_email'))), true);
select set_config('zz.unsubscribe_token', (select unsubscribe_token::text from public.alert_subscriptions where lower(email) = lower(current_setting('zz.alert_email'))), true);
select public.zz_val('alert: verify only the one subscription landed, still unconfirmed',
  $q$select count(*) || ':' || bool_and(confirmed_at is null)::text from public.alert_subscriptions where email ilike 'zz-alert-%@example.test'$q$, '1:true');

set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_val('alert/anon: confirm with the real token returns true',
  $q$select public.confirm_alert_subscription(current_setting('zz.confirm_token')::uuid)::text$q$, 'true');
reset role;
select public.zz_val('alert: verify confirmed_at is now set',
  $q$select (confirmed_at is not null)::text from public.alert_subscriptions where lower(email) = lower(current_setting('zz.alert_email'))$q$, 'true');
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_val('alert/anon: unsubscribe with the real token returns true',
  $q$select public.unsubscribe_alert(current_setting('zz.unsubscribe_token')::uuid)::text$q$, 'true');
reset role;
select public.zz_val('alert: verify unsubscribed_at is now set',
  $q$select (unsubscribed_at is not null)::text from public.alert_subscriptions where lower(email) = lower(current_setting('zz.alert_email'))$q$, 'true');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('admin'), 'role','authenticated')::text, true);
select public.zz_val('alert/admin: can select email and categories',
  $q$select count(*) from (select email, categories from public.alert_subscriptions where lower(email) = lower(current_setting('zz.alert_email'))) s$q$, '1');
select public.zz_err('alert/admin: selecting confirm_token is denied',
  $q$select confirm_token from public.alert_subscriptions$q$, 'permission denied for (table|relation) alert_subscriptions');
select public.zz_err('alert/admin: selecting unsubscribe_token is denied',
  $q$select unsubscribe_token from public.alert_subscriptions$q$, 'permission denied for (table|relation) alert_subscriptions');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('editor1'), 'role','authenticated')::text, true);
select public.zz_val('alert/editor (non-admin): reads 0 rows (while admin reads 1)',
  $q$select count(*) from public.alert_subscriptions$q$, '0');
reset role;

-- ============================================================================
-- PORTFOLIO SUBMISSIONS
-- ============================================================================
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_ok('portfolio/anon: insert succeeds',
  $q$insert into public.portfolio_submissions (full_name, email, university, graduation_year, headline, portfolio_url, consent_publish) values ('ZZ Portfolio One','zz-pf1@example.test','University of Nairobi',2022,'Architect and urbanist','https://example.com/pf1',true)$q$);
select public.zz_val('portfolio/anon: cannot see the pending row',
  $q$select count(*) from public.portfolio_submissions where full_name like 'ZZ Portfolio%'$q$, '0');
select public.zz_err('portfolio/anon: cannot insert with status approved (column privilege)',
  $q$insert into public.portfolio_submissions (full_name, email, university, graduation_year, headline, portfolio_url, consent_publish, status) values ('ZZ Portfolio Two','zz-pf2@example.test','University of Nairobi',2022,'Architect and urbanist','https://example.com/pf2',true,'approved')$q$,
  'permission denied for (table|relation) portfolio_submissions');
select public.zz_err('portfolio/anon: consent_publish=false rejected',
  $q$insert into public.portfolio_submissions (full_name, email, university, graduation_year, headline, portfolio_url, consent_publish) values ('ZZ Portfolio Three','zz-pf3@example.test','University of Nairobi',2022,'Architect and urbanist','https://example.com/pf3',false)$q$,
  'row-level security|portfolio_submissions_consent_publish_check');
reset role;

select public.zz_val('portfolio: verify the anon row landed as pending, not reviewed; rejected rows did not land',
  $q$select (select status || ':' || (reviewed_by is null)::text from public.portfolio_submissions where email = 'zz-pf1@example.test') || ':' || (select count(*) from public.portfolio_submissions where email in ('zz-pf2@example.test','zz-pf3@example.test'))$q$,
  'pending:true:0');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('editor1'), 'role','authenticated')::text, true);
select public.zz_rows('portfolio/editor (non-admin): cannot approve (0 rows)',
  $q$update public.portfolio_submissions set status = 'approved' where email = 'zz-pf1@example.test'$q$, 0);
reset role;
select public.zz_val('portfolio: verify the row is still pending after editor attempt',
  $q$select status from public.portfolio_submissions where email = 'zz-pf1@example.test'$q$, 'pending');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('admin'), 'role','authenticated')::text, true);
select public.zz_rows('portfolio/admin: approves the row',
  $q$update public.portfolio_submissions set status = 'approved' where email = 'zz-pf1@example.test'$q$, 1);
reset role;
select public.zz_val('portfolio/admin: reviewed_by = admin and reviewed_at set by trigger',
  $q$select (reviewed_by = public.zz_uid('admin'))::text || ':' || (reviewed_at is not null)::text from public.portfolio_submissions where email = 'zz-pf1@example.test'$q$, 'true:true');

set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_val('portfolio/anon: now sees the approved row',
  $q$select count(*) from public.portfolio_submissions where full_name = 'ZZ Portfolio One'$q$, '1');
select public.zz_err('portfolio/anon: selecting email is denied',
  $q$select email from public.portfolio_submissions$q$, 'permission denied for (table|relation) portfolio_submissions');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('outsider'), 'role','authenticated')::text, true);
select public.zz_val('portfolio/plain authenticated user: sees 0 rows even though one is approved',
  $q$select count(*) from public.portfolio_submissions$q$, '0');
select public.zz_val('portfolio/plain authenticated user: cannot read the email (0 rows returned)',
  $q$select count(*) from public.portfolio_submissions where email = 'zz-pf1@example.test'$q$, '0');
reset role;

-- ============================================================================
-- STORAGE POLICIES (bucket opportunity-files on stubbed/real storage.objects)
-- ============================================================================
insert into storage.objects (bucket_id, name, owner) values
  ('opportunity-files', public.zz_uid('editor1') || '/own.pdf',   public.zz_uid('editor1')),
  ('opportunity-files', public.zz_uid('editor2') || '/other.pdf', public.zz_uid('editor2')),
  ('opportunity-files', public.zz_uid('editor2') || '/admin-del.pdf', public.zz_uid('editor2'));

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('editor1'), 'role','authenticated')::text, true);
select public.zz_ok('storage/editor: can insert object in own folder',
  $q$insert into storage.objects (bucket_id, name, owner) values ('opportunity-files', public.zz_uid('editor1') || '/poster.pdf', public.zz_uid('editor1'))$q$);
select public.zz_err('storage/editor: cannot insert into another user''s folder',
  $q$insert into storage.objects (bucket_id, name, owner) values ('opportunity-files', public.zz_uid('editor2') || '/x.pdf', public.zz_uid('editor1'))$q$, 'row-level security');
select public.zz_err('storage/editor: cannot insert in a different bucket',
  $q$insert into storage.buckets (id, name, public) values ('zz-other', 'zz-other', true)$q$, 'permission denied|row-level security');
select public.zz_val('storage/staff: can list objects (3 fixture objects + own new one = 4 of ours)',
  $q$select count(*) from storage.objects where bucket_id = 'opportunity-files' and name like any (array[public.zz_uid('editor1') || '/%', public.zz_uid('editor2') || '/%'])$q$, '4');
select public.zz_rows('storage/editor: can delete own-folder object',
  $q$delete from storage.objects where bucket_id = 'opportunity-files' and name = public.zz_uid('editor1') || '/own.pdf'$q$, 1);
select public.zz_rows('storage/editor: cannot delete another editor''s object (0 rows)',
  $q$delete from storage.objects where bucket_id = 'opportunity-files' and name = public.zz_uid('editor2') || '/other.pdf'$q$, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('outsider'), 'role','authenticated')::text, true);
select public.zz_err('storage/outsider: cannot insert (even in own-named folder)',
  $q$insert into storage.objects (bucket_id, name, owner) values ('opportunity-files', public.zz_uid('outsider') || '/x.pdf', public.zz_uid('outsider'))$q$, 'row-level security');
select public.zz_val('storage/outsider: cannot list (0 rows)',
  $q$select count(*) from storage.objects where bucket_id = 'opportunity-files'$q$, '0');
select public.zz_rows('storage/outsider: cannot delete (0 rows)',
  $q$delete from storage.objects where bucket_id = 'opportunity-files'$q$, 0);
reset role;

set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select public.zz_err('storage/anon: cannot insert',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', public.zz_uid('editor1') || '/anon.pdf')$q$, 'row-level security');
select public.zz_val('storage/anon: cannot list (0 rows)',
  $q$select count(*) from storage.objects where bucket_id = 'opportunity-files'$q$, '0');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', public.zz_uid('admin'), 'role','authenticated')::text, true);
select public.zz_rows('storage/admin: can delete any object (editor2''s)',
  $q$delete from storage.objects where bucket_id = 'opportunity-files' and name = public.zz_uid('editor2') || '/admin-del.pdf'$q$, 1);
reset role;
select public.zz_val('storage: verify surviving objects of ours = editor2 other.pdf + editor1 poster.pdf',
  $q$select string_agg(split_part(name,'/',2), ',' order by name) from storage.objects where bucket_id = 'opportunity-files' and (name like public.zz_uid('editor1') || '/%' or name like public.zz_uid('editor2') || '/%' or name like public.zz_uid('outsider') || '/%')$q$,
  case when public.zz_uid('editor1') < public.zz_uid('editor2') then 'poster.pdf,other.pdf' else 'other.pdf,poster.pdf' end);

-- ============================================================================
-- RESULT (last statement before ROLLBACK)
-- ============================================================================
select name, result, detail from (
  select n, name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from (select row_number() over (order by ctid) as n, * from public.zz_rls_results) r
  union all
  select 2147483647,
         'TOTAL: ' || count(*) filter (where not passed) || ' failed, ' || count(*) filter (where passed) || ' passed (' || count(*) || ' checks)',
         case when count(*) filter (where not passed) = 0 and count(*) = 0 + 999999 then 'FAIL'
              when count(*) filter (where not passed) = 0 then 'PASS' else 'FAIL' end,
         case when count(*) filter (where not passed) = 0 then 'all checks passed' else 'SEE FAIL ROWS ABOVE' end
  from public.zz_rls_results
) x order by n;
rollback;

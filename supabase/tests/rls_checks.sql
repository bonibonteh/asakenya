-- ============================================================================
-- ASA Kenya - access-rule self-test for migrations 001, 002 and 003
-- HOW TO USE: run migrations 001, 002 and 003 first, then paste this whole file into
-- Supabase -> SQL Editor and click Run.
--
-- It creates fake test users and data, pretends to be each kind of visitor
-- (public, signed-in outsider, editor, administrator) and checks every rule.
-- The LAST step deliberately raises an error whose text is the report. That makes
-- the database undo EVERYTHING this script did, so no test data is left behind.
--   * First line "ALL n CHECKS PASSED"  -> the rules work as designed.
--   * Any line starting "FAIL"          -> do not go live; send me that line.
-- If a later query complains "current transaction is aborted", run:  rollback;
--
-- Note: it inserts fake rows into auth.users (id, email only). If your project
-- rejects that, the error will say which extra column is required.
-- ============================================================================
begin;

create schema zz_rls_test;
create table zz_rls_test.results (n bigint generated always as identity primary key, name text, passed boolean, detail text);
create table zz_rls_test.ctx (k text primary key, v text);
grant usage on schema zz_rls_test to anon, authenticated;
grant select on zz_rls_test.ctx to anon, authenticated;

-- Recording is done by a definer function so test roles never need write access to the table.
create function zz_rls_test.log(p_name text, p_ok boolean, p_detail text) returns void
  language sql security definer set search_path = ''
  as $$ insert into zz_rls_test.results (name, passed, detail) values (p_name, p_ok, p_detail) $$;

-- The helpers below run the test statement as whoever is currently impersonated.
create function zz_rls_test.denied(p_name text, p_sql text, p_like text) returns void
  language plpgsql set search_path = '' as $$
begin
  begin
    execute p_sql;
    perform zz_rls_test.log(p_name, false, 'statement succeeded but should have been rejected');
  exception when others then
    perform zz_rls_test.log(p_name, sqlerrm ilike '%' || p_like || '%', sqlerrm);
  end;
end $$;

create function zz_rls_test.ok(p_name text, p_sql text) returns void
  language plpgsql set search_path = '' as $$
begin
  begin
    execute p_sql;
    perform zz_rls_test.log(p_name, true, '');
  exception when others then
    perform zz_rls_test.log(p_name, false, 'unexpected error: ' || sqlerrm);
  end;
end $$;

create function zz_rls_test.rows(p_name text, p_sql text, p_expected integer) returns void
  language plpgsql set search_path = '' as $$
declare n integer;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    perform zz_rls_test.log(p_name, n = p_expected, 'rows affected: ' || n || ', expected ' || p_expected);
  exception when others then
    perform zz_rls_test.log(p_name, false, 'unexpected error: ' || sqlerrm);
  end;
end $$;

create function zz_rls_test.val(p_name text, p_sql text, p_expected text) returns void
  language plpgsql set search_path = '' as $$
declare v text;
begin
  begin
    execute p_sql into v;
    perform zz_rls_test.log(p_name, v is not distinct from p_expected, 'got ' || coalesce(v, 'NULL') || ', expected ' || coalesce(p_expected, 'NULL'));
  exception when others then
    perform zz_rls_test.log(p_name, false, 'unexpected error: ' || sqlerrm);
  end;
end $$;

grant execute on all functions in schema zz_rls_test to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the database owner, who bypasses the rules)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'zz-admin@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'zz-editor1@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'zz-editor2@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a4', 'zz-outsider@example.invalid');
insert into public.staff_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'admin'),
  ('00000000-0000-4000-8000-0000000000a2', 'editor'),
  ('00000000-0000-4000-8000-0000000000a3', 'editor');

insert into public.opportunities (title, organisation, category, description, status, deadline, created_by) values
  ('zz pub null',    'ZZ Org', 'Competitions', 'zz description long enough', 'published', null,                       '00000000-0000-4000-8000-0000000000a1'),
  ('zz pub future',  'ZZ Org', 'Competitions', 'zz description long enough', 'published', current_date + 10,          '00000000-0000-4000-8000-0000000000a1'),
  ('zz pub expired', 'ZZ Org', 'Competitions', 'zz description long enough', 'published', current_date - 1,           '00000000-0000-4000-8000-0000000000a1'),
  ('zz archived',    'ZZ Org', 'Competitions', 'zz description long enough', 'archived',  null,                       '00000000-0000-4000-8000-0000000000a1'),
  ('zz draft e1',    'ZZ Org', 'Competitions', 'zz description long enough', 'draft',     null,                       '00000000-0000-4000-8000-0000000000a2'),
  ('zz pending e1',  'ZZ Org', 'Competitions', 'zz description long enough', 'pending',   null,                       '00000000-0000-4000-8000-0000000000a2'),
  ('zz pub e1',      'ZZ Org', 'Competitions', 'zz description long enough', 'published', null,                       '00000000-0000-4000-8000-0000000000a2'),
  ('zz draft e2',    'ZZ Org', 'Competitions', 'zz description long enough', 'draft',     null,                       '00000000-0000-4000-8000-0000000000a3');

insert into storage.objects (bucket_id, name) values
  ('opportunity-files', '00000000-0000-4000-8000-0000000000a2/old.pdf'),
  ('opportunity-files', '00000000-0000-4000-8000-0000000000a3/their.pdf');

-- ===========================================================================
-- ACTOR 1: PUBLIC VISITOR (not signed in)
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select zz_rls_test.val('public: sees published rows with no deadline or a future deadline',
  $q$select count(*)::text from public.opportunities where title in ('zz pub null','zz pub future')$q$, '2');
select zz_rls_test.val('public: does NOT see draft, pending, archived or expired rows',
  $q$select count(*)::text from public.opportunities where title in ('zz pub expired','zz archived','zz draft e1','zz pending e1','zz draft e2')$q$, '0');
select zz_rls_test.denied('public: select * is refused (creator column is private)',
  $q$select * from public.opportunities$q$, 'permission denied');
select zz_rls_test.denied('public: cannot read created_by',
  $q$select created_by from public.opportunities$q$, 'permission denied');
select zz_rls_test.ok('public: the 15 public columns can be read',
  $q$select id,title,organisation,category,description,location,apply_url,deadline,file_url,eligibility,audience,status,published_at,created_at,updated_at from public.opportunities$q$);
select zz_rls_test.denied('public: source (staff-only note) cannot be read',
  $q$select source from public.opportunities$q$, 'permission denied');
select zz_rls_test.denied('public: cannot insert an opportunity',
  $q$insert into public.opportunities (title,organisation,category,description) values ('zz x1','O','Competitions','zz description long enough')$q$, 'permission denied');
select zz_rls_test.denied('public: cannot update an opportunity',
  $q$update public.opportunities set title = 'hacked'$q$, 'permission denied');
select zz_rls_test.denied('public: cannot delete an opportunity',
  $q$delete from public.opportunities$q$, 'permission denied');
select zz_rls_test.denied('public: cannot read staff roles',
  $q$select count(*) from public.staff_roles$q$, 'permission denied');
select zz_rls_test.denied('public: cannot read graduate interest submissions',
  $q$select count(*) from public.graduate_interest$q$, 'permission denied');
select zz_rls_test.denied('public: cannot read alert subscriptions',
  $q$select count(*) from public.alert_subscriptions$q$, 'permission denied');
select zz_rls_test.val('public: cannot list private storage objects',
  $q$select count(*)::text from storage.objects where bucket_id = 'opportunity-files'$q$, '0');
select zz_rls_test.denied('public: cannot upload a file',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', '00000000-0000-4000-8000-0000000000a2/evil.pdf')$q$, 'row-level security');

-- Graduate interest form (public may only insert)
select zz_rls_test.ok('graduate form: public insert with consent works',
  $q$insert into public.graduate_interest (full_name,email,university,graduation_year,consent) values ('ZZ Grad','zz-grad@example.invalid','University of Nairobi',2025,true)$q$);
select zz_rls_test.denied('graduate form: consent=false is rejected',
  $q$insert into public.graduate_interest (full_name,email,university,graduation_year,consent) values ('ZZ Grad2','zz-grad2@example.invalid','University of Nairobi',2025,false)$q$, 'violates');
select zz_rls_test.denied('graduate form: graduate without university is rejected',
  $q$insert into public.graduate_interest (full_name,email,graduation_year,consent) values ('ZZ Grad3','zz-grad3@example.invalid',2025,true)$q$, 'violates');
select zz_rls_test.ok('graduate form: mentor without university is accepted',
  $q$insert into public.graduate_interest (interest_type,full_name,email,consent) values ('mentor','ZZ Mentor','zz-mentor@example.invalid',true)$q$);
select zz_rls_test.denied('graduate form: bad email is rejected',
  $q$insert into public.graduate_interest (full_name,email,university,graduation_year,consent) values ('ZZ Bad','not-an-email','University of Nairobi',2025,true)$q$, 'violates');
select zz_rls_test.denied('graduate form: public cannot choose the id or created_at',
  $q$insert into public.graduate_interest (id,full_name,email,university,graduation_year,consent) values (gen_random_uuid(),'ZZ Id','zz-id@example.invalid','University of Nairobi',2025,true)$q$, 'permission denied');
select zz_rls_test.denied('graduate form: http:// portfolio link is rejected',
  $q$insert into public.graduate_interest (full_name,email,university,graduation_year,portfolio_url,consent) values ('ZZ Url','zz-url@example.invalid','University of Nairobi',2025,'http://example.invalid',true)$q$, 'violates');

-- Alert subscriptions
select zz_rls_test.ok('alerts: public can create a pending subscription',
  $q$insert into public.alert_subscriptions (email,categories,consent) values ('zz-alert@example.invalid', array['Jobs'], true)$q$);
select zz_rls_test.denied('alerts: duplicate email (any letter case) is rejected',
  $q$insert into public.alert_subscriptions (email,categories,consent) values ('ZZ-Alert@Example.invalid', array['Jobs'], true)$q$, 'duplicate key');
select zz_rls_test.denied('alerts: public cannot mark itself confirmed',
  $q$insert into public.alert_subscriptions (email,categories,consent,confirmed_at) values ('zz-alert2@example.invalid', array['Jobs'], true, now())$q$, 'permission denied');
select zz_rls_test.denied('alerts: consent=false is rejected',
  $q$insert into public.alert_subscriptions (email,categories,consent) values ('zz-alert3@example.invalid', array['Jobs'], false)$q$, 'violates');
select zz_rls_test.denied('alerts: empty category list is rejected',
  $q$insert into public.alert_subscriptions (email,categories,consent) values ('zz-alert4@example.invalid', '{}', true)$q$, 'violates');
select zz_rls_test.val('alerts: confirming with a wrong token does nothing',
  $q$select public.confirm_alert_subscription(gen_random_uuid())::text$q$, 'false');
select zz_rls_test.val('alerts: unsubscribing with a wrong token does nothing',
  $q$select public.unsubscribe_alert(gen_random_uuid())::text$q$, 'false');

-- Portfolio showcase
select zz_rls_test.ok('portfolio: public can submit (consent given)',
  $q$insert into public.portfolio_submissions (full_name,email,university,graduation_year,headline,portfolio_url,consent_publish) values ('ZZ Pf Pending','zz-pf1@example.invalid','University of Nairobi',2025,'zz headline','https://example.invalid/pf',true)$q$);
select zz_rls_test.ok('portfolio: second submission, will be approved later',
  $q$insert into public.portfolio_submissions (full_name,email,university,graduation_year,headline,portfolio_url,consent_publish) values ('ZZ Pf Approve','zz-pf2@example.invalid','University of Nairobi',2025,'zz headline','https://example.invalid/pf2',true)$q$);
select zz_rls_test.denied('portfolio: public cannot self-approve on submit',
  $q$insert into public.portfolio_submissions (full_name,email,university,graduation_year,headline,portfolio_url,consent_publish,status) values ('ZZ Pf Self','zz-pf3@example.invalid','University of Nairobi',2025,'zz headline','https://example.invalid/pf3','true'::boolean,'approved')$q$, 'permission denied');
select zz_rls_test.denied('portfolio: submission without publishing consent is rejected',
  $q$insert into public.portfolio_submissions (full_name,email,university,graduation_year,headline,portfolio_url,consent_publish) values ('ZZ Pf NoC','zz-pf4@example.invalid','University of Nairobi',2025,'zz headline','https://example.invalid/pf4',false)$q$, 'violates');
select zz_rls_test.val('portfolio: public cannot see pending submissions',
  $q$select count(*)::text from public.portfolio_submissions where full_name like 'ZZ Pf%'$q$, '0');
select zz_rls_test.denied('portfolio: public cannot update',
  $q$update public.portfolio_submissions set status = 'approved'$q$, 'permission denied');
reset role;

-- Capture the secret tokens as the owner, so the public RPC calls can be tested with the REAL tokens.
insert into zz_rls_test.ctx select 'confirm_token',     confirm_token::text     from public.alert_subscriptions where email = 'zz-alert@example.invalid';
insert into zz_rls_test.ctx select 'unsubscribe_token', unsubscribe_token::text from public.alert_subscriptions where email = 'zz-alert@example.invalid';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select zz_rls_test.val('alerts: confirming with the real token works',
  $q$select public.confirm_alert_subscription(v::uuid)::text from zz_rls_test.ctx where k = 'confirm_token'$q$, 'true');
select zz_rls_test.val('alerts: unsubscribing with the real token works',
  $q$select public.unsubscribe_alert(v::uuid)::text from zz_rls_test.ctx where k = 'unsubscribe_token'$q$, 'true');
reset role;

select zz_rls_test.log('alerts: confirmed_at and unsubscribed_at were recorded by the database',
  (select confirmed_at is not null and unsubscribed_at is not null from public.alert_subscriptions where email = 'zz-alert@example.invalid'), '');
select zz_rls_test.log('portfolio: a public submission starts as pending',
  (select status = 'pending' from public.portfolio_submissions where full_name = 'ZZ Pf Pending'), '');

-- ===========================================================================
-- ACTOR 2: SIGNED-IN OUTSIDER (has an account but no staff role)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);

select zz_rls_test.val('outsider: sees only public opportunities (not drafts)',
  $q$select count(*)::text from public.opportunities where title like 'zz %'$q$, '3');   -- pub null, pub future, pub e1
select zz_rls_test.denied('outsider: cannot create an opportunity',
  $q$insert into public.opportunities (title,organisation,category,description) values ('zz o1','O','Competitions','zz description long enough')$q$, 'row-level security');
select zz_rls_test.denied('outsider: cannot insert a staff role for themselves',
  $q$insert into public.staff_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a4', 'admin')$q$, 'permission denied');
select zz_rls_test.val('outsider: sees no staff role rows',
  $q$select count(*)::text from public.staff_roles$q$, '0');
select zz_rls_test.val('outsider: cannot read graduate interest submissions',
  $q$select count(*)::text from public.graduate_interest$q$, '0');
select zz_rls_test.val('outsider: cannot read portfolio emails (even of approved rows)',
  $q$select count(email)::text from public.portfolio_submissions$q$, '0');
select zz_rls_test.denied('outsider: cannot upload a file',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', '00000000-0000-4000-8000-0000000000a4/x.pdf')$q$, 'row-level security');
select zz_rls_test.val('outsider: cannot list storage objects',
  $q$select count(*)::text from storage.objects where bucket_id = 'opportunity-files'$q$, '0');
reset role;

-- ===========================================================================
-- ACTOR 3: EDITOR (editor1)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select zz_rls_test.ok('editor: can create a draft as themselves',
  $q$insert into public.opportunities (title,organisation,category,description,status) values ('zz new draft','Org','Jobs','zz description long enough','draft')$q$);
select zz_rls_test.ok('editor: can submit a pending record',
  $q$insert into public.opportunities (title,organisation,category,description,status) values ('zz new pending','Org','Jobs','zz description long enough','pending')$q$);
select zz_rls_test.denied('editor: cannot create a published record',
  $q$insert into public.opportunities (title,organisation,category,description,status) values ('zz sneaky pub','Org','Jobs','zz description long enough','published')$q$, 'row-level security');
select zz_rls_test.denied('editor: cannot create an archived record',
  $q$insert into public.opportunities (title,organisation,category,description,status) values ('zz sneaky arch','Org','Jobs','zz description long enough','archived')$q$, 'row-level security');
select zz_rls_test.denied('editor: cannot create a record in another person''s name',
  $q$insert into public.opportunities (title,organisation,category,description,status,created_by) values ('zz forged','Org','Jobs','zz description long enough','draft','00000000-0000-4000-8000-0000000000a3')$q$, 'row-level security');
select zz_rls_test.denied('validation: http:// apply link is rejected',
  $q$insert into public.opportunities (title,organisation,category,description,apply_url) values ('zz badurl','Org','Jobs','zz description long enough','http://example.invalid')$q$, 'violates check constraint');
select zz_rls_test.denied('validation: unknown category is rejected',
  $q$insert into public.opportunities (title,organisation,category,description) values ('zz badcat','Org','Nonsense','zz description long enough')$q$, 'violates check constraint');
select zz_rls_test.denied('validation: 2-character title is rejected',
  $q$insert into public.opportunities (title,organisation,category,description) values ('ab','Org','Jobs','zz description long enough')$q$, 'violates check constraint');
select zz_rls_test.denied('validation: javascript: file link is rejected',
  $q$insert into public.opportunities (title,organisation,category,description,file_url) values ('zz badfile','Org','Jobs','zz description long enough','javascript:alert(1)')$q$, 'violates check constraint');

select zz_rls_test.val('editor: sees own draft',            $q$select count(*)::text from public.opportunities where title = 'zz draft e1'$q$, '1');
select zz_rls_test.val('editor: sees own pending record',   $q$select count(*)::text from public.opportunities where title = 'zz pending e1'$q$, '1');
select zz_rls_test.val('editor: does NOT see another editor''s draft', $q$select count(*)::text from public.opportunities where title = 'zz draft e2'$q$, '0');
select zz_rls_test.val('editor: does NOT see archived or expired records of others', $q$select count(*)::text from public.opportunities where title in ('zz archived','zz pub expired')$q$, '0');

select zz_rls_test.rows('editor: can move own draft to pending',
  $q$update public.opportunities set status = 'pending' where title = 'zz draft e1'$q$, 1);
select zz_rls_test.denied('editor: cannot publish own record',
  $q$update public.opportunities set status = 'published' where title = 'zz draft e1'$q$, 'row-level security');
select zz_rls_test.denied('editor: cannot archive own record',
  $q$update public.opportunities set status = 'archived' where title = 'zz draft e1'$q$, 'row-level security');
select zz_rls_test.rows('editor: cannot edit a record once it is published',
  $q$update public.opportunities set title = 'zz changed' where title = 'zz pub e1'$q$, 0);
select zz_rls_test.rows('editor: cannot edit another person''s record',
  $q$update public.opportunities set title = 'zz changed' where title = 'zz draft e2'$q$, 0);
select zz_rls_test.ok('editor: attempt to hand own record to someone else (ignored by the trigger, verified below)',
  $q$update public.opportunities set created_by = '00000000-0000-4000-8000-0000000000a3' where title = 'zz new draft'$q$);
select zz_rls_test.ok('editor: can try to forge published_at (ignored by the database)',
  $q$update public.opportunities set published_at = now() - interval '30 days' where title = 'zz new draft'$q$);
select zz_rls_test.rows('editor: cannot delete anything (own draft)',
  $q$delete from public.opportunities where title = 'zz new draft'$q$, 0);
select zz_rls_test.rows('editor: cannot delete anything (published)',
  $q$delete from public.opportunities where title = 'zz pub null'$q$, 0);

select zz_rls_test.val('roles: editor sees only their own role row',
  $q$select count(*)::text from public.staff_roles$q$, '1');
select zz_rls_test.denied('roles: editor cannot grant themselves admin (insert)',
  $q$insert into public.staff_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a2', 'admin')$q$, 'permission denied');
select zz_rls_test.denied('roles: editor cannot promote themselves (update)',
  $q$update public.staff_roles set role = 'admin' where user_id = '00000000-0000-4000-8000-0000000000a2'$q$, 'permission denied');
select zz_rls_test.denied('roles: editor cannot delete roles',
  $q$delete from public.staff_roles$q$, 'permission denied');

select zz_rls_test.val('storage: staff can list files', $q$select count(*)::text from storage.objects where bucket_id = 'opportunity-files'$q$, '2');
select zz_rls_test.ok('storage: editor can upload into their own folder',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', '00000000-0000-4000-8000-0000000000a2/poster.pdf')$q$);
select zz_rls_test.denied('storage: editor cannot upload into someone else''s folder',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', '00000000-0000-4000-8000-0000000000a3/x.pdf')$q$, 'row-level security');
select zz_rls_test.denied('storage: editor cannot upload outside the bucket folders rule (no folder)',
  $q$insert into storage.objects (bucket_id, name) values ('opportunity-files', 'loose.pdf')$q$, 'row-level security');
select zz_rls_test.rows('storage: editor can delete own file',
  $q$delete from storage.objects where name = '00000000-0000-4000-8000-0000000000a2/old.pdf'$q$, 1);
select zz_rls_test.rows('storage: editor cannot delete another editor''s file',
  $q$delete from storage.objects where name = '00000000-0000-4000-8000-0000000000a3/their.pdf'$q$, 0);

select zz_rls_test.val('graduate form data: an editor (non-admin) cannot read submissions',
  $q$select count(*)::text from public.graduate_interest$q$, '0');
select zz_rls_test.val('alerts: an editor (non-admin) cannot read subscriptions',
  $q$select count(*)::text from public.alert_subscriptions$q$, '0');
select zz_rls_test.rows('portfolio: an editor (non-admin) cannot approve submissions',
  $q$update public.portfolio_submissions set status = 'approved' where full_name = 'ZZ Pf Approve'$q$, 0);
reset role;

-- ===========================================================================
-- ACTOR 4: ADMINISTRATOR
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select zz_rls_test.val('admin: sees drafts, expired and archived records',
  $q$select count(*)::text from public.opportunities where title in ('zz pub expired','zz archived','zz draft e2','zz draft e1')$q$, '4');
select zz_rls_test.ok('admin: can create a published record directly',
  $q$insert into public.opportunities (title,organisation,category,description,status) values ('zz admin pub','Org','Jobs','zz description long enough','published')$q$);
select zz_rls_test.rows('admin: can approve and publish a pending record',
  $q$update public.opportunities set status = 'published' where title = 'zz pending e1'$q$, 1);
select zz_rls_test.rows('admin: can archive a record',
  $q$update public.opportunities set status = 'archived' where title = 'zz pub null'$q$, 1);
select zz_rls_test.rows('admin: can edit another person''s record',
  $q$update public.opportunities set description = 'zz edited by admin okay' where title = 'zz draft e2'$q$, 1);
select zz_rls_test.ok('admin: can try to reassign created_by (ignored by the database)',
  $q$update public.opportunities set created_by = '00000000-0000-4000-8000-0000000000a3' where title = 'zz draft e1'$q$);
select zz_rls_test.rows('admin: can delete a record',
  $q$delete from public.opportunities where title = 'zz draft e2'$q$, 1);

select zz_rls_test.val('admin: sees graduate interest submissions',
  $q$select (count(*) >= 2)::text from public.graduate_interest$q$, 'true');
select zz_rls_test.val('admin: sees alert subscriptions (email + categories)',
  $q$select (count(email) >= 1)::text from public.alert_subscriptions$q$, 'true');
select zz_rls_test.denied('admin: cannot read the secret confirm token',
  $q$select confirm_token from public.alert_subscriptions$q$, 'permission denied');
select zz_rls_test.denied('admin: cannot read the secret unsubscribe token',
  $q$select unsubscribe_token from public.alert_subscriptions$q$, 'permission denied');
select zz_rls_test.val('admin: sees pending portfolio submissions',
  $q$select count(*)::text from public.portfolio_submissions where full_name like 'ZZ Pf%'$q$, '2');
select zz_rls_test.rows('admin: can approve a portfolio submission',
  $q$update public.portfolio_submissions set status = 'approved' where full_name = 'ZZ Pf Approve'$q$, 1);
select zz_rls_test.denied('admin: cannot edit other portfolio fields (only status)',
  $q$update public.portfolio_submissions set headline = 'changed'$q$, 'permission denied');
select zz_rls_test.rows('storage: admin can delete anyone''s file',
  $q$delete from storage.objects where name = '00000000-0000-4000-8000-0000000000a3/their.pdf'$q$, 1);
select zz_rls_test.denied('roles: even an admin cannot change roles from the website',
  $q$insert into public.staff_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a4', 'admin')$q$, 'permission denied');
reset role;

-- Database-side effects the browser must not be able to forge
select zz_rls_test.log('trigger: publishing set published_at',
  (select published_at is not null from public.opportunities where title = 'zz pending e1'), '');
select zz_rls_test.log('trigger: an editor cannot forge published_at on a draft',
  (select published_at is null from public.opportunities where title = 'zz new draft'), '');
select zz_rls_test.log('trigger: editor cannot reassign created_by on own draft',
  (select created_by = '00000000-0000-4000-8000-0000000000a2' from public.opportunities where title = 'zz new draft'), '');
select zz_rls_test.log('trigger: created_by cannot be reassigned, even by an admin',
  (select created_by = '00000000-0000-4000-8000-0000000000a2' from public.opportunities where title = 'zz draft e1'), '');
select zz_rls_test.log('portfolio: approving records who reviewed it and when',
  (select reviewed_by = '00000000-0000-4000-8000-0000000000a1' and reviewed_at is not null from public.portfolio_submissions where full_name = 'ZZ Pf Approve'), '');

-- Approved portfolio entries become public, without the email
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select zz_rls_test.val('portfolio: public now sees the approved entry (only)',
  $q$select count(*)::text from public.portfolio_submissions where full_name like 'ZZ Pf%'$q$, '1');
select zz_rls_test.denied('portfolio: public cannot read email addresses',
  $q$select email from public.portfolio_submissions$q$, 'permission denied');
select zz_rls_test.ok('portfolio: public columns can be read',
  $q$select id,full_name,university,graduation_year,headline,bio,portfolio_url,created_at,status from public.portfolio_submissions$q$);
select zz_rls_test.val('public: the admin''s archive/publish changes are reflected (archived row now hidden)',
  $q$select count(*)::text from public.opportunities where title in ('zz pub null')$q$, '0');
reset role;

-- ---------------------------------------------------------------------------
-- MIGRATION 003: events and announcements (admin-managed, public reads published only)
-- ---------------------------------------------------------------------------
reset role;
insert into public.events (title, association, description, event_date, venue, status, created_by) values
  ('zz ev published','ASA Kenya','A published event description', current_date + 5, 'Nairobi', 'published', '00000000-0000-4000-8000-0000000000a1'),
  ('zz ev draft','ASA Kenya','A draft event description here', current_date + 6, 'Nairobi', 'draft', '00000000-0000-4000-8000-0000000000a1'),
  ('zz ev past','ASA TUK','A past event that stays visible', current_date - 20, 'Nairobi', 'published', '00000000-0000-4000-8000-0000000000a1');
insert into public.announcements (title, kind, body, status, created_by) values
  ('zz news published','News','This is a published announcement.','published','00000000-0000-4000-8000-0000000000a1'),
  ('zz news draft','Announcement','This announcement is still a draft.','draft','00000000-0000-4000-8000-0000000000a1');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select zz_rls_test.val('003 public: sees published events only (incl. past ones)',
  $q$select count(*)::text from public.events where title like 'zz ev%'$q$, '2');
select zz_rls_test.val('003 public: draft event hidden',
  $q$select count(*)::text from public.events where title = 'zz ev draft'$q$, '0');
select zz_rls_test.val('003 public: sees published announcements only',
  $q$select count(*)::text from public.announcements where title like 'zz news%'$q$, '1');
select zz_rls_test.denied('003 public: cannot read events.created_by',
  $q$select created_by from public.events$q$, 'permission denied');
select zz_rls_test.denied('003 public: cannot read announcements.created_by',
  $q$select created_by from public.announcements$q$, 'permission denied');
select zz_rls_test.denied('003 public: cannot insert an event',
  $q$insert into public.events (title, description, event_date, venue) values ('zz x','long enough text', current_date, 'v')$q$, 'permission denied');
select zz_rls_test.denied('003 public: cannot insert an announcement',
  $q$insert into public.announcements (title, body) values ('zz x','long enough body text')$q$, 'permission denied');
select zz_rls_test.denied('003 public: cannot update an event',
  $q$update public.events set title = 'zz hacked'$q$, 'permission denied');
select zz_rls_test.denied('003 public: cannot delete an announcement',
  $q$delete from public.announcements$q$, 'permission denied');
reset role;

-- editor (a2): no write power over events/announcements, and sees only published ones
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000a2"}', true);
select zz_rls_test.val('003 editor: reads published events only',
  $q$select count(*)::text from public.events where title like 'zz ev%'$q$, '2');
select zz_rls_test.denied('003 editor: cannot create an event',
  $q$insert into public.events (title, description, event_date, venue, created_by) values ('zz e','long enough text', current_date, 'v', '00000000-0000-4000-8000-0000000000a2')$q$, 'row-level security');
select zz_rls_test.rows('003 editor: cannot update an event (0 rows)',
  $q$update public.events set title = 'zz hacked' where title = 'zz ev published'$q$, 0);
select zz_rls_test.rows('003 editor: cannot delete an announcement (0 rows)',
  $q$delete from public.announcements where title = 'zz news published'$q$, 0);
reset role;

-- outsider (a4, no role): same as the public
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000a4"}', true);
select zz_rls_test.val('003 outsider: sees published events only',
  $q$select count(*)::text from public.events where title like 'zz ev%'$q$, '2');
select zz_rls_test.denied('003 outsider: cannot create an announcement',
  $q$insert into public.announcements (title, body, created_by) values ('zz o','long enough body text','00000000-0000-4000-8000-0000000000a4')$q$, 'row-level security');
reset role;

-- admin (a1): full control, server-controlled fields, constraints
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000a1"}', true);
select zz_rls_test.val('003 admin: sees drafts too',
  $q$select count(*)::text from public.events where title like 'zz ev%'$q$, '3');
select zz_rls_test.ok('003 admin: can create an event',
  $q$insert into public.events (title, association, description, event_date, start_time, end_time, online_url, created_by, status) values ('zz ev new','ASA KU','Online workshop for everyone', current_date + 9, '14:00', '16:00', 'https://meet.example/abc', '00000000-0000-4000-8000-0000000000a1', 'published')$q$);
select zz_rls_test.denied('003 admin: event needs a venue or online link',
  $q$insert into public.events (title, description, event_date, created_by) values ('zz noplace','long enough text', current_date, '00000000-0000-4000-8000-0000000000a1')$q$, 'events_place_ck');
select zz_rls_test.denied('003 admin: end time cannot be before start time',
  $q$insert into public.events (title, description, event_date, start_time, end_time, venue, created_by) values ('zz time','long enough text', current_date, '15:00','14:00','v','00000000-0000-4000-8000-0000000000a1')$q$, 'events_time_order_ck');
select zz_rls_test.denied('003 admin: unknown association rejected',
  $q$insert into public.events (title, association, description, event_date, venue, created_by) values ('zz assoc','Evil Corp','long enough text', current_date, 'v','00000000-0000-4000-8000-0000000000a1')$q$, 'check constraint');
select zz_rls_test.denied('003 admin: http image link rejected',
  $q$insert into public.events (title, description, event_date, venue, image_url, created_by) values ('zz img','long enough text', current_date, 'v','http://x.example/a.png','00000000-0000-4000-8000-0000000000a1')$q$, 'check constraint');
select zz_rls_test.rows('003 admin: can unpublish an event',
  $q$update public.events set status = 'draft' where title = 'zz ev published'$q$, 1);
select zz_rls_test.rows('003 admin: can publish an announcement',
  $q$update public.announcements set status = 'published' where title = 'zz news draft'$q$, 1);
select zz_rls_test.rows('003 admin: can delete an event',
  $q$delete from public.events where title = 'zz ev past'$q$, 1);
select zz_rls_test.rows('003 admin: can delete an announcement',
  $q$delete from public.announcements where title = 'zz news published'$q$, 1);
reset role;
select zz_rls_test.log('003 trigger: published_at set when an announcement is first published',
  (select published_at is not null from public.announcements where title = 'zz news draft'), '');
select zz_rls_test.log('003 trigger: authorship cannot change',
  (select created_by = '00000000-0000-4000-8000-0000000000a1' from public.events where title = 'zz ev new'), '');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select zz_rls_test.val('003 public: unpublished event disappears at once',
  $q$select count(*)::text from public.events where title = 'zz ev published'$q$, '0');
select zz_rls_test.val('003 public: newly published event appears',
  $q$select count(*)::text from public.events where title = 'zz ev new'$q$, '1');
reset role;

-- ---------------------------------------------------------------------------
-- REPORT. The error below is intentional: raising it makes the database undo the whole script.
-- ---------------------------------------------------------------------------
do $report$
declare
  total integer; failed integer; lines text;
begin
  select count(*), count(*) filter (where not passed) into total, failed from zz_rls_test.results;
  select string_agg((case when passed then 'PASS  ' else 'FAIL  ' end) || name || case when passed or detail = '' then '' else '   -> ' || detail end, E'\n' order by n)
    into lines from zz_rls_test.results;
  raise exception E'%\n\n%\n\n(This error is intentional: it rolls back all test data.)',
    case when failed = 0 then 'ALL ' || total || ' CHECKS PASSED' else failed || ' OF ' || total || ' CHECKS FAILED' end, lines;
end
$report$;

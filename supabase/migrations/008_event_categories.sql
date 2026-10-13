-- 008_event_categories.sql
-- Add an optional category to events without changing existing event records.
begin;
alter table public.events add column if not exists category text;
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
  check (category is null or category in ('Conference','Workshop','Competition','Site visit','Exhibition','Talk','Networking','Other'));
grant select (category) on public.events to anon;
commit;

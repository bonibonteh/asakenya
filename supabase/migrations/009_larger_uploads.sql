-- ASA Kenya upload cap increase.
-- Safe to re-run; preserves bucket visibility, MIME allow-lists and Storage RLS policies.
begin;

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id in ('opportunity-files', 'student-submissions');

-- Fail clearly if the expected buckets have not been created by migrations 001 and 005.
do $$
begin
  if (select count(*) from storage.buckets
      where id in ('opportunity-files', 'student-submissions')) <> 2 then
    raise exception 'Expected opportunity-files and student-submissions buckets. Run migrations 001 and 005 first.';
  end if;
end $$;

commit;

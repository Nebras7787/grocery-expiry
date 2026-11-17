-- Enable Supabase Realtime for live cross-device sync.
-- Run this in the Supabase SQL Editor (or `supabase db push`).
--
-- Without it the app still works: deletes and additions sync on the next pull
-- (30s auto-sync / app foreground), but they are not pushed instantly.

-- 1) Make sure the publication exists (Supabase normally creates it).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2) Add both tables, idempotently.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'product_batches'
  ) then
    alter publication supabase_realtime add table public.product_batches;
  end if;
end $$;

-- 3) DELETE events carry the old row. `full` also lets Realtime evaluate the
--    per-user RLS policy for deletes reliably.
alter table public.products replica identity full;
alter table public.product_batches replica identity full;

-- 4) Sanity check: both rows should appear.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;

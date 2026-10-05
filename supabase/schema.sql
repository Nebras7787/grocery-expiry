-- =============================================
-- Grocery Expiry & Inventory — Supabase Schema
-- Run in Supabase SQL Editor (or via `supabase db push`)
-- =============================================

-- Enable pgcrypto for gen_random_uuid() if not enabled
create extension if not exists "pgcrypto";

-- -------------------------------------------------
-- 1. ENUM for batch status
-- -------------------------------------------------
do $$ begin
  create type batch_status as enum ('valid', 'near_expiry', 'expired');
exception when duplicate_object then null;
end $$;

-- -------------------------------------------------
-- 2. Table: products
-- -------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General'
    check (category in ('Dairy','Bakery','Canned Goods','Beverages','Frozen','Produce','Meat','Snacks','General','Other')),
  created_at timestamptz not null default now(),
  -- Optional owner for RLS per-user isolation
  user_id uuid references auth.users(id) on delete cascade
);

create index if not exists idx_products_user_id on public.products(user_id);
create index if not exists idx_products_category on public.products(category);

-- Enable trigram extension for search.
-- Must come BEFORE the GIN index below: gin_trgm_ops is provided by pg_trgm,
-- and Postgres validates the operator class while creating the index.
create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

comment on table public.products is 'Master list of grocery products';
comment on column public.products.category is 'Product category for quick filtering';

-- -------------------------------------------------
-- 3. Table: product_batches
-- -------------------------------------------------
create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  expiry_date date not null,
  status batch_status not null default 'valid',
  is_notified boolean not null default false,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  -- keep denormalized expiry check fast
  constraint expiry_not_in_distant_past check (expiry_date >= '2000-01-01')
);

create index if not exists idx_batches_product_id on public.product_batches(product_id);
create index if not exists idx_batches_expiry_date on public.product_batches(expiry_date);
create index if not exists idx_batches_status on public.product_batches(status);
create index if not exists idx_batches_user_id on public.product_batches(user_id);
create index if not exists idx_batches_expiry_status on public.product_batches(expiry_date, status);

comment on table public.product_batches is 'Inventory batches with expiry tracking';
comment on column public.product_batches.status is 'Computed: valid (>30d), near_expiry (<=30d & >=0), expired (<0)';
comment on column public.product_batches.is_notified is 'Whether expiry notification was sent';

-- -------------------------------------------------
-- 4. Helper function: compute status from expiry_date
-- -------------------------------------------------
create or replace function public.compute_batch_status(expiry date)
returns batch_status
language plpgsql immutable as $$
begin
  if expiry < current_date then
    return 'expired'::batch_status;
  elsif expiry <= current_date + interval '30 days' then
    return 'near_expiry'::batch_status;
  else
    return 'valid'::batch_status;
  end if;
end;
$$;

-- -------------------------------------------------
-- 5. Trigger: auto-set status on insert/update
-- -------------------------------------------------
create or replace function public.set_batch_status()
returns trigger
language plpgsql as $$
begin
  new.status := public.compute_batch_status(new.expiry_date);
  return new;
end;
$$;

drop trigger if exists trg_set_batch_status on public.product_batches;
create trigger trg_set_batch_status
  before insert or update of expiry_date on public.product_batches
  for each row execute function public.set_batch_status();

-- Backfill existing rows (if any)
update public.product_batches set status = public.compute_batch_status(expiry_date) where true;

-- -------------------------------------------------
-- 6. Cron helper: refresh all statuses (call daily)
-- -------------------------------------------------
create or replace function public.refresh_batch_statuses()
returns integer
language plpgsql security definer as $$
declare
  updated int;
begin
  update public.product_batches
    set status = public.compute_batch_status(expiry_date)
    where status != public.compute_batch_status(expiry_date);
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- -------------------------------------------------
-- 7. Views: expiring windows & analytics
-- -------------------------------------------------

-- Priority list: all batches closest to expiry first
create or replace view public.v_batches_priority as
select
  b.id,
  b.product_id,
  p.name as product_name,
  p.category,
  b.quantity,
  b.expiry_date,
  b.status,
  b.is_notified,
  b.created_at,
  b.user_id,
  (b.expiry_date - current_date) as days_until_expiry
from public.product_batches b
join public.products p on p.id = b.product_id
order by b.expiry_date asc;

-- Expiring within 30 / 14 / 3 days (reusable)
create or replace view public.v_expiring_30d as
select * from public.v_batches_priority
where expiry_date between current_date and current_date + interval '30 days'
and status != 'expired';

create or replace view public.v_expiring_14d as
select * from public.v_batches_priority
where expiry_date between current_date and current_date + interval '14 days'
and status != 'expired';

create or replace view public.v_expiring_3d as
select * from public.v_batches_priority
where expiry_date between current_date and current_date + interval '3 days'
and status != 'expired';

-- Expired
create or replace view public.v_expired as
select * from public.v_batches_priority where status = 'expired';

-- Dashboard aggregation per user (or global if RLS disabled)
create or replace view public.v_dashboard_stats as
select
  user_id,
  count(*) filter (where status = 'expired') as expired_count,
  count(*) filter (where status = 'near_expiry') as near_expiry_count,
  count(*) filter (where expiry_date between current_date and current_date + interval '7 days') as expiring_this_week,
  count(*) filter (where status != 'expired') as active_batches,
  sum(quantity) filter (where status != 'expired') as total_active_quantity,
  count(distinct product_id) as distinct_products
from public.product_batches
group by user_id;

-- -------------------------------------------------
-- 8. Row Level Security
-- -------------------------------------------------
alter table public.products enable row level security;
alter table public.product_batches enable row level security;

-- Helper: allow anon for local dev if you want open access -> comment out below and use permissive policies.
-- For production: per-user isolation.

-- Drop existing policies to make script idempotent
drop policy if exists "Authenticated can manage own products" on public.products;
drop policy if exists "Authenticated can manage own batches" on public.product_batches;
drop policy if exists "Allow all for service_role" on public.products;
drop policy if exists "Allow all for service_role" on public.product_batches;
drop policy if exists "Public read for demo (remove in prod)" on public.products;
drop policy if exists "Public read for demo (remove in prod)" on public.product_batches;

-- Production-grade: authenticated users only manage their own rows
create policy "Authenticated can manage own products"
  on public.products for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated can manage own batches"
  on public.product_batches for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role bypasses RLS anyway, but explicit for clarity (Supabase service_role)
-- Optional: demo/open policy for offline-first local setup where auth is not yet configured.
-- UNCOMMENT the two policies below if you want an open dev mode without auth:
-- create policy "Public read for demo (remove in prod)" on public.products for all to anon, authenticated using (true) with check (true);
-- create policy "Public read for demo (remove in prod)" on public.product_batches for all to anon, authenticated using (true) with check (true);

-- -------------------------------------------------
-- 9. Realtime (optional)
-- -------------------------------------------------
-- Enable realtime for live dashboard updates
-- Run separately if needed:
-- alter publication supabase_realtime add table public.product_batches;
-- alter publication supabase_realtime add table public.products;

-- -------------------------------------------------
-- 10. Example seed (optional, comment out in prod)
-- -------------------------------------------------
-- insert into public.products (name, category) values
--   ('Milk Whole 1L', 'Dairy'),
--   ('Cheddar Cheese 500g', 'Dairy'),
--   ('Canned Tuna', 'Canned Goods'),
--   ('White Bread', 'Bakery');

-- -------------------------------------------------
-- 11. Useful ad-hoc queries (documented for app use)
-- -------------------------------------------------
-- -- Fetch batches expiring in next N days (param)
-- select * from public.v_batches_priority
-- where expiry_date <= current_date + interval '14 days'
-- order by expiry_date asc;

-- -- Mark notified
-- update public.product_batches set is_notified = true where id = '...';

-- -- Search products by name prefix
-- select * from public.products where name ilike '%milk%' order by name limit 10;

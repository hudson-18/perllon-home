-- ============================================================
-- PERLLON — Migration 005: product_specifications (flexible attributes)
-- ============================================================
-- HYBRID MODEL: structured product fields in `products`, plus a
-- flexible key/value attribute table so any category (iPhone, MacBook,
-- Xiaomi, Apple Watch, ...) can carry arbitrary specs WITHOUT schema
-- churn. `raw` JSONB is kept for future structured rendering.

create table if not exists public.product_specifications (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  key         text not null,               -- e.g. 'Armazenamento', 'Cor', 'Chip', 'RAM'
  value       text not null,
  unit        text,                        -- optional: 'GB', '"', etc. (already in value when desired)
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_specs_product on public.product_specifications(product_id, sort_order);

-- Optional JSONB payload for machine-readable specs (battery %, SIM type, etc.).
create table if not exists public.product_specs_json (
  product_id uuid primary key references public.products(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger trg_specs_json_updated_at
  before update on public.product_specs_json
  for each row execute function public.set_updated_at();
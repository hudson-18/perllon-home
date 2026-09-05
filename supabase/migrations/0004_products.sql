-- ============================================================
-- PERLLON — Migration 004: products (generic, extensor)
-- ============================================================
-- Products are brand/category/device agnostic. Structured fields
-- (price, installments, status) are columns; device-specific specs
-- live in product_specifications (migration 005).

-- ---------- product lifecycle enum ----------
create type public.product_status as enum ('active', 'inactive', 'archived');

create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  brand_id           uuid references public.brands(id) on delete set null,
  category_id        uuid references public.categories(id) on delete set null,
  description        text,
  -- Monetary values: integer centavos (BRL). NEVER floating point.
  price_cents        integer not null check (price_cents >= 0),
  installments_count integer check (installments_count is null or installments_count >= 0),
  installment_cents  integer check (installment_cents is null or installment_cents >= 0),
  currency           text not null default 'BRL',
  status             public.product_status not null default 'inactive',
  has_stock          boolean,               -- null = unknown; false = explicit "out"; true = confirmed in stock
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_products_status     on public.products(status);
create index if not exists idx_products_brand      on public.products(brand_id);
create index if not exists idx_products_category   on public.products(category_id);
create index if not exists idx_products_active_sort on public.products(status, sort_order, name);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
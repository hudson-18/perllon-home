-- ============================================================
-- PERLLON — Migration 003: brands + categories
-- ============================================================
-- Extensible: no hardcoded Apple/Xiaomi/iPhone. Admin manages both.

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  logo_url    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index if not exists idx_categories_active on public.categories(active, sort_order);
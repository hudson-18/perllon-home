-- ============================================================
-- PERLLON — Migration 007: spotlight (featured product)
-- ============================================================
-- Spotlight POINTS to an existing product (no duplication of name/price).
-- Only editorial override fields live here; all commercial data is
-- read from the referenced product at render time.

create table if not exists public.spotlight (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  active             boolean not null default true,
  -- Optional editorial overrides (null = fall back to product data):
  editorial_title    text,
  editorial_subtitle text,
  editorial_body     text,
  image_path_override text,
  video_path_override text,
  cta_label          text,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_spotlight_active on public.spotlight(active, sort_order);

create trigger trg_spotlight_updated_at
  before update on public.spotlight
  for each row execute function public.set_updated_at();
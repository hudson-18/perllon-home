-- ============================================================
-- PERLLON — Migration 006: product_images
-- ============================================================
-- Images are metadata rows pointing to Storage objects. One product
-- has one primary image + optional ordered gallery. Enforced by
-- partial unique index (only one is_primary=true per product).

create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  storage_path text not null,              -- path inside the storage bucket (no leading slash)
  alt_text    text,
  is_primary  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_images_product on public.product_images(product_id, sort_order);

-- Guarantee at most one primary image per product.
create unique index if not exists uq_images_one_primary
  on public.product_images(product_id)
  where is_primary;

-- Also guard the current product's "primary image" pointer (single source of truth)
-- via a stored slice on products.main_image_storage_path if we add it in a later migration.
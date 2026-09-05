-- ============================================================
-- PERLLON — Migration 010: Storage bucket + policies
-- ============================================================
-- The bucket is PUBLIC. `public = true` in Supabase ONLY governs READ
-- access via the `/storage/v1/object/public/...` object proxy (which the
-- public catalog <img> tags rely on). WRITES are still fully protected by
-- the RLS policies on storage.objects below (INSERT/UPDATE/DELETE staff-only).
-- NOTE: `insert into storage.buckets` is executed via the Supabase service
-- role (SQL migrations run as postgres/service).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

-- ---------- storage.objects RLS (public images + staff-only writes) ----------

-- Anyone may read product images (public catalog) — the bucket is public,
-- so this policy backs the object proxy's read path.
create policy "public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

-- Staff may upload/replace/delete product images.
create policy "staff insert product images" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and public.has_role('admin', 'editor')
  );

create policy "staff update product images" on storage.objects
  for update using (
    bucket_id = 'product-images'
    and public.has_role('admin', 'editor')
  );

create policy "staff delete product images" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and public.has_role('admin', 'editor')
  );
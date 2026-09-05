-- ============================================================
-- PERLLON — Migration 013: make product-images bucket PUBLIC
-- ============================================================
-- Corrective migration for the already-migrated remote DB.
-- `public = false` caused catalog images to return "Bucket not found"
-- via the /storage/v1/object/public/... object proxy.
--
-- Setting `public = true` only opens READ access through the public
-- object proxy. WRITES remain fully protected by the existing RLS
-- policies on storage.objects (INSERT/UPDATE/DELETE staff-only).
-- The `public read product images` SELECT policy is already in place.

update storage.buckets
set public = true
where id = 'product-images';
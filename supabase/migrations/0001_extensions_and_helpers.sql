-- ============================================================
-- PERLLON — Migration 001: extensions + helpers
-- ============================================================

-- UUID generation (used for PKs and default ID generation).
-- `gen_random_uuid()` is built-in on PostgreSQL 13+ (core), but we enable
-- `pgcrypto` defensively to guarantee availability across environments.
create extension if not exists "pgcrypto";

-- Ensure `updated_at` is maintained automatically (trigger helper).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Soft-delete / lifecycle helper not needed as generic — kept inline per table.
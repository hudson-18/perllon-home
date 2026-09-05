-- ============================================================
-- PERLLON — Migration 012: guarantee UUID function availability
-- ============================================================
-- Fix for SQLSTATE 42883 (`uuid_generate_v4 does not exist`) encountered
-- on the remote DB, where the legacy `uuid-ossp` extension is not enabled.
--
-- `gen_random_uuid()` is PostgreSQL 13+ CORE (no extension needed), but we
-- enable `pgcrypto` if it is not already present, so any environment
-- converges to a working UUID generator regardless of prior state.
-- Idempotent: safe to run on fresh installs AND already-migrated remotes.

create extension if not exists "pgcrypto";
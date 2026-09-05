-- ============================================================
-- PERLLON — Migration 008: audit_logs
-- ============================================================
-- Append-only administrative audit trail (who/when/what/before/after).
-- RLS makes this insert-only for editors/admins and read-only for admins.

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,                         -- auth user id (null = system/seed)
  actor_email text,
  action      text not null,                -- 'product.created', 'product.updated', 'price.changed', ...
  entity      text not null,                -- 'product' | 'spotlight' | 'brand' | ...
  entity_id   text,                         -- textual id of the affected record
  before      jsonb,
  after       jsonb,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id, created_at desc);
create index if not exists idx_audit_actor   on public.audit_logs(actor_id, created_at desc);

-- Audit rows are immutable: no UPDATE, no DELETE via RLS.
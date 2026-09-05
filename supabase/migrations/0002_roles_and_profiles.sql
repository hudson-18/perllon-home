-- ============================================================
-- PERLLON — Migration 002: roles + profiles
-- ============================================================
-- Roles are a fixed, small enum (source of truth for authorization).
-- Profiles extend Supabase Auth users with role + display metadata.

-- ---------- roles ----------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- 'admin' | 'editor' | 'viewer'
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.roles is 'Authorization roles (admin / editor / viewer).';

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key,              -- references auth.users.id
  role_id     uuid not null references public.roles(id) on delete restrict,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Per-user admin/editor/viewer profile with role assignment.';

create index if not exists idx_profiles_role on public.profiles(role_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Seed the three roles (idempotent).
insert into public.roles (slug, name, description) values
  ('admin',  'Administrador', 'Acesso total: produtos, imagens, destaque, usuários.'),
  ('editor', 'Editor',        'Gerencia catálogo e destaque, sem gerenciar usuários.'),
  ('viewer', 'Visualizador',  'Somente leitura do painel administrativo.')
on conflict (slug) do nothing;
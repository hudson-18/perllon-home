-- ============================================================
-- PERLLON — Migration 014: hero_media (dynamic hero video/poster)
-- ============================================================
-- Prepares a SEPARATE system from `spotlight`. The hero is the cinematic
-- section at the top; its media (video + poster fallback) becomes admin-
-- manageable WITHOUT a code redeploy. Media files live in the existing
-- Supabase Storage (bucket `hero-media`); this table stores the path + a
-- single active row the public site reads.
--
-- Editorial text (title/subtitle/CTA) kept here so it can be updated later,
-- but is OPTIONAL (null = keep the current hardcoded copy) to avoid forcing
-- duplicate content now.

create table if not exists public.hero_media (
  id            uuid primary key default gen_random_uuid(),
  video_path    text,            -- path in `hero-media` storage bucket (mp4)
  poster_path   text,            -- optional poster/fallback image path
  title         text,            -- optional editorial title (null = default)
  subtitle      text,            -- optional editorial subtitle
  cta_label     text,            -- optional primary CTA label
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_hero_media_updated_at
  before update on public.hero_media
  for each row execute function public.set_updated_at();

alter table public.hero_media enable row level security;

-- Public: read the single active hero media row.
create policy "public read active hero media" on public.hero_media
  for select using (active = true);

-- Staff: manage hero media (read all + write).
create policy "staff read all hero media" on public.hero_media
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert hero media" on public.hero_media
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update hero media" on public.hero_media
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete hero media" on public.hero_media
  for delete using (public.has_role('admin', 'editor'));

-- ============================================================
-- Storage bucket for hero media (separate from product-images).
-- Public read so <video> can load it; writes staff-only via storage.objects.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('hero-media', 'hero-media', true)
on conflict (id) do update set public = excluded.public;

create policy "public read hero media objects" on storage.objects
  for select using (bucket_id = 'hero-media');

create policy "staff insert hero media objects" on storage.objects
  for insert with check (bucket_id = 'hero-media' and public.has_role('admin', 'editor'));

create policy "staff update hero media objects" on storage.objects
  for update using (bucket_id = 'hero-media' and public.has_role('admin', 'editor'));

create policy "staff delete hero media objects" on storage.objects
  for delete using (bucket_id = 'hero-media' and public.has_role('admin', 'editor'));
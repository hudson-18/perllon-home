-- ============================================================
-- PERLLON — Migration 015: hero_media CTA href + spotlight image
-- ============================================================
-- Adds the hero CTA link/action (cta_href) that was not in 014, keeping that
-- migration already-applied-safe. Also no structural change to spotlight —
-- its image_path_override column already exists (migration 007).

alter table public.hero_media
  add column if not exists cta_href text;
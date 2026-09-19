-- Prevent browser URL parsing from reinterpreting a same-site CTA containing
-- a backslash or control character as a protocol-relative external URL.

begin;

alter table public.hero_media
  drop constraint if exists hero_media_cta_href_safe;

alter table public.hero_media
  add constraint hero_media_cta_href_safe
  check (
    cta_href is null
    or btrim(cta_href) = ''
    or (
      position(pg_catalog.chr(92) in btrim(cta_href)) = 0
      and btrim(cta_href) !~ '[[:cntrl:]]'
      and (
        lower(btrim(cta_href)) ~ '^(https?://|mailto:|tel:|#)'
        or (
          left(btrim(cta_href), 1) = '/'
          and left(btrim(cta_href), 2) <> '//'
        )
        or left(btrim(cta_href), 2) = './'
        or left(btrim(cta_href), 3) = '../'
      )
    )
  );

comment on constraint hero_media_cta_href_safe on public.hero_media is
  'Allows HTTP(S), mailto, tel, and same-site CTA destinations without URL-parser control or backslash ambiguity.';

commit;

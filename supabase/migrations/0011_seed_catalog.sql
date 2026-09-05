-- ============================================================
-- PERLLON — Migration 011: SEED — brands, categories, 7 products
-- ============================================================
-- Migrates the canonical catalog. NO invented data: only confirmed
-- fields are populated; every unknown/non-confirmed attribute is
-- intentionally left NULL (color, condition, warranty, battery, stock).
--
-- Prices are stored in integer CENTAVOS (BRL).
--   R$ 5.600,00 → 560000
--   R$   537,00 →  53700
--   etc.
--
-- Slug rules: lowercase, hyphenated, stable (mirrors current JSON ids).

do $$
declare
  brand_apple  uuid;
  brand_xiaomi uuid;

  cat_iphone     uuid;
  cat_smartband  uuid;
  cat_smartwatch uuid;

  p uuid;
begin

  -- ---------- brands ----------
  insert into public.brands (slug, name) values ('apple', 'Apple')
    on conflict (slug) do update set name = excluded.name
    returning id into brand_apple;
  select id into brand_apple from public.brands where slug = 'apple';

  insert into public.brands (slug, name) values ('xiaomi', 'Xiaomi')
    on conflict (slug) do update set name = excluded.name
    returning id into brand_xiaomi;
  select id into brand_xiaomi from public.brands where slug = 'xiaomi';

  -- ---------- categories ----------
  insert into public.categories (slug, name, sort_order) values ('smartphone', 'Smartphone', 1)
    on conflict (slug) do update set name = excluded.name;
  select id into cat_iphone from public.categories where slug = 'smartphone';

  insert into public.categories (slug, name, sort_order) values ('smartband', 'Smartband', 50)
    on conflict (slug) do update set name = excluded.name;
  select id into cat_smartband from public.categories where slug = 'smartband';

  insert into public.categories (slug, name, sort_order) values ('smartwatch', 'Smartwatch', 51)
    on conflict (slug) do update set name = excluded.name;
  select id into cat_smartwatch from public.categories where slug = 'smartwatch';

  -- ---------- products ----------
  -- 1. iPhone 17 — 256GB · Preto · R$5600 · 12x 537 · Lacrado · Gaveta SIM · 1 ano Apple
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('iphone-17-256gb-preto', 'iPhone 17', brand_apple, cat_iphone,
          560000, 12, 53700, 'active', 1)
  on conflict (slug) do nothing;
  select id into p from public.products where slug = 'iphone-17-256gb-preto';
  insert into public.product_specifications (product_id, key, value, sort_order) values
    (p, 'Armazenamento', '256 GB', 1),
    (p, 'Cor',          'Preto',  2),
    (p, 'Condição',     'Lacrado', 3),
    (p, 'Chip/SIM',     'Gaveta física SIM', 4),
    (p, 'Garantia',     '1 ano de garantia Apple', 5);

  -- 2. iPhone 16 — 128GB · R$3900 · 12x 368 · garantia até 10/11
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('iphone-16-128gb', 'iPhone 16', brand_apple, cat_iphone,
          390000, 12, 36800, 'active', 2)
  on conflict (slug) do nothing;
  select id into p from public.products where slug = 'iphone-16-128gb';
  insert into public.product_specifications (product_id, key, value, sort_order) values
    (p, 'Armazenamento', '128 GB', 1),
    (p, 'Garantia',      'Até 10/11', 2);

  -- 3. iPhone 15 Pro Max — 256GB · R$4200 · 12x 403
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('iphone-15-pro-max-256gb', 'iPhone 15 Pro Max', brand_apple, cat_iphone,
          420000, 12, 40300, 'active', 3)
  on conflict (slug) do nothing;
  select id into p from public.products where slug = 'iphone-15-pro-max-256gb';
  insert into public.product_specifications (product_id, key, value, sort_order) values
    (p, 'Armazenamento', '256 GB', 1);

  -- 4. iPhone 14 Pro Max — 128GB · R$3600 · 12x 340
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('iphone-14-pro-max-128gb', 'iPhone 14 Pro Max', brand_apple, cat_iphone,
          360000, 12, 34000, 'active', 4)
  on conflict (slug) do nothing;
  select id into p from public.products where slug = 'iphone-14-pro-max-128gb';
  insert into public.product_specifications (product_id, key, value, sort_order) values
    (p, 'Armazenamento', '128 GB', 1);

  -- 5. iPhone 14 Pro — 512GB · R$3300 · 12x 312 · bateria 100%
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('iphone-14-pro-512gb', 'iPhone 14 Pro', brand_apple, cat_iphone,
          330000, 12, 31200, 'active', 5)
  on conflict (slug) do nothing;
  select id into p from public.products where slug = 'iphone-14-pro-512gb';
  insert into public.product_specifications (product_id, key, value, sort_order) values
    (p, 'Armazenamento', '512 GB', 1),
    (p, 'Bateria',       '100%',   2);

  -- 6. Xiaomi Smart Band 10 Pro — R$550 (sem parcelamento confirmado)
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('xiaomi-smart-band-10-pro', 'Xiaomi Smart Band 10 Pro', brand_xiaomi, cat_smartband,
          55000, null, null, 'active', 6)
  on conflict (slug) do nothing;

  -- 7. Smartwatch WB — R$350 (sem parcelamento confirmado)
  insert into public.products (slug, name, brand_id, category_id, price_cents,
                               installments_count, installment_cents, status, sort_order)
  values ('smartwatch-wb', 'Smartwatch WB', null, cat_smartwatch,
          35000, null, null, 'active', 7)
  on conflict (slug) do nothing;

end $$;

-- ---------- Spotlight seed: iPhone 17 as current featured ----------
-- Confirmed by the existing prototype (Spotlight section features iPhone 17).
do $$
declare
  p uuid;
begin
  select id into p from public.products where slug = 'iphone-17-256gb-preto';
  if p is not null then
    insert into public.spotlight (product_id, active, sort_order)
    values (p, true, 1)
    on conflict do nothing;
  end if;
end $$;
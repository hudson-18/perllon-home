-- ============================================================
-- PERLLON — Migration 009: RLS policies + authorization helpers
-- ============================================================
-- Authorization is enforced HERE, in the database — never only in JS.
--
-- Default posture: DENY (RLS enabled, no public policy = no access).
-- We then grant explicitly per role.
--
-- Role resolution: a profile row links auth.uid() → role slug.
-- Helper functions make policies concise and consistent.

-- ---------- auth helpers ----------
create or replace function public.current_role_slug()
returns text
language sql stable security definer
set search_path = public
as $$
  select r.slug
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

-- Returns true when the current user holds one of the given roles.
create or replace function public.has_role(variadic allowed text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_role_slug() = any(allowed), false);
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table public.roles                   enable row level security;
alter table public.profiles                enable row level security;
alter table public.brands                  enable row level security;
alter table public.categories              enable row level security;
alter table public.products                enable row level security;
alter table public.product_specifications  enable row level security;
alter table public.product_specs_json      enable row level security;
alter table public.product_images          enable row level security;
alter table public.spotlight               enable row level security;
alter table public.audit_logs              enable row level security;

-- ============================================================
-- PUBLIC READ (anon / anyone)
--   Only ACTIVE products (and their specs + images + spotlight)
--   are publicly visible. No writes, no admin data, no audit logs.
-- ============================================================

-- brands / categories: public read of active rows only
create policy "public read active brands"     on public.brands
  for select using (active = true);
create policy "public read active categories" on public.categories
  for select using (active = true);

-- products: only `active` rows
create policy "public read active products" on public.products
  for select using (status = 'active');

-- specifications: join to an active product
create policy "public read specs of active products" on public.product_specifications
  for select using (
    exists (select 1 from public.products pr
            where pr.id = product_id and pr.status = 'active')
  );

create policy "public read specs_json of active products" on public.product_specs_json
  for select using (
    exists (select 1 from public.products pr
            where pr.id = product_id and pr.status = 'active')
  );

-- images: join to an active product
create policy "public read images of active products" on public.product_images
  for select using (
    exists (select 1 from public.products pr
            where pr.id = product_id and pr.status = 'active')
  );

-- spotlight: only active spotlight rows pointing to active products
create policy "public read active spotlight" on public.spotlight
  for select using (
    active = true
    and exists (select 1 from public.products pr
                where pr.id = product_id and pr.status = 'active')
  );

-- ============================================================
-- ADMIN / EDITOR WRITE (catalog management)
--   - admin:  full write on catalog tables
--   - editor: write on catalog tables too (no user management)
--   - viewer: read-only (granted read over ALL rows, not just active)
-- ============================================================

-- brands — admin/editor manage; viewer read all
create policy "staff read all brands" on public.brands
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert brands" on public.brands
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update brands" on public.brands
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete brands" on public.brands
  for delete using (public.has_role('admin', 'editor'));

-- categories — same pattern
create policy "staff read all categories" on public.categories
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert categories" on public.categories
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update categories" on public.categories
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete categories" on public.categories
  for delete using (public.has_role('admin', 'editor'));

-- products — staff read all; admin/editor write
create policy "staff read all products" on public.products
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert products" on public.products
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update products" on public.products
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete products" on public.products
  for delete using (public.has_role('admin', 'editor'));

-- specifications — staff read all; admin/editor write
create policy "staff read all specs" on public.product_specifications
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert specs" on public.product_specifications
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update specs" on public.product_specifications
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete specs" on public.product_specifications
  for delete using (public.has_role('admin', 'editor'));

create policy "staff read all specs_json" on public.product_specs_json
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert specs_json" on public.product_specs_json
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update specs_json" on public.product_specs_json
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete specs_json" on public.product_specs_json
  for delete using (public.has_role('admin', 'editor'));

-- images — staff read all; admin/editor write
create policy "staff read all images" on public.product_images
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert images" on public.product_images
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update images" on public.product_images
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete images" on public.product_images
  for delete using (public.has_role('admin', 'editor'));

-- spotlight — staff read all; admin/editor write
create policy "staff read all spotlight" on public.spotlight
  for select using (public.has_role('admin', 'editor', 'viewer'));
create policy "admin/editor insert spotlight" on public.spotlight
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin/editor update spotlight" on public.spotlight
  for update using (public.has_role('admin', 'editor'));
create policy "admin/editor delete spotlight" on public.spotlight
  for delete using (public.has_role('admin', 'editor'));

-- profiles — admin manages; each user may read their own
create policy "admin read all profiles" on public.profiles
  for select using (public.has_role('admin'));
create policy "admin insert profiles" on public.profiles
  for insert with check (public.has_role('admin'));
create policy "admin update profiles" on public.profiles
  for update using (public.has_role('admin'));
create policy "admin delete profiles" on public.profiles
  for delete using (public.has_role('admin'));
-- (also allow a user to at least read their own profile for role checks)
create policy "self read profile" on public.profiles
  for select using (id = auth.uid());

-- roles — read-only to staff, no write
create policy "staff read roles" on public.roles
  for select using (public.has_role('admin', 'editor', 'viewer'));

-- ============================================================
-- AUDIT LOGS — append-only
--   - admin/editor: INSERT (writes)
--   - admin:        SELECT (reads)
--   - NO update, NO delete, ever.
-- ============================================================
create policy "staff insert audit" on public.audit_logs
  for insert with check (public.has_role('admin', 'editor'));
create policy "admin read audit" on public.audit_logs
  for select using (public.has_role('admin'));
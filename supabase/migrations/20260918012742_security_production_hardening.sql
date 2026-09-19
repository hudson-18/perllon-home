-- Security and production hardening for Storage, role helpers, audit authorship,
-- trigger search paths, and dynamic Hero CTA destinations.

begin;

-- Enforce the same upload families used by the application at the Storage API
-- boundary. hero-media needs a 25 MB bucket cap for video; the client keeps its
-- stricter 8 MB image cap because Supabase supports one size limit per bucket.
update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif'
    ]::text[]
where id = 'product-images';

update storage.buckets
set file_size_limit = 25 * 1024 * 1024,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]::text[]
where id = 'hero-media';

-- Role lookup must bypass profiles RLS to avoid policy recursion. Keep the
-- SECURITY DEFINER operation outside the exposed public API schema, and expose
-- only invoker wrappers that can return the caller's own role.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_role_slug()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.slug
  from public.profiles as p
  join public.roles as r on r.id = p.role_id
  where p.id = auth.uid();
$$;

revoke all on function private.current_role_slug() from public;
grant execute on function private.current_role_slug() to anon, authenticated, service_role;

create or replace function public.current_role_slug()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_role_slug();
$$;

create or replace function public.has_role(variadic allowed text[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(public.current_role_slug() = any(allowed), false);
$$;

revoke all on function public.current_role_slug() from public;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.current_role_slug() to anon, authenticated, service_role;
grant execute on function public.has_role(text[]) to anon, authenticated, service_role;

-- Trigger helpers do not need elevated privileges. Fix the search path and
-- keep direct execution away from browser roles.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

-- Audit event details remain best-effort client context, but actor and time are
-- authoritative: every insert is overwritten from the authenticated JWT.
create or replace function private.set_audit_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  new.actor_id := caller_id;
  new.actor_email := case
    when caller_id is null then null
    else nullif(auth.jwt() ->> 'email', '')
  end;
  new.created_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_audit_actor() from public, anon, authenticated;
grant execute on function private.set_audit_actor() to service_role;

drop trigger if exists trg_audit_logs_actor on public.audit_logs;
create trigger trg_audit_logs_actor
  before insert on public.audit_logs
  for each row execute function private.set_audit_actor();

revoke all privileges on table public.audit_logs from anon;
revoke update, delete, truncate, references, trigger on table public.audit_logs from authenticated;
grant select, insert on table public.audit_logs to authenticated;
revoke all privileges on sequence public.audit_logs_id_seq from anon;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

-- Defense in depth for records written outside the Admin UI.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.hero_media'::regclass
      and conname = 'hero_media_cta_href_safe'
  ) then
    alter table public.hero_media
      add constraint hero_media_cta_href_safe
      check (
        cta_href is null
        or btrim(cta_href) = ''
        or lower(btrim(cta_href)) ~ '^(https?://|mailto:|tel:|#)'
        or (
          left(btrim(cta_href), 1) = '/'
          and left(btrim(cta_href), 2) <> '//'
        )
        or left(btrim(cta_href), 2) = './'
        or left(btrim(cta_href), 3) = '../'
      );
  end if;
end;
$$;

comment on constraint hero_media_cta_href_safe on public.hero_media is
  'Allows only HTTP(S), mailto, tel, and explicit same-site CTA destinations.';

commit;

-- Replace one product's complete specification set in a single PostgreSQL
-- transaction. SECURITY INVOKER preserves the caller's table grants and RLS;
-- the explicit role check also rejects read-only staff when the new set is empty.
create or replace function public.replace_product_specifications(
  p_product_id uuid,
  p_specs jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_role('admin', 'editor') then
    raise exception 'Insufficient permissions to replace product specifications.'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Product id is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_specs, '[]'::jsonb)) <> 'array' then
    raise exception 'Specifications must be a JSON array.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Product not found or not accessible.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_specs, '[]'::jsonb)) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or nullif(btrim(item.value ->> 'key'), '') is null
       or nullif(btrim(item.value ->> 'value'), '') is null
  ) then
    raise exception 'Each specification requires non-empty key and value.'
      using errcode = '22023';
  end if;

  delete from public.product_specifications
  where product_id = p_product_id;

  insert into public.product_specifications (
    product_id,
    key,
    value,
    unit,
    sort_order
  )
  select
    p_product_id,
    btrim(item.value ->> 'key'),
    btrim(item.value ->> 'value'),
    nullif(btrim(item.value ->> 'unit'), ''),
    coalesce((item.value ->> 'sort_order')::integer, item.ordinality::integer - 1)
  from jsonb_array_elements(coalesce(p_specs, '[]'::jsonb))
    with ordinality as item(value, ordinality);
end;
$$;

comment on function public.replace_product_specifications(uuid, jsonb) is
  'Atomically replaces all specifications for one product; caller authorization remains enforced by RLS.';

revoke execute on function public.replace_product_specifications(uuid, jsonb)
  from public, anon;
grant execute on function public.replace_product_specifications(uuid, jsonb)
  to authenticated;

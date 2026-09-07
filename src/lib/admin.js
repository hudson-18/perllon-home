// ============================================================
// PERLLON — Admin data access layer (authenticated writes)
// ============================================================
// All admin CRUD goes through RLS (staff role). Audit logging is
// written alongside mutations. No service role in the browser.

import { getSupabase } from './supabase.js';

// ---------- session / auth ----------
export async function signIn(email, password) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function currentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

export async function currentProfile() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return null;
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, role:roles(slug, name)')
    .eq('id', user.user.id)
    .maybeSingle();
  return data || null;
}

export async function hasRole(...slugs) {
  const p = await currentProfile();
  if (!p?.role?.slug) return false;
  return slugs.includes(p.role.slug);
}

// ---------- brands / categories ----------
export async function listBrands() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('brands').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function listCategories() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('categories').select('*').order('sort_order').order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertBrand({ id, name }) {
  const sb = await getSupabase();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9áéíóúãõç]+/g, '-').replace(/^-+|-+$/g, '');
  if (id) {
    const { error } = await sb.from('brands').update({ name }).eq('id', id);
    if (error) throw error;
    return { id, name };
  }
  const { data, error } = await sb.from('brands').insert({ name, slug }).select().single();
  if (error) throw error;
  return data;
}

export async function upsertCategory({ id, name, sort_order }) {
  const sb = await getSupabase();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9áéíóúãõç]+/g, '-').replace(/^-+|-+$/g, '');
  if (id) {
    const { error } = await sb.from('categories').update({ name, sort_order: sort_order ?? 0 }).eq('id', id);
    if (error) throw error;
    return { id, name };
  }
  const { data, error } = await sb.from('categories').insert({ name, slug, sort_order: sort_order ?? 0 }).select().single();
  if (error) throw error;
  return data;
}

// ---------- audit ----------
export async function writeAudit({ action, entity, entityId, before = null, after = null, metadata = null }) {
  const sb = await getSupabase();
  const { data: user } = await sb.auth.getUser();
  const { error } = await sb.from('audit_logs').insert({
    actor_id: user?.user?.id || null,
    actor_email: user?.user?.email || null,
    action,
    entity,
    entity_id: entityId != null ? String(entityId) : null,
    before,
    after,
    metadata,
  });
  // Audit failure is non-fatal to the primary operation.
  if (error) console.warn('audit log failed', error);
}

// ---------- products ----------
const PRODUCT_SELECT = `
  id, slug, name, description,
  price_cents, installments_count, installment_cents, currency,
  status, sort_order, brand_id, category_id,
  brand:brands(name, slug), category:categories(name, slug),
  product_specifications(id, key, value, unit, sort_order),
  product_images(id, storage_path, alt_text, is_primary, sort_order)
`;

export async function listProductsAll() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('products')
    .select(PRODUCT_SELECT)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getProduct(id) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('products').select(PRODUCT_SELECT).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createProduct(payload) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('products').insert(payload).select().single();
  if (error) throw error;
  await writeAudit({ action: 'product.created', entity: 'product', entityId: data.id, after: data });
  return data;
}

export async function updateProduct(id, payload) {
  const sb = await getSupabase();
  const { data: before } = await sb.from('products').select('*').eq('id', id).single();
  const { data, error } = await sb.from('products').update(payload).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit({
    action: before?.price_cents !== data.price_cents ? 'product.updated.price' : 'product.updated',
    entity: 'product', entityId: id, before, after: data,
  });
  return data;
}

export async function setProductStatus(id, status) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('products').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  await writeAudit({ action: `product.${status}`, entity: 'product', entityId: id, after: { status } });
  return data;
}

export async function deleteProduct(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) throw error;
  await writeAudit({ action: 'product.deleted', entity: 'product', entityId: id });
}

// ---------- specifications ----------
export async function replaceSpecifications(productId, specs) {
  const sb = await getSupabase();
  await sb.from('product_specifications').delete().eq('product_id', productId);
  if (specs && specs.length) {
    const rows = specs
      .filter((s) => s && s.key && s.key.trim() && s.value && s.value.trim())
      .map((s, i) => ({ product_id: productId, key: s.key.trim(), value: s.value.trim(), unit: s.unit || null, sort_order: s.sort_order ?? i }));
    const { error } = await sb.from('product_specifications').insert(rows);
    if (error) throw error;
  }
}

// ---------- images ----------
export async function addProductImage(productId, { storage_path, alt_text, is_primary, sort_order }) {
  const sb = await getSupabase();
  if (is_primary) {
    // Clear prior primary flag on this product.
    await sb.from('product_images').update({ is_primary: false }).eq('product_id', productId).eq('is_primary', true);
  }
  const { data, error } = await sb.from('product_images')
    .insert({ product_id: productId, storage_path, alt_text, is_primary: is_primary ?? false, sort_order: sort_order ?? 0 })
    .select().single();
  if (error) throw error;
  await writeAudit({ action: 'product.image_added', entity: 'product_image', entityId: data.id, after: { storage_path } });
  return data;
}

export async function removeProductImage(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('product_images').delete().eq('id', id);
  if (error) throw error;
  await writeAudit({ action: 'product.image_removed', entity: 'product_image', entityId: id });
}

// ---------- spotlight ----------
export async function getSpotlight() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('spotlight').select('*').order('sort_order').limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function setSpotlight({ product_id, active, editorial_title, editorial_subtitle, editorial_body, cta_label, image_path_override }) {
  const sb = await getSupabase();
  const existing = await getSpotlight();
  if (existing) {
    const { data, error } = await sb.from('spotlight')
      .update({ product_id, active, editorial_title, editorial_subtitle, editorial_body, cta_label, image_path_override })
      .eq('id', existing.id).select().single();
    if (error) throw error;
    await writeAudit({ action: 'spotlight.updated', entity: 'spotlight', entityId: data.id, before: existing, after: data });
    return data;
  }
  const { data, error } = await sb.from('spotlight')
    .insert({ product_id, active: active ?? true, editorial_title, editorial_subtitle, editorial_body, cta_label, image_path_override })
    .select().single();
  if (error) throw error;
  await writeAudit({ action: 'spotlight.created', entity: 'spotlight', entityId: data.id, after: data });
  return data;
}

// ---------- hero media ----------
export async function getHeroMedia() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('hero_media').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function setHeroMedia(fields) {
  const sb = await getSupabase();
  // Only touch fields actually provided (key present) — prevents a stale or
  // unrelated caller from clobbering video_path/poster_path when it only
  // means to edit the title. Explicit null still clears a field.
  const KEYS = ['video_path', 'poster_path', 'title', 'subtitle', 'cta_label', 'cta_href', 'active'];
  const patch = {};
  for (const k of KEYS) {
    if (k in fields) patch[k] = fields[k] ?? null;
  }
  const existing = await getHeroMedia();
  if (existing) {
    const { data, error } = await sb.from('hero_media')
      .update(patch)
      .eq('id', existing.id).select().single();
    if (error) throw error;
    await writeAudit({ action: 'hero_media.updated', entity: 'hero_media', entityId: data.id, before: existing, after: data });
    return data;
  }
  const { data, error } = await sb.from('hero_media')
    .insert({ ...patch, active: patch.active ?? true })
    .select().single();
  if (error) throw error;
  await writeAudit({ action: 'hero_media.created', entity: 'hero_media', entityId: data.id, after: data });
  return data;
}

// ---------- dashboard stats ----------
export async function dashboardStats() {
  const sb = await getSupabase();
  const { count: total } = await sb.from('products').select('*', { count: 'exact', head: true });
  const { count: active } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: inactive } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('status', 'inactive');
  const { count: archived } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('status', 'archived');
  return { total: total || 0, active: active || 0, inactive: inactive || 0, archived: archived || 0 };
}

export async function recentAudit(limit = 10) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}
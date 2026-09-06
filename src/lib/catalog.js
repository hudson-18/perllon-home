// ============================================================
// PERLLON — Catalog data access layer
// ============================================================
// Public + admin data operations against Supabase. All reads/writes
// go through RLS; no service role anywhere in the browser.
//
// Monetary unit: integer centavos (BRL). Format helpers live here so
// price can never be trusted from the client — it's always re-read
// from the database at cart validation time.

import { getSupabase, isSupabaseConfigured } from './supabase.js';

export const money = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export const installmentLabel = (product) => {
  if (!product.installments_count || !product.installment_cents) return null;
  return `${product.installments_count}x de ${money(product.installment_cents)}`;
};

// Resolve a storage path to a public URL (product-images bucket).
export function imageUrl(path) {
  if (!path) return null;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url && !url.includes('YOUR-PROJECT')) {
    return `${url}/storage/v1/object/public/product-images/${path}`;
  }
  return null;
}

// Build { primary, gallery } from product_images rows (sorted).
function resolveImages(rows = []) {
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primary = sorted.find((r) => r.is_primary) || sorted[0] || null;
  return {
    image: primary ? imageUrl(primary.storage_path) : null,
    images: sorted.map((r) => ({
      url: imageUrl(r.storage_path),
      alt: r.alt_text || null,
      primary: !!r.is_primary,
    })),
  };
}

// Map a DB product row (+ specs) into the shape the public site already
// renders (keeps the existing card/cart code intact). Prices are converted
// from integer centavos (DB) to reals (public site) at this boundary, while
// the numeric centavo value stays available for cart validation.
export function normalizeProduct(row, specs = []) {
  const specsMap = {};
  specs.forEach((s) => { specsMap[s.key] = s.value; });
  const storage = specsMap['Armazenamento'] || null;
  const color = specsMap['Cor'] || null;
  const priceReal = row.price_cents / 100;
  const { image, images } = resolveImages(row.product_images);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category?.name || null,
    brand: row.brand?.name || null,
    storage,
    color,
    condition: specsMap['Condição'] || null,
    warranty: specsMap['Garantia'] || null,
    price: priceReal,                        // reals (matches static JSON unit)
    price_cents: row.price_cents,            // integer centavos (validation)
    priceFormatted: money(row.price_cents),
    installments: installmentLabel(row),
    installments_count: row.installments_count,
    installment_cents: row.installment_cents,
    image,                                    // resolved public URL
    images,
    status: row.status,
    simType: specsMap['Chip/SIM'] || null,
    battery: specsMap['Bateria'] || null,
    specs: specs,
  };
}

const PRODUCT_SELECT = `
  id, slug, name, description,
  price_cents, installments_count, installment_cents, currency,
  status, sort_order,
  brand:brands(name, slug),
  category:categories(name, slug)
`;

// ---------- PUBLIC catalog queries ----------
export async function fetchProducts() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('products')
    .select(`${PRODUCT_SELECT}, product_specifications(key, value, sort_order), product_images(storage_path, alt_text, is_primary, sort_order)`)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name');
  if (error) throw error;
  return { data: (data || []).map((r) => normalizeProduct(r, r.product_specifications || [])) };
}

export async function fetchProductBySlug(slug) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('products')
    .select(`${PRODUCT_SELECT}, product_specifications(key, value, sort_order), product_images(storage_path, alt_text, is_primary, sort_order)`)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeProduct(data, data.product_specifications || []);
}

export async function fetchSpotlight() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('spotlight')
    .select(`
      id, active, editorial_title, editorial_subtitle, editorial_body,
      image_path_override, video_path_override, cta_label,
      product:products(${PRODUCT_SELECT}, product_specifications(key, value, sort_order), product_images(storage_path, alt_text, is_primary, sort_order))
    `)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data.product;
  const product = normalizeProduct(p, p?.product_specifications || []);
  return {
    id: data.id,
    active: data.active,
    editorialTitle: data.editorial_title,
    editorialSubtitle: data.editorial_subtitle,
    editorialBody: data.editorial_body,
    imageOverride: data.image_path_override,
    videoOverride: data.video_path_override,
    ctaLabel: data.cta_label,
    product,
  };
}

// ---------- Cart validation (price/product re-read from DB) ----------
// Returns a map id -> { price_cents, status, name } so the client can
// reject stale prices and deactivated/archived items at checkout.
export async function fetchCartValidation(ids) {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return {};
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('products')
    .select('id, slug, name, price_cents, status')
    .in('id', uniq);
  if (error) throw error;
  const out = {};
  (data || []).forEach((r) => { out[r.id] = r; });
  return out;
}

export { isSupabaseConfigured };
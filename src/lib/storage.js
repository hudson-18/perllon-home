// ============================================================
// PERLLON — Storage upload helper (admin)
// ============================================================
// Safe image upload: content-type allowlist enforced client-side
// (server/storage policies enforce the rest), size cap, and a
// deterministic path under the product's private bucket.

import { getSupabase } from './supabase.js';

export const BUCKET = 'product-images';

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Returns { path, publicUrl } or throws.
export async function uploadProductImage(file, productId) {
  if (!file || !productId) throw new Error('Arquivo ou produto ausente.');
  if (!ALLOWED[file.type]) {
    throw new Error(`Tipo não permitido: ${file.type || 'desconhecido'}. Use JPG, PNG, WebP ou AVIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 8 MB.`);
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');

  const ext = ALLOWED[file.type];
  // Deterministic, collision-resistant path keyed to product + timestamp.
  const filename = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await sb.storage.from(BUCKET).upload(filename, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
  return { path: filename, publicUrl };
}

export async function deleteProductImage(path) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export { ALLOWED, MAX_BYTES };

// ============================================================
// Generic media upload (hero video/poster, spotlight promo image)
// ============================================================
// Used by the dynamic Media CMS so new videos/posters go to Supabase Storage
// (NOT into the Vite build / Cloudflare bundle). Safe allowlist + size cap,
// deterministic collision-resistant path, staff-only writes (RLS).

export const HERO_BUCKET = 'hero-media';

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

// Returns { path, publicUrl } or throws. `folder` groups files under a stable
// subpath (e.g. product id or 'hero').
export async function uploadMedia(bucket, file, folder, kind) {
  if (!file) throw new Error('Arquivo ausente.');
  const kinds = kind === 'video' ? VIDEO_EXT : IMAGE_EXT;

  // Normalize MIME: browsers may return empty string or append "; codecs=…".
  // Derive from extension when the browser can't sniff the type reliably.
  const rawType = (file.type || '').split(';')[0].trim().toLowerCase();
  const extLower = (file.name || '').split('.').pop()?.toLowerCase();
  const mime = rawType || ({ mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }[extLower] || '');

  if (!kinds[mime]) {
    throw new Error(`Tipo não permitido: ${file.type || extLower || 'desconhecido'}. Use ${kind === 'video' ? 'MP4/WebM/MOV' : 'JPG/PNG/WebP/AVIF'}.`);
  }
  const maxBytes = kind === 'video' ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${kind === 'video' ? 25 : 8} MB.`);
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');

  const ext = kinds[mime];
  const base = (folder || 'media').replace(/[^a-zA-Z0-9._-]/g, '-');
  const filename = `${base}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await sb.storage.from(bucket).upload(filename, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime || file.type || 'application/octet-stream',
  });
  if (error) throw error;

  const publicUrl = sb.storage.from(bucket).getPublicUrl(filename).data.publicUrl;
  return { path: filename, publicUrl, contentType: mime, size: file.size };
}

export async function deleteMedia(bucket, path) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase não configurado.');
  const { error } = await sb.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function mediaPublicUrl(bucket, path) {
  if (!path || !import.meta.env.VITE_SUPABASE_URL) return null;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url.includes('YOUR-PROJECT')) return null;
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
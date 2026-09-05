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
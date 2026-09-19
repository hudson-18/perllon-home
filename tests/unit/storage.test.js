import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ getSupabase: supabase.getSupabase }));

import { uploadMedia, uploadProductImage } from '../../src/lib/storage.js';

beforeEach(() => supabase.getSupabase.mockReset());

function storageClient() {
  const upload = vi.fn(async (path) => ({ data: { path }, error: null }));
  const from = vi.fn(() => ({ upload, getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/${path}` } }) }));
  supabase.getSupabase.mockResolvedValue({ storage: { from } });
  return { upload, from };
}

describe('Storage upload boundary', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])('accepts supported product image MIME %s', async (type) => {
    const { upload, from } = storageClient();
    const result = await uploadProductImage({ name: 'image', type, size: 1000 }, 'real-product-id');
    expect(from).toHaveBeenCalledWith('product-images');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatch(/^real-product-id\//);
    expect(upload.mock.calls[0][2].contentType).toBe(type);
    expect(result.publicUrl).toContain('storage.example');
  });

  it('rejects disallowed type and oversized product image before contacting Storage', async () => {
    const { upload } = storageClient();
    await expect(uploadProductImage({ name: 'x.svg', type: 'image/svg+xml', size: 1000 }, 'id')).rejects.toThrow('Tipo não permitido');
    await expect(uploadProductImage({ name: 'x.png', type: 'image/png', size: 8 * 1024 * 1024 + 1 }, 'id')).rejects.toThrow('Limite: 8 MB');
    expect(upload).not.toHaveBeenCalled();
  });

  it('allows supported hero video but rejects executable and over-limit video', async () => {
    const { upload, from } = storageClient();
    const result = await uploadMedia('hero-media', { name: 'hero.mov', type: '', size: 1024 }, 'hero', 'video');
    expect(from).toHaveBeenCalledWith('hero-media');
    expect(result.contentType).toBe('video/quicktime');
    expect(upload).toHaveBeenCalledTimes(1);
    await expect(uploadMedia('hero-media', { name: 'bad.exe', type: 'application/x-msdownload', size: 1024 }, 'hero', 'video')).rejects.toThrow('Tipo não permitido');
    await expect(uploadMedia('hero-media', { name: 'hero.mp4', type: 'video/mp4', size: 25 * 1024 * 1024 + 1 }, 'hero', 'video')).rejects.toThrow('Limite: 25 MB');
    expect(upload).toHaveBeenCalledTimes(1);
  });
});

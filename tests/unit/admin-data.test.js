import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({ getSupabase: supabase.getSupabase }));

import { addProductImage, currentProfile, removeProductImage, replaceSpecifications, signOut } from '../../src/lib/admin.js';

beforeEach(() => supabase.getSupabase.mockReset());

describe('administrative data operations', () => {
  it('uses one RPC call to replace specifications and propagates failure without client-side deletes', async () => {
    let persisted = [{ key: 'Armazenamento', value: '128 GB' }];
    let fail = false;
    const rpc = vi.fn(async (name, args) => {
      expect(name).toBe('replace_product_specifications');
      expect(args.p_product_id).toBe('product-db-id');
      if (fail) return { error: new Error('insertion failed') };
      persisted = structuredClone(args.p_specs);
      return { error: null };
    });
    const from = vi.fn(() => { throw new Error('Specifications must not use separate client-side DELETE/INSERT'); });
    supabase.getSupabase.mockResolvedValue({ rpc, from });

    await replaceSpecifications('product-db-id', [
      { key: ' Cor ', value: ' Preto ', sort_order: 0 },
      { key: '', value: 'ignored' },
    ]);
    expect(persisted).toEqual([{ key: 'Cor', value: 'Preto', unit: null, sort_order: 0 }]);
    fail = true;
    await expect(replaceSpecifications('product-db-id', [{ key: 'Cor', value: 'Azul' }])).rejects.toThrow('insertion failed');
    expect(persisted).toEqual([{ key: 'Cor', value: 'Preto', unit: null, sort_order: 0 }]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps delete and insert inside the PostgreSQL RPC with invoker authorization', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20260914210743_replace_product_specifications_atomically.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/create or replace function public\.replace_product_specifications\(/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/if not public\.has_role\('admin', 'editor'\)/i);
    expect(sql).toMatch(/delete from public\.product_specifications[\s\S]+insert into public\.product_specifications/i);
    expect(sql).toMatch(/revoke execute[\s\S]+from public, anon/i);
  });

  it('returns the database image ID and removes that same ID', async () => {
    const realId = 'db-image-94';
    const removed = [];
    const from = vi.fn((table) => {
      if (table === 'audit_logs') return { insert: async () => ({ error: null }) };
      expect(table).toBe('product_images');
      const query = {
        insert: (row) => { expect(row.product_id).toBe('product-db-id'); return query; },
        delete: () => query,
        eq: (key, value) => { removed.push([key, value]); return query; },
        select: () => query,
        single: async () => ({ data: { id: realId, storage_path: 'product-db-id/photo.jpg' }, error: null }),
      };
      return query;
    });
    supabase.getSupabase.mockResolvedValue({ from });
    const saved = await addProductImage('product-db-id', { storage_path: 'product-db-id/photo.jpg', is_primary: false });
    expect(saved.id).toBe(realId);
    const deleted = await removeProductImage(saved.id);
    expect(deleted.id).toBe(realId);
    expect(removed).toContainEqual(['id', realId]);
  });

  it('rejects failed database image writes and removals', async () => {
    const failure = new Error('database unavailable');
    supabase.getSupabase.mockResolvedValue({ from: () => {
      const query = { insert: () => query, delete: () => query, eq: () => query, select: () => query, single: async () => ({ data: null, error: failure }) };
      return query;
    } });
    await expect(addProductImage('product-db-id', { storage_path: 'photo.jpg', is_primary: false })).rejects.toBe(failure);
    await expect(removeProductImage('db-image-94')).rejects.toBe(failure);
  });

  it('distinguishes missing session from authentication errors and profiles without role', async () => {
    const noSession = Object.assign(new Error('missing'), { name: 'AuthSessionMissingError' });
    supabase.getSupabase.mockResolvedValue({ auth: { getUser: async () => ({ data: null, error: noSession }) } });
    await expect(currentProfile()).resolves.toBeNull();

    const failure = new Error('authentication unavailable');
    supabase.getSupabase.mockResolvedValue({ auth: { getUser: async () => ({ data: null, error: failure }) } });
    await expect(currentProfile()).rejects.toBe(failure);

    supabase.getSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'signed-in-id' } }, error: null }) },
      from: () => {
        const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
        return query;
      },
    });
    await expect(currentProfile()).resolves.toMatchObject({ id: 'signed-in-id', role: null });
  });

  it('propagates signOut failure rather than reporting a false success', async () => {
    const failure = new Error('signOut failed');
    supabase.getSupabase.mockResolvedValue({ auth: { signOut: async () => ({ error: failure }) } });
    await expect(signOut()).rejects.toBe(failure);
    supabase.getSupabase.mockResolvedValue({ auth: { signOut: async () => ({ error: null }) } });
    await expect(signOut()).resolves.toBeUndefined();
  });
});

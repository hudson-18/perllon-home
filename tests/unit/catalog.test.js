import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../../src/lib/supabase.js', () => ({
  getSupabase: supabase.getSupabase,
  isSupabaseConfigured: () => true,
}));

import { fetchCartValidation, fetchProducts, installmentLabel, money, normalizeProduct } from '../../src/lib/catalog.js';
import { specificationKey, specificationLabel } from '../../src/lib/specifications.js';

const row = {
  id: 'db-product-id', slug: 'iphone-17', name: 'iPhone 17',
  price_cents: 560050, installments_count: 12, installment_cents: 51000,
  status: 'active', brand: { name: 'Apple' }, category: { name: 'iPhone' },
  product_specifications: [
    { key: 'Armazenamento', value: '256 GB' },
    { key: 'Cor', value: 'Preto' },
  ],
  product_images: [
    { storage_path: 'secondary.jpg', alt_text: 'Verso', is_primary: false, sort_order: 0 },
    { storage_path: 'primary.jpg', alt_text: 'Frente', is_primary: true, sort_order: 1 },
  ],
};

function queryResult(result, onCall = () => {}) {
  const query = {
    select: (...args) => { onCall('select', args); return query; },
    eq: (...args) => { onCall('eq', args); return query; },
    order: (...args) => { onCall('order', args); return query; },
    in: (...args) => { onCall('in', args); return query; },
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

beforeEach(() => supabase.getSupabase.mockReset());

describe('catalog data boundary', () => {
  it('reads stable specification keys and legacy labels without changing editor labels', () => {
    const specs = [
      { key: 'Armazenamento', value: '128 GB' },
      { key: 'storage', value: '256 GB' },
      { key: 'color', value: 'Azul' },
      { key: 'sim_type', value: 'eSIM' },
    ];
    expect(normalizeProduct(row, specs)).toMatchObject({ storage: '256 GB', color: 'Azul', simType: 'eSIM' });
    expect(specificationKey('Armazenamento')).toBe('storage');
    expect(specificationLabel('storage')).toBe('Armazenamento');
    expect(specificationKey('RAM')).toBe('RAM');
  });

  it('normalizes integer centavos, specifications and primary image', () => {
    const product = normalizeProduct(row, row.product_specifications);
    expect(product).toMatchObject({
      id: 'db-product-id', price: 5600.5, price_cents: 560050,
      storage: '256 GB', color: 'Preto', brand: 'Apple', category: 'iPhone',
      installments: `12x de ${money(51000)}`,
    });
    expect(product.image).toContain('/product-images/primary.jpg');
    expect(product.images.map((image) => image.alt)).toEqual(['Verso', 'Frente']);
    expect(money(560050)).toBe(product.priceFormatted);
    expect(installmentLabel({ installments_count: null, installment_cents: null })).toBeNull();
  });

  it('returns actual active products from Supabase', async () => {
    const calls = [];
    supabase.getSupabase.mockResolvedValue({
      from: (table) => {
        expect(table).toBe('products');
        return queryResult({ data: [row], error: null }, (name, args) => calls.push([name, args]));
      },
    });
    const result = await fetchProducts();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].price_cents).toBe(560050);
    expect(calls).toContainEqual(['eq', ['status', 'active']]);
  });

  it('preserves a successful empty response instead of manufacturing products', async () => {
    supabase.getSupabase.mockResolvedValue({ from: () => queryResult({ data: [], error: null }) });
    await expect(fetchProducts()).resolves.toEqual({ data: [] });
  });

  it('propagates a query error instead of presenting it as empty', async () => {
    const failure = new Error('network unavailable');
    supabase.getSupabase.mockResolvedValue({ from: () => queryResult({ data: null, error: failure }) });
    await expect(fetchProducts()).rejects.toBe(failure);
  });

  it('re-reads commercial fields for unique cart IDs', async () => {
    const calls = [];
    supabase.getSupabase.mockResolvedValue({ from: () => queryResult({ data: [row], error: null }, (name, args) => calls.push([name, args])) });
    const fresh = await fetchCartValidation(['db-product-id', 'db-product-id']);
    expect(calls).toContainEqual(['in', ['id', ['db-product-id']]]);
    expect(fresh['db-product-id'].price_cents).toBe(560050);
  });
});

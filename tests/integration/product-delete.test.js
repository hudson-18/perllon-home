// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  listBrands: vi.fn(), listCategories: vi.fn(), getProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock('../../src/lib/admin.js', () => mock);
vi.mock('../../src/lib/storage.js', () => ({
  uploadProductImage: vi.fn(), deleteProductImage: vi.fn(),
}));
import { renderProductForm } from '../../src/admin/product-form.js';

const record = {
  id: 'demo-id', name: 'Demo product', slug: 'demo-product',
  price_cents: 10000, status: 'active',
  product_images: [], product_specifications: [],
};
const root = () => document.querySelector('#test-root');
const router = vi.fn();
const context = {
  root,
  shell: (_active, html) => html,
  isCurrentNavigation: () => true,
  router,
  imageUrlOrNull: () => null,
};
async function show(id = 'demo-id') {
  await renderProductForm(id, 1, context);
  return root();
}

beforeEach(() => {
  document.body.innerHTML = '<main id="test-root"></main>';
  location.hash = '#/products/demo-id';
  router.mockReset();
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.listBrands.mockResolvedValue([]);
  mock.listCategories.mockResolvedValue([]);
  mock.getProduct.mockResolvedValue(structuredClone(record));
  mock.deleteProduct.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('permanent product deletion', () => {
  it('is unavailable for a new product', async () => {
    const view = await show(null);
    expect(view.querySelector('#delete-product')).toBeNull();
  });

  it('requires confirmation before deleting', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = await show();
    view.querySelector('#delete-product').click();
    expect(confirm).toHaveBeenCalledOnce();
    expect(mock.deleteProduct).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and navigates back to products', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = await show();
    view.querySelector('#delete-product').click();
    await vi.waitFor(() => expect(mock.deleteProduct).toHaveBeenCalledWith('demo-id'));
    await vi.waitFor(() => expect(location.hash).toBe('#/products'));
  });

  it('keeps the form available if the database rejects deletion', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mock.deleteProduct.mockRejectedValue(new Error('unavailable'));
    const view = await show();
    view.querySelector('#delete-product').click();
    await vi.waitFor(() => expect(view.querySelector('#delete-product').disabled).toBe(false));
    expect(location.hash).toBe('#/products/demo-id');
    expect(document.querySelector('.toast-admin.error')?.textContent).toContain('Não foi possível excluir');
  });
});

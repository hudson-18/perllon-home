// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  admin: {
    currentProfile: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    dashboardStats: vi.fn(), recentAudit: vi.fn(),
    listBrands: vi.fn(), listCategories: vi.fn(), getProduct: vi.fn(),
    createProduct: vi.fn(), updateProduct: vi.fn(), replaceSpecifications: vi.fn(),
    addProductImage: vi.fn(), removeProductImage: vi.fn(),
  },
  storage: {
    uploadProductImage: vi.fn(), deleteProductImage: vi.fn(),
    uploadMedia: vi.fn(), deleteMedia: vi.fn(), mediaPublicUrl: vi.fn(),
  },
  authChange: null,
  route: null,
}));

vi.mock('../../src/lib/admin.js', () => state.admin);
vi.mock('../../src/lib/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: async () => ({ auth: { onAuthStateChange: (callback) => { state.authChange = callback; } } }),
}));
vi.mock('../../src/lib/storage.js', () => ({ ...state.storage, HERO_BUCKET: 'hero-media' }));
vi.mock('../../src/lib/catalog.js', () => ({ money: (cents) => `R$ ${Number(cents / 100).toFixed(2)}` }));

const profile = { id: 'staff-id', full_name: 'Admin Teste', role: { slug: 'admin', name: 'Administrador' } };
const product = {
  id: 'product-db-id', name: 'iPhone de teste', slug: 'iphone-de-teste',
  price_cents: 10000, installments_count: 10, installment_cents: 1000,
  status: 'active', product_images: [], product_specifications: [],
};

async function bootAdmin(route = '#/dashboard') {
  vi.resetModules();
  document.body.innerHTML = '<div id="admin-root"></div>';
  location.hash = route;
  state.authChange = null;
  state.route = null;
  const nativeAdd = window.addEventListener.bind(window);
  const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'hashchange') { state.route = listener; return; }
    nativeAdd(type, listener, options);
  });
  await import('../../src/admin/main.js');
  spy.mockRestore();
  expect(state.route).toBeTypeOf('function');
  await vi.waitFor(() => expect(document.querySelector('#admin-root').children.length).toBeGreaterThan(0));
  return document.querySelector('#admin-root');
}

async function navigate(hash) {
  location.hash = hash;
  await state.route();
}

async function readyProductForm(route = '#/products/product-db-id') {
  const root = await bootAdmin(route);
  await vi.waitFor(() => expect(root.querySelector('#product-form')).not.toBeNull());
  return root;
}

beforeEach(() => {
  for (const fn of Object.values(state.admin)) fn.mockReset();
  for (const fn of Object.values(state.storage)) fn.mockReset();
  state.admin.currentProfile.mockResolvedValue(profile);
  state.admin.dashboardStats.mockResolvedValue({ total: 1, active: 1, inactive: 0, archived: 0 });
  state.admin.recentAudit.mockResolvedValue([]);
  state.admin.listBrands.mockResolvedValue([]);
  state.admin.listCategories.mockResolvedValue([]);
  state.admin.getProduct.mockResolvedValue(structuredClone(product));
  state.admin.createProduct.mockResolvedValue({ id: 'created-product-id' });
  state.admin.updateProduct.mockResolvedValue({ id: product.id });
  state.admin.replaceSpecifications.mockResolvedValue(undefined);
  state.admin.signOut.mockResolvedValue(undefined);
  state.storage.deleteProductImage.mockResolvedValue(undefined);
  state.storage.mediaPublicUrl.mockReturnValue(null);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('administrative authentication and authorization', () => {
  it.each(['#logout-btn', '#logout-btn-mobile'])('binds %s after rendering and navigates only after signOut', async (selector) => {
    const root = await bootAdmin();
    await vi.waitFor(() => expect(root.querySelector(selector)).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.querySelector(selector).click();
    await vi.waitFor(() => expect(state.admin.signOut).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(location.hash).toBe('#/login'));
    state.admin.currentProfile.mockResolvedValue(null);
    await state.route();
    expect(root.textContent).toContain('Acesso administrativo');
  });

  it('keeps the authenticated page and shows an error if signOut fails', async () => {
    state.admin.signOut.mockRejectedValue(new Error('network unavailable'));
    const root = await bootAdmin();
    await vi.waitFor(() => expect(root.querySelector('#logout-btn')).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.querySelector('#logout-btn').click();
    await vi.waitFor(() => expect(root.querySelector('#logout-btn').disabled).toBe(false));
    expect(state.admin.signOut).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#/dashboard');
    expect(document.querySelector('.toast-admin.error')?.textContent).toContain('Não foi possível sair');
  });

  it('does not render the panel for an invalid role', async () => {
    state.admin.currentProfile.mockResolvedValue({ id: 'visitor-id', role: { slug: 'customer' } });
    const root = await bootAdmin();
    await vi.waitFor(() => expect(root.textContent).toContain('Acesso administrativo não autorizado'));
    expect(root.querySelector('.admin-shell')).toBeNull();
    expect(root.querySelector('#access-denied-logout')).not.toBeNull();
  });

  it('redirects an absent session and clears the panel on SIGNED_OUT', async () => {
    const root = await bootAdmin();
    await vi.waitFor(() => expect(root.querySelector('.admin-shell')).not.toBeNull());
    await vi.waitFor(() => expect(state.authChange).toBeTypeOf('function'));
    state.admin.currentProfile.mockResolvedValue(null);
    state.authChange('SIGNED_OUT');
    expect(location.hash).toBe('#/login');
    await state.route();
    expect(root.querySelector('.admin-shell')).toBeNull();
    expect(root.textContent).toContain('Acesso administrativo');
  });
});

describe('administrative product operations', () => {
  it('uses the persisted image ID for removal and deletes Storage after the database row', async () => {
    const order = [];
    state.storage.uploadProductImage.mockResolvedValue({ path: 'product-db-id/photo.jpg' });
    state.admin.addProductImage.mockImplementation(async () => {
      order.push('insert-db');
      return { id: 'real-image-db-id', storage_path: 'product-db-id/photo.jpg', is_primary: true };
    });
    state.admin.removeProductImage.mockImplementation(async (id) => { order.push(`delete-db:${id}`); });
    state.storage.deleteProductImage.mockImplementation(async (path) => { order.push(`delete-storage:${path}`); });
    const root = await readyProductForm();
    const input = root.querySelector('#image-upload');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelector('[data-rmimg="real-image-db-id"]')).not.toBeNull());
    expect(root.querySelector('[data-rmimg]').dataset.path).toBe('product-db-id/photo.jpg');
    root.querySelector('[data-rmimg]').click();
    await vi.waitFor(() => expect(state.storage.deleteProductImage).toHaveBeenCalledWith('product-db-id/photo.jpg'));
    expect(state.admin.removeProductImage).toHaveBeenCalledWith('real-image-db-id');
    expect(order).toEqual(['insert-db', 'delete-db:real-image-db-id', 'delete-storage:product-db-id/photo.jpg']);
    expect(root.querySelector('[data-rmimg]')).toBeNull();
  });

  it('cleans an orphaned upload when database insertion fails', async () => {
    state.storage.uploadProductImage.mockResolvedValue({ path: 'product-db-id/orphan.jpg' });
    state.admin.addProductImage.mockRejectedValue(new Error('insert failed'));
    const root = await readyProductForm();
    const input = root.querySelector('#image-upload');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bytes'], 'orphan.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(state.storage.deleteProductImage).toHaveBeenCalledWith('product-db-id/orphan.jpg'));
    expect(root.querySelector('[data-rmimg]')).toBeNull();
    expect(document.querySelector('.toast-admin.error')?.textContent).toContain('Não foi possível enviar');
  });

  it('reports Storage cleanup failure after database removal without claiming success', async () => {
    state.admin.getProduct.mockResolvedValue({ ...product, product_images: [
      { id: 'real-image-db-id', storage_path: 'product-db-id/photo.jpg', is_primary: true },
    ] });
    state.admin.removeProductImage.mockResolvedValue({ id: 'real-image-db-id' });
    state.storage.deleteProductImage.mockRejectedValue(new Error('Storage unavailable'));
    const root = await readyProductForm();
    root.querySelector('[data-rmimg="real-image-db-id"]').click();
    await vi.waitFor(() => expect(document.querySelector('.toast-admin.error')?.textContent).toContain('arquivo antigo não pôde ser limpo'));
    expect(state.admin.removeProductImage).toHaveBeenCalledWith('real-image-db-id');
    expect(root.querySelector('[data-rmimg]')).toBeNull();
    expect(document.querySelector('.toast-admin.success')).toBeNull();
  });

  it('blocks double submit, shows processing and confirms success after specifications finish', async () => {
    let finishCreate;
    state.admin.createProduct.mockReturnValue(new Promise((resolve) => { finishCreate = resolve; }));
    const root = await readyProductForm('#/products/new');
    const form = root.querySelector('#product-form');
    form.elements.name.value = 'iPhone novo';
    form.elements.price.value = '100.00';
    const submit = form.querySelector('button[type="submit"]');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(state.admin.createProduct).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Salvando');
    expect(document.querySelector('.toast-admin.success')).toBeNull();
    finishCreate({ id: 'created-product-id' });
    await vi.waitFor(() => expect(state.admin.replaceSpecifications).toHaveBeenCalledWith('created-product-id', []));
    await vi.waitFor(() => expect(document.querySelector('.toast-admin.success')?.textContent).toContain('Produto criado'));
    expect(submit.disabled).toBe(false);
  });

  it('reports save failure, restores controls and allows retry', async () => {
    state.admin.createProduct.mockRejectedValueOnce(new Error('database unavailable'));
    const root = await readyProductForm('#/products/new');
    const form = root.querySelector('#product-form');
    form.elements.name.value = 'iPhone novo';
    form.elements.price.value = '100.00';
    const submit = form.querySelector('button[type="submit"]');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.toast-admin.error')?.textContent).toContain('Não foi possível salvar'));
    expect(submit.disabled).toBe(false);
    expect(state.admin.replaceSpecifications).not.toHaveBeenCalled();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(state.admin.createProduct).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(document.querySelector('.toast-admin.success')?.textContent).toContain('Produto criado'));
  });

  it('does not claim full success when specifications fail after saving basic data', async () => {
    state.admin.replaceSpecifications.mockRejectedValue(new Error('RPC failed'));
    const root = await readyProductForm();
    const form = root.querySelector('#product-form');
    form.elements.name.value = 'iPhone editado';
    form.elements.price.value = '150.00';
    const submit = form.querySelector('button[type="submit"]');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.toast-admin.error')?.textContent).toContain('dados básicos foram salvos'));
    expect(state.admin.updateProduct).toHaveBeenCalledTimes(1);
    expect(state.admin.replaceSpecifications).toHaveBeenCalledWith('product-db-id', []);
    expect(document.querySelector('.toast-admin.success')).toBeNull();
    expect(submit.disabled).toBe(false);
  });
});

// @vitest-environment jsdom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = vi.hoisted(() => ({
  configured: vi.fn(), products: vi.fn(), validate: vi.fn(),
  spotlight: vi.fn(), hero: vi.fn(),
}));
vi.mock('../../src/lib/catalog.js', () => ({
  isSupabaseConfigured: catalog.configured,
  fetchProducts: catalog.products,
  fetchCartValidation: catalog.validate,
  fetchSpotlight: catalog.spotlight,
  fetchHeroMedia: catalog.hero,
}));
vi.mock('../../src/lib/storage.js', () => ({ mediaPublicUrl: vi.fn(() => null), HERO_BUCKET: 'hero-media' }));

const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fixture = {
  id: 'product-db-id', name: 'iPhone de teste', category: 'iPhone',
  price: 100, installments: `10x de ${brl(10)}`, image: '/image.jpg',
  storage: '128 GB', color: 'Preto', status: 'active',
};
const cartItem = { ...fixture, qty: 1 };
let documentListeners = [];

function freshProduct(overrides = {}) {
  return {
    id: fixture.id, name: fixture.name, price_cents: 10000,
    installments_count: 10, installment_cents: 1000, status: 'active',
    ...overrides,
  };
}

async function bootPublic({ connected = true, products = [fixture], cart = [], hero = false } = {}) {
  vi.resetModules();
  document.body.innerHTML = `
    <a class="skip-link" href="#main">Pular</a>
    <header id="header" class="header">
      <button class="header-burger" aria-expanded="false">Menu</button>
      <button class="header-cart">Carrinho</button><span class="header-cart-count"></span>
    </header>
    <div id="menu-backdrop"></div><aside id="mobile-menu" inert></aside>
    <main id="main"><div id="catalog-rail"></div>
      ${hero ? '<section id="hero"><video id="hero-video"></video><a id="hero-cta" href="/safe">Solicitar orçamento</a></section>' : ''}
    </main>
    <footer class="footer"></footer><div id="toast-wrap" aria-live="polite"></div>
  `;
  localStorage.clear();
  localStorage.setItem('perllon_cart', JSON.stringify(cart));
  catalog.configured.mockReturnValue(connected);
  catalog.products.mockResolvedValue({ data: products });
  catalog.validate.mockResolvedValue({ [fixture.id]: freshProduct() });

  let onReady;
  const nativeAdd = document.addEventListener.bind(document);
  const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type, callback, options) => {
    if (type === 'DOMContentLoaded') { onReady = callback; return; }
    nativeAdd(type, callback, options);
    documentListeners.push([type, callback, options]);
  });
  await import('../../src/main.js');
  expect(onReady).toBeTypeOf('function');
  onReady();
  spy.mockRestore();
  return document.querySelector('#catalog-rail');
}

function submitName(name = 'Cliente Teste') {
  document.querySelector('#cart-checkout').click();
  const input = document.querySelector('#customer-name');
  input.value = name;
  document.querySelector('.name-modal-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return document.querySelector('.name-modal-status');
}

function persistedCart() {
  return JSON.parse(localStorage.getItem('perllon_cart'));
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog.spotlight.mockResolvedValue(null);
  catalog.hero.mockResolvedValue(null);
  vi.stubGlobal('requestAnimationFrame', (callback) => { callback(); return 1; });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('open', vi.fn());
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
  });
});

afterEach(() => {
  for (const [type, callback, options] of documentListeners) document.removeEventListener(type, callback, options);
  documentListeners = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('public catalog', () => {
  it('renders Supabase products when returned', async () => {
    const rail = await bootPublic();
    await vi.waitFor(() => expect(rail.querySelectorAll('.pcard')).toHaveLength(1));
    expect(rail.textContent).toContain('iPhone de teste');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders an empty state for [] without loading old demo products', async () => {
    const rail = await bootPublic({ products: [] });
    await vi.waitFor(() => expect(rail.textContent).toContain('Nenhum aparelho disponível'));
    expect(rail.querySelector('.pcard')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders an explicit error when the connected query fails', async () => {
    catalog.products.mockRejectedValueOnce(new Error('network unavailable'));
    const rail = await bootPublic();
    await vi.waitFor(() => expect(rail.textContent).toContain('Não foi possível carregar o catálogo'));
    expect(rail.querySelector('.pcard')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses static products only in demo mode and resolves each image asset', async () => {
    const fallback = JSON.parse(readFileSync(resolve('public/data/products.json'), 'utf8'));
    for (const product of fallback) {
      expect(existsSync(resolve('src/assets/images', product.image))).toBe(true);
    }
    fetch.mockResolvedValue({ ok: true, json: async () => fallback });
    const rail = await bootPublic({ connected: false });
    await vi.waitFor(() => expect(rail.querySelectorAll('.pcard')).toHaveLength(fallback.length));
    expect(catalog.products).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/data/products.json');
    expect(rail.querySelector('.pcard img').getAttribute('src')).toContain('iphone-17-256gb-preto');
  });

  it('keeps the safe static hero destination when Supabase returns an unsafe CTA', async () => {
    catalog.hero.mockResolvedValue({ active: true, ctaHref: 'javascript:alert(1)' });
    await bootPublic({ hero: true });
    await vi.waitFor(() => expect(catalog.hero).toHaveBeenCalledTimes(1));
    expect(document.querySelector('#hero-cta').getAttribute('href')).toBe('/safe');
  });
});

describe('assisted WhatsApp cart', () => {
  it('persists new price and installments before requiring a second confirmation', async () => {
    const rail = await bootPublic({ cart: [cartItem] });
    await vi.waitFor(() => expect(rail.textContent).toContain(fixture.name));
    catalog.validate.mockResolvedValue({ [fixture.id]: freshProduct({ price_cents: 12000, installments_count: 6, installment_cents: 2000 }) });
    document.querySelector('.header-cart').click();
    const status = submitName();
    expect(status.getAttribute('aria-live')).toBe('polite');
    await vi.waitFor(() => expect(persistedCart()[0].price).toBe(120));
    expect(persistedCart()[0].installments).toContain('6x de');
    expect(document.querySelector('#cart-drawer').textContent).toContain('120,00');
    expect(window.open).not.toHaveBeenCalled();
    expect(document.querySelector('#toast-wrap').textContent).toContain('Revise o carrinho');

    submitName();
    await vi.waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    const url = new URL(window.open.mock.calls[0][0]);
    const message = url.searchParams.get('text');
    expect(message).toContain(brl(120));
    expect(message).toContain(`6x de ${brl(20)}`);
    expect(message).not.toContain('10x de R$ 10,00');
  });

  it('requires review when only installment terms change', async () => {
    await bootPublic({ cart: [cartItem] });
    catalog.validate.mockResolvedValue({ [fixture.id]: freshProduct({ installments_count: 5, installment_cents: 2200 }) });
    document.querySelector('.header-cart').click();
    submitName();
    await vi.waitFor(() => expect(persistedCart()[0].installments).toContain('5x de'));
    expect(window.open).not.toHaveBeenCalled();
  });

  it('removes unavailable products and never sends their old prices', async () => {
    await bootPublic({ cart: [cartItem] });
    catalog.validate.mockResolvedValue({ [fixture.id]: freshProduct({ status: 'inactive' }) });
    document.querySelector('.header-cart').click();
    submitName();
    await vi.waitFor(() => expect(persistedCart()).toEqual([]));
    expect(window.open).not.toHaveBeenCalled();
    expect(document.querySelector('#toast-wrap').textContent).toContain('não estão mais disponíveis');
  });

  it('keeps cart and modal available for retry after validation failure', async () => {
    await bootPublic({ cart: [cartItem] });
    catalog.validate.mockRejectedValueOnce(new Error('network unavailable'));
    document.querySelector('.header-cart').click();
    const status = submitName();
    await vi.waitFor(() => expect(status.textContent).toContain('tente novamente'));
    expect(persistedCart()).toEqual([cartItem]);
    expect(window.open).not.toHaveBeenCalled();
    expect(document.querySelector('#name-modal-overlay').classList.contains('is-open')).toBe(true);
    expect(document.querySelector('.name-modal-form button[type="submit"]').disabled).toBe(false);

    document.querySelector('.name-modal-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
  });

  it('keeps the name modal labelled, live-announced and focused', async () => {
    await bootPublic({ cart: [cartItem] });
    document.querySelector('.header-cart').click();
    document.querySelector('#cart-checkout').click();
    expect(document.querySelector('.name-modal').getAttribute('role')).toBe('dialog');
    expect(document.querySelector('.name-modal').getAttribute('aria-labelledby')).toBe('name-modal-title');
    expect(document.querySelector('.name-modal-status').getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement.id).toBe('customer-name');
  });

  it('formats subtotal and assisted-sale message from quantity without opening a real tab', async () => {
    await bootPublic({ cart: [{ ...cartItem, qty: 2 }] });
    document.querySelector('.header-cart').click();
    expect(document.querySelector('.cart-total').textContent).toContain(brl(200));
    submitName();
    await vi.waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
    const message = new URL(window.open.mock.calls[0][0]).searchParams.get('text');
    expect(message).toContain('Quantidade: 2');
    expect(message).toContain(`Total do pedido: ${brl(200)}`);
  });
});

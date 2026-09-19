import { fetchProducts as fetchProductsRemote, isSupabaseConfigured } from '../lib/catalog.js';
import { esc, money } from './format.js';
import fallbackIphone17 from '../assets/images/iphone-17-256gb-preto.jpg';
import fallbackIphone16 from '../assets/images/iphone-16-128gb.jpg';
import fallbackIphone15ProMax from '../assets/images/iphone-15-pro-max-256gb.jpg';
import fallbackIphone14ProMax from '../assets/images/iphone-14-pro-max-128gb.jpg';
import fallbackIphone14Pro from '../assets/images/iphone-14-pro-512gb.jpg';
import fallbackSmartBand from '../assets/images/xiaomi-smart-band-10.jpg';
import fallbackSmartwatch from '../assets/images/smartwatch-wb.jpg';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

// Static demo data stores stable asset keys. Vite resolves these imports to the
// hashed production URLs, so the fallback never depends on /src paths at runtime.
const FALLBACK_PRODUCT_IMAGES = {
  'iphone-17-256gb-preto.jpg': fallbackIphone17,
  'iphone-16-128gb.jpg': fallbackIphone16,
  'iphone-15-pro-max-256gb.jpg': fallbackIphone15ProMax,
  'iphone-14-pro-max-128gb.jpg': fallbackIphone14ProMax,
  'iphone-14-pro-512gb.jpg': fallbackIphone14Pro,
  'xiaomi-smart-band-10.jpg': fallbackSmartBand,
  'smartwatch-wb.jpg': fallbackSmartwatch,
};

// ---------- Catalog preview render ----------
async function loadFallbackProducts() {
  const response = await fetch('/data/products.json');
  if (!response.ok) throw new Error(`Fallback catalog request failed (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Fallback catalog response is invalid.');
  return data.map((product) => {
    const image = FALLBACK_PRODUCT_IMAGES[product.image];
    if (!image) throw new Error(`Fallback image is not mapped: ${product.image}`);
    return { ...product, image };
  });
}

// Supabase is authoritative whenever configured. The static catalog is only
// used by the explicit unconfigured/demo mode.
async function loadProducts() {
  if (isSupabaseConfigured()) {
    const { data } = await fetchProductsRemote();
    if (!Array.isArray(data)) throw new Error('Supabase catalog response is invalid.');
    return data;
  }
  return loadFallbackProducts();
}

export async function initCatalog({ addToCart, reveal }) {
  const rail = $('#catalog-rail');
  if (!rail) return;
  let products = [];
  try {
    products = await loadProducts();
  } catch (e) {
    console.warn('[perllon] catalog load failed.', e);
    rail.innerHTML = '<p class="catalog-error">Não foi possível carregar o catálogo no momento.</p>';
    return;
  }

  // Local cache of active products for cart validation at checkout
  // (id → price_cents). Prices are always re-validated against backend.
  window.__perllonCatalog = products;

  if (products.length === 0) {
    rail.innerHTML = '<p class="catalog-message">Nenhum aparelho disponível no momento. Fale conosco pelo WhatsApp para consultar reposições.</p>';
    return;
  }

  rail.innerHTML = products.map((p, idx) => {
    const name = esc(p.name);
    const category = esc(p.category || '');
    const storage = esc(p.storage || '');
    const color = esc(p.color || '');
    const installments = esc(p.installments || '');
    const image = esc(p.image || '');
    const spec = [storage, color].filter(Boolean).join(' · ') || 'Consulte especificações';
    // Staggered entrance (perceptible cadence, capped so long rails stay lively).
    const delay = Math.min(idx * 95, 380);
    return `
    <article class="pcard" data-reveal="scale" style="--reveal-delay:${delay}ms" data-id="${esc(p.id)}" data-name="${name}" data-price="${esc(p.price)}" data-image="${image}" data-storage="${storage}" data-color="${color}" data-installments="${installments}">
      <div class="pcard-media"><img src="${image}" alt="${name}${storage ? ' ' + storage : ''}" loading="lazy" decoding="async"></div>
      <div class="pcard-body">
        <span class="pcard-cat">${category}</span>
        <h3 class="pcard-name">${name}</h3>
        <span class="pcard-spec">${spec}</span>
        <div class="pcard-foot">
          <div>
            <div class="pcard-price">${money(p.price)}</div>
            ${p.installments ? `<div class="pcard-install">${installments}</div>` : ''}
          </div>
        </div>
        <button class="btn btn-primary btn-sm" data-add>Adicionar ao carrinho</button>
      </div>
    </article>`;
  }).join('');

  // Observe new cards (re-run reveal so injected cards animate in).
  reveal();

  $$('#catalog-rail [data-add]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const card = btn.closest('.pcard');
      // Visual confirmation on the button before the drawer takes over.
      btn.classList.add('is-added');
      setTimeout(() => btn.classList.remove('is-added'), 700);
      addToCart({
        id: card.dataset.id, name: card.dataset.name, price: +card.dataset.price,
        image: card.dataset.image, storage: card.dataset.storage, color: card.dataset.color,
        installments: card.dataset.installments,
      });
    })
  );
}

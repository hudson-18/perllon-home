// ============================================================
// PERLLON — Home
// Vanilla JS. Zero runtime dependencies.
// ============================================================

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';

import { fetchProducts as fetchProductsRemote, fetchCartValidation, isSupabaseConfigured } from './lib/catalog.js';

// ---------- Utils ----------
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const WHATSAPP = '5584998405201';
const waUrl = (text) =>
  `https://api.whatsapp.com/send/?phone=${WHATSAPP}&type=phone_number&app_absent=0&text=${encodeURIComponent(text)}`;

const money = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// HTML-escape dynamic data before any innerHTML interpolation (XSS hardening).
// Never interpolate DB/localStorage/user input into HTML without this.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Motion preview mode (dev-only) ----------
// Developer escape hatch to SEE the motion on machines whose OS flags
// `prefers-reduced-motion: reduce`. Enabled ONLY on localhost with an
// explicit `?motion=preview` query param, so it can never leak to production
// or affect real users' accessibility. Visual-only; touches no auth/data/RYLS.
const _isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const _motionPreview = _isLocalhost && new URLSearchParams(window.location.search).get('motion') === 'preview';
// Returns true when motion should be REDUCED. Preview mode forces false.
function reduceMotion() {
  if (_motionPreview) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
// When preview is on, reflect it in the DOM so the CSS media queries (which
// still key off the real OS preference) can't silently zero the durations.
if (_motionPreview) {
  document.documentElement.classList.add('motion-preview');
}

// ---------- Toast ----------
function toast(msg) {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; setTimeout(() => el.remove(), 320); }, 3200);
}

// ---------- Cart store (localStorage) ----------
const Cart = {
  key: 'perllon_cart',
  items: [],
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || '[]');
      this.items = Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === 'string' && typeof i.price === 'number' && Number.isFinite(i.price) && typeof i.qty === 'number' && i.qty > 0)
        .map((i) => ({ ...i, qty: Math.min(99, Math.max(1, Math.floor(i.qty))), price: i.price }))
        : [];
    }
    catch { this.items = []; }
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch (e) { /* storage may be blocked */ }
    document.dispatchEvent(new CustomEvent('cart:updated'));
  },
  add(p) {
    const found = this.items.find((i) => i.id === p.id);
    if (found) found.qty += 1;
    else this.items.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1, installments: p.installments, storage: p.storage, color: p.color });
    this.save();
    toast(`${p.name} adicionado ao carrinho`);
    // Brief beat so the button feedback (is-added) reads before the drawer opens.
    setTimeout(openCart, 240);
  },
  setQty(id, qty) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    if (qty <= 0) { this.remove(id); return; }
    it.qty = Math.min(99, qty);
    this.save();
  },
  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.save(); },
  count() { return this.items.reduce((n, i) => n + i.qty, 0); },
  subtotal() { return this.items.reduce((n, i) => n + i.price * i.qty, 0); },
};
Cart.load();

// Single source of truth re-render: every cart mutation re-paints the drawer if open.
function onCartUpdated() {
  updateCartBadge();
  // Re-render the drawer live if it's currently open (keeps qty/subtotal/total in sync without reopen).
  if (cartEl && cartEl.classList.contains('is-open')) {
    renderCart();
  }
}
document.addEventListener('cart:updated', onCartUpdated);

// ---------- Header (scroll + mobile menu) ----------
function initHeader() {
  const header = $('#header');
  const burger = $('.header-burger');
  const menu = $('#mobile-menu');
  const backdrop = $('#menu-backdrop');

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const open = () => { menu.classList.add('is-open'); backdrop.classList.add('is-open'); burger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; };
  const close = () => { menu.classList.remove('is-open'); backdrop.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };

  burger.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  backdrop.addEventListener('click', close);
  $$('#mobile-menu .nav-item').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); closeCart(); } });
}

// ---------- Cart drawer (minimal, functional) ----------
let cartEl;
function ensureCart() {
  if (cartEl) return cartEl;
  cartEl = document.createElement('aside');
  cartEl.className = 'cart-drawer';
  cartEl.id = 'cart-drawer';
  cartEl.setAttribute('aria-label', 'Carrinho');
  document.body.appendChild(cartEl);

  const bd = document.createElement('div');
  bd.className = 'cart-backdrop';
  bd.id = 'cart-backdrop';
  bd.addEventListener('click', closeCart);
  document.body.appendChild(bd);

  return cartEl;
}
function renderCart() {
  ensureCart();
  const items = Cart.items;
  if (items.length === 0) {
    cartEl.innerHTML = `<div class="cart-head"><h3>Carrinho</h3><button id="cart-x" aria-label="Fechar carrinho">×</button></div>
      <div class="cart-empty">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;opacity:.35"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1 0 8"/></svg>
        <strong>Seu carrinho está vazio.</strong>
        <span class="cart-hint">Adicione aparelhos para gerar seu pedido.</span>
        <button class="btn btn-secondary btn-sm" id="cart-keep-shopping" style="width:100%;max-width:220px;margin:1.2rem auto 0;">Continuar navegando</button>
      </div>`;
    $('#cart-x').addEventListener('click', closeCart);
    $('#cart-keep-shopping').addEventListener('click', closeCart);
    return;
  }
  const rows = items.map((i) => {
    const name = esc(i.name);
    const storage = esc(i.storage || '');
    const color = esc(i.color || '');
    const image = esc(i.image || '');
    return `
    <div class="cart-row">
      <img src="${image}" alt="${name}">
      <div class="cart-row-info">
        <strong>${name}</strong>
        <span class="cart-spec">${[storage, color].filter(Boolean).join(' · ') || 'Consulte'}</span>
        <span class="cart-price">${money(i.price * i.qty)}</span>
        <button class="cart-remove" data-remove="${esc(i.id)}" aria-label="Remover ${name} do carrinho">Remover</button>
      </div>
      <div class="cart-qty">
        <button data-act="dec" data-id="${esc(i.id)}" aria-label="Diminuir quantidade">−</button>
        <span class="qty-num">${i.qty}</span>
        <button data-act="inc" data-id="${esc(i.id)}" aria-label="Aumentar quantidade">+</button>
      </div>
    </div>`;
  }).join('');

  cartEl.innerHTML = `<div class="cart-head"><h3>Carrinho</h3><button id="cart-x" aria-label="Fechar carrinho">×</button></div>
    <div class="cart-body">${rows}</div>
    <div class="cart-foot">
      <div class="cart-total"><span>Subtotal</span><strong>${money(Cart.subtotal())}</strong></div>
      <button class="btn btn-primary btn-lg" id="cart-checkout" style="width:100%;">Finalizar pelo WhatsApp</button>
    </div>`;

  $('#cart-x').addEventListener('click', closeCart);
  $$('#cart-drawer [data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      const cur = Cart.items.find((i) => i.id === id)?.qty || 0;
      if (b.dataset.act === 'inc') Cart.setQty(id, cur + 1);
      else Cart.setQty(id, cur - 1);
    })
  );
  $$('#cart-drawer [data-remove]').forEach((b) =>
    b.addEventListener('click', () => Cart.remove(b.dataset.remove))
  );
  $('#cart-checkout').addEventListener('click', checkout);
}
function openCart() {
  ensureCart();
  renderCart();
  $('#cart-drawer').classList.add('is-open');
  $('#cart-backdrop').classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  $('#cart-drawer')?.classList.remove('is-open');
  $('#cart-backdrop')?.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ---------- Checkout via WhatsApp ----------
function checkout() {
  openNameModal();
}
let nameModalRef = null;
function ensureNameModal() {
  if (nameModalRef) return nameModalRef;

  const overlay = document.createElement('div');
  overlay.className = 'name-modal-overlay';
  overlay.id = 'name-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'name-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'name-modal-title');
  modal.innerHTML = `
    <div class="name-modal-head">
      <h3 id="name-modal-title">Antes de finalizar</h3>
      <button class="name-modal-x" aria-label="Fechar">×</button>
    </div>
    <p class="name-modal-sub">Como podemos chamar você?</p>
    <form class="name-modal-form" novalidate>
      <label class="input-label" for="customer-name">Seu nome</label>
      <input type="text" id="customer-name" class="input" placeholder="Digite seu nome" autocomplete="name">
      <div class="name-modal-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Continuar</button>
      </div>
    </form>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  nameModalRef = overlay;
  return overlay;
}

function openNameModal() {
  ensureNameModal();
  nameModalRef.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  const input = $('#customer-name');
  const prev = document.activeElement;
  setTimeout(() => input.focus(), 60);

  const close = () => {
    nameModalRef.classList.remove('is-open');
    document.body.style.overflow = '';
    prev?.focus?.();
  };

  // close handlers
  nameModalRef.querySelector('.name-modal-x').onclick = close;
  nameModalRef.querySelector('[data-action="cancel"]').onclick = close;
  nameModalRef.onclick = (e) => { if (e.target === nameModalRef) close(); };

  // submit
  nameModalRef.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { toast('Informe seu nome para continuar.'); input.focus(); return; }
    sendWhatsAppOrder(name);
    close();
  };
}

function sendWhatsAppOrder(name) {
  void finalizeOrder(name);
}

// Re-validate cart against the database before generating the order.
// Prices are NEVER trusted from localStorage — they are always re-read
// from the backend (or, in the unconfigured prototype, unchanged).
async function finalizeOrder(name) {
  let items = Cart.items;

  // Re-read prices/status from the source of truth when available.
  if (isSupabaseConfigured()) {
    try {
      const ids = items.map((i) => i.id);
      const fresh = await fetchCartValidation(ids);
      // Drop items that are deactivated/removed; refresh prices from DB.
      items = items
        .filter((i) => fresh[i.id] && (fresh[i.id].status === 'active'))
        .map((i) => ({
          ...i,
          price: fresh[i.id].price_cents / 100,        // reals
          price_cents: fresh[i.id].price_cents,
        }));
      if (items.length !== Cart.items.length) {
        toast('Alguns itens do seu carrinho não estão mais disponíveis e foram removidos.');
      }
    } catch (e) {
      console.warn('[perllon] cart re-validation failed; sending with cached data.', e);
    }
  }

  if (items.length === 0) {
    toast('Seu carrinho está vazio.');
    closeCart();
    return;
  }

  const lines = [
    'Olá, PERLLON! 👋',
    '',
    `Me chamo ${name} e gostaria de consultar a disponibilidade dos seguintes produtos:`,
    '',
    '🛒 ITENS:'
  ];
  items.forEach((i) => {
    lines.push(`• ${i.name}${[i.storage, i.color].filter(Boolean).join(' ').trim() ? ' (' + [i.storage, i.color].filter(Boolean).join(', ') + ')' : ''}`);
    lines.push(`   Quantidade: ${i.qty}`);
    lines.push(`   Valor: ${money(i.price)}${i.installments ? ' (' + i.installments + ')' : ''}`);
    lines.push('');
  });
  lines.push('--------------------------------');
  lines.push(`Total do pedido: ${money(items.reduce((n, i) => n + i.price * i.qty, 0))}`);
  lines.push('--------------------------------');
  lines.push('');
  lines.push('Gostaria de consultar a disponibilidade e os próximos passos para finalizar.');

  window.open(waUrl(lines.join('\n')), '_blank', 'noopener');
  closeCart();
}

// ---------- Keyboard: ESC closes name modal too ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nameModalRef?.classList.contains('is-open')) {
    nameModalRef.classList.remove('is-open');
    document.body.style.overflow = '';
  }
});

// ---------- Header cart count ----------
let _lastBadgeCount = 0;
function updateCartBadge() {
  const c = Cart.count();
  const el = $('.header-cart-count');
  if (el) {
    el.textContent = c > 99 ? '99+' : c;
    el.style.display = c > 0 ? 'flex' : 'none';
    // Pop feedback on every count change (add/remove), not on initial load.
    if (c !== _lastBadgeCount) {
      el.classList.remove('bump');
      void el.offsetWidth; // reflow to restart the animation
      el.classList.add('bump');
      _lastBadgeCount = c;
    }
  }
}

// ---------- Catalog preview render ----------
// Priority: Supabase (if configured) → static JSON fallback (prototype).
async function loadProducts() {
  // 1) Try the live backend first.
  if (isSupabaseConfigured()) {
    try {
      const { data } = await fetchProductsRemote();
      if (data && data.length) return data;
    } catch (e) {
      console.warn('[perllon] Supabase catalog load failed; falling back to static JSON.', e);
    }
  }
  // 2) Static fallback (keeps prototype fully functional without a backend).
  try {
    const r = await fetch('/data/products.json');
    return await r.json();
  } catch (e) {
    throw e;
  }
}

async function initCatalog() {
  const rail = $('#catalog-rail');
  if (!rail) return;
  let products = [];
  try {
    products = await loadProducts();
  } catch (e) {
    rail.innerHTML = '<p class="catalog-error">Não foi possível carregar o catálogo no momento.</p>';
    return;
  }

  // Local cache of active products for cart validation at checkout
  // (id → price_cents). Prices are always re-validated against backend.
  window.__perllonCatalog = products;

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
      <div class="pcard-media"><img src="${image}" alt="${name}${storage ? ' ' + storage : ''}" loading="lazy"></div>
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
  initReveal();

  $$('#catalog-rail [data-add]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const card = btn.closest('.pcard');
      // Visual confirmation on the button before the drawer takes over.
      btn.classList.add('is-added');
      setTimeout(() => btn.classList.remove('is-added'), 700);
      Cart.add({
        id: card.dataset.id, name: card.dataset.name, price: +card.dataset.price,
        image: card.dataset.image, storage: card.dataset.storage, color: card.dataset.color,
        installments: card.dataset.installments,
      });
    })
  );
}

// ---------- Scroll reveal ----------
// Persistent observer + idempotent: safe to call multiple times
// (e.g. boot + after catalog cards are injected) without double-observing.
let _revealObserver = null;
function initReveal() {
  const els = $$('[data-reveal]').filter((el) => !el.classList.contains('is-visible') && !el.dataset.revealObserved);
  if (!els.length) return;
  if (reduceMotion()) {
    els.forEach((e) => e.classList.add('is-visible'));
    return;
  }
  if (!_revealObserver) {
    _revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); _revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  }
  els.forEach((el) => { el.dataset.revealObserved = '1'; _revealObserver.observe(el); });
}

// ---------- Counters ----------
function initCounters() {
  if (reduceMotion()) {
    $$('.counter').forEach((c) => { c.textContent = c.dataset.target; });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = +el.dataset.target;
      const dur = 1600;
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$('.counter').forEach((c) => io.observe(c));
}

// ---------- Open/closed status ----------
function initStatus() {
  const el = $('#open-status');
  if (!el) return;
  const upd = () => {
    const now = new Date();
    const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', hour: 'numeric', minute: 'numeric', weekday: 'short' }).formatToParts(now);
    let h = 0, m = 0, wd = '';
    p.forEach((x) => { if (x.type === 'hour') h = +x.value; if (x.type === 'minute') m = +x.value; if (x.type === 'weekday') wd = x.value.toLowerCase(); });
    const t = h * 60 + m;
    const open = wd.includes('dom') ? false : wd.includes('sáb') ? (t >= 480 && t < 780) : (t >= 480 && t < 1080);
    el.innerHTML = open
      ? '<span class="status-pill open"><span class="dot"></span>Aberto agora</span>'
      : '<span class="status-pill closed"><span class="dot"></span>Fechado agora</span>';
  };
  upd();
  setInterval(upd, 60000);
}

// ---------- WhatsApp float ----------
function initWaFloat() {
  const f = $('#wa-float');
  if (!f) return;
  if (reduceMotion()) { f.classList.add('is-visible'); return; }
  const show = () => { f.classList.add('is-visible'); };
  window.addEventListener('scroll', () => { if (window.scrollY > 300) show(); }, { passive: true, once: true });
  setTimeout(show, 2500);
}

// ---------- Hero scroll choreography ----------
// Perceptible parallax: foreground (phone) drifts up and shrinks, headline
// drifts slightly, glow moves opposite for depth. transform/opacity only
// (GPU-composited), rAF-throttled, passive listener, disabled on
// reduced-motion and on touch (where parallax jitters and adds little).
function initHeroScroll() {
  const hero = $('#hero');
  if (!hero) return;
  if (reduceMotion()) return;
  // Enable parallax on desktop AND hybrid/touch-capable laptops. Only skip on
  // genuinely narrow (mobile) viewports where scroll parallax jitters and
  // costs performance. `pointer: coarse` is NOT a reliable "mobile" signal
  // (it is true on many hybrid laptops), so we use viewport width instead.
  if (window.innerWidth < 900) return;

  const visual = $('.hero-visual', hero);
  const phone = $('.hero-phone', hero);
  const glow = $('.hero-glow', hero);
  const copy = $('.hero-copy', hero);
  const inner = $('.hero-inner', hero);
  const chip = $('.hero-chip', hero);
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const h = hero.offsetHeight;
    const p = Math.min(Math.max(y / h, 0), 1);
    // Foreground phone frame: rise + shrink (the clearest depth cue).
    if (visual) visual.style.transform = `translateY(${(p * 140).toFixed(1)}px)`;
    if (phone) phone.style.transform = `scale(${(1 - p * 0.16).toFixed(3)}) rotateY(-8deg) rotateX(2deg)`;
    // Glow / ambient: opposite drift (deeper layer).
    if (glow) glow.style.transform = `translateY(${(-p * 80).toFixed(1)}px) scale(${(1 + p * 0.2).toFixed(3)})`;
    // Copy: rise + fade for spatial continuity into the next scene.
    if (copy) { copy.style.transform = `translateY(${(-p * 40).toFixed(1)}px)`; copy.style.opacity = String(1 - p * 0.55); }
    if (inner) inner.style.opacity = String(1 - p * 0.3);
    if (chip) chip.style.opacity = String(1 - p * 0.8);
  };

  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ---------- Hero entrance (controlled, post-first-paint) ----------
// The hero is already in the viewport at load, so an IntersectionObserver
// adds `.is-visible` ~immediately and the entry is invisible. Instead we
// force the hero reveal elements into their hidden state, then play a
// staged sequence once the first frame has painted, so the entrance is
// clearly perceived without ever blocking content for long.
function initHeroEntrance() {
  const hero = $('#hero');
  if (!hero) return;
  if (reduceMotion()) return;

  const items = Array.from(hero.querySelectorAll('[data-reveal]'));
  if (!items.length) return;

  // Detach hero elements from the scroll-reveal observer (which would flip
  // them visible immediately since the hero is already in-viewport), so we
  // own their timing with an explicit post-first-paint sequence instead.
  if (_revealObserver) items.forEach((el) => _revealObserver.unobserve(el));

  // Reset to hidden for a visible staged entrance.
  items.forEach((el) => { el.classList.remove('is-visible'); el.dataset.revealObserved = ''; });

  // Play the sequence once the first frame has painted (two rAFs guarantee
  // the hidden state is committed before transitioning to visible).
  requestAnimationFrame(() => requestAnimationFrame(() => {
    items.forEach((el) => el.classList.add('is-visible'));
  }));
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initReveal();
  initCatalog();
  initCounters();
  initStatus();
  initWaFloat();
  initHeroScroll();
  initHeroEntrance();
  updateCartBadge();
  $('.header-cart')?.addEventListener('click', openCart);
});

// cart drawer styles (injected once)
const cartCSS = `
.cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(92vw,400px);background:#fff;z-index:600;transform:translateX(100%);opacity:.4;transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .4s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(4,20,33,.25)}
.cart-drawer.is-open{transform:none;opacity:1}
.cart-backdrop{position:fixed;inset:0;background:rgba(4,20,33,.55);z-index:599;opacity:0;visibility:hidden;transition:.4s}
.cart-backdrop.is-open{opacity:1;visibility:visible}
.cart-head{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.4rem;border-bottom:1px solid var(--color-border)}
.cart-head h3{margin:0;font-size:1.2rem}
.cart-head button{font-size:1.6rem;line-height:1;width:36px;height:36px;border-radius:50%}
.cart-body{flex:1;overflow-y:auto;padding:1rem 1.4rem}
.cart-row{display:flex;gap:1rem;align-items:center;padding:1rem 0;border-bottom:1px solid var(--color-border);animation:cart-row-in .28s cubic-bezier(.22,1,.36,1)}
@keyframes cart-row-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.cart-row img{width:56px;height:56px;object-fit:contain;border-radius:10px;background:var(--color-bg)}
.cart-row-info{flex:1;display:flex;flex-direction:column;gap:.15rem;min-width:0}
.cart-row-info strong{font-size:.95rem}
.cart-spec{font-size:.8rem;color:var(--color-text-muted)}
.cart-price{font-weight:600;font-variant-numeric:tabular-nums}
.cart-remove{align-self:flex-start;margin-top:.25rem;font-size:.78rem;color:var(--color-danger);text-decoration:underline;padding:.3rem 0;background:none;border:0;cursor:pointer}
.cart-remove:hover{opacity:.75}
.cart-qty{display:flex;align-items:center;gap:.35rem;border:1px solid var(--color-border);border-radius:999px;padding:.2rem}
.cart-qty button{width:34px;height:34px;border-radius:50%;font-size:1.2rem;line-height:1;display:flex;align-items:center;justify-content:center;color:var(--color-ink)}
.cart-qty button:hover{background:var(--color-bg)}
.cart-qty button:active{background:var(--color-orange-tint);transform:scale(.9)}
.cart-qty .qty-num{min-width:22px;text-align:center;font-weight:var(--weight-semibold);font-variant-numeric:tabular-nums;animation:qty-pop .22s cubic-bezier(.34,1.56,.64,1)}
@keyframes qty-pop{from{opacity:.3;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.cart-foot{padding:1.2rem 1.4rem;border-top:1px solid var(--color-border);display:flex;flex-direction:column;gap:1rem}
.cart-total{display:flex;justify-content:space-between;font-size:1.1rem}
.cart-total strong{font-variant-numeric:tabular-nums}
.cart-empty{display:flex;flex-direction:column;align-items:center;padding:3rem 1rem;text-align:center;color:var(--color-text-secondary);animation:cart-row-in .28s cubic-bezier(.22,1,.36,1)}
.cart-empty .cart-hint{font-size:.85rem;color:var(--color-text-muted);font-weight:400}

/* Name capture modal */
.name-modal-overlay{position:fixed;inset:0;background:rgba(4,20,33,.6);z-index:700;display:flex;align-items:center;justify-content:center;padding:1.25rem;opacity:0;visibility:hidden;transition:opacity .35s,visibility .35s}
.name-modal-overlay.is-open{opacity:1;visibility:visible}
.name-modal{background:#fff;border-radius:20px;width:100%;max-width:400px;padding:1.75rem;box-shadow:0 32px 80px rgba(4,20,33,.3);transform:translateY(28px) scale(.94);opacity:0;transition:transform .45s cubic-bezier(.22,1,.36,1),opacity .35s}
.name-modal-overlay.is-open .name-modal{transform:none;opacity:1}
.name-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
.name-modal-head h3{margin:0;font-size:1.25rem}
.name-modal-x{width:36px;height:36px;border-radius:50%;font-size:1.4rem;line-height:1;color:var(--color-text-muted)}
.name-modal-x:hover{background:var(--color-bg)}
.name-modal-sub{color:var(--color-text-secondary);margin-bottom:1.2rem}
.name-modal-form{display:flex;flex-direction:column;gap:1rem}
.name-modal-form .input{width:100%}
.name-modal-actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:.25rem}
@media (prefers-reduced-motion: reduce){.name-modal,.name-modal-overlay{transition:none}.cart-row,.cart-empty,.cart-qty .qty-num{animation:none}}
:root.motion-preview .cart-row,:root.motion-preview .cart-empty,:root.motion-preview .cart-qty .qty-num{animation-duration:var(--dur-base,300ms)!important}
:root.motion-preview .name-modal,:root.motion-preview .name-modal-overlay{transition:transform .45s cubic-bezier(.22,1,.36,1),opacity .35s!important}
`;
const style = document.createElement('style');
style.textContent = cartCSS;
document.head.appendChild(style);
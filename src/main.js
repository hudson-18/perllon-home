// ============================================================
// PERLLON — Home
// Vanilla JS. Zero runtime dependencies.
// ============================================================

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/cart.css';
import { esc, money, waUrl } from './public/format.js';
import { createCart, reconcileCartItems } from './public/cart.js';
import { initCatalog } from './public/catalog.js';
import { initSpotlight, initHero } from './public/content.js';

import { fetchCartValidation, isSupabaseConfigured } from './lib/catalog.js';

// ---------- Utils ----------
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

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

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container) {
  if (!container) return [];
  return $$(FOCUSABLE_SELECTOR, container).filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0);
}

function activeLayer() {
  if (nameModalRef?.classList.contains('is-open')) return nameModalRef;
  if (cartEl?.classList.contains('is-open')) return cartEl;
  const menu = $('#mobile-menu');
  return menu?.classList.contains('is-open') ? menu : null;
}

function syncLayerState() {
  const menu = $('#mobile-menu');
  const layer = activeLayer();
  const layers = [menu, cartEl, nameModalRef].filter(Boolean);
  const pageRegions = $$('.skip-link, .header, main, .footer, .wa-float');

  layers.forEach((element) => {
    const isActive = element === layer;
    element.toggleAttribute('inert', !isActive);
    element.setAttribute('aria-hidden', String(!isActive));
  });
  pageRegions.forEach((element) => {
    element.toggleAttribute('inert', Boolean(layer));
    if (layer) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  });

  document.body.classList.toggle('has-open-layer', Boolean(layer));
  document.body.style.overflow = layer ? 'hidden' : '';
}

function trapLayerFocus(event, layer) {
  if (event.key !== 'Tab') return;
  const focusable = focusableElements(layer);
  if (focusable.length === 0) {
    event.preventDefault();
    layer.focus?.();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!layer.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

const Cart = createCart((p) => {
  toast(`${p.name} adicionado ao carrinho`);
  setTimeout(openCart, 240);
}, () => toast('Não foi possível salvar o carrinho neste navegador. Os itens podem desaparecer ao atualizar a página.'));
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

  let returnFocus = null;
  const open = () => {
    returnFocus = document.activeElement;
    menu.classList.add('is-open');
    backdrop.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    syncLayerState();
    requestAnimationFrame(() => {
      if (menu.classList.contains('is-open')) focusableElements(menu)[0]?.focus();
    });
  };
  const close = () => {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    syncLayerState();
    const target = returnFocus?.isConnected ? returnFocus : burger;
    target?.focus?.();
    returnFocus = null;
  };

  burger.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  backdrop.addEventListener('click', close);
  $$('#mobile-menu .nav-item').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    const layer = activeLayer();
    if (layer) trapLayerFocus(event, layer);
    if (event.key !== 'Escape') return;
    if (nameModalRef?.classList.contains('is-open')) closeNameModal();
    else if (cartEl?.classList.contains('is-open')) closeCart();
    else close();
  });

  syncLayerState();
}

// ---------- Cart drawer (minimal, functional) ----------
let cartEl;
let cartReturnFocus = null;
function ensureCart() {
  if (cartEl) return cartEl;
  cartEl = document.createElement('aside');
  cartEl.className = 'cart-drawer';
  cartEl.id = 'cart-drawer';
  cartEl.setAttribute('role', 'dialog');
  cartEl.setAttribute('aria-modal', 'true');
  cartEl.setAttribute('aria-label', 'Carrinho');
  cartEl.setAttribute('aria-hidden', 'true');
  cartEl.setAttribute('inert', '');
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
        <span class="qty-num" role="status" aria-live="polite" aria-label="Quantidade: ${i.qty}">${i.qty}</span>
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
      const action = b.dataset.act;
      const cur = Cart.items.find((i) => i.id === id)?.qty || 0;
      if (action === 'inc') Cart.setQty(id, cur + 1);
      else Cart.setQty(id, cur - 1);
      const replacement = $$('#cart-drawer [data-act]').find((button) => button.dataset.id === id && button.dataset.act === action);
      (replacement || $('#cart-x'))?.focus();
    })
  );
  $$('#cart-drawer [data-remove]').forEach((b) =>
    b.addEventListener('click', () => Cart.remove(b.dataset.remove))
  );
  $('#cart-checkout').addEventListener('click', checkout);
}
function openCart() {
  const wasOpen = cartEl?.classList.contains('is-open');
  if (!wasOpen) cartReturnFocus = document.activeElement;
  ensureCart();
  renderCart();
  $('#cart-drawer').classList.add('is-open');
  $('#cart-backdrop').classList.add('is-open');
  syncLayerState();
  $('#cart-x')?.focus();
}
function closeCart() {
  const wasOpen = cartEl?.classList.contains('is-open');
  $('#cart-drawer')?.classList.remove('is-open');
  $('#cart-backdrop')?.classList.remove('is-open');
  syncLayerState();
  if (wasOpen && !activeLayer()) {
    const target = cartReturnFocus?.isConnected ? cartReturnFocus : $('.header-cart');
    target?.focus?.();
  }
  cartReturnFocus = null;
}

// ---------- Checkout via WhatsApp ----------
function checkout() {
  openNameModal();
}
let nameModalRef = null;
let nameModalReturnFocus = null;
function ensureNameModal() {
  if (nameModalRef) return nameModalRef;

  const overlay = document.createElement('div');
  overlay.className = 'name-modal-overlay';
  overlay.id = 'name-modal-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('inert', '');

  const modal = document.createElement('div');
  modal.className = 'name-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'name-modal-title');
  modal.setAttribute('aria-describedby', 'name-modal-description');
  modal.innerHTML = `
    <div class="name-modal-head">
      <h3 id="name-modal-title">Antes de finalizar</h3>
      <button class="name-modal-x" aria-label="Fechar">×</button>
    </div>
    <p class="name-modal-sub" id="name-modal-description">Como podemos chamar você?</p>
    <form class="name-modal-form" novalidate>
      <label class="input-label" for="customer-name">Seu nome</label>
      <input type="text" id="customer-name" class="input" placeholder="Digite seu nome" autocomplete="name">
      <p class="name-modal-status" role="status" aria-live="polite"></p>
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
  nameModalReturnFocus = document.activeElement;
  nameModalRef.classList.add('is-open');
  syncLayerState();
  const input = $('#customer-name');
  const status = nameModalRef.querySelector('.name-modal-status');
  const submit = nameModalRef.querySelector('button[type="submit"]');
  status.textContent = '';
  submit.disabled = false;
  requestAnimationFrame(() => input.focus());

  // close handlers
  nameModalRef.querySelector('.name-modal-x').onclick = closeNameModal;
  nameModalRef.querySelector('[data-action="cancel"]').onclick = closeNameModal;
  nameModalRef.onclick = (e) => { if (e.target === nameModalRef) closeNameModal(); };

  // submit
  nameModalRef.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { toast('Informe seu nome para continuar.'); input.focus(); return; }
    submit.disabled = true;
    status.textContent = 'Confirmando preços e disponibilidade…';
    try {
      const result = await finalizeOrder(name);
      if (result.status === 'sent' || result.status === 'empty') {
        closeNameModal();
      } else if (result.status === 'reconciled') {
        closeNameModal();
        openCart();
      } else {
        status.textContent = 'Não foi possível confirmar os dados. Verifique sua conexão e tente novamente.';
      }
    } catch (error) {
      console.error('[perllon] order preparation failed.', error);
      status.textContent = 'Não foi possível preparar a consulta. Tente novamente.';
    } finally {
      submit.disabled = false;
    }
  };
}

function closeNameModal() {
  if (!nameModalRef?.classList.contains('is-open')) return;
  nameModalRef.classList.remove('is-open');
  syncLayerState();
  const fallback = cartEl?.classList.contains('is-open') ? $('#cart-checkout') : $('.header-cart');
  const target = nameModalReturnFocus?.isConnected && !nameModalReturnFocus.closest('[inert]')
    ? nameModalReturnFocus
    : fallback;
  target?.focus?.();
  nameModalReturnFocus = null;
}

// Re-validate cart against the database before generating the order.
// Connected mode blocks on validation errors. Demo mode intentionally uses the
// static catalog because no backend is configured.
async function finalizeOrder(name) {
  let items = [...Cart.items];

  if (items.length === 0) {
    toast('Seu carrinho está vazio.');
    closeCart();
    return { status: 'empty' };
  }

  // Re-read prices/status from the source of truth when available.
  if (isSupabaseConfigured()) {
    try {
      const ids = items.map((i) => i.id);
      const fresh = await fetchCartValidation(ids);
      const result = reconcileCartItems(items, fresh);
      items = result.items;
      Cart.replace(items);

      if (items.length === 0) {
        toast('Os itens do seu carrinho não estão mais disponíveis.');
        closeCart();
        return { status: 'empty' };
      }

      if (result.changed) {
        const changes = [];
        if (result.unavailableCount) changes.push('itens indisponíveis foram removidos');
        if (result.priceChangeCount) changes.push('os valores foram atualizados');
        if (result.detailChangeCount) changes.push('os dados dos produtos foram atualizados');
        toast(`${changes.join(' e ')}. Revise o carrinho e confirme novamente para continuar.`);
        return { status: 'reconciled' };
      }
    } catch (e) {
      console.warn('[perllon] cart re-validation failed; order was not generated.', e);
      return { status: 'validation-error' };
    }
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
  return { status: 'sent' };
}

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
  const mobile = window.matchMedia('(max-width: 560px)');
  const hero = $('#hero');
  const updateMobileVisibility = () => {
    const threshold = Math.max(300, (hero?.offsetHeight || 0) - window.innerHeight * 0.35);
    f.classList.toggle('is-visible', window.scrollY > threshold);
  };
  if (mobile.matches) {
    updateMobileVisibility();
    window.addEventListener('scroll', updateMobileVisibility, { passive: true });
    return;
  }
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
  void initCatalog({ addToCart: (product) => Cart.add(product), reveal: initReveal }).catch((error) => {
    console.error('[perllon] catalog render failed.', error);
    const rail = $('#catalog-rail');
    if (rail) rail.innerHTML = '<p class="catalog-error">Não foi possível carregar o catálogo no momento.</p>';
  });
  void initSpotlight().catch((error) => console.error('[perllon] spotlight render failed.', error));
  void initHero({ reduceMotion }).catch((error) => console.error('[perllon] hero render failed.', error));
  initCounters();
  initStatus();
  initWaFloat();
  initHeroScroll();
  initHeroEntrance();
  updateCartBadge();
  $('.header-cart')?.addEventListener('click', openCart);
});

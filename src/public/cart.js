import { money } from './format.js';

// ---------- Cart store (localStorage) ----------
export function createCart(onAdded, onPersistenceError) {
  let persistenceErrorReported = false;
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
    try { localStorage.setItem(this.key, JSON.stringify(this.items)); }
    catch (error) {
      if (!persistenceErrorReported) {
        persistenceErrorReported = true;
        console.warn('[perllon] cart could not be saved locally.', error);
        onPersistenceError?.();
      }
    }
    document.dispatchEvent(new CustomEvent('cart:updated'));
  },
  add(p) {
    const found = this.items.find((i) => i.id === p.id);
    if (found) found.qty += 1;
    else this.items.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1, installments: p.installments, storage: p.storage, color: p.color });
    this.save();
    onAdded(p);
  },
  setQty(id, qty) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    if (qty <= 0) { this.remove(id); return; }
    it.qty = Math.min(99, qty);
    this.save();
  },
  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.save(); },
  replace(items) { this.items = items; this.save(); },
  count() { return this.items.reduce((n, i) => n + i.qty, 0); },
  subtotal() { return this.items.reduce((n, i) => n + i.price * i.qty, 0); },
};
  return Cart;
}


function validatedInstallments(product) {
  if (!product.installments_count || !product.installment_cents) return null;
  return `${product.installments_count}x de ${money(product.installment_cents / 100)}`;
}

export function reconcileCartItems(items, fresh) {
  const reconciled = [];
  let unavailableCount = 0;
  let priceChangeCount = 0;
  let detailChangeCount = 0;

  items.forEach((item) => {
    const current = fresh[item.id];
    if (!current || current.status !== 'active') {
      unavailableCount += 1;
      return;
    }
    if (!Number.isInteger(current.price_cents) || current.price_cents < 0) {
      throw new Error(`Preço inválido recebido para o produto ${item.id}.`);
    }

    const nextPrice = current.price_cents / 100;
    const nextInstallments = validatedInstallments(current);
    const nextName = current.name || item.name;
    if (nextPrice !== item.price) priceChangeCount += 1;
    if (nextName !== item.name || nextInstallments !== (item.installments || null)) detailChangeCount += 1;

    reconciled.push({
      ...item,
      name: nextName,
      price: nextPrice,
      price_cents: current.price_cents,
      installments: nextInstallments,
    });
  });

  return {
    items: reconciled,
    unavailableCount,
    priceChangeCount,
    detailChangeCount,
    changed: unavailableCount > 0 || priceChangeCount > 0 || detailChangeCount > 0,
  };
}

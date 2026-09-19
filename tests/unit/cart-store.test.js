// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCart } from '../../src/public/cart.js';

afterEach(() => vi.restoreAllMocks());

describe('cart persistence failure', () => {
  it('keeps the current cart usable and reports a blocked localStorage once', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    const onError = vi.fn();
    const cart = createCart(vi.fn(), onError);
    const item = { id: 'product-id', name: 'Produto', price: 100, qty: 1 };

    cart.replace([item]);
    cart.setQty('product-id', 2);

    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(200);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

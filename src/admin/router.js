export function parseHash() {
  const h = location.hash.replace(/^#\//, '');
  if (!h || h === '' || h === 'login') return { name: 'login' };
  if (h === 'dashboard') return { name: 'dashboard' };
  if (h === 'spotlight') return { name: 'spotlight' };
  if (h === 'hero') return { name: 'hero' };
  if (h === 'products') return { name: 'products' };
  if (h === 'products/new') return { name: 'products/new' };
  const m = h.match(/^products\/(.+)$/);
  if (m) return { name: 'products/:id', id: m[1] };
  return { name: 'dashboard' };
}

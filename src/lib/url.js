const ALLOWED_CTA_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);

export function normalizeCtaHref(value) {
  const href = String(value ?? '').trim();
  if (!href) return null;
  if (/[\\\u0000-\u001F\u007F]/.test(href)) return null;

  // Preserve deliberate same-site destinations without accepting
  // protocol-relative URLs such as //untrusted.example.
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//')) || href.startsWith('./') || href.startsWith('../')) {
    return href;
  }

  try {
    const parsed = new URL(href);
    if (!ALLOWED_CTA_PROTOCOLS.has(parsed.protocol)) return null;
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !/^https?:\/\//i.test(href)) return null;
    if ((parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') && !/^(mailto|tel):\S+$/i.test(href)) return null;
    return href;
  } catch {
    return null;
  }
}

export { ALLOWED_CTA_PROTOCOLS };

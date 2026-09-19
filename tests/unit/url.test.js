import { describe, expect, it } from 'vitest';
import { normalizeCtaHref } from '../../src/lib/url.js';

describe('hero CTA destinations', () => {
  it.each([
    ['https://perllon.com.br/contato', 'https://perllon.com.br/contato'],
    ['http://localhost:4173/#catalogo', 'http://localhost:4173/#catalogo'],
    ['mailto:contato@perllon.com.br', 'mailto:contato@perllon.com.br'],
    ['tel:+5584998405201', 'tel:+5584998405201'],
    ['#catalogo', '#catalogo'],
    ['/privacidade.html', '/privacidade.html'],
    ['./catalogo', './catalogo'],
    ['../catalogo', '../catalogo'],
    ['  https://perllon.com.br  ', 'https://perllon.com.br'],
  ])('accepts legitimate destination %j', (input, expected) => {
    expect(normalizeCtaHref(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/path',
    '/\\evil.example/path',
    '/path\nmore',
    '/path\tmore',
    'https:example.com',
    'ftp://example.com/file',
    'mailto:',
    'tel:',
  ])('rejects unsafe destination %j', (input) => {
    expect(normalizeCtaHref(input)).toBeNull();
  });

  it('treats an empty value as no dynamic CTA', () => {
    expect(normalizeCtaHref('   ')).toBeNull();
    expect(normalizeCtaHref(null)).toBeNull();
  });
});

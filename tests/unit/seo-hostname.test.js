import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const origin = 'https://perllon-home.pages.dev';

describe('PERLLON public production URLs', () => {
  it('uses the current Pages hostname consistently in public SEO metadata', () => {
    const html = read('index.html');
    expect(html).toContain(`<link rel="canonical" href="${origin}/">`);
    expect(html).toContain(`<meta property="og:url" content="${origin}/">`);
    expect(html).toContain(`<meta property="og:image" content="${origin}/og-image.png">`);
    expect(html).toContain(`<meta name="twitter:image" content="${origin}/og-image.png">`);
    expect(html).not.toContain('https://perllon.com.br');
  });

  it('lists the current Pages hostname in robots and sitemap', () => {
    const sitemap = read('public/sitemap.xml');
    const robots = read('public/robots.txt');
    expect(sitemap).toContain(`<loc>${origin}/</loc>`);
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(robots).toContain('Disallow: /admin.html');
  });
});

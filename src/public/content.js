import { fetchSpotlight, fetchHeroMedia, isSupabaseConfigured } from '../lib/catalog.js';
import { mediaPublicUrl, HERO_BUCKET } from '../lib/storage.js';
import { normalizeCtaHref } from '../lib/url.js';
import staticHeroVideo from '../assets/video/iphone-17-hero.mp4';
import { esc, waUrl } from './format.js';

const $ = (s, c = document) => c.querySelector(s);

// The poster remains visible until the video can actually be used.
function activateHeroVideo(video, reduceMotion) {
  if (reduceMotion() || window.matchMedia('(max-width: 560px)').matches) return;
  const start = () => {
    if (!video.isConnected || video.src) return;
    video.src = video.dataset.videoSrc || staticHeroVideo;
    video.load();
  };
  if (!('IntersectionObserver' in window)) { start(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    start();
  }, { rootMargin: '100px' });
  observer.observe(video);
}

// ---------- Spotlight (dynamic: product selected in Admin) ----------
// The public Spotlight section renders the product the admin chose in the
// "Destaque" area. Source of truth is Supabase (`spotlight` table). The
// static iPhone 17 markup in index.html remains as a graceful fallback for
// when the backend is not configured (prototype/offline).
export async function initSpotlight() {
  const elName = $('#spotlight-name');
  if (!elName) return;                  // section not present
  if (!isSupabaseConfigured()) return;  // keep static fallback value

  let spot;
  try {
    spot = await fetchSpotlight();
  } catch (e) {
    console.warn('[perllon] spotlight load failed; using static fallback.', e);
    return;
  }
  if (!spot || !spot.product) return;   // no active spotlight → keep fallback

  const p = spot.product;

  // Name
  elName.textContent = p.name;

  // Editorial description (if admin set one, else keep existing text)
  if (spot.editorialBody) $('#spotlight-desc').textContent = spot.editorialBody;

  // Specs grid (derive from product specs — only confirmed fields)
  const specs = [];
  if (p.storage) specs.push(['Armazenamento', p.storage]);
  if (p.color) specs.push(['Cor', p.color]);
  if (p.condition) specs.push(['Estado', p.condition]);
  if (p.simType) specs.push(['Chip', p.simType]);
  if (p.warranty) specs.push(['Garantia', p.warranty]);
  if (p.battery) specs.push(['Bateria', p.battery]);
  const specsEl = $('#spotlight-specs');
  if (specsEl && specs.length) {
    specsEl.innerHTML = specs.map(([k, v]) => `<div class="spec-item"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('');
  }

  // Price + installments
  if (p.priceFormatted) $('#spotlight-price').textContent = p.priceFormatted;
  const installEl = $('#spotlight-install');
  if (p.installments) installEl.textContent = p.installments;
  else installEl.textContent = 'Consulte condições';

  // Image — prefer a custom promotional image, else the product's primary.
  const imgEl = $('#spotlight-image');
  const overrideUrl = spot.imageOverride ? mediaPublicUrl('product-images', spot.imageOverride) : null;
  const finalImg = overrideUrl || p.image;
  if (finalImg) {
    imgEl.src = finalImg;
    imgEl.alt = `${p.name}${p.storage ? ' ' + p.storage : ''} em destaque na PERLLON`;
  }

  // WhatsApp CTA → contextualized to the selected product
  const waEl = $('#spotlight-wa');
  if (waEl) {
    const parts = [p.name, p.storage, p.color].filter(Boolean).join(', ');
    const msg = `Olá! Tenho interesse no ${parts}. Gostaria de saber mais.`;
    waEl.href = waUrl(msg);
  }
}

// ---------- Hero (dynamic media/editorial from Supabase) ----------
// Reads the active hero_media row and swaps video/poster/title/subtitle/CTA.
// Falls back to the static hero when Supabase is unconfigured or there is no
// active config (resilient — never leaves a broken/empty hero).
export async function initHero({ reduceMotion }) {
  const root = $('#hero-video');
  if (!root) return;
  if (!isSupabaseConfigured()) { activateHeroVideo(root, reduceMotion); return; }

  let hero;
  try {
    hero = await fetchHeroMedia();
  } catch (e) {
    console.warn('[perllon] hero media load failed; using static hero.', e);
    activateHeroVideo(root, reduceMotion);
    return;
  }
  if (!hero || !hero.active) { activateHeroVideo(root, reduceMotion); return; }

  // Keep the active video URL ready; loading starts only when it can be shown.
  const videoUrl = hero.videoPath ? mediaPublicUrl(HERO_BUCKET, hero.videoPath) : null;
  if (videoUrl) {
    root.dataset.videoSrc = videoUrl;
  }

  // Poster / fallback image
  const posterUrl = hero.posterPath ? mediaPublicUrl(HERO_BUCKET, hero.posterPath) : null;
  if (posterUrl) root.setAttribute('poster', posterUrl);

  // Editorial title/subtitle (only when admin set something, preserve html accent)
  if (hero.title) {
    const t = $('#hero-title');
    if (t) t.textContent = hero.title;
  }
  if (hero.subtitle) {
    const l = $('#hero-lead');
    if (l) l.textContent = hero.subtitle;
  }

  // Primary CTA (label + href)
  const cta = $('#hero-cta');
  if (cta) {
    if (hero.ctaLabel) {
      cta.innerHTML = `${esc(hero.ctaLabel)} <span class="arrow">→</span>`;
    }
    const safeCtaHref = normalizeCtaHref(hero.ctaHref);
    if (safeCtaHref) cta.href = safeCtaHref;
    else if (hero.ctaHref) console.warn('[perllon] unsafe hero CTA ignored; using static destination.');
  }

  activateHeroVideo(root, reduceMotion);
}

/**
 * Clean-Slate footer tag #3 — funnel copy patch + MODE B chrome sync only.
 *
 * Desktop & phone portrait: Designer-only layout (no injected position CSS).
 * Middle breakpoints: 20px H1→copy gutter, shirt 25px below inside CTA (CSS vars).
 */

const FUNNEL_LINE1 = 'DIAL YOUR SPECS';
const FUNNEL_LINE2 = 'ON OUR LIVE BUILDER';

const MIDDLE_H1_COPY_GAP_PX = 20;
const MIDDLE_SHIRT_BELOW_CTA_PX = 25;

function isHeroMiddleLayout(w = window.innerWidth) {
  if (w >= 992) return false;
  if (w <= 767) {
    return window.matchMedia('(orientation: landscape)').matches;
  }
  return w <= 991;
}

function middleSyncRoot() {
  return document.querySelector('.ltf-hero > .ltf-site-cage.ltf-cage');
}

function clearMiddleHeroInline() {
  const cage = middleSyncRoot();
  if (!cage || cage.dataset.ltfMiddleSync !== '1') return;
  cage.style.removeProperty('--ltf-middle-bar-top');
  cage.style.removeProperty('--ltf-middle-shirt-top');
  delete cage.dataset.ltfMiddleSync;

  const shirt = document.querySelector('.ltf-hero .ltf-hero-figure');
  if (shirt && shirt.dataset.ltfMiddleShirtSync === '1') {
    delete shirt.dataset.ltfMiddleShirtSync;
  }
}

function syncMiddleHeroLayout() {
  const cage = middleSyncRoot();
  if (!cage) return;

  if (!isHeroMiddleLayout()) {
    clearMiddleHeroInline();
    return;
  }

  const headline = document.querySelector('.ltf-hero-headline');
  const bar = document.querySelector('.ltf-hero-bottom-bar');
  const cta = document.querySelector('.ltf-btn-gradient-wrap.is-hero-cta-wrap-inside');
  const shirt = document.querySelector('.ltf-hero .ltf-hero-figure');
  if (!headline || !bar || !cta || !shirt) return;

  const cageRect = cage.getBoundingClientRect();
  const h1Rect = headline.getBoundingClientRect();
  const ctaRect = cta.getBoundingClientRect();

  if (cageRect.width < 2 || h1Rect.height < 4) return;

  const barTop = h1Rect.bottom - cageRect.top + MIDDLE_H1_COPY_GAP_PX;
  cage.style.setProperty('--ltf-middle-bar-top', `${Math.round(barTop)}px`);

  const shirtH = shirt.offsetHeight || shirt.getBoundingClientRect().height;
  if (shirtH < 4 || ctaRect.height < 4) return;

  const shirtTop = ctaRect.bottom - cageRect.top + MIDDLE_SHIRT_BELOW_CTA_PX - shirtH;
  cage.style.setProperty('--ltf-middle-shirt-top', `${Math.round(shirtTop)}px`);

  cage.dataset.ltfMiddleSync = '1';
  shirt.dataset.ltfMiddleShirtSync = '1';
}

let middleSyncRaf = 0;
function scheduleMiddleHeroSync() {
  if (middleSyncRaf) return;
  middleSyncRaf = requestAnimationFrame(() => {
    middleSyncRaf = 0;
    syncMiddleHeroLayout();
  });
}

function patchFunnelCopy() {
  const el = document.querySelector('.ltf-funnel-cta-threshold');
  if (!el) return;
  if (el.dataset.ltfFunnelCopyPatched === '1') return;
  const normalized = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!normalized.includes('DIAL IN YOUR SPECS') && !normalized.includes('DIAL YOUR SPECS')) {
    return;
  }
  el.dataset.ltfFunnelCopyPatched = '1';
  el.classList.add('ltf-funnel-threshold-split');
}

function bindMiddleHeroSync() {
  if (!document.querySelector('.ltf-hero')) return;
  scheduleMiddleHeroSync();
  window.addEventListener('resize', scheduleMiddleHeroSync, { passive: true });
  window.addEventListener('orientationchange', scheduleMiddleHeroSync, { passive: true });

  if (typeof ResizeObserver !== 'function') return;
  const ro = new ResizeObserver(scheduleMiddleHeroSync);
  for (const sel of [
    '.ltf-hero-headline',
    '.ltf-body-text.is-hero-body-inside',
    '.ltf-btn-gradient-wrap.is-hero-cta-wrap-inside',
    '.ltf-hero .ltf-hero-figure',
  ]) {
    const el = document.querySelector(sel);
    if (el) ro.observe(el);
  }
}

function bind() {
  if (!document.querySelector('.ltf-hero')) return;
  patchFunnelCopy();
  bindMiddleHeroSync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}
window.addEventListener('load', () => {
  patchFunnelCopy();
  scheduleMiddleHeroSync();
}, { once: true });

window.LTFHeroViewport = {
  patchFunnelCopy,
  syncMiddleHeroLayout,
  scheduleMiddleHeroSync,
};

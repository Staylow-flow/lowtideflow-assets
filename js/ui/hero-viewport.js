/**
 * Clean-Slate footer tag #3 — funnel copy patch + MODE B chrome sync only.
 *
 * Shirt + hero CTA layout: Webflow Designer for desktop & phone portrait.
 * Middle breakpoints (tablet + phone landscape): sync orange shirt bottom to
 * inside copy bottom — CSS cannot anchor across absolute layers reliably.
 */

const FUNNEL_LINE1 = 'DIAL YOUR SPECS';
const FUNNEL_LINE2 = 'ON OUR LIVE BUILDER';

function isHeroMiddleLayout(w = window.innerWidth) {
  if (w >= 992) return false;
  if (w <= 767) {
    return window.matchMedia('(orientation: landscape)').matches;
  }
  return w <= 991;
}

function clearMiddleShirtInline(shirt) {
  if (!shirt || shirt.dataset.ltfMiddleShirtSync !== '1') return;
  shirt.style.removeProperty('top');
  shirt.style.removeProperty('bottom');
  delete shirt.dataset.ltfMiddleShirtSync;
}

function syncMiddleHeroShirt() {
  const shirt = document.querySelector('.ltf-hero .ltf-hero-figure');
  if (!shirt) return;

  if (!isHeroMiddleLayout()) {
    clearMiddleShirtInline(shirt);
    return;
  }

  const copy = document.querySelector('.ltf-body-text.is-hero-body-inside');
  const cage = document.querySelector('.ltf-hero > .ltf-site-cage.ltf-cage');
  if (!copy || !cage) return;

  const copyRect = copy.getBoundingClientRect();
  const cageRect = cage.getBoundingClientRect();
  const shirtRect = shirt.getBoundingClientRect();
  if (copyRect.height < 8 || shirtRect.height < 4) return;

  const topPx = copyRect.bottom - cageRect.top - shirtRect.height;
  shirt.style.top = `${Math.max(topPx, 0)}px`;
  shirt.style.bottom = 'auto';
  shirt.dataset.ltfMiddleShirtSync = '1';
}

let middleSyncRaf = 0;
function scheduleMiddleHeroSync() {
  if (middleSyncRaf) return;
  middleSyncRaf = requestAnimationFrame(() => {
    middleSyncRaf = 0;
    syncMiddleHeroShirt();
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

  const copy = document.querySelector('.ltf-body-text.is-hero-body-inside');
  if (copy && typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(scheduleMiddleHeroSync);
    ro.observe(copy);
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

window.LTFHeroViewport = { patchFunnelCopy, syncMiddleHeroShirt, scheduleMiddleHeroSync };

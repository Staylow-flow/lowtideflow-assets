/**
 * Lowtideflow — Hero viewport sync (mobile + in-app browsers)
 *
 * Instagram, Facebook, and other embedded browsers report inconsistent
 * 100vh / 100svh values. visualViewport.height is the visible chrome-
 * adjusted height, so the hero shell and bottom-pinned CTA land in the
 * same place in Safari, Chrome, and in-app WebViews.
 */

const MOBILE_QUERY = '(max-width: 991px)';
const NAV_H = 52;
const FUNNEL_COPY = 'DIAL YOUR SPECS ON OUR LIVE BUILDER';

function isMobile() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function patchFunnelCopy() {
  const el = document.querySelector('.ltf-funnel-cta-threshold');
  if (!el) return;
  const normalized = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
  if (normalized.includes('DIAL IN YOUR SPECS') || normalized.includes('DIAL YOUR SPECS')) {
    el.textContent = FUNNEL_COPY;
  }
}

function syncHeroViewport() {
  if (!isMobile()) return;

  const hero = document.querySelector('.ltf-hero');
  if (!hero) return;

  const vv = window.visualViewport;
  const visibleH = vv ? vv.height : window.innerHeight;
  const totalH = Math.round(visibleH + NAV_H);

  hero.style.setProperty('--ltf-vv-h', `${Math.round(visibleH)}px`);
  hero.style.setProperty('--ltf-hero-h', `${totalH}px`);
}

function bind() {
  patchFunnelCopy();
  syncHeroViewport();

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', syncHeroViewport, { passive: true });
    vv.addEventListener('scroll', syncHeroViewport, { passive: true });
  }
  window.addEventListener('resize', syncHeroViewport, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      patchFunnelCopy();
      syncHeroViewport();
    }, 120);
  });
}

function init() {
  if (!document.querySelector('.ltf-hero')) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
}

export { init, syncHeroViewport, patchFunnelCopy };

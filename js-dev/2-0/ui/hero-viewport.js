/**
 * Lowtideflow — Hero viewport sync (clean-slate footer tag #3)
 *
 * - Mobile / in-app: visualViewport → --ltf-hero-h (Webflow cannot express).
 * - Middle breakpoints (768–991 + phone landscape): measured H1 → copy/logo/shirt
 *   CSS vars (parity with live hero-viewport @4749e8b).
 *
 * Desktop & phone portrait layout stays in Designer + page head CSS.
 */

(async function () {
  const MOBILE_QUERY = '(max-width: 991px)';
  const NAV_H = 52;

  const MIDDLE_H1_COPY_GAP_PX = 20;
  const MIDDLE_H1_LOGO_GAP_PX = 20;
  const MIDDLE_LOGO_HEIGHT_AT_REF = 81;
  const MIDDLE_LOGO_REF_H1_FONT_PX = 56;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

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

  function h1FontSizePx(headline) {
    const h1 = headline.querySelector('h1, .ltf-main-header, .ltf-section-header') || headline;
    const fs = parseFloat(getComputedStyle(h1).fontSize);
    return Number.isFinite(fs) && fs > 0 ? fs : MIDDLE_LOGO_REF_H1_FONT_PX;
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

  function clearMiddleHeroInline() {
    const cage = middleSyncRoot();
    const bar = document.querySelector('.ltf-hero-bottom-bar');
    if (bar) {
      bar.style.removeProperty('--ltf-middle-logo-top');
      bar.style.removeProperty('--ltf-middle-logo-left');
      bar.style.removeProperty('--ltf-middle-logo-height');
    }
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
    const logo = document.querySelector('.is-hero-logo-mobile.is-hero-logo-inside');
    const shirt = document.querySelector('.ltf-hero .ltf-hero-figure');
    if (!headline || !bar || !logo || !shirt) return;

    const cageRect = cage.getBoundingClientRect();
    const h1Rect = headline.getBoundingClientRect();

    if (cageRect.width < 2 || h1Rect.height < 4) return;

    const barTop = h1Rect.bottom - cageRect.top + MIDDLE_H1_COPY_GAP_PX;
    cage.style.setProperty('--ltf-middle-bar-top', `${Math.round(barTop)}px`);

    const h1Fs = h1FontSizePx(headline);
    const logoH = (h1Fs / MIDDLE_LOGO_REF_H1_FONT_PX) * MIDDLE_LOGO_HEIGHT_AT_REF;
    bar.style.setProperty('--ltf-middle-logo-height', `${logoH.toFixed(2)}px`);

    const h1El = headline.querySelector('h1, .ltf-main-header, .ltf-section-header') || headline;
    const h1TextRect = h1El.getBoundingClientRect();
    const h1MidY = h1TextRect.top + h1TextRect.height / 2;

    bar.offsetHeight;
    const barRectFresh = bar.getBoundingClientRect();
    logo.offsetHeight;
    const logoW = logo.getBoundingClientRect().width || logo.offsetWidth;
    bar.style.setProperty('--ltf-middle-logo-top', `${Math.round(h1MidY - logoH / 2 - barRectFresh.top)}px`);

    const logoLeftScreen = h1TextRect.left - MIDDLE_H1_LOGO_GAP_PX - logoW;
    const minLeftScreen = cageRect.left + 24;
    const logoLeftBar = Math.max(logoLeftScreen, minLeftScreen) - barRectFresh.left;
    bar.style.setProperty('--ltf-middle-logo-left', `${Math.round(logoLeftBar)}px`);

    const logoRect2 = logo.getBoundingClientRect();
    const groupTop = Math.min(h1Rect.top, logoRect2.top);
    const groupBottom = Math.max(h1Rect.bottom, logoRect2.bottom);
    const groupMidY = (groupTop + groupBottom) / 2;
    const shirtTop = groupMidY - cageRect.top;

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
      '.ltf-hero-headline h1',
      '.is-hero-logo-mobile.is-hero-logo-inside',
      '.ltf-body-text.is-hero-body-inside',
      '.ltf-hero .ltf-hero-figure',
    ]) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
  }

  function bind() {
    if (!document.querySelector('.ltf-hero')) return;
    syncHeroViewport();
    patchFunnelCopy();
    bindMiddleHeroSync();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', syncHeroViewport, { passive: true });
      vv.addEventListener('scroll', syncHeroViewport, { passive: true });
    }
    window.addEventListener('resize', syncHeroViewport, { passive: true });
    window.addEventListener('orientationchange', () => {
      setTimeout(syncHeroViewport, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
  window.addEventListener('load', () => {
    syncHeroViewport();
    patchFunnelCopy();
    scheduleMiddleHeroSync();
    setTimeout(scheduleMiddleHeroSync, 120);
  }, { once: true });

  window.LTFHeroViewport = {
    syncHeroViewport,
    patchFunnelCopy,
    syncMiddleHeroLayout,
    scheduleMiddleHeroSync,
  };
})();

/**
 * Lowtideflow — Hero viewport sync (mobile + in-app browsers)
 *
 * Optional third footer tag on clean-slate. Sets --ltf-hero-h from
 * visualViewport — behavior Webflow Designer cannot express.
 *
 * Layout, copy, and mobile CSS live in Designer + the minimal page-head
 * residue (webflow/clean-slate-head-integration.html). Do not inject styles
 * or patch copy from this file.
 */

(async function () {
  const MOBILE_QUERY = '(max-width: 991px)';
  const NAV_H = 52;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
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
    if (!document.querySelector('.ltf-hero')) return;
    syncHeroViewport();

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
  window.addEventListener('load', syncHeroViewport, { once: true });

  window.LTFHeroViewport = { syncHeroViewport };
})();

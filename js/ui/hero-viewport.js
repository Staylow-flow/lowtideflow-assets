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
const MOBILE_STYLE_ID = 'ltf-mobile-fixes';

/* Injected when head snippet isn't pasted yet — keeps deploy to one footer tag */
const MOBILE_FIXES_CSS = `@media (max-width:991px){
.ltf-hero{height:var(--ltf-hero-h,calc(100svh + 52px))!important;min-height:var(--ltf-hero-h,calc(100svh + 52px))!important;max-height:none!important;overflow:visible!important}
.ltf-hero>.ltf-site-cage.ltf-cage{height:100%!important;min-height:100%!important;overflow:visible!important}
.ltf-hero-figure,.ltf-hero-figure-img{top:auto!important;bottom:-15px!important;max-height:none!important;height:auto!important;object-fit:contain!important;object-position:bottom right!important}
.ltf-btn-gradient-wrap.is-hero-cta-wrap{position:absolute!important;top:auto!important;left:50%!important;right:auto!important;bottom:calc(25px + env(safe-area-inset-bottom,0px))!important;transform:translateX(-50%)!important;margin:0!important}
.ltf-funnel-cta{box-sizing:border-box!important;height:auto!important;min-height:0!important;padding:75px 10px!important;overflow:visible!important}
.ltf-funnel-cta-inner{box-sizing:border-box!important;width:100%!important;max-width:100%!important;padding:64px 20px!important}
.ltf-funnel-cta-heading{padding-left:0!important;padding-right:0!important;font-size:clamp(2.35rem,11.5vw,4.2rem)!important;line-height:.92!important}
.ltf-funnel-cta-threshold{white-space:nowrap!important;font-size:clamp(9px,2.55vw,13px)!important;letter-spacing:.1em!important;line-height:1.2!important;padding-left:0!important;padding-right:0!important;margin:28px 0!important;overflow:hidden!important;text-overflow:ellipsis!important}
}
@media (max-width:479px){
.ltf-funnel-cta-threshold{font-size:clamp(8px,2.35vw,11px)!important;letter-spacing:.08em!important}
}`;

function isMobile() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function injectMobileStyles() {
  if (!isMobile() || document.getElementById(MOBILE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MOBILE_STYLE_ID;
  style.textContent = MOBILE_FIXES_CSS;
  document.head.appendChild(style);
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
  injectMobileStyles();
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

export { init, syncHeroViewport, patchFunnelCopy, injectMobileStyles };

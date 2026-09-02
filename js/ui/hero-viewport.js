/**
 * Lowtideflow — Hero viewport sync (mobile + in-app browsers)
 *
 * Third footer tag on clean-slate. Injects mobile layout overrides when the
 * page-head snippet is missing (Webflow Designer max-height on the orange shirt,
 * CTA pin, funnel gutters).
 *
 * Hero height is stable CSS (100svh + 52px) — NOT synced on visualViewport
 * scroll (that caused shirt/CTA to drift at a different rate than page scroll).
 * Resize/orientation only updates --ltf-hero-h when the viewport actually changes.
 *
 * Layout baseline also lives in webflow/clean-slate-mobile-fixes.html — paste
 * that into page head when you want overrides visible in Designer custom code.
 */

const MOBILE_QUERY = '(max-width: 991px)';
const NAV_H = 52;
const FUNNEL_COPY = 'DIAL YOUR SPECS ON OUR LIVE BUILDER';
const MOBILE_STYLE_ID = 'ltf-mobile-fixes';

const MOBILE_FIXES_CSS = `@media (max-width:991px){
.ltf-hero{height:calc(100svh + 52px)!important;min-height:calc(100svh + 52px)!important;max-height:none!important;overflow-x:clip!important;overflow-y:visible!important}
.ltf-hero>.ltf-site-cage.ltf-cage{height:100%!important;min-height:100%!important;overflow-x:clip!important;overflow-y:visible!important}
.ltf-hero .hero-canvas-wrapper,.ltf-hero #canvas3d{overflow:hidden!important}
.ltf-hero-figure{position:absolute!important;top:auto!important;right:0!important;bottom:-40px!important;width:min(92vw,420px)!important;max-width:min(92vw,420px)!important;transform:translateX(12%)!important;will-change:auto!important}
.ltf-hero-figure-img,.ltf-hero-figure img{top:auto!important;bottom:0!important;max-height:none!important;height:auto!important;object-fit:contain!important;object-position:bottom right!important}
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

/** Set hero height once on load/resize/orientation — never on visualViewport scroll. */
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
  injectMobileStyles();
  patchFunnelCopy();
  syncHeroViewport();

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', syncHeroViewport, { passive: true });
    /* Do NOT listen to visualViewport scroll — it fires during page scroll and
       resizes .ltf-hero, making absolutely-positioned figure/CTA appear to drift. */
  }
  window.addEventListener('resize', syncHeroViewport, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      patchFunnelCopy();
      syncHeroViewport();
    }, 120);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}
window.addEventListener('load', () => {
  injectMobileStyles();
  patchFunnelCopy();
  syncHeroViewport();
}, { once: true });

window.LTFHeroViewport = { syncHeroViewport, injectMobileStyles, patchFunnelCopy };

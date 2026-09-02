/**
 * Lowtideflow — Hero mobile layout boot (clean-slate footer tag #3)
 *
 * Injects mobile layout overrides when page-head #ltf-mobile-fixes is missing.
 * Hero height is fixed CSS (100svh + 52px) — we do NOT set --ltf-hero-h from
 * visualViewport (resize during scroll made CTA/shirt drift vs page scroll).
 *
 * Source of truth for CSS: webflow/clean-slate-mobile-fixes.html
 */

const MOBILE_QUERY = '(max-width: 991px)';
const FUNNEL_COPY = 'DIAL YOUR SPECS ON OUR LIVE BUILDER';
const MOBILE_STYLE_ID = 'ltf-mobile-fixes';

const MOBILE_FIXES_CSS = `@media (max-width:991px){
.ltf-hero{height:calc(100svh + 52px)!important;min-height:calc(100svh + 52px)!important;max-height:none!important;overflow-x:clip!important;overflow-y:visible!important}
.ltf-hero>.ltf-site-cage.ltf-cage{position:relative!important;height:100%!important;min-height:100%!important;overflow-x:clip!important;overflow-y:visible!important}
.ltf-hero .hero-canvas-wrapper,.ltf-hero #canvas3d{overflow:hidden!important}
.ltf-hero-figure,.ltf-hero-figure-img,.ltf-hero-figure img,img.ltf-hero-figure{position:absolute!important;top:auto!important;left:auto!important;right:0!important;bottom:-90px!important;inset:auto!important;width:min(92vw,420px)!important;max-width:min(92vw,420px)!important;max-height:none!important;height:auto!important;object-fit:contain!important;object-position:bottom right!important;transform:translateX(12%)!important;will-change:auto!important}
.ltf-hero-bottom-bar,.ltf-hero-bottom-bar.ltf-split-2{position:absolute!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;left:25px!important;right:25px!important;top:var(--ltf-hero-copy-top,calc(12% + 200px))!important;bottom:0!important;width:auto!important;transform:none!important;translate:none!important;will-change:auto!important;z-index:3!important;pointer-events:none!important}
.ltf-hero-bottom-bar .is-hero-copy,.ltf-hero-bottom-bar .ltf-stack,.ltf-hero-bottom-bar .ltf-stack.ltf-split-copy,.ltf-hero-bottom-bar .ltf-stack.ltf-split-copy.is-hero-copy{position:relative!important;width:100%!important;max-width:none!important;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 88px)!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important}
.ltf-hero .ltf-hero-bottom-bar .ltf-btn-gradient-wrap,.ltf-btn-gradient-wrap.is-hero-cta-wrap{position:absolute!important;top:auto!important;left:50%!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 28px)!important;transform:translateX(-50%)!important;margin:0!important;z-index:4!important;pointer-events:auto!important}
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

function bind() {
  if (!document.querySelector('.ltf-hero')) return;
  injectMobileStyles();
  patchFunnelCopy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}
window.addEventListener('load', () => {
  injectMobileStyles();
  patchFunnelCopy();
}, { once: true });

window.LTFHeroViewport = { injectMobileStyles, patchFunnelCopy };

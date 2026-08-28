/**
 * Lowtideflow — Clean-slate page UI entry (classic footer tag).
 *
 * Loaded as its own <script src="..."> — separate from rock-scene.js and
 * hero-viewport.js so each effect can be pinned and updated independently
 * in Webflow.
 *
 *   js/ltf.js                        — this file
 *   js/hero/rock-scene.js            — own footer tag (Three + GLB)
 *   js/ui/hero-viewport.js           — own footer tag (mobile hero + funnel)
 *   js/nav.js                        — site-wide footer (non-clean-slate pages)
 */

(function () {
  'use strict';

  /* Capture script base synchronously — document.currentScript is null after await. */
  var scriptSrc =
    (document.currentScript && document.currentScript.src) ||
    (function () {
      var nodes = document.getElementsByTagName('script');
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].src && /\/js\/ltf\.js(\?|$)/.test(nodes[i].src)) return nodes[i].src;
      }
      return '';
    })();
  var BASE = scriptSrc
    ? scriptSrc.replace(/\/[^/?#]+$/, '/')
    : 'https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@main/js/';

  var NARROW_STYLE_ID = 'ltf-narrow-desktop-fixes';
  var NARROW_DESKTOP_CSS =
    '@media (min-width:992px) and (max-width:1280px){' +
    '.ltf-specs-vault{height:auto!important;min-height:0!important}' +
    '.ltf-specs-vault-sticky{position:relative!important;height:auto!important;min-height:0!important;top:auto!important;padding-top:96px!important;padding-bottom:64px!important;padding-left:40px!important;padding-right:40px!important;align-items:stretch!important}' +
    '.ltf-vault-cage,.ltf-vault-cage.ltf-cage,.ltf-vault-cage.ltf-split-2{display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important;gap:32px!important;align-items:stretch!important}' +
    '.ltf-specs-vault-cards,.ltf-specs-vault-cards.ltf-split-asset{display:flex!important;flex-direction:column!important;gap:32px!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;position:relative!important;overflow:visible!important}' +
    '.ltf-spec-card,.ltf-spec-card.ltf-spec-card-01,.ltf-spec-card.ltf-spec-card-02,.ltf-spec-card.ltf-spec-card-03,.ltf-spec-card.ltf-spec-card-04{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;z-index:1!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:280px!important;max-height:none!important;margin:0!important;padding:36px 40px!important;overflow:hidden!important;transform:none!important}' +
    '.ltf-spec-card .ltf-card-title{font-size:clamp(1.5rem,2.2vw,1.85rem)!important;line-height:1.15!important}' +
    '.ltf-spec-card .ltf-body-text{width:100%!important;max-width:100%!important;font-size:clamp(16px,1.6vw,18px)!important;line-height:1.35!important}' +
    '.ltf-section.is-trenches{height:auto!important;min-height:0!important;max-height:none!important;padding-top:96px!important;padding-bottom:96px!important;overflow:visible!important}' +
    '.ltf-section.is-trenches .ltf-section-inner.ltf-cage{padding-left:clamp(2rem,4vw,5rem)!important;padding-right:clamp(2rem,4vw,5rem)!important;overflow:visible!important;box-sizing:border-box!important;max-width:1400px!important;margin-left:auto!important;margin-right:auto!important}' +
    '.ltf-section.is-trenches .ltf-split.ltf-split-2{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:clamp(20px,3vw,40px)!important;width:100%!important;max-width:100%!important;overflow:visible!important;box-sizing:border-box!important}' +
    '.ltf-stack.ltf-split-copy.is-trenches-copy{flex:1 1 0!important;min-width:0!important;width:auto!important;max-width:100%!important;padding-left:0!important;padding-right:clamp(12px,2vw,28px)!important;box-sizing:border-box!important;overflow:visible!important}' +
    '.ltf-section.is-trenches .ltf-section-header-navy,.ltf-section.is-trenches h2{font-size:clamp(2rem,4vw,2.75rem)!important;line-height:1.08!important}' +
    '.ltf-body-text.is-trenches-body{font-size:clamp(16px,1.5vw,18px)!important;line-height:1.4!important;padding-right:0!important;max-width:100%!important}' +
    '.ltf-section.is-trenches .ltf-authority-image-box.ltf-split-asset{flex:0 0 auto!important;max-width:min(380px,42vw)!important;width:auto!important}' +
    '}';

  var inits = null;

  function injectNarrowDesktopFixes() {
    if (document.getElementById(NARROW_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = NARROW_STYLE_ID;
    style.textContent = NARROW_DESKTOP_CSS;
    document.head.appendChild(style);
  }

  function wrapSpecsTitle() {
    var h = document.querySelector(
      '.ltf-specs-vault-header .ltf-section-header-navy, .ltf-specs-vault-header h2',
    );
    if (!h || h.dataset.ltfWrap === '1') return;
    if (!/STANDARDS/i.test(h.textContent || '')) return;
    h.innerHTML = h.innerHTML.replace(/(&amp;|&)\s*STANDARDS/i, '$1<br>STANDARDS');
    h.dataset.ltfWrap = '1';
  }

  function safeRun(label, fn) {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch (err) {
      console.error('[LTF] ' + label + ' failed:', err);
    }
  }

  function boot() {
    safeRun('narrow-desktop', injectNarrowDesktopFixes);
    safeRun('specs-title', wrapSpecsTitle);
    if (!inits) return;
    safeRun('nav', inits.initNav);
    safeRun('btn-gradient', inits.initBtn);
    safeRun('crew-cards', inits.initCrew);
    safeRun('upsell-lines', inits.initUpsell);
    safeRun('specs-vault', inits.initVault);
    safeRun('magnifier', inits.initMag);
  }

  window.LTF = { boot: boot };

  (async function load() {
    try {
      var modules = await Promise.all([
        import(BASE + 'ui/nav-mobile.js'),
        import(BASE + 'ui/btn-gradient.js'),
        import(BASE + 'sections/crew-cards.js'),
        import(BASE + 'sections/upsell-lines.js'),
        import(BASE + 'sections/specs-vault-slam.js'),
        import(BASE + 'sections/garment-magnifier.js'),
      ]);
      inits = {
        initNav: modules[0].init,
        initBtn: modules[1].init,
        initCrew: modules[2].init,
        initUpsell: modules[3].init,
        initVault: modules[4].init,
        initMag: modules[5].init,
      };
      boot();
      window.addEventListener('load', boot, { once: true });
    } catch (err) {
      console.error('[LTF] module load failed:', err);
    }
  })();
})();

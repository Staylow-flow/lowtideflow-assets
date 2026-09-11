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
 *
 * Layout lives in Webflow Designer + page head FX CSS only.
 * Do NOT inject layout CSS from this file — it competes with responsive styles.
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

  var inits = null;

  function safeRun(label, fn) {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch (err) {
      console.error('[LTF] ' + label + ' failed:', err);
    }
  }

  function boot() {
    if (!inits) return;
    safeRun('nav', inits.initNav);
    safeRun('btn-gradient', inits.initBtn);
    safeRun('nav-comms', inits.initComms);
    safeRun('crew-cards', inits.initCrew);
    safeRun('upsell-lines', inits.initUpsell);
    safeRun('specs-vault', inits.initVault);
    safeRun('magnifier', inits.initMag);
  }

  window.LTF = {
    boot: boot,
    reinitVault: function () {
      safeRun('specs-vault-reinit', inits && inits.reinitVault);
    },
  };

  (async function load() {
    try {
      var modules = await Promise.all([
        import(BASE + 'ui/nav-mobile.js'),
        import(BASE + 'ui/btn-gradient.js'),
        import(BASE + 'ui/nav-comms.js'),
        import(BASE + 'sections/crew-cards.js'),
        import(BASE + 'sections/upsell-lines.js'),
        import(BASE + 'sections/specs-vault-slam.js'),
        import(BASE + 'sections/garment-magnifier.js'),
      ]);
      inits = {
        initNav: modules[0].init,
        initBtn: modules[1].init,
        initComms: modules[2].init,
        initCrew: modules[3].init,
        initUpsell: modules[4].init,
        initVault: modules[5].init,
        reinitVault: modules[5].reinit,
        initMag: modules[6].init,
      };
      boot();
      window.addEventListener('load', boot, { once: true });
    } catch (err) {
      console.error('[LTF] module load failed:', err);
    }
  })();
})();

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

(async function () {
  const [
    { init: initNav },
    { init: initBtn },
    { init: initCrew },
    { init: initUpsell },
    { init: initVault },
    { init: initMag },
  ] = await Promise.all([
    import('./ui/nav-mobile.js'),
    import('./ui/btn-gradient.js'),
    import('./sections/crew-cards.js'),
    import('./sections/upsell-lines.js'),
    import('./sections/specs-vault-slam.js'),
    import('./sections/garment-magnifier.js'),
  ]);

  function wrapSpecsTitle() {
    const h = document.querySelector(
      '.ltf-specs-vault-header .ltf-section-header-navy, .ltf-specs-vault-header h2',
    );
    if (!h || h.dataset.ltfWrap === '1') return;
    if (!/STANDARDS/i.test(h.textContent || '')) return;
    h.innerHTML = h.innerHTML.replace(/(&amp;|&)\s*STANDARDS/i, '$1<br>STANDARDS');
    h.dataset.ltfWrap = '1';
  }

  function boot() {
    wrapSpecsTitle();
    initNav();
    initBtn();
    initCrew();
    initUpsell();
    initVault();
    initMag();
  }

  boot();
  window.addEventListener('load', boot, { once: true });

  window.LTF = { boot };
})();

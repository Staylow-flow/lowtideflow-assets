/**
 * Lowtideflow — UI bundle entry point.
 *
 * Loaded as a static, classic footer <script src="..."> (no type="module"),
 * so Webflow renders a plain, directly-inspectable jsDelivr URL in the body.
 * Uses import() — valid inside classic scripts — to fetch nav, cards, glass,
 * vault, and upsell concurrently via Promise.all, same "same breath" loading
 * static imports gave us, just resolved at runtime instead of parse time.
 *
 *   js/ltf.js              — this file
 *   js/hero/rock-scene.js  — Three + GLB
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
    const h = document.querySelector('.ltf-specs-vault-header .ltf-section-header-navy, .ltf-specs-vault-header h2');
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

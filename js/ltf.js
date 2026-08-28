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
  function wrapSpecsTitle() {
    const h = document.querySelector('.ltf-specs-vault-header .ltf-section-header-navy, .ltf-specs-vault-header h2');
    if (!h || h.dataset.ltfWrap === '1') return;
    if (!/STANDARDS/i.test(h.textContent || '')) return;
    h.innerHTML = h.innerHTML.replace(/(&amp;|&)\s*STANDARDS/i, '$1<br>STANDARDS');
    h.dataset.ltfWrap = '1';
  }

  window.LTF = {
    boot() {
      try {
        wrapSpecsTitle();
        if (initNav) initNav();
        if (initBtn) initBtn();
        if (initCrew) initCrew();
        if (initUpsell) initUpsell();
        if (initVault) initVault();
        if (initMag) initMag();
      } catch (err) {
        console.error('[ltf] boot failed', err);
      }
    },
  };

  let initNav;
  let initBtn;
  let initCrew;
  let initUpsell;
  let initVault;
  let initMag;

  try {
    [
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
  } catch (err) {
    console.error('[ltf] module load failed', err);
    return;
  }

  window.LTF.boot();
  window.addEventListener('load', window.LTF.boot, { once: true });
})();

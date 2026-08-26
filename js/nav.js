/**
 * Lowtideflow — Nav-only UI entry point.
 *
 * Lean bundle for pages that only need the shared site nav to work
 * (hamburger open/close, mobile scroll-hide/reveal, button click-pulse).
 * Does NOT include the Clean-Slate-only section effects (crew cards,
 * upsell sweep, specs vault slam, garment magnifier) — those stay in
 * js/ltf.js for the Clean-Slate page only.
 *
 * Loaded as a static, classic <script src="..."> (no type="module") before
 * </body> site-wide — import() works in classic scripts too.
 *
 *   js/nav.js               — this file
 *   js/ui/nav-mobile.js      — hamburger + scroll-hide/reveal
 *   js/ui/btn-gradient.js    — nav CTA click-pulse
 */

(async function () {
  const [{ init: initNav }, { init: initBtn }] = await Promise.all([
    import('./ui/nav-mobile.js'),
    import('./ui/btn-gradient.js'),
  ]);

  function boot() {
    initNav();
    initBtn();
  }

  boot();
  window.addEventListener('load', boot, { once: true });

  window.LTFNav = { boot };
})();

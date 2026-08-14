/**
 * Lowtideflow — bundle entry point.
 *
 * This is the only script tag the site needs:
 *
 *   <script type="module"
 *     src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@<commit>/js/ltf.js"></script>
 *
 * Every other module is imported with a RELATIVE path, so they all resolve
 * against whatever commit this file was loaded from. Bumping the one pin in
 * Webflow moves the entire bundle forward atomically — there is no way to end
 * up with the hero on one commit and a section effect on another, which is the
 * failure mode the old multi-tag footer kept producing.
 *
 * Modules are imported on demand: a page with no specs section never downloads
 * the specs code, and a page with no hero never downloads Three.js. Adding a
 * new effect means adding one row to MODULES below.
 */

/**
 * `test` decides whether the page needs the module at all. Keep the selectors
 * cheap — they run on every page load before anything else.
 */
const VIEW_MARGIN = '200px';

const MODULES = [
  {
    name: 'nav-mobile',
    load: () => import('./ui/nav-mobile.js'),
    test: () => document.querySelector('.ltf-site-nav'),
  },
  {
    name: 'btn-gradient',
    load: () => import('./ui/btn-gradient.js'),
    test: () => document.querySelector('.ltf-btn-gradient-wrap'),
  },
  {
    name: 'hero-rock',
    load: () => import('./hero/rock-scene.js'),
    test: () =>
      document.querySelector('.hero-canvas-wrapper, [data-ltf-rock], #canvas3d'),
  },
  {
    name: 'specs-vault',
    load: () => import('./sections/specs-vault-slam.js'),
    test: () => document.querySelector('.ltf-specs-vault, [data-ltf-specs-slam]'),
    lazy: true,
  },
  {
    name: 'garment-magnifier',
    load: () => import('./sections/garment-magnifier.js'),
    test: () =>
      document.querySelector('.ltf-authority-image-box, [data-ltf-magnifier]'),
    lazy: true,
    /* Start the module + bitmaps well before the section so the glass is
       already decoded by the time it enters the viewport. */
    lazyMargin: '1600px',
  },
  {
    name: 'upsell-lines',
    load: () => import('./sections/upsell-lines.js'),
    test: () => document.querySelector('.ltf-upsell-list-item'),
    lazy: true,
  },
  {
    name: 'crew-cards',
    load: () => import('./sections/crew-cards.js'),
    test: () => document.querySelector('.ltf-cards-grid'),
    lazy: true,
  },
];

const loaded = new Map();

function whenNear(el, fn, margin) {
  if (!(el instanceof Element) || typeof IntersectionObserver !== 'function') {
    fn();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn();
    },
    { rootMargin: margin || VIEW_MARGIN },
  );
  io.observe(el);
}

async function start(mod) {
  const el = mod.test();
  if (!el) return;

  const run = async () => {
    try {
      if (!loaded.has(mod.name)) {
        loaded.set(mod.name, mod.load());
      }
      const ns = await loaded.get(mod.name);
      /* rock-scene boots itself on import; the others expose init(). */
      if (typeof ns.init === 'function') ns.init();
    } catch (err) {
      /* A failed section effect must never take the hero down with it. */
      console.error(`[ltf] module "${mod.name}" failed`, err);
    }
  };

  if (mod.lazy) whenNear(el instanceof Element ? el : null, run, mod.lazyMargin);
  else run();
}

function wrapSpecsTitle() {
  const h = document.querySelector('.ltf-specs-vault-header .ltf-section-header-navy, .ltf-specs-vault-header h2');
  if (!h || h.dataset.ltfWrap === '1') return;
  if (!/STANDARDS/i.test(h.textContent || '')) return;
  h.innerHTML = h.innerHTML.replace(/(&amp;|&)\s*STANDARDS/i, '$1<br>STANDARDS');
  h.dataset.ltfWrap = '1';
}

function boot() {
  wrapSpecsTitle();
  for (const mod of MODULES) start(mod);
}

boot();

/* Webflow interactions and CMS-bound content can attach after DOMContentLoaded,
   so sweep again once at load. Every init() is idempotent, so re-running only
   picks up nodes that appeared late. */
window.addEventListener('load', boot, { once: true });

window.LTF = { boot, loaded, MODULES };

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
    name: 'hero-viewport',
    load: () => import('./ui/hero-viewport.js'),
    test: () => document.querySelector('.ltf-hero'),
  },
  {
    name: 'specs-vault',
    load: () => import('./sections/specs-vault-slam.js'),
    test: () => document.querySelector('.ltf-specs-vault, [data-ltf-specs-slam]'),
  },
];

const loaded = new Map();

async function start(mod) {
  if (!mod.test()) return;

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
}

function boot() {
  for (const mod of MODULES) start(mod);
}

boot();

/* Webflow interactions and CMS-bound content can attach after DOMContentLoaded,
   so sweep again once at load. Every init() is idempotent, so re-running only
   picks up nodes that appeared late. */
window.addEventListener('load', boot, { once: true });

window.LTF = { boot, loaded, MODULES };

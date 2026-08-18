/**
 * Lowtideflow — UI bundle entry point.
 *
 * Footer loads two module tags on the same commit pin:
 *
 *   js/ltf.js              — nav, buttons, cards, magnifier, vault, upsell
 *   js/hero/rock-scene.js  — Three.js + GLB (own tag so a hung rock cannot
 *                            stall the rest of the page)
 *
 * Every other module here is imported with a RELATIVE path, so they all
 * resolve against this file's commit. Bump both footer tags together.
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
    name: 'crew-cards',
    load: () => import('./sections/crew-cards.js'),
    test: () => document.querySelector('.ltf-cards-grid'),
  },
  {
    name: 'upsell-lines',
    load: () => import('./sections/upsell-lines.js'),
    test: () => document.querySelector('.ltf-upsell-list-item'),
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
    lazyMargin: '1600px',
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
      if (typeof ns.init === 'function') ns.init();
    } catch (err) {
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

window.addEventListener('load', boot, { once: true });

window.LTF = { boot, loaded, MODULES };

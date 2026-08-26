/**
 * Lowtideflow — UI bundle entry point.
 *
 * Static imports so the browser fetches nav, cards, glass, vault, and upsell
 * in the same breath as this file. No IntersectionObserver on these modules —
 * they init as soon as the document has the nodes. The rock/nebula stays on
 * its own footer tag and is the only effect that waits on Three.
 *
 *   js/ltf.js              — this file
 *   js/hero/rock-scene.js  — Three + GLB
 */

import { init as initNav } from './ui/nav-mobile.js';
import { init as initBtn } from './ui/btn-gradient.js';
import { init as initCrew } from './sections/crew-cards.js';
import { init as initUpsell } from './sections/upsell-lines.js';
import { init as initVault } from './sections/specs-vault-slam.js';
import { init as initMag } from './sections/garment-magnifier.js';

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

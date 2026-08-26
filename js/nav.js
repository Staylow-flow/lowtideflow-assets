/**
 * Lowtideflow — Nav-only UI entry point.
 *
 * Lean bundle for pages that only need the shared site nav to work
 * (hamburger open/close, mobile scroll-hide/reveal, button click-pulse).
 * Does NOT include the Clean-Slate-only section effects (crew cards,
 * upsell sweep, specs vault slam, garment magnifier) — those stay in
 * js/ltf.js for the Clean-Slate page only.
 *
 *   js/nav.js               — this file, static <script> tag before </body>
 *   js/ui/nav-mobile.js      — hamburger + scroll-hide/reveal
 *   js/ui/btn-gradient.js    — nav CTA click-pulse
 */

import { init as initNav } from './ui/nav-mobile.js';
import { init as initBtn } from './ui/btn-gradient.js';

function boot() {
  initNav();
  initBtn();
}

boot();
window.addEventListener('load', boot, { once: true });

window.LTFNav = { boot };

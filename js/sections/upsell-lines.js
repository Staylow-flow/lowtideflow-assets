/**
 * Lowtideflow — Beyond the Gear line hover.
 *
 * The sweep itself is CSS (`ltf-upsell-sweep` in the page head): a slow
 * left-to-right iridescent band that loops for the duration of the hover.
 * This module only exists so the effect stays in the bundle registry; there
 * is no mouse tracking anymore.
 */

export function init() {
  /* CSS-owned. Kept as an idempotent no-op so ltf.js can keep importing it. */
}

export default init;

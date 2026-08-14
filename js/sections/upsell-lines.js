/**
 * Lowtideflow — Beyond the Gear line hover.
 *
 * The sweep itself is CSS (`ltf-upsell-sweep` in the page head): a left-to-right
 * iridescent band that restarts at the left and repeats for the hover. This
 * module adds `is-sweep` on pointer enter/leave so the effect still fires when
 * :hover does not land on the Webflow Paragraph wrapper.
 */

export function init() {
  document.querySelectorAll('.ltf-upsell-list-item').forEach((item) => {
    if (item.dataset.ltfUpsellSweep === '1') return;
    item.dataset.ltfUpsellSweep = '1';
    item.addEventListener('pointerenter', () => item.classList.add('is-sweep'));
    item.addEventListener('pointerleave', () => item.classList.remove('is-sweep'));
  });
}

export default init;

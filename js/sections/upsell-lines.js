/**
 * Lowtideflow — Beyond the Gear line hover / touch sweep.
 *
 * CSS (`ltf-upsell-sweep`) paints the iridescent band. This module toggles
 * `is-sweep` for pointer + touch so mobile still fires when :hover does not.
 */

const STYLE_ID = 'ltf-upsell-layout';

function injectUpsellLayout() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    '@media (min-width:992px){.ltf-upsell-list.ltf-split-asset{position:relative!important;top:0!important;box-sizing:border-box!important}}';
  document.head.appendChild(style);
}

export function init() {
  injectUpsellLayout();

  document.querySelectorAll('.ltf-upsell-list-item').forEach((item) => {
    if (item.dataset.ltfUpsellSweep === '1') return;
    item.dataset.ltfUpsellSweep = '1';

    let hideTimer = 0;
    const show = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      item.classList.add('is-sweep');
    };
    const hideNow = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      item.classList.remove('is-sweep');
    };
    const hideSoon = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideNow, 700);
    };

    item.addEventListener('pointerenter', show);
    item.addEventListener('pointerleave', hideNow);
    item.addEventListener('pointerdown', show);
    item.addEventListener('pointerup', hideSoon);
    item.addEventListener('pointercancel', hideNow);
  });
}

export default init;

/**
 * Lowtideflow — mouse-follow iridescent bloom on .ltf-upsell-list-item.
 *
 * Writes --ltf-mx / --ltf-my on the row. The gradient itself is CSS so the
 * hover colour stays in the same palette as the button rings and squad cards.
 */

function bind(item) {
  if (item.dataset.ltfUpsellBound === '1') return;
  item.dataset.ltfUpsellBound = '1';

  item.addEventListener('pointermove', (e) => {
    const r = item.getBoundingClientRect();
    item.style.setProperty('--ltf-mx', `${e.clientX - r.left}px`);
    item.style.setProperty('--ltf-my', `${e.clientY - r.top}px`);
  });
}

export function init() {
  document.querySelectorAll('.ltf-upsell-list-item').forEach(bind);
}

export default init;

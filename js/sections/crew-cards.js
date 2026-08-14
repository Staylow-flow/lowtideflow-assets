/**
 * Lowtideflow — The Crew cards scroll-dock.
 *
 * Left-column cards start off-canvas to the left, right-column cards to the
 * right. Position tracks window scroll. All four cards share the grid's
 * progress so the bottom pair only lags a hair, and they finish docking
 * while the section is still traveling toward center.
 */

import { onFrame, reducedMotion } from '../core/ticker.js';

const DESKTOP = '(min-width: 992px)';
/* Grid top at this fraction of the viewport → fully off-canvas. */
const START_AT = 1.08;
/* Grid top at this fraction → fully docked. Higher = stops earlier,
   while the block is still below center. */
const END_AT = 0.52;
const TRAVEL = 100;
const HOVER_SCALE = 1.03;
/* Bottom row waits this much extra progress — a beat, not a second row. */
const BOTTOM_LAG = 0.07;

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function scrollProgress(el, vh) {
  const top = el.getBoundingClientRect().top;
  const start = vh * START_AT;
  const end = vh * END_AT;
  const span = start - end;
  if (span <= 0) return 1;
  return clamp01((start - top) / span);
}

export function init() {
  const grid = document.querySelector('.ltf-cards-grid');
  if (!grid || grid.dataset.ltfCrewBound === '1') return;
  grid.dataset.ltfCrewBound = '1';

  const cards = Array.from(grid.querySelectorAll('.ltf-card'));
  if (!cards.length) return;

  /* Extra hover bloom lives in CSS (.ltf-card::before). The class keeps
     the glow lit while the pointer is down on the card, matching Specs. */
  for (const card of cards) {
    card.addEventListener('pointerenter', () => card.classList.add('is-glow'));
    card.addEventListener('pointerleave', () => card.classList.remove('is-glow'));
  }

  const rest = () => {
    for (const card of cards) card.style.transform = '';
  };

  if (reducedMotion) {
    rest();
    return;
  }

  const mq = matchMedia(DESKTOP);
  let desktop = mq.matches;
  mq.addEventListener('change', (e) => {
    desktop = e.matches;
    if (!desktop) rest();
  });

  onFrame(() => {
    if (!desktop) return;
    const vh = window.innerHeight || 1;
    const gridP = scrollProgress(grid, vh);
    for (let i = 0; i < cards.length; i++) {
      const lag = i >= 2 ? BOTTOM_LAG : 0;
      const p = easeOutQuad(clamp01((gridP - lag) / (1 - lag)));
      const dir = i % 2 === 0 ? -1 : 1;
      const scale = cards[i].classList.contains('is-glow') ? HOVER_SCALE : 1;
      cards[i].style.transform =
        `translate3d(${(1 - p) * dir * TRAVEL}%, 0, 0) scale(${scale})`;
    }
  }, { element: grid });
}

export default init;

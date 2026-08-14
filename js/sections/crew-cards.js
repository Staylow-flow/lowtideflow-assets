/**
 * Lowtideflow — The Crew cards scroll-dock.
 *
 * Each card tracks its own position in the viewport so the bottom row
 * still slides in instead of appearing already docked. Hover glow lives
 * in CSS; this file only writes translate so type never scales.
 */

import { onFrame, reducedMotion } from '../core/ticker.js';

const DESKTOP = '(min-width: 992px)';
/* Card top at this fraction of the viewport → fully off-canvas. */
const START_AT = 1.05;
/* Card top at this fraction → fully docked. Lower = more travel on-screen. */
const END_AT = 0.58;
const TRAVEL = 100;

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
    for (let i = 0; i < cards.length; i++) {
      const p = easeOutQuad(scrollProgress(cards[i], vh));
      const dir = i % 2 === 0 ? -1 : 1;
      cards[i].style.transform =
        `translate3d(${(1 - p) * dir * TRAVEL}%, 0, 0)`;
    }
  }, { element: grid });
}

export default init;

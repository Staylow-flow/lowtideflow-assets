/**
 * Lowtideflow — The Crew cards scroll-dock + Specs mobile Crew match.
 *
 * Each card tracks its own position in the viewport so the bottom row
 * still slides in instead of appearing already docked. Hover glow lives
 * in CSS; this file only writes translate so type never scales.
 *
 * On mobile (≤991): Specs vault is restacked as Crew-style boxes — no
 * slam travel, no sticky scroll track transforms. Glow only.
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

function bindGlow(card) {
  if (card.dataset.ltfGlowBound === '1') return;
  card.dataset.ltfGlowBound = '1';
  card.addEventListener('pointerenter', () => card.classList.add('is-glow'));
  card.addEventListener('pointerleave', () => card.classList.remove('is-glow'));
  /* Touch: keep glow while finger is down (no size change — CSS enforces). */
  card.addEventListener('pointerdown', () => card.classList.add('is-glow'));
  card.addEventListener('pointerup', () => card.classList.remove('is-glow'));
  card.addEventListener('pointercancel', () => card.classList.remove('is-glow'));
}

/** Mobile Specs: kill slam leftovers, stack like Crew, glow only. */
function normalizeSpecsMobile() {
  const mobile = matchMedia('(max-width: 991px)');
  const vaults = document.querySelectorAll('.ltf-specs-vault, [data-ltf-specs-slam]');

  function apply() {
    for (const vault of vaults) {
      const host =
        vault.querySelector('.ltf-specs-vault-cards') ||
        vault.querySelector('[data-ltf-slam-cards]');
      const cards = vault.querySelectorAll('.ltf-spec-card');

      if (mobile.matches) {
        vault.style.height = 'auto';
        vault.style.minHeight = '0';
        if (host) {
          host.style.height = 'auto';
          host.style.minHeight = '0';
          host.style.overflow = 'visible';
          host.querySelectorAll('.ltf-nebula-gas-layer, .ltf-nebula-ring-layer').forEach((el) => {
            el.remove();
          });
        }
        for (const card of cards) {
          card.style.transform = 'none';
          card.style.willChange = 'auto';
          card.style.transition = '';
          card.style.position = '';
          card.style.top = '';
          card.style.left = '';
          card.style.zIndex = '';
          bindGlow(card);
        }
      } else {
        vault.style.height = '';
        vault.style.minHeight = '';
        if (host) {
          host.style.height = '';
          host.style.minHeight = '';
          host.style.overflow = '';
        }
      }
    }
  }

  apply();
  mobile.addEventListener('change', apply);
}

export function init() {
  const grid = document.querySelector('.ltf-cards-grid');
  if (grid && grid.dataset.ltfCrewBound !== '1') {
    grid.dataset.ltfCrewBound = '1';

    const cards = Array.from(grid.querySelectorAll('.ltf-card'));
    for (const card of cards) bindGlow(card);

    const rest = () => {
      for (const card of cards) card.style.transform = '';
    };

    if (!reducedMotion && cards.length) {
      const mq = matchMedia(DESKTOP);
      let desktop = mq.matches;
      mq.addEventListener('change', (e) => {
        desktop = e.matches;
        if (!desktop) rest();
      });

      /* Only write translates once the grid is near the viewport. Applying
         100% travel at bind (while the user is still in the hero) parks cards
         off-canvas; a late JS load then makes them vanish and pop back. */
      let live = false;

      function paint() {
        if (!desktop || !live) return;
        const vh = window.innerHeight || 1;
        for (let i = 0; i < cards.length; i++) {
          const p = easeOutQuad(scrollProgress(cards[i], vh));
          const dir = i % 2 === 0 ? -1 : 1;
          cards[i].style.transform =
            `translate3d(${(1 - p) * dir * TRAVEL}%, 0, 0)`;
        }
      }

      onFrame(paint, {
        element: grid,
        onEnter() {
          live = true;
          paint();
        },
      });
    } else {
      rest();
    }
  }

  /* Specs cards — same glow; mobile = Crew stack, no scroll slide. */
  document.querySelectorAll('.ltf-spec-card').forEach(bindGlow);
  normalizeSpecsMobile();
}

export default init;

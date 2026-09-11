/**
 * Lowtideflow — The Crew cards scroll-dock + Specs mobile stack (≤767 only).
 *
 * Each card tracks its own position in the viewport so the bottom row
 * still slides in instead of appearing already docked. Hover glow lives
 * in CSS; this file only writes translate so type never scales.
 *
 * On phone (≤767): Specs vault is restacked as Crew-style boxes — no
 * slam travel, no sticky scroll track transforms. Glow only.
 * Tablet stack (768–991): same cleanup — head CSS owns layout; slam off.
 */

import { onFrame, reducedMotion } from '../core/ticker.js';

const DESKTOP = '(min-width: 992px)';
const SPECS_STACK = '(max-width: 991px)';
/* Card top at this fraction of the viewport → fully off-canvas. */
const START_AT = 1.05;
/* Card top at this fraction → fully docked. Lower = more travel on-screen. */
const END_AT = 0.58;
const TRAVEL = 100;
/* Keep touch glow visible briefly after finger-up (pointerleave is flaky). */
const TOUCH_GLOW_MS = 900;

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

  let hideTimer = 0;
  const show = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    card.classList.add('is-glow');
  };
  const hideSoon = () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      card.classList.remove('is-glow');
      hideTimer = 0;
    }, TOUCH_GLOW_MS);
  };
  const hideNow = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    card.classList.remove('is-glow');
  };

  card.addEventListener('pointerenter', show);
  card.addEventListener('pointerleave', hideNow);
  /* Touch: show wash + orbit ring while finger is down, linger briefly. */
  card.addEventListener('pointerdown', show);
  card.addEventListener('pointerup', hideSoon);
  card.addEventListener('pointercancel', hideNow);
}

/** ≤991 Specs stack: kill slam leftovers, content-fit boxes, glow only. */
function normalizeSpecsMobile(reinitVault) {
  const stack = matchMedia(SPECS_STACK);
  const vaults = document.querySelectorAll('.ltf-specs-vault, [data-ltf-specs-slam]');

  function clearInline(el, props) {
    if (!el) return;
    for (const p of props) el.style.removeProperty(p);
  }

  function apply() {
    let leavingMobile = false;

    for (const vault of vaults) {
      const host =
        vault.querySelector('.ltf-specs-vault-cards') ||
        vault.querySelector('[data-ltf-slam-cards]');
      const cards = vault.querySelectorAll('.ltf-spec-card');

      if (stack.matches) {
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
          clearInline(card, [
            'transition',
            'position',
            'top',
            'left',
            'right',
            'bottom',
            'z-index',
            'width',
            'max-width',
            'height',
            'min-height',
            'max-height',
          ]);
          bindGlow(card);
        }
        delete vault.dataset.ltfSlamBound;
      } else {
        clearInline(vault, ['height', 'min-height']);
        clearInline(host, ['height', 'min-height', 'overflow']);
        leavingMobile = true;
      }
    }

    if (!stack.matches && leavingMobile && typeof reinitVault === 'function') {
      reinitVault();
    } else if (!stack.matches && leavingMobile && window.LTF && typeof window.LTF.reinitVault === 'function') {
      window.LTF.reinitVault();
    }
  }

  apply();
  stack.addEventListener('change', apply);
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

  /* Launch Your Fleet — touch/pointer glow (CSS ::before + .ltf-funnel-cta-glow). */
  document.querySelectorAll('.ltf-funnel-cta').forEach((el) => {
    if (el.dataset.ltfFunnelGlow === '1') return;
    el.dataset.ltfFunnelGlow = '1';
    let hideTimer = 0;
    const show = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      el.classList.add('is-glow');
    };
    const hideNow = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      el.classList.remove('is-glow');
    };
    const hideSoon = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideNow, TOUCH_GLOW_MS);
    };
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointerleave', hideNow);
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointerup', hideSoon);
    el.addEventListener('pointercancel', hideNow);
  });
}

export default init;

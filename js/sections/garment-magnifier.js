/**
 * Lowtideflow — thread-counter magnifier.
 *
 * Host: .ltf-authority-image-box or [data-ltf-magnifier]
 * Base layer: the Designer <img> (FABRIC-ONLY AVIF).
 * Reveal: LOGO-REVEAL AVIF, shown through the mask hole.
 *
 * The glass is always on. At rest it sits at 50% x / 20% y. Scroll is read
 * from the shared ticker (`scroll.deltaY`) so this stays in lockstep with
 * every other effect. The glass mostly holds its place in the window and
 * only eases a little in the scroll direction. 90% of that slip is vertical;
 * 10% is a sticky random left or right.
 *
 * Pointer hover takes over; ice resumes on leave from the current pose.
 */

import { onFrame, reducedMotion, scroll } from '../core/ticker.js';

const ASSETS = new URL('../../Magnifying-Glass-Assets/', import.meta.url);
const SRC = {
  reveal: new URL('Grey-Fabric-Macro-Shot-LOGO-REVEAL.avif', ASSETS).href,
  mask: new URL('Magnifying-Glass-Mask.png', ASSETS).href,
};

const HOLE_CX = 0.4958;
const HOLE_CY = 0.4528;
const HOLE_D = 0.62;
const MASK_RATIO = 936 / 1056;
const MAG = 1.22;
const REST_X = 0.5;
const REST_Y = 0.2;

/* Motion mix: stay-in-window + a little travel with the scroll. */
const Y_SHARE = 0.9;
const X_SHARE = 0.1;
const LOCK = 0.88;
const SLIP = 0.1;
const SMOOTH = 0.12;
const SETTLE = 0.965;
const ICE_MAX_X = 24;
const ICE_MAX_Y = 72;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function bind(host) {
  if (host.dataset.ltfMagnifierBound === '1') return;
  host.dataset.ltfMagnifierBound = '1';
  host.classList.add('ltf-magnifier', 'is-lit');

  const base = host.querySelector(
    'img:not(.ltf-magnifier-print):not(.ltf-magnifier-glass)',
  );
  if (!base) return;
  base.classList.add('ltf-magnifier-base');

  const printSrc =
    host.getAttribute('data-ltf-print-src') ||
    host.querySelector('img[data-ltf-print]')?.currentSrc ||
    host.querySelector('img[data-ltf-print]')?.src ||
    SRC.reveal;

  const lens = document.createElement('div');
  lens.className = 'ltf-magnifier-lens';
  lens.setAttribute('aria-hidden', 'true');

  const hole = document.createElement('div');
  hole.className = 'ltf-magnifier-hole';

  const print = document.createElement('img');
  print.className = 'ltf-magnifier-print';
  print.alt = '';
  print.decoding = 'async';
  print.src = printSrc;

  const glass = document.createElement('img');
  glass.className = 'ltf-magnifier-glass';
  glass.alt = '';
  glass.decoding = 'async';
  glass.src = SRC.mask;

  hole.appendChild(print);
  lens.appendChild(hole);
  lens.appendChild(glass);
  host.appendChild(lens);

  let lensW = 0;
  let lensH = 0;
  let holeCx = 0;
  let holeCy = 0;
  let holeD = 0;
  let hovering = false;
  let iceX = 0;
  let iceY = 0;
  let targetX = 0;
  let targetY = 0;
  let lastLx = 0;
  let lastLy = 0;
  const xDir = Math.random() < 0.5 ? -1 : 1;

  function sizeLens() {
    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
    if (!hostW || !hostH) return;
    lensW = Math.min(340, Math.max(200, hostW * 0.72));
    lensH = lensW * MASK_RATIO;
    holeCx = lensW * HOLE_CX;
    holeCy = lensH * HOLE_CY;
    holeD = lensW * HOLE_D;

    lens.style.width = lensW + 'px';
    lens.style.height = lensH + 'px';
    hole.style.width = holeD + 'px';
    hole.style.height = holeD + 'px';
    hole.style.left = holeCx - holeD / 2 + 'px';
    hole.style.top = holeCy - holeD / 2 + 'px';

    print.style.width = hostW + 'px';
    print.style.height = hostH + 'px';
    print.style.transformOrigin = '0 0';
  }

  function rest() {
    return {
      x: host.clientWidth * REST_X - holeCx,
      y: host.clientHeight * REST_Y - holeCy,
    };
  }

  function applyLens(lx, ly, focusX, focusY) {
    lastLx = lx;
    lastLy = ly;
    lens.style.transform = `translate(${lx}px, ${ly}px)`;
    print.style.transform =
      `translate(${holeD / 2}px, ${holeD / 2}px) scale(${MAG}) ` +
      `translate(${-focusX}px, ${-focusY}px)`;
  }

  function moveToPointer(clientX, clientY) {
    const r = host.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const lx = clamp(x - holeCx, -holeD * 0.25, Math.max(0, r.width - holeD * 0.75));
    const ly = clamp(y - holeCy, -holeD * 0.25, Math.max(0, r.height - holeD * 0.75));
    applyLens(lx, ly, x, y);
  }

  function parkIce() {
    const at = rest();
    const lx = at.x + iceX;
    const ly = at.y + iceY;
    applyLens(lx, ly, lx + holeCx, ly + holeCy);
  }

  host.addEventListener('pointerenter', (e) => {
    hovering = true;
    host.classList.add('is-hover');
    sizeLens();
    moveToPointer(e.clientX, e.clientY);
  });

  host.addEventListener('pointermove', (e) => {
    if (!hovering) return;
    moveToPointer(e.clientX, e.clientY);
  });

  host.addEventListener('pointerleave', () => {
    hovering = false;
    host.classList.remove('is-hover');
    const at = rest();
    iceX = lastLx - at.x;
    iceY = lastLy - at.y;
    targetX = iceX;
    targetY = iceY;
    parkIce();
  });

  window.addEventListener('resize', () => {
    sizeLens();
    if (!hovering) parkIce();
  }, { passive: true });

  const boot = () => {
    sizeLens();
    parkIce();
  };
  if (base.complete) boot();
  else base.addEventListener('load', boot, { once: true });

  if (reducedMotion) return;

  onFrame(() => {
    if (hovering) return;

    /* scroll.deltaY is sampled once per ticker frame — same value every
       other effect on the page sees this tick. */
    const kick = scroll.deltaY * (LOCK + SLIP);
    targetY += kick * Y_SHARE;
    targetX += kick * X_SHARE * xDir;
    targetX *= SETTLE;
    targetY *= SETTLE;
    targetX = clamp(targetX, -ICE_MAX_X, ICE_MAX_X);
    targetY = clamp(targetY, -ICE_MAX_Y, ICE_MAX_Y);

    iceX += (targetX - iceX) * SMOOTH;
    iceY += (targetY - iceY) * SMOOTH;
    parkIce();
  }, { element: host, onEnter: sizeLens });
}

export function init() {
  document
    .querySelectorAll('.ltf-authority-image-box, [data-ltf-magnifier]')
    .forEach(bind);
}

export default init;

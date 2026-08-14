/**
 * Lowtideflow — thread-counter magnifier.
 *
 * Host: .ltf-authority-image-box or [data-ltf-magnifier]
 * Base layer: the Designer <img> (FABRIC-ONLY AVIF).
 * Reveal / mask layers are not requested until the host is near the
 * viewport. Scroll is sampled once per frame by the shared ticker;
 * this subscriber is parked while the host is off-screen.
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
const REST_Y = 0.5;

const Y_SHARE = 0.9;
const X_SHARE = 0.1;
const LOCK = 0.88;
const SLIP = 0.1;
const SMOOTH = 0.12;
const SETTLE = 0.965;
const ICE_MAX_X = 24;
const ICE_MAX_Y = 72;
const IDLE = 0.08;
const RETURN_SPRING = 0.085;
const RETURN_DAMP = 0.78;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function bind(host) {
  if (host.dataset.ltfMagnifierBound === '1') return;
  host.dataset.ltfMagnifierBound = '1';
  host.classList.add('ltf-magnifier');

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
  print.loading = 'lazy';
  print.setAttribute('fetchpriority', 'low');

  const glass = document.createElement('img');
  glass.className = 'ltf-magnifier-glass';
  glass.alt = '';
  glass.decoding = 'async';
  glass.loading = 'lazy';
  glass.setAttribute('fetchpriority', 'low');

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
  let vx = 0;
  let vy = 0;
  let returning = false;
  let assetsOn = false;
  const xDir = Math.random() < 0.5 ? -1 : 1;

  function loadAssets() {
    if (assetsOn) return;
    assetsOn = true;
    host.classList.add('is-lit');
    print.src = printSrc;
    glass.src = SRC.mask;
  }

  function dropDecoded() {
    /* Keep src so a return visit does not refetch; just stop painting. */
    lens.style.willChange = 'auto';
    print.style.willChange = 'auto';
  }

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
    lens.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
    print.style.transform =
      `translate3d(${holeD / 2}px, ${holeD / 2}px, 0) scale(${MAG}) ` +
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
    returning = false;
    vx = 0;
    vy = 0;
    host.classList.add('is-hover');
    loadAssets();
    sizeLens();
    lens.style.willChange = 'transform';
    print.style.willChange = 'transform';
    moveToPointer(e.clientX, e.clientY);
  });

  host.addEventListener('pointermove', (e) => {
    if (!hovering) return;
    moveToPointer(e.clientX, e.clientY);
  });

  host.addEventListener('pointerleave', () => {
    hovering = false;
    returning = true;
    vx = 0;
    vy = 0;
    host.classList.remove('is-hover');
  });

  window.addEventListener('resize', () => {
    if (!assetsOn) return;
    sizeLens();
    if (!hovering) parkIce();
  }, { passive: true });

  if (reducedMotion) {
    onFrame(() => {}, {
      element: host,
      onEnter() {
        loadAssets();
        sizeLens();
        parkIce();
      },
    });
    return;
  }

  onFrame(() => {
    if (hovering) return;

    if (returning) {
      const at = rest();
      const dx = at.x - lastLx;
      const dy = at.y - lastLy;
      vx = vx * RETURN_DAMP + dx * RETURN_SPRING;
      vy = vy * RETURN_DAMP + dy * RETURN_SPRING;
      const lx = lastLx + vx;
      const ly = lastLy + vy;
      applyLens(lx, ly, lx + holeCx, ly + holeCy);
      if (
        Math.abs(dx) < 0.6 &&
        Math.abs(dy) < 0.6 &&
        Math.abs(vx) < 0.2 &&
        Math.abs(vy) < 0.2
      ) {
        returning = false;
        iceX = 0;
        iceY = 0;
        targetX = 0;
        targetY = 0;
        parkIce();
      }
      return;
    }

    const kick = scroll.deltaY * (LOCK + SLIP);
    const idle =
      Math.abs(scroll.deltaY) < IDLE &&
      Math.abs(targetX - iceX) < IDLE &&
      Math.abs(targetY - iceY) < IDLE &&
      Math.abs(iceX) < IDLE &&
      Math.abs(iceY) < IDLE;
    if (idle) return;

    targetY += kick * Y_SHARE;
    targetX += kick * X_SHARE * xDir;
    targetX *= SETTLE;
    targetY *= SETTLE;
    targetX = clamp(targetX, -ICE_MAX_X, ICE_MAX_X);
    targetY = clamp(targetY, -ICE_MAX_Y, ICE_MAX_Y);

    iceX += (targetX - iceX) * SMOOTH;
    iceY += (targetY - iceY) * SMOOTH;
    parkIce();
  }, {
    element: host,
    onEnter() {
      loadAssets();
      sizeLens();
      lens.style.willChange = 'transform';
      print.style.willChange = 'transform';
      parkIce();
    },
    onExit: dropDecoded,
  });
}

export function init() {
  document
    .querySelectorAll('.ltf-authority-image-box, [data-ltf-magnifier]')
    .forEach(bind);
}

export default init;

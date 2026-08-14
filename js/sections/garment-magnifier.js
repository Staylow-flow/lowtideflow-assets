/**
 * Lowtideflow — two-layer garment magnifier (thread-counter glass).
 *
 * Host: .ltf-authority-image-box or [data-ltf-magnifier]
 * Base layer: FABRIC-ONLY (the visible <img>).
 * Reveal layer: LOGO-REVEAL, shown through the transparent hole in
 * Magnifying-Glass-Mask.png. The PNG itself is the cursor — the old
 * teal circle is gone.
 *
 * The print image is sized to the host and offset opposite the lens so
 * the pixels in the hole line up with the fabric underneath, then scaled
 * up around the hole for a rounded magnification at the rim.
 */

const ASSETS = new URL('../../Magnifying-Glass-Assets/', import.meta.url);
const SRC = {
  fabric: new URL('fabric-only.jpg', ASSETS).href,
  reveal: new URL('logo-reveal.jpg', ASSETS).href,
  mask: new URL('Magnifying-Glass-Mask.png', ASSETS).href,
};

/* Measured on the mask PNG (1056×936). Fractions stay valid after resize. */
const HOLE_CX = 0.4958;
const HOLE_CY = 0.4528;
const HOLE_D = 0.62;
const MASK_RATIO = 936 / 1056;
const MAG = 1.22;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function bind(host) {
  if (host.dataset.ltfMagnifierBound === '1') return;
  host.dataset.ltfMagnifierBound = '1';
  host.classList.add('ltf-magnifier');

  const base = host.querySelector('img:not(.ltf-magnifier-print):not(.ltf-magnifier-glass)');
  if (!base) return;
  base.classList.add('ltf-magnifier-base');
  if (!base.getAttribute('data-ltf-keep-src')) {
    base.src = SRC.fabric;
  }

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

  function sizeLens() {
    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
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

  function moveLens(clientX, clientY) {
    const r = host.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const lx = clamp(x - holeCx, -holeD * 0.25, Math.max(0, r.width - holeD * 0.75));
    const ly = clamp(y - holeCy, -holeD * 0.25, Math.max(0, r.height - holeD * 0.75));
    lens.style.transform = `translate(${lx}px, ${ly}px)`;

    /* Zoom around the cursor, then park that point on the hole center. */
    print.style.transform =
      `translate(${holeD / 2}px, ${holeD / 2}px) scale(${MAG}) translate(${-x}px, ${-y}px)`;
  }

  host.addEventListener('pointerenter', (e) => {
    sizeLens();
    host.classList.add('is-lit');
    moveLens(e.clientX, e.clientY);
  });

  host.addEventListener('pointermove', (e) => {
    moveLens(e.clientX, e.clientY);
  });

  host.addEventListener('pointerleave', () => {
    host.classList.remove('is-lit');
  });

  window.addEventListener('resize', sizeLens, { passive: true });
  if (base.complete) sizeLens();
  else base.addEventListener('load', sizeLens, { once: true });
}

export function init() {
  document
    .querySelectorAll('.ltf-authority-image-box, [data-ltf-magnifier]')
    .forEach(bind);
}

export default init;

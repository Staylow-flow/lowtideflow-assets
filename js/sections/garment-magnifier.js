/**
 * Lowtideflow — two-layer garment magnifier.
 *
 * Host: .ltf-authority-image-box or [data-ltf-magnifier]
 * Base layer: the existing <img> (unprinted / blank garment).
 * Print layer: data-ltf-print-src on the host, or a second <img
 * data-ltf-print>. If neither is set, the base image is reused with a
 * colour-grade so the lens still reveals something until a real print
 * plate is dropped in.
 *
 * The lens is a circular overflow window. The print image is sized to the
 * host and offset opposite the lens, so the pixels under the glass always
 * line up with the pixels underneath.
 */

const LENS = 168;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function bind(host) {
  if (host.dataset.ltfMagnifierBound === '1') return;
  host.dataset.ltfMagnifierBound = '1';
  host.classList.add('ltf-magnifier');

  const base = host.querySelector('img:not(.ltf-magnifier-print)');
  if (!base) return;
  base.classList.add('ltf-magnifier-base');

  const printSrc =
    host.getAttribute('data-ltf-print-src') ||
    host.querySelector('img[data-ltf-print]')?.currentSrc ||
    host.querySelector('img[data-ltf-print]')?.src ||
    '';

  const lens = document.createElement('div');
  lens.className = 'ltf-magnifier-lens';
  lens.setAttribute('aria-hidden', 'true');

  const print = document.createElement('img');
  print.className = 'ltf-magnifier-print';
  print.alt = '';
  print.decoding = 'async';

  if (printSrc) {
    print.src = printSrc;
    lens.appendChild(print);
  } else {
    print.src = base.currentSrc || base.src;
    host.classList.add('is-same-src');
    const tint = document.createElement('span');
    tint.className = 'ltf-magnifier-print-tint';
    lens.appendChild(print);
    lens.appendChild(tint);
  }
  host.appendChild(lens);

  function sizePrint() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    print.style.width = w + 'px';
    print.style.height = h + 'px';
  }

  function moveLens(clientX, clientY) {
    const r = host.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const lx = clamp(x - LENS / 2, 0, Math.max(0, r.width - LENS));
    const ly = clamp(y - LENS / 2, 0, Math.max(0, r.height - LENS));
    lens.style.transform = `translate(${lx}px, ${ly}px)`;
    print.style.transform = `translate(${-lx}px, ${-ly}px)`;
  }

  host.addEventListener('pointerenter', (e) => {
    sizePrint();
    host.classList.add('is-lit');
    moveLens(e.clientX, e.clientY);
  });

  host.addEventListener('pointermove', (e) => {
    moveLens(e.clientX, e.clientY);
  });

  host.addEventListener('pointerleave', () => {
    host.classList.remove('is-lit');
  });

  window.addEventListener('resize', sizePrint, { passive: true });
  if (base.complete) sizePrint();
  else base.addEventListener('load', sizePrint, { once: true });
}

export function init() {
  document
    .querySelectorAll('.ltf-authority-image-box, [data-ltf-magnifier]')
    .forEach(bind);
}

export default init;

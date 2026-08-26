/**
 * Lowtideflow — thread-counter magnifier.
 *
 * Host: .ltf-authority-image-box or [data-ltf-magnifier]
 * Base layer: the Designer <img> (FABRIC-ONLY AVIF).
 * Reveal / mask layers decode to display size so a 1790×2400 source does not
 * sit fully uncompressed in GPU memory. Scroll is sampled once per frame by
 * the shared ticker; this subscriber is parked while the host is off-screen.
 */

import { onFrame, reducedMotion, scroll } from '../core/ticker.js';

/* Bitmaps live on the Webflow CDN — not next to this module on jsDelivr. */
const SRC = {
  reveal:
    'https://cdn.prod.website-files.com/6789f449bbb1a21245706751/6a7edecc38121cbf2060e27e_Grey-Fabric-Macro-Shot-LOGO-REVEAL.avif',
  mask:
    'https://cdn.prod.website-files.com/6789f449bbb1a21245706751/6a845ac239284466e6512f78_Magnifying-Glass-Mask.png',
};

const HOLE_CX = 0.4958;
const HOLE_CY = 0.4528;
const HOLE_D = 0.62;
const MASK_RATIO = 936 / 1056;
/* Reveal is a true zoom — larger than the plain fabric plate. */
const MAG = 1.25;
const REST_X = 0.33;
const REST_Y = 0.5;
const LENS_OVERHANG = 0.45;

const Y_SHARE = 0.9;
const X_SHARE = 0.1;
const LOCK = 0.88;
const SLIP = 0.1;
const SMOOTH = 0.12;
const SETTLE = 0.965;
const ICE_MAX_X = 24;
const ICE_MAX_Y = 72;
const IDLE = 0.08;
const RETURN_EASE = 0.012;
const RETURN_MAX = 0.85;
const LEAVE_Y_PULL = 0;

/* 50% glued to the fabric, 50% sliding in viewport space.
   Coast is velocity-only — same direction, slow, then stop. No spring-back. */
const STICK_FRICTION = 0.94;
const STICK_SNAP = 0.12;
const STICK_SHARE = 0.5;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function blobUrlFromBitmap(bitmap, type, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { alpha: type === 'image/png' });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('magnifier encode failed'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, type, quality);
  });
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

  function isMobile() {
    return window.matchMedia('(max-width: 991px)').matches;
  }

  const printSrc =
    host.getAttribute('data-ltf-print-src') ||
    host.querySelector('img[data-ltf-print]')?.currentSrc ||
    host.querySelector('img[data-ltf-print]')?.src ||
    SRC.reveal;
  const maskSrc =
    host.getAttribute('data-ltf-mask-src') ||
    host.querySelector('img[data-ltf-mask]')?.currentSrc ||
    host.querySelector('img[data-ltf-mask]')?.src ||
    SRC.mask;

  const lens = document.createElement('div');
  lens.className = 'ltf-magnifier-lens';
  lens.setAttribute('aria-hidden', 'true');

  const hole = document.createElement('div');
  hole.className = 'ltf-magnifier-hole';

  const print = document.createElement('img');
  print.className = 'ltf-magnifier-print';
  print.alt = '';
  print.crossOrigin = 'anonymous';
  print.decoding = 'async';
  print.setAttribute('fetchpriority', 'low');

  const glass = document.createElement('img');
  glass.className = 'ltf-magnifier-glass';
  glass.alt = '';
  glass.crossOrigin = 'anonymous';
  glass.decoding = 'async';
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
  let returning = false;
  let hangNx = REST_X;
  let hangNy = REST_Y;
  let assetsOn = false;
  let loading = false;
  let viewStickY = 0;
  let stickVel = 0;
  let started = false;
  const objectUrls = [];
  const xDir = Math.random() < 0.5 ? -1 : 1;

  function revokeUrls() {
    while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
  }

  async function loadAssets() {
    if (assetsOn || loading) return;
    loading = true;

    const narrow = window.innerWidth < 992;
    const maxW = Math.min(
      narrow ? 720 : 1400,
      Math.max(
        narrow ? 480 : 720,
        Math.round((host.clientWidth || 480) * MAG * (narrow ? 1.5 : 2)),
      ),
    );

    try {
      if (typeof createImageBitmap === 'function') {
        const [revBlob, maskBlob] = await Promise.all([
          fetch(printSrc, { cache: 'force-cache' }).then((r) => {
            if (!r.ok) throw new Error('reveal fetch ' + r.status);
            return r.blob();
          }),
          fetch(maskSrc, { cache: 'force-cache' }).then((r) => {
            if (!r.ok) throw new Error('mask fetch ' + r.status);
            return r.blob();
          }),
        ]);
        const revBmp = await createImageBitmap(revBlob, {
          resizeWidth: maxW,
          resizeQuality: 'high',
        });
        const maskBmp = await createImageBitmap(maskBlob);
        const [revUrl, maskUrl] = await Promise.all([
          blobUrlFromBitmap(revBmp, 'image/jpeg', 0.84),
          blobUrlFromBitmap(maskBmp, 'image/png'),
        ]);
        objectUrls.push(revUrl, maskUrl);
        print.src = revUrl;
        glass.src = maskUrl;
      } else {
        print.src = printSrc;
        glass.src = maskSrc;
      }
      await Promise.all([
        print.decode().catch(() => {}),
        glass.decode().catch(() => {}),
      ]);
      assetsOn = true;
      host.classList.add('is-lit');
    } catch (err) {
      console.error('[ltf] magnifier assets', err);
      print.src = printSrc;
      glass.src = maskSrc;
      assetsOn = true;
      host.classList.add('is-lit');
    } finally {
      loading = false;
    }
  }

  function dropDecoded() {
    /* Keep bitmaps once decoded. Dropping them on ticker exit forced a
       ~1s createImageBitmap/toBlob hitch when scrolling back — the whole
       Trenches split (copy included) froze blank until decode finished. */
    lens.style.willChange = 'auto';
    print.style.willChange = 'auto';
  }

  function sizeLens() {
    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
    if (!hostW || !hostH) return;
    const mobile = isMobile();
    lensW = mobile
      ? Math.min(160, Math.max(110, hostW * 0.42))
      : Math.min(340, Math.max(200, hostW * 0.72));
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

    if (!started) {
      placeStart();
      started = true;
    }
  }

  function lensBounds() {
    const w = host.clientWidth || 0;
    const h = host.clientHeight || 0;
    const inset = isMobile() ? 12 : 50;
    const minX = -lensW * LENS_OVERHANG + inset;
    const minY = -lensH * LENS_OVERHANG + inset;
    const maxX = w - lensW * (1 - LENS_OVERHANG) - inset;
    const maxY = h - lensH * (1 - LENS_OVERHANG) - inset;
    return {
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
    };
  }

  function clampLens(lx, ly) {
    const b = lensBounds();
    return {
      x: clamp(lx, b.minX, b.maxX),
      y: clamp(ly, b.minY, b.maxY),
    };
  }

  function placeStart() {
    const b = lensBounds();
    if (isMobile()) {
      lastLx = b.minX;
      lastLy = (b.minY + b.maxY) / 2;
      hangNx = (lastLx + holeCx) / (host.clientWidth || 1);
      hangNy = (lastLy + holeCy) / (host.clientHeight || 1);
      return;
    }
    const x = Math.max(0, b.minX);
    const y = Math.max(0, b.minY) + Math.max(0, host.clientHeight - lensH) * 0.16;
    lastLx = x;
    lastLy = y;
    hangNx = (x + holeCx) / (host.clientWidth || 1);
    hangNy = (y + holeCy) / (host.clientHeight || 1);
  }

  function rest() {
    return clampLens(host.clientWidth * 0.5 - holeCx, lastLy);
  }

  function paint() {
    const vis = clampLens(lastLx, lastLy + viewStickY);
    viewStickY = vis.y - lastLy;
    lastLx = vis.x;
    lens.style.transform = `translate3d(${vis.x}px, ${vis.y}px, 0)`;
    print.style.transform =
      `translate3d(${holeD / 2}px, ${holeD / 2}px, 0) scale(${MAG}) ` +
      `translate(${-(vis.x + holeCx)}px, ${-(vis.y + holeCy)}px)`;
  }

  function applyLens(lx, ly) {
    const c = clampLens(lx, ly);
    lastLx = c.x;
    lastLy = c.y;
    paint();
  }

  function moveToPointer(clientX, clientY) {
    const r = host.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    applyLens(x - holeCx, y - holeCy);
  }

  function parkIce() {
    const at = rest();
    applyLens(at.x + iceX, at.y + iceY);
  }

  function tickStick() {
    if (Math.abs(scroll.deltaY) > 0.05) {
      stickVel = scroll.deltaY * STICK_SHARE;
    } else {
      stickVel *= STICK_FRICTION;
      if (Math.abs(stickVel) < STICK_SNAP) stickVel = 0;
    }
    if (stickVel) viewStickY += stickVel;
  }

  /** Mobile: pan glass left→right from host scroll progress (no finger drag). */
  function scrollPanProgress() {
    const r = host.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 0.92;
    const end = vh * 0.18 - r.height;
    const span = start - end;
    if (span <= 0) return 1;
    return clamp((start - r.top) / span, 0, 1);
  }

  function applyScrollPan() {
    const b = lensBounds();
    const t = scrollPanProgress();
    const y = (b.minY + b.maxY) / 2;
    const x = b.minX + (b.maxX - b.minX) * t;
    viewStickY = 0;
    applyLens(x, y);
  }

  let mobileMode = isMobile();

  if (!mobileMode) {
    host.addEventListener('pointerenter', (e) => {
      hovering = true;
      returning = false;
      viewStickY = 0;
      stickVel = 0;
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
      host.classList.remove('is-hover');
    });
  }

  window.addEventListener('resize', () => {
    const next = isMobile();
    if (next !== mobileMode) {
      mobileMode = next;
      hovering = false;
      returning = false;
      host.classList.remove('is-hover');
    }
    if (!assetsOn) return;
    sizeLens();
    if (mobileMode) applyScrollPan();
    else if (!hovering && !returning) parkIce();
  }, { passive: true });

  /* Kick the fetch as soon as the module binds — do not wait for hover. */
  loadAssets();

  let seen = false;

  if (reducedMotion) {
    onFrame(() => {}, {
      element: host,
      onEnter() {
        seen = true;
        loadAssets();
        sizeLens();
        if (isMobile()) applyScrollPan();
        else parkIce();
      },
      onExit() {
        if (seen) dropDecoded();
      },
    });
    return;
  }

  onFrame((dt, now) => {
    if (isMobile()) {
      applyScrollPan();
      return;
    }

    if (hovering) return;

    tickStick();

    if (returning) {
      const at = rest();
      const dx = at.x - lastLx;
      const dy = at.y - lastLy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.4) {
        returning = false;
        iceX = 0;
        iceY = 0;
        targetX = 0;
        targetY = 0;
        parkIce();
        return;
      }
      let mx = dx * RETURN_EASE;
      let my = dy * RETURN_EASE;
      const step = Math.hypot(mx, my);
      if (step > RETURN_MAX) {
        mx *= RETURN_MAX / step;
        my *= RETURN_MAX / step;
      }
      applyLens(lastLx + mx, lastLy + my);
      return;
    }

    if (Math.abs(stickVel) < IDLE && Math.abs(scroll.deltaY) < IDLE) return;
    paint();
  }, {
    element: host,
    onEnter() {
      seen = true;
      loadAssets();
      sizeLens();
      lens.style.willChange = 'transform';
      print.style.willChange = 'transform';
      if (isMobile()) applyScrollPan();
      else parkIce();
    },
    onExit() {
      if (seen) dropDecoded();
    },
  });
}

export function init() {
  document
    .querySelectorAll('.ltf-authority-image-box, [data-ltf-magnifier]')
    .forEach(bind);
}

export default init;

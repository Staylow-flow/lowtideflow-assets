/**
 * Lowtideflow — shared frame scheduler.
 *
 * Every animated effect on the site subscribes here instead of calling
 * requestAnimationFrame itself. Three reasons this matters:
 *
 *   1. One rAF callback total. Effects stay in lockstep, so a scroll-driven
 *      card and a scroll-driven canvas can never sample different frames and
 *      drift a frame apart from each other.
 *   2. Scroll is read once per frame into `scroll`. Reading window.scrollY in
 *      a scroll listener is what makes pages jank: each reader can force the
 *      browser to recompute layout. One read per frame, shared by everyone.
 *   3. Subscribers are gated on visibility. An effect bound to an element
 *      burns zero CPU until that element is near the viewport, and the whole
 *      loop parks when the tab is backgrounded.
 *
 * Usage:
 *
 *   import { onFrame, scroll } from '../core/ticker.js';
 *
 *   const stop = onFrame((dt, now) => {
 *     el.style.transform = `translateY(${scroll.progress * 100}px)`;
 *   }, { element: section });
 *
 * The returned function unsubscribes. `dt` is milliseconds since the previous
 * frame, clamped so a backgrounded tab cannot resume with a huge time step.
 */

/* Longest frame delta we hand to subscribers. Tab-switching produces gaps of
   many seconds; without this an effect would teleport on resume. */
const MAX_FRAME_MS = 50;

/* Start work slightly before an element scrolls into view so the first visible
   frame is already correct rather than popping in. */
const VIEW_MARGIN = '200px';

export const reducedMotion =
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll state, refreshed once per frame while the loop runs.
 *
 *   y        — window.scrollY in pixels
 *   progress — 0..1 through the whole document
 *   deltaY   — pixels scrolled since the previous frame (signed)
 *   velocity — smoothed pixels-per-frame, useful for momentum and coast effects
 */
export const scroll = { y: 0, progress: 0, deltaY: 0, velocity: 0 };

const subs = new Set();

let raf = 0;
let lastNow = 0;
let observer = null;

function sampleScroll(dt) {
  const y = window.scrollY || window.pageYOffset || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;

  scroll.deltaY = y - scroll.y;
  scroll.y = y;
  scroll.progress = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;

  /* Normalise to a 60fps-equivalent step so velocity means the same thing on a
     120Hz display as it does on a 60Hz one. */
  const perFrame = scroll.deltaY * (16.667 / Math.max(dt, 1));
  scroll.velocity += (perFrame - scroll.velocity) * 0.2;
}

function frame(now) {
  raf = 0;

  const dt = lastNow ? Math.min(now - lastNow, MAX_FRAME_MS) : 16.667;
  lastNow = now;

  sampleScroll(dt);

  for (const sub of subs) {
    if (!sub.active) continue;
    try {
      sub.fn(dt, now);
    } catch (err) {
      /* One broken effect must not take down every other effect on the page. */
      console.error('[ltf-ticker] subscriber failed, unsubscribing', err);
      sub.stop();
    }
  }

  schedule();
}

function schedule() {
  if (raf || document.hidden) return;

  let anyActive = false;
  for (const sub of subs) {
    if (sub.active) {
      anyActive = true;
      break;
    }
  }
  if (!anyActive) return;

  raf = requestAnimationFrame(frame);
}

function wake() {
  /* Only when the loop was actually parked: forget the old timestamp so the
     first frame back reports a normal delta instead of the length of the pause.
     Scroll events call wake() constantly, and resetting on those would peg
     every delta at one frame. */
  if (!raf) lastNow = 0;
  schedule();
}

function getObserver() {
  if (observer || typeof IntersectionObserver !== 'function') return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        for (const sub of subs) {
          if (sub.element !== entry.target) continue;
          sub.active = entry.isIntersecting;
          if (sub.active && sub.onEnter) sub.onEnter();
          if (!sub.active && sub.onExit) sub.onExit();
        }
      }
      wake();
    },
    { rootMargin: VIEW_MARGIN },
  );

  return observer;
}

/**
 * Run `fn(dt, now)` every frame.
 *
 * @param {(dt: number, now: number) => void} fn
 * @param {object} [opts]
 * @param {Element} [opts.element]  Only run while this element is near the viewport.
 * @param {() => void} [opts.onEnter]  Called when the element becomes visible,
 *   a good place to re-measure layout that may have changed while parked.
 * @param {() => void} [opts.onExit]  Called when the element leaves the
 *   viewport band. Use this to drop decoded images or park GPU layers.
 * @returns {() => void} unsubscribe
 */
export function onFrame(fn, opts = {}) {
  const sub = {
    fn,
    element: opts.element || null,
    onEnter: opts.onEnter || null,
    onExit: opts.onExit || null,
    /* With no element to watch, run immediately and always. */
    active: !opts.element,
    stop() {
      subs.delete(sub);
      if (sub.element && observer) observer.unobserve(sub.element);
    },
  };

  subs.add(sub);

  if (sub.element) {
    const io = getObserver();
    /* No IntersectionObserver means no gating; run always rather than never. */
    if (io) io.observe(sub.element);
    else sub.active = true;
  }

  wake();
  return sub.stop;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  } else {
    wake();
  }
});

/* Scroll and resize do not drive the loop, they only wake it. The actual read
   happens in sampleScroll, once per frame. */
window.addEventListener('scroll', wake, { passive: true });
window.addEventListener('resize', wake, { passive: true });

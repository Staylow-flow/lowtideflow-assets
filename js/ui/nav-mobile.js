/**
 * Lowtideflow — nav hamburger (mobile only) + hide-on-scroll for
 * .ltf-site-nav (mobile AND desktop: hides on scroll down, reveals on a
 * 20px upward scroll, both driven by the same accumulator logic).
 */

const MOBILE_QUERY = '(max-width: 991px)';
/** Cumulative upward scroll (px) before the bar slides back in. */
const SHOW_DELTA = 20;
/** Cumulative downward scroll (px) before the bar hides. */
const HIDE_DELTA = 24;
const TOP_LOCK = 8;

export function init() {
  const nav = document.querySelector('.ltf-site-nav');
  const toggle = document.querySelector('.ltf-nav-toggle');
  const panel = document.querySelector('.ltf-nav-mobile-panel');
  if (!nav || !toggle || !panel) return;
  if (nav.dataset.ltfNavBound === '1') return;
  nav.dataset.ltfNavBound = '1';

  const mq = window.matchMedia(MOBILE_QUERY);
  let lastY = window.scrollY || 0;
  let hidden = false;
  let upAccum = 0;
  let downAccum = 0;

  function setOpen(open) {
    nav.classList.toggle('is-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('ltf-nav-open', open);
    if (open) {
      setHidden(false);
    }
  }

  function setHidden(next) {
    if (nav.classList.contains('is-nav-open')) {
      next = false;
    }
    if (hidden === next) return;
    hidden = next;
    nav.classList.toggle('is-nav-hidden', next);
  }

  function onScroll() {
    const y = window.scrollY || 0;
    const dy = y - lastY;
    lastY = y;

    if (y <= TOP_LOCK) {
      upAccum = 0;
      downAccum = 0;
      setHidden(false);
      return;
    }

    if (dy > 0) {
      downAccum += dy;
      upAccum = 0;
      if (downAccum >= HIDE_DELTA) {
        downAccum = 0;
        setHidden(true);
        setOpen(false);
      }
    } else if (dy < 0) {
      upAccum += -dy;
      downAccum = 0;
      if (upAccum >= SHOW_DELTA) {
        upAccum = 0;
        setHidden(false);
      }
    }
  }

  const close = () => setOpen(false);
  const toggleOpen = () => setOpen(!nav.classList.contains('is-nav-open'));

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    toggleOpen();
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOpen();
    }
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  window.addEventListener('scroll', onScroll, { passive: true });

  mq.addEventListener('change', () => {
    if (!mq.matches) {
      close();
      setHidden(false);
    }
    lastY = window.scrollY || 0;
  });

  initWrapDetection(nav);
}

/**
 * Desktop nav can wrap to a 2nd row (logo stays put, links + buttons drop
 * below it) once the window gets too narrow for everything on one line.
 * The exact pixel width where that happens shifts any time logo/button
 * sizing changes, so detect the wrap live via geometry instead of hard-coding
 * a breakpoint — toggles .is-nav-wrapped on .ltf-nav-inner for CSS to hook.
 */
function initWrapDetection(nav) {
  const inner = nav.querySelector('.ltf-nav-inner');
  const logo = nav.querySelector('.ltf-nav-logo-link');
  const links = nav.querySelector('.ltf-nav-links');
  if (!inner || !logo || !links) return;

  function check() {
    if (window.innerWidth < 992) {
      inner.classList.remove('is-nav-wrapped');
      return;
    }
    const wrapped = links.getBoundingClientRect().top - logo.getBoundingClientRect().top > 4;
    inner.classList.toggle('is-nav-wrapped', wrapped);
  }

  check();
  window.addEventListener('resize', check, { passive: true });
  window.addEventListener('orientationchange', check, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(check).catch(() => {});
  }
}

export default init;

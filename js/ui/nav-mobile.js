/**
 * Lowtideflow — mobile nav hamburger + hide-on-scroll for .ltf-site-nav.
 */

const MOBILE_QUERY = '(max-width: 991px)';
const SHOW_DELTA = 25;
const HIDE_DELTA = 25;
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
    if (!mq.matches) {
      nav.classList.remove('is-nav-hidden');
      hidden = false;
      return;
    }
    if (nav.classList.contains('is-nav-open')) {
      next = false;
    }
    if (hidden === next) return;
    hidden = next;
    nav.classList.toggle('is-nav-hidden', next);
  }

  function onScroll() {
    if (!mq.matches) return;
    const y = window.scrollY || 0;
    const dy = y - lastY;

    if (y <= TOP_LOCK) {
      setHidden(false);
    } else if (dy > HIDE_DELTA) {
      setHidden(true);
      setOpen(false);
    } else if (dy < -SHOW_DELTA) {
      setHidden(false);
    }

    lastY = y;
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
}

export default init;

/**
 * Lowtideflow — mobile nav hamburger toggle for .ltf-site-nav.
 *
 * This is the source of what used to be pasted as a minified inline block in
 * the Webflow footer. It now ships through the bundle like everything else, so
 * there is one copy to edit rather than two that can drift apart.
 */

const MOBILE_QUERY = '(max-width: 991px)';

export function init() {
  const nav = document.querySelector('.ltf-site-nav');
  const toggle = document.querySelector('.ltf-nav-toggle');
  const panel = document.querySelector('.ltf-nav-mobile-panel');
  if (!nav || !toggle || !panel) return;
  if (nav.dataset.ltfNavBound === '1') return;
  nav.dataset.ltfNavBound = '1';

  const mq = window.matchMedia(MOBILE_QUERY);

  function setOpen(open) {
    nav.classList.toggle('is-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('ltf-nav-open', open);
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

  /* Leaving mobile width with the panel open would strand the overlay. */
  mq.addEventListener('change', () => {
    if (!mq.matches) close();
  });
}

export default init;

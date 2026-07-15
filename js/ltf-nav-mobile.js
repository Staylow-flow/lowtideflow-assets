/**
 * Lowtideflow — Mobile nav hamburger toggle for .ltf-site-nav
 */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 991px)');

  function init() {
    var nav = document.querySelector('.ltf-site-nav');
    var toggle = document.querySelector('.ltf-nav-toggle');
    var panel = document.querySelector('.ltf-nav-mobile-panel');
    if (!nav || !toggle || !panel) return;

    function setOpen(open) {
      nav.classList.toggle('is-nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('ltf-nav-open', open);
    }

    function close() {
      setOpen(false);
    }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(!nav.classList.contains('is-nav-open'));
    });

    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(!nav.classList.contains('is-nav-open'));
      }
    });

    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    MQ.addEventListener('change', function () {
      if (!MQ.matches) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * System Engine preloader — dismiss after DOM ready (no artificial delay), iris reveal.
 *
 * Spec Engine (/spec-engine): link css + this script early (page head or first footer tag).
 * Webflow: place markup as first body child (see ensurePreloader template).
 *
 * No global resize/scroll listeners. Single window "load" (once) when needed.
 */
(function () {
  'use strict';

  var ROOT_SELECTOR = '.system-preloader';
  var REVEAL_CLASS = 'reveal-active';
  var BOOT_HTML_CLASS = 'ltf-system-engine-boot';
  var MIN_DISPLAY_MS = 0;
  var REVEAL_TRANSITION_MS = 850;
  var STATUS_TEXT = 'INITIALIZING SYSTEM ENGINE...';

  function navigationStartMs() {
    if (typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number') {
      return performance.timeOrigin;
    }
    if (performance && performance.timing && performance.timing.navigationStart) {
      return performance.timing.navigationStart;
    }
    return Date.now();
  }

  function ensurePreloader() {
    var existing = document.querySelector(ROOT_SELECTOR);
    if (existing) return existing;

    var root = document.createElement('div');
    root.className = 'system-preloader';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-busy', 'true');
    root.innerHTML =
      '<div class="preloader-content">' +
      '<div class="gradient-spinner-ring" aria-hidden="true"></div>' +
      '<div class="preloader-status-text">' +
      STATUS_TEXT +
      '</div>' +
      '</div>';

    var mount = document.body || document.documentElement;
    mount.insertBefore(root, mount.firstChild);
    return root;
  }

  function scheduleReveal(preloader, navStart) {
    if (preloader.dataset.ltfSystemEngineScheduled === '1') return;
    preloader.dataset.ltfSystemEngineScheduled = '1';

    var elapsed = Date.now() - navStart;
    var remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    window.setTimeout(function () {
      preloader.classList.add(REVEAL_CLASS);
      preloader.setAttribute('aria-busy', 'false');
      preloader.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove(BOOT_HTML_CLASS);

      window.setTimeout(function () {
        if (preloader.parentNode) {
          preloader.parentNode.removeChild(preloader);
        }
      }, REVEAL_TRANSITION_MS);
    }, remaining);
  }

  function init() {
    if (document.documentElement.dataset.ltfSystemEngineInit === '1') return;
    document.documentElement.dataset.ltfSystemEngineInit = '1';

    var navStart = navigationStartMs();
    var preloader = ensurePreloader();
    if (!preloader) return;

    document.documentElement.classList.add(BOOT_HTML_CLASS);

    function onReadyToDismiss() {
      scheduleReveal(preloader, navStart);
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      onReadyToDismiss();
    } else {
      document.addEventListener('DOMContentLoaded', onReadyToDismiss, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.LTFSystemEnginePreloader = {
    MIN_DISPLAY_MS: MIN_DISPLAY_MS,
    init: init,
  };
})();

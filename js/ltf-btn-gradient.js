/**
 * Lowtideflow — Nebula gradient button ring (hover + click pulse).
 * Apply .ltf-btn-gradient-wrap around .ltf-btn-primary / nav CTA links.
 */
(function () {
  'use strict';

  function init() {
    document.querySelectorAll('.ltf-btn-gradient-wrap').forEach(function (wrap) {
      if (wrap.dataset.ltfGradientInit) return;
      wrap.dataset.ltfGradientInit = '1';
      wrap.addEventListener('click', function () {
        wrap.classList.add('ltf-btn-gradient-active');
        clearTimeout(wrap._ltfGradientTimer);
        wrap._ltfGradientTimer = setTimeout(function () {
          wrap.classList.remove('ltf-btn-gradient-active');
        }, 1400);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
})();

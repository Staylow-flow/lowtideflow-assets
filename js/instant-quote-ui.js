/**
 * Instant Quote — UI bridge (no pricing logic)
 * Syncs slider values to Webflow text nodes. Calc/headless routing comes later.
 *
 * Load from: /instant-quote → Page Settings → Custom Code → Before </body>
 */
(function () {
  'use strict';

  function syncSliderValue(slider) {
    var targetId = slider.getAttribute('data-iq-value-target');
    if (!targetId) return;

    var target = document.getElementById(targetId);
    if (!target) return;

    target.textContent = slider.value;
    slider.setAttribute('aria-valuenow', slider.value);
  }

  function initSliders() {
    var sliders = document.querySelectorAll('.iq-range[data-iq-value-target]');
    sliders.forEach(function (slider) {
      syncSliderValue(slider);
      slider.addEventListener('input', function () {
        syncSliderValue(slider);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSliders);
  } else {
    initSliders();
  }
})();

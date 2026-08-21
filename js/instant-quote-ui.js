/**
 * Instant Quote — UI bridge (sliders, toggles, split animation, Run Quote)
 * Pricing: instant-quote-pricing-data.js + instant-quote-pricing.js (window.IQ.recalculate)
 */
(function () {
  'use strict';

  function recalculateQuote() {
    if (window.IQ && typeof window.IQ.recalculate === 'function') {
      window.IQ.recalculate();
    }
  }

  function formatInkDisplay(raw) {
    var n = Math.round(raw);
    return n >= 5 ? '5+' : String(n);
  }

  function syncSliderValue(slider) {
    var targetId = slider.getAttribute('data-iq-value-target');
    if (!targetId) return;

    var target = document.getElementById(targetId);
    if (!target) return;

    var step = parseFloat(slider.getAttribute('data-iq-step') || slider.step || '1');
    var raw = parseFloat(slider.value);
    var display;
    if (slider.id === 'iq-slider-ink-colors') {
      display = formatInkDisplay(raw);
    } else {
      display = step >= 1 ? String(Math.round(raw)) : String(Math.round(raw));
    }
    target.textContent = display;
    slider.setAttribute('aria-valuenow', display);
    recalculateQuote();
  }

  function snapValue(slider, raw) {
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var step = parseFloat(slider.getAttribute('data-iq-step') || slider.step);
    var snapped = min + Math.round((raw - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
  }

  function animateSliderTo(slider, target, done) {
    var start = parseFloat(slider.value);
    if (start === target) {
      slider.value = String(target);
      syncSliderValue(slider);
      if (done) done();
      return;
    }

    var duration = 180;
    var startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      var t = Math.min(1, (ts - startTime) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var current = start + (target - start) * eased;
      slider.value = String(current);
      syncSliderValue(slider);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        slider.value = String(target);
        syncSliderValue(slider);
        if (done) done();
      }
    }

    requestAnimationFrame(frame);
  }

  function initMagneticSlider(slider) {
    var step = parseFloat(slider.getAttribute('data-iq-step') || slider.step);
    var smoothStep = Math.max(step / 24, 0.01);
    var dragging = false;

    slider.addEventListener('pointerdown', function () {
      dragging = true;
      slider.step = String(smoothStep);
    });

    function finishDrag() {
      if (!dragging) return;
      dragging = false;
      slider.step = String(step);
      var target = snapValue(slider, parseFloat(slider.value));
      animateSliderTo(slider, target);
    }

    slider.addEventListener('pointerup', finishDrag);
    slider.addEventListener('pointercancel', finishDrag);
    slider.addEventListener('input', function () {
      syncSliderValue(slider);
    });
    slider.addEventListener('change', function () {
      slider.step = String(step);
      var target = snapValue(slider, parseFloat(slider.value));
      slider.value = String(target);
      syncSliderValue(slider);
    });

    syncSliderValue(slider);
  }

  function initSliders() {
    document.querySelectorAll('.iq-range[data-iq-value-target]').forEach(initMagneticSlider);
  }

  function setSplitVisible(isOn) {
    var splitRow = document.getElementById('split-row-wrapper');
    var unitCost2 = document.getElementById('iq-unit-cost-2');
    var unitCol = document.getElementById('iq-unit-price-col');
    if (!splitRow) return;

    if (isOn) {
      splitRow.classList.add('is-visible');
      splitRow.style.maxHeight = splitRow.scrollHeight + 'px';
      if (unitCost2) unitCost2.classList.add('is-visible');
      if (unitCol) unitCol.classList.add('is-split-visible');
      recalculateQuote();
      return;
    }

    splitRow.style.maxHeight = splitRow.scrollHeight + 'px';
    requestAnimationFrame(function () {
      splitRow.classList.remove('is-visible');
      splitRow.style.maxHeight = '0px';
      if (unitCost2) unitCost2.classList.remove('is-visible');
      if (unitCol) unitCol.classList.remove('is-split-visible');
      recalculateQuote();
    });
  }

  function initSplitToggle() {
    var toggle = document.getElementById('iq-split-toggle');
    if (!toggle) return;
    setSplitVisible(toggle.checked);
    toggle.addEventListener('change', function () {
      setSplitVisible(toggle.checked);
    });
  }

  function initQualityToggle() {
    var track = document.querySelector('.iq-toggle-track');
    if (!track) return;
    track.addEventListener('click', function (event) {
      var btn = event.target.closest('.iq-toggle-btn');
      if (!btn || !track.contains(btn)) return;
      event.preventDefault();
      track.querySelectorAll('.iq-toggle-btn').forEach(function (el) {
        el.classList.remove('is-active');
      });
      btn.classList.add('is-active');
      recalculateQuote();
    });
  }

  function initStyleRadios() {
    document
      .querySelectorAll('input[type="radio"][name^="style-row-"]')
      .forEach(function (radio) {
        radio.addEventListener('change', recalculateQuote);
      });
  }

  function initCustomArtToggle() {
    var toggle = document.getElementById('iq-custom-art-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', recalculateQuote);
  }

  function initRunQuoteButton() {
    var btn =
      document.getElementById('iq-run-quote') ||
      document.querySelector('.iq-run-quote');
    if (!btn) return;
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      if (window.IQ && typeof window.IQ.runQuote === 'function') {
        window.IQ.runQuote();
      } else {
        recalculateQuote();
      }
      btn.classList.add('is-running');
      window.setTimeout(function () {
        btn.classList.remove('is-running');
      }, 520);
    });
  }

  function init() {
    initSliders();
    initSplitToggle();
    initQualityToggle();
    initStyleRadios();
    initCustomArtToggle();
    initRunQuoteButton();
    recalculateQuote();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

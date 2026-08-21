/**
 * Instant Quote — UI bridge (sliders, toggles, split animation, Run Quote)
 * Pricing: instant-quote-pricing-data.js + instant-quote-pricing.js (window.IQ.recalculate)
 */
(function () {
  'use strict';

  var ORBIT_MS = 850;

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

  /** Upgrade live Designer embed from 4 → 5 print-location ticks (ink-colors pattern). */
  function upgradePrintLocationsSlider() {
    var slider = document.getElementById('iq-slider-print-locations');
    if (!slider) return;

    slider.min = '1';
    slider.max = '5';
    slider.setAttribute('aria-valuemin', '1');
    slider.setAttribute('aria-valuemax', '5');
    if (!slider.getAttribute('data-iq-step')) {
      slider.setAttribute('data-iq-step', '1');
    }

    var control = slider.closest('.iq-slider-control');
    var ticks = control && control.querySelector('.iq-slider-ticks');
    if (!ticks) return;

    ticks.setAttribute('data-tick-count', '5');
    var marks = ticks.querySelectorAll('.iq-slider-tick');
    while (marks.length < 5) {
      var tick = document.createElement('span');
      tick.className = 'iq-slider-tick';
      ticks.appendChild(tick);
      marks = ticks.querySelectorAll('.iq-slider-tick');
    }
  }

  /**
   * Upgrade live Designer embed: qty scale 0–500 (was 50–500).
   * Adds one tick for the new 0 option → 11 marks (symmetry).
   */
  function upgradeQuantitySlider() {
    var slider = document.getElementById('iq-slider-final-quantity');
    if (!slider) return;

    slider.min = '0';
    slider.max = '500';
    slider.step = '50';
    slider.setAttribute('data-iq-step', '50');
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', '500');

    var control = slider.closest('.iq-slider-control');
    var ticks = control && control.querySelector('.iq-slider-ticks');
    if (!ticks) return;

    ticks.setAttribute('data-tick-count', '11');
    var marks = ticks.querySelectorAll('.iq-slider-tick');
    while (marks.length < 11) {
      var tick = document.createElement('span');
      tick.className = 'iq-slider-tick';
      ticks.appendChild(tick);
      marks = ticks.querySelectorAll('.iq-slider-tick');
    }
  }

  /** Blank / first-paint: every left-side control at its minimum. */
  function applyBlankMinimums() {
    var qty = document.getElementById('iq-slider-final-quantity');
    if (qty) {
      qty.value = String(parseFloat(qty.min) || 0);
    }

    var ink = document.getElementById('iq-slider-ink-colors');
    if (ink) {
      ink.value = String(parseFloat(ink.min) || 1);
    }

    var locs = document.getElementById('iq-slider-print-locations');
    if (locs) {
      locs.value = String(parseFloat(locs.min) || 1);
    }

    var styleRadios = document.querySelectorAll('input[type="radio"][name="style-row-1"]');
    if (styleRadios.length) {
      styleRadios.forEach(function (radio, i) {
        radio.checked = i === 0;
      });
    }
  }

  function initSliders() {
    upgradePrintLocationsSlider();
    upgradeQuantitySlider();
    applyBlankMinimums();
    document.querySelectorAll('.iq-range[data-iq-value-target]').forEach(initMagneticSlider);
  }

  function alignSplitUnitPrice() {
    var splitRow = document.getElementById('split-row-wrapper');
    var styleRow2 = document.getElementById('iq-style-row-2');
    var unit2 = document.getElementById('iq-unit-cost-2');
    if (!splitRow || !styleRow2 || !unit2) return;

    if (!splitRow.classList.contains('is-visible')) {
      styleRow2.style.transform = '';
      unit2.style.transform = '';
      return;
    }

    styleRow2.style.transform = 'translateY(-40px)';

    requestAnimationFrame(function () {
      var styleRect = styleRow2.getBoundingClientRect();
      var unitRect = unit2.getBoundingClientRect();
      var delta = styleRect.top - unitRect.top;
      unit2.style.transform = 'translateY(' + delta + 'px)';
    });
  }

  function setSplitVisible(isOn) {
    var splitRow = document.getElementById('split-row-wrapper');
    var unitCost2 = document.getElementById('iq-unit-cost-2');
    var unitCol = document.getElementById('iq-unit-price-col');
    if (!splitRow) return;

    if (isOn) {
      splitRow.classList.add('is-visible');
      splitRow.style.maxHeight = splitRow.scrollHeight + 48 + 'px';
      if (unitCost2) unitCost2.classList.add('is-visible');
      if (unitCol) unitCol.classList.add('is-split-visible');
      recalculateQuote();
      window.setTimeout(alignSplitUnitPrice, 40);
      window.setTimeout(alignSplitUnitPrice, 420);
      return;
    }

    splitRow.style.maxHeight = splitRow.scrollHeight + 'px';
    requestAnimationFrame(function () {
      splitRow.classList.remove('is-visible');
      splitRow.style.maxHeight = '0px';
      if (unitCost2) unitCost2.classList.remove('is-visible');
      if (unitCol) unitCol.classList.remove('is-split-visible');
      alignSplitUnitPrice();
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
    window.addEventListener('resize', function () {
      if (toggle.checked) alignSplitUnitPrice();
    });
  }

  function setQualityActive(track, btn, animate) {
    var buttons = track.querySelectorAll('.iq-toggle-btn');
    var thumb = track.querySelector('.iq-toggle-thumb');
    var index = 0;
    buttons.forEach(function (el, i) {
      el.classList.toggle('is-active', el === btn);
      if (el === btn) index = i;
    });

    if (thumb) {
      if (!animate) track.classList.add('is-dragging');
      else track.classList.remove('is-dragging');
      thumb.style.transform = 'translateX(' + index * 100 + '%)';
      if (!animate) {
        requestAnimationFrame(function () {
          track.classList.remove('is-dragging');
        });
      }
    }
    recalculateQuote();
  }

  function ensureQualityThumb(track) {
    var thumb = track.querySelector('.iq-toggle-thumb');
    if (thumb) return thumb;
    thumb = document.createElement('span');
    thumb.className = 'iq-toggle-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    track.insertBefore(thumb, track.firstChild);
    return thumb;
  }

  function initQualityToggle() {
    var track = document.querySelector('.iq-toggle-track');
    if (!track) return;

    var buttons = Array.prototype.slice.call(track.querySelectorAll('.iq-toggle-btn'));
    if (buttons.length < 2) return;

    ensureQualityThumb(track);
    track.classList.add('iq-toggle-draggable');

    /* Blank state: leftmost (High-Quality), not Designer Premium default */
    var active = buttons[0];
    setQualityActive(track, active, false);

    var dragging = false;
    var pointerId = null;

    function pickFromClientX(clientX) {
      var rect = track.getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      return clientX < mid ? buttons[0] : buttons[1];
    }

    function onPointerMove(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      var rect = track.getBoundingClientRect();
      var pad = 4;
      var usable = Math.max(1, rect.width - pad * 2);
      var x = Math.min(1, Math.max(0, (event.clientX - rect.left - pad) / usable));
      var thumb = track.querySelector('.iq-toggle-thumb');
      if (thumb) {
        track.classList.add('is-dragging');
        thumb.style.transform = 'translateX(' + x * 100 + '%)';
      }
    }

    function finishDrag(event) {
      if (!dragging) return;
      if (event && pointerId != null && event.pointerId !== pointerId) return;
      dragging = false;
      try {
        if (pointerId != null) track.releasePointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      pointerId = null;
      var clientX = event && event.clientX != null ? event.clientX : null;
      var targetBtn;
      if (clientX != null) {
        targetBtn = pickFromClientX(clientX);
      } else {
        var thumb = track.querySelector('.iq-toggle-thumb');
        var tx = thumb ? thumb.style.transform : '';
        var match = /translateX\(([-\d.]+)%\)/.exec(tx);
        var pct = match ? parseFloat(match[1]) : 50;
        targetBtn = pct < 50 ? buttons[0] : buttons[1];
      }
      setQualityActive(track, targetBtn, true);
    }

    track.addEventListener('pointerdown', function (event) {
      if (event.button != null && event.button !== 0) return;
      dragging = true;
      pointerId = event.pointerId;
      try {
        track.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      onPointerMove(event);
      event.preventDefault();
    });

    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', finishDrag);
    track.addEventListener('pointercancel', finishDrag);

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        if (dragging) return;
        setQualityActive(track, btn, true);
      });
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

  function playOrbitClick(el) {
    if (!el) return;
    el.classList.remove('iq-orbit-click');
    void el.offsetWidth;
    el.classList.add('iq-orbit-click');
    window.setTimeout(function () {
      el.classList.remove('iq-orbit-click');
    }, ORBIT_MS);
  }

  function ensureOrbitWrap(btn) {
    if (!btn) return null;
    var wrap = btn.closest('.iq-orbit-wrap');
    if (wrap) return wrap;
    wrap = document.createElement('span');
    wrap.className = 'iq-orbit-wrap ltf-btn-gradient-wrap';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    return wrap;
  }

  function initRunQuoteButton() {
    var btn =
      document.getElementById('iq-run-quote') ||
      document.querySelector('.iq-run-quote');
    if (!btn) return;

    btn.classList.add('iq-orbit-btn');
    ensureOrbitWrap(btn);

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      playOrbitClick(btn);
      var wrap = btn.closest('.iq-orbit-wrap');
      if (wrap) {
        wrap.classList.add('ltf-btn-gradient-active', 'iq-orbit-click');
        window.setTimeout(function () {
          wrap.classList.remove('ltf-btn-gradient-active', 'iq-orbit-click');
        }, ORBIT_MS);
      }
      if (window.IQ && typeof window.IQ.runQuote === 'function') {
        window.IQ.runQuote();
      } else {
        recalculateQuote();
      }
      btn.classList.add('is-running');
      window.setTimeout(function () {
        btn.classList.remove('is-running');
      }, ORBIT_MS);
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

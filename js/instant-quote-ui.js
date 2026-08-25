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

  function placeSplitUnitPrice() {
    var unit2 = document.getElementById('iq-unit-cost-2');
    var splitRow = document.querySelector('#split-row-wrapper .iq-apparel-row--split');
    if (!unit2 || !splitRow) return;
    if (unit2.parentElement !== splitRow) {
      splitRow.appendChild(unit2);
    }
  }

  function setSplitVisible(isOn) {
    var splitRow = document.getElementById('split-row-wrapper');
    var unitCost2 = document.getElementById('iq-unit-cost-2');
    var unitCol = document.getElementById('iq-unit-price-col');
    if (!splitRow) return;

    placeSplitUnitPrice();

    if (isOn) {
      splitRow.classList.add('is-visible');
      splitRow.style.maxHeight = '';
      if (unitCost2) unitCost2.classList.add('is-visible');
      if (unitCol) unitCol.classList.add('is-split-visible');
      recalculateQuote();
      applyMobileApparelLayout();
      return;
    }

    splitRow.classList.remove('is-visible');
    splitRow.style.maxHeight = '';
    if (unitCost2) unitCost2.classList.remove('is-visible');
    if (unitCol) unitCol.classList.remove('is-split-visible');
    recalculateQuote();
    applyMobileApparelLayout();
  }

  function initSplitToggle() {
    var toggle = document.getElementById('iq-split-toggle');
    placeSplitUnitPrice();
    if (!toggle) return;
    setSplitVisible(toggle.checked);
    toggle.addEventListener('change', function () {
      setSplitVisible(toggle.checked);
    });
  }

  function setQualityActive(track, btn, animate) {
    var buttons = track.querySelectorAll('.iq-toggle-btn');
    var thumb = track.querySelector('.iq-toggle-thumb');
    var index = 0;
    var vertical = track.classList.contains('iq-toggle-vertical');
    buttons.forEach(function (el, i) {
      el.classList.toggle('is-active', el === btn);
      if (el === btn) index = i;
    });

    if (thumb) {
      if (!animate) track.classList.add('is-dragging');
      else track.classList.remove('is-dragging');
      if (vertical) {
        thumb.style.transform = 'translateY(' + index * 100 + '%)';
      } else {
        thumb.style.transform = 'translateX(' + index * 100 + '%)';
      }
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

  function syncQualityToggleOrientation() {
    var track = document.querySelector('.iq-toggle-track');
    if (!track) return;
    track.classList.toggle('iq-toggle-vertical', isMobileIq());
    var active = track.querySelector('.iq-toggle-btn.is-active') || track.querySelector('.iq-toggle-btn');
    if (active) setQualityActive(track, active, false);
  }

  function initQualityToggle() {
    var track = document.querySelector('.iq-toggle-track');
    if (!track) return;

    var buttons = Array.prototype.slice.call(track.querySelectorAll('.iq-toggle-btn'));
    if (buttons.length < 2) return;

    ensureQualityThumb(track);
    track.classList.add('iq-toggle-draggable');
    syncQualityToggleOrientation();

    /* Blank state: leftmost (High-Quality), not Designer Premium default */
    var active = buttons[0];
    setQualityActive(track, active, false);

    var dragging = false;
    var pointerId = null;
    var vertical = function () {
      return track.classList.contains('iq-toggle-vertical');
    };

    function pickFromPointer(clientX, clientY) {
      var rect = track.getBoundingClientRect();
      if (vertical()) {
        var midY = rect.top + rect.height / 2;
        return clientY < midY ? buttons[0] : buttons[1];
      }
      var midX = rect.left + rect.width / 2;
      return clientX < midX ? buttons[0] : buttons[1];
    }

    function onPointerMove(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      var rect = track.getBoundingClientRect();
      var pad = 4;
      var thumb = track.querySelector('.iq-toggle-thumb');
      if (!thumb) return;
      track.classList.add('is-dragging');
      if (vertical()) {
        var usableY = Math.max(1, rect.height - pad * 2);
        var y = Math.min(1, Math.max(0, (event.clientY - rect.top - pad) / usableY));
        thumb.style.transform = 'translateY(' + y * 100 + '%)';
      } else {
        var usableX = Math.max(1, rect.width - pad * 2);
        var x = Math.min(1, Math.max(0, (event.clientX - rect.left - pad) / usableX));
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
      var clientY = event && event.clientY != null ? event.clientY : null;
      var targetBtn;
      if (clientX != null && clientY != null) {
        targetBtn = pickFromPointer(clientX, clientY);
      } else {
        var thumb = track.querySelector('.iq-toggle-thumb');
        var tx = thumb ? thumb.style.transform : '';
        var match = vertical()
          ? /translateY\(([-\d.]+)%\)/.exec(tx)
          : /translateX\(([-\d.]+)%\)/.exec(tx);
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

    window.matchMedia(MOBILE_MQ).addEventListener('change', syncQualityToggleOrientation);
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

  /* ── Mobile layout only (≤991px): real notched sliders stay native ── */

  var MOBILE_MQ = '(max-width: 991px)';
  var mobileLayoutAnchors = null;

  function isMobileIq() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function rememberMobileAnchor(node) {
    if (!node || node.dataset.iqMobileHome === '1') return;
    node.dataset.iqMobileHome = '1';
  }

  function restoreMobileApparelLayout() {
    if (!mobileLayoutAnchors) return;
    ['split', 'unit1'].forEach(function (key) {
      var entry = mobileLayoutAnchors[key];
      if (!entry || !entry.node || !entry.parent) return;
      if (entry.next && entry.next.parentNode === entry.parent) {
        entry.parent.insertBefore(entry.node, entry.next);
      } else {
        entry.parent.appendChild(entry.node);
      }
      entry.node.classList.remove('iq-split-mobile-below', 'iq-unit-cost-mobile');
    });
    mobileLayoutAnchors = null;
  }

  function applyMobileApparelLayout() {
    if (!isMobileIq()) {
      restoreMobileApparelLayout();
      return;
    }

    var splitWrap = document.querySelector('.iq-split-checkbox-wrapper');
    var styleRow1 = document.getElementById('iq-style-row-1');
    var unit1 = document.getElementById('iq-unit-cost-1');
    var apparelRow1 = styleRow1 && styleRow1.closest('.iq-apparel-row');

    if (!mobileLayoutAnchors) {
      mobileLayoutAnchors = {};
      if (splitWrap) {
        rememberMobileAnchor(splitWrap);
        mobileLayoutAnchors.split = {
          node: splitWrap,
          parent: splitWrap.parentNode,
          next: splitWrap.nextSibling
        };
      }
      if (unit1) {
        rememberMobileAnchor(unit1);
        mobileLayoutAnchors.unit1 = {
          node: unit1,
          parent: unit1.parentNode,
          next: unit1.nextSibling
        };
      }
    }

    if (splitWrap && styleRow1 && splitWrap.previousElementSibling !== styleRow1) {
      styleRow1.insertAdjacentElement('afterend', splitWrap);
      splitWrap.classList.add('iq-split-mobile-below');
    }

    if (unit1 && apparelRow1) {
      var anchor =
        splitWrap && splitWrap.parentElement === apparelRow1 ? splitWrap : styleRow1;
      if (anchor) {
        anchor.insertAdjacentElement('afterend', unit1);
        unit1.classList.add('iq-unit-cost-mobile');
      }
    }
  }

  /** Tall / short / tall notch rhythm for tactile tick marks. */
  function styleSliderTicks() {
    document.querySelectorAll('.iq-slider-ticks').forEach(function (ticks) {
      var marks = ticks.querySelectorAll('.iq-slider-tick');
      marks.forEach(function (tick, i) {
        tick.classList.remove('is-tall', 'is-mid', 'is-short');
        if (i === 0 || i === marks.length - 1 || i % 2 === 0) {
          tick.classList.add('is-tall');
        } else {
          tick.classList.add('is-short');
        }
      });
    });
  }

  function initMobileLayout() {
    /* Strip any leftover hold-scroll triggers from older pins */
    document.querySelectorAll('.iq-mobile-picker-trigger').forEach(function (el) {
      el.parentNode && el.parentNode.removeChild(el);
    });

    styleSliderTicks();
    applyMobileApparelLayout();

    window.matchMedia(MOBILE_MQ).addEventListener('change', function () {
      applyMobileApparelLayout();
      syncQualityToggleOrientation();
    });
  }

  function init() {
    initSliders();
    styleSliderTicks();
    initSplitToggle();
    initQualityToggle();
    initStyleRadios();
    initCustomArtToggle();
    initRunQuoteButton();
    initMobileLayout();
    recalculateQuote();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

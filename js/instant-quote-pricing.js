/**
 * Instant Quote — quote engine (execution stack per spec)
 * Depends on: instant-quote-pricing-data.js
 */
(function (global) {
  'use strict';

  global.IQ = global.IQ || {};

  /** DOM style keys → garmentPrices keys */
  var STYLE_TO_GARMENT = {
    tshirts: 'tshirt',
    longsleeves: 'longsleeve',
    polos: 'polo',
    crewnecks: 'crewneck',
    hoodies: 'hoodie',
    windbreakers: 'windbreaker',
    hats: 'hat',
    quarterzips: 'polo'
  };

  var STYLE_KEYS = Object.keys(STYLE_TO_GARMENT);
  var TOTAL_ANIM_MS = 500;
  var totalAnimFrame = null;
  var displayedTotal = null;

  function parseStyleKey(inputId) {
    if (!inputId) return 'tshirts';
    var match = inputId.match(/iq-style-r\d-(.+)$/);
    return match && STYLE_KEYS.indexOf(match[1]) >= 0 ? match[1] : 'tshirts';
  }

  function readSliderValue(id, fallback) {
    var slider = document.getElementById(id);
    if (!slider) return fallback;
    return parseFloat(slider.value);
  }

  function readQuality() {
    var active = document.querySelector('.iq-toggle-track .iq-toggle-btn.is-active');
    if (!active) return 'premium';
    var label = (active.textContent || '').toLowerCase();
    return label.indexOf('high') >= 0 ? 'hq' : 'premium';
  }

  function readSelectedStyle(row) {
    var selected = document.querySelector('input[name="style-row-' + row + '"]:checked');
    return parseStyleKey(selected && selected.id);
  }

  function readSplit() {
    var toggle = document.getElementById('iq-split-toggle');
    return !!(toggle && toggle.checked);
  }

  function readCustomArt() {
    var toggle = document.getElementById('iq-custom-art-toggle');
    return !!(toggle && toggle.checked);
  }

  /** Ink slider tick 5 = Full Color (5+) */
  function isFullColorInk(inkColors) {
    return inkColors >= 5;
  }

  function getState() {
    var inkColors = readSliderValue('iq-slider-ink-colors', 1);
    return {
      quality: readQuality(),
      inkColors: inkColors,
      fullColor: isFullColorInk(inkColors),
      printLocations: Math.min(5, Math.max(1, readSliderValue('iq-slider-print-locations', 1))),
      quantity: readSliderValue('iq-slider-final-quantity', 0),
      split: readSplit(),
      customArt: readCustomArt(),
      styleRow1: readSelectedStyle(1),
      styleRow2: readSelectedStyle(2)
    };
  }

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function getPrintBracket(totalQty, printMatrix) {
    for (var i = 0; i < printMatrix.length; i += 1) {
      if (totalQty <= printMatrix[i].maxQty) return printMatrix[i];
    }
    return printMatrix[printMatrix.length - 1];
  }

  function garmentCost(styleDomKey, qualityTier, data) {
    var garmentKey = STYLE_TO_GARMENT[styleDomKey] || 'tshirt';
    var row = data.garmentPrices[garmentKey];
    if (!row) return 0;
    return row[qualityTier] != null ? row[qualityTier] : row.premium;
  }

  /**
   * Spot colors 1–4: classic screen math.
   * Tick 5 (Full Color): CMYK/sim-process/DTF — 4 screens per location + multipliers.
   */
  function sharedPrintEconomics(state, data) {
    var bracket = getPrintBracket(state.quantity, data.printMatrix);
    var printLocations = state.printLocations;
    var fc = data.fullColor || {};
    var inkColors;
    var totalScreens;
    var loc1Cost;
    var otherLocsCost;

    if (state.fullColor) {
      var screensPerLoc = fc.screensPerLocation != null ? fc.screensPerLocation : 4;
      var loc1Mult = fc.loc1Multiplier != null ? fc.loc1Multiplier : 1.85;
      var locOtherMult = fc.locOtherMultiplier != null ? fc.locOtherMultiplier : 1.65;
      inkColors = 5;
      totalScreens = screensPerLoc * printLocations;
      loc1Cost = bracket.loc1Base * loc1Mult;
      otherLocsCost = (printLocations - 1) * bracket.locOtherBase * locOtherMult;
    } else {
      inkColors = state.inkColors;
      totalScreens = inkColors + (printLocations - 1);
      loc1Cost = bracket.loc1Base + (inkColors - 1) * bracket.extraInk;
      otherLocsCost = (printLocations - 1) * bracket.locOtherBase;
    }

    var printRunCogs = loc1Cost + otherLocsCost;
    var totalSetupCost = totalScreens * data.screenSetupFeePerScreen;
    var qty = state.quantity > 0 ? state.quantity : 0;
    var screenFeePerUnit = qty > 0 ? totalSetupCost / qty : 0;

    return {
      bracket: bracket,
      fullColor: !!state.fullColor,
      inkColors: inkColors,
      totalScreens: totalScreens,
      totalSetupCost: totalSetupCost,
      printRunCogs: printRunCogs,
      screenFeePerUnit: screenFeePerUnit
    };
  }

  function finalUnitPrice(styleDomKey, qualityTier, economics, data) {
    var garment = garmentCost(styleDomKey, qualityTier, data);
    var markedUpProduction =
      (garment + economics.printRunCogs) * data.agencyMarkupMultiplier;
    return markedUpProduction + economics.screenFeePerUnit;
  }

  /**
   * Execution stack: bracket → setup → print COGS → unit prices → invoice total.
   */
  function calculateQuote(state, data) {
    var qty1 = state.split ? state.quantity / 2 : state.quantity;
    var qty2 = state.split ? state.quantity / 2 : 0;

    /* Blank / qty 0: show $0 until a real production run size is chosen */
    if (!state.quantity || state.quantity <= 0) {
      return {
        unit1: 0,
        unit2: state.split ? 0 : null,
        total: 0,
        qty1: 0,
        qty2: 0,
        economics: null
      };
    }

    var economics = sharedPrintEconomics(state, data);

    var rawUnit1 = finalUnitPrice(state.styleRow1, state.quality, economics, data);
    var unit1 = roundMoney(rawUnit1);

    var rawUnit2 = null;
    var unit2 = null;
    if (state.split) {
      rawUnit2 = finalUnitPrice(state.styleRow2, state.quality, economics, data);
      unit2 = roundMoney(rawUnit2);
    }

    var baseTotal = state.split
      ? unit1 * qty1 + unit2 * qty2
      : unit1 * state.quantity;

    if (state.customArt) {
      baseTotal += data.customArtFee;
    }

    return {
      unit1: unit1,
      unit2: unit2,
      total: roundMoney(baseTotal),
      qty1: qty1,
      qty2: qty2,
      economics: economics
    };
  }

  function formatMoney(value) {
    return (
      '$' +
      value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  function parseDisplayedTotal(node) {
    if (!node) return null;
    var raw = (node.textContent || '').replace(/[^0-9.-]/g, '');
    var n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }

  function animateTotalTo(target, fromZero) {
    var node = document.getElementById('iq-total-price');
    if (!node) return;

    if (totalAnimFrame) {
      cancelAnimationFrame(totalAnimFrame);
      totalAnimFrame = null;
    }

    var start =
      fromZero || displayedTotal == null
        ? 0
        : displayedTotal;
    if (!fromZero && displayedTotal == null) {
      var parsed = parseDisplayedTotal(node);
      start = parsed != null ? parsed : 0;
    }

    var delta = target - start;
    if (Math.abs(delta) < 0.005) {
      displayedTotal = target;
      node.textContent = formatMoney(target);
      return;
    }

    var startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      var t = Math.min(1, (ts - startTime) / TOTAL_ANIM_MS);
      var eased = 1 - Math.pow(1 - t, 3);
      var current = roundMoney(start + delta * eased);
      displayedTotal = current;
      node.textContent = formatMoney(current);
      if (t < 1) {
        totalAnimFrame = requestAnimationFrame(frame);
      } else {
        totalAnimFrame = null;
        displayedTotal = target;
        node.textContent = formatMoney(target);
      }
    }

    totalAnimFrame = requestAnimationFrame(frame);
  }

  function applyQuote(result, options) {
    options = options || {};
    setText('iq-price-unit-1', formatMoney(result.unit1));
    if (result.unit2 != null) {
      setText('iq-price-unit-2', formatMoney(result.unit2));
    }

    /* Total stays static until Calculate — unit prices may still live-update. */
    if (options.updateTotal) {
      if (options.skipTotalAnim) {
        displayedTotal = result.total;
        setText('iq-total-price', formatMoney(result.total));
      } else {
        animateTotalTo(result.total, !!options.fromZero);
      }
    }

    if (typeof global.IQ.syncQuoteForm === 'function') {
      global.IQ.syncQuoteForm();
    }
    if (typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('iq:quote-updated', { detail: result }));
    }
  }

  function recalculate(options) {
    var data = global.IQ.PRICING_DATA;
    if (!data) return null;
    var state = getState();
    var result = calculateQuote(state, data);
    applyQuote(result, options);
    return { state: state, result: result };
  }

  /** Explicit "Calculate Production Run" — animate total (from $0 on first calc). */
  function runQuote() {
    return recalculate({ fromZero: true, updateTotal: true });
  }

  global.IQ.getState = getState;
  global.IQ.calculateQuote = calculateQuote;
  global.IQ.applyQuote = applyQuote;
  global.IQ.recalculate = recalculate;
  global.IQ.runQuote = runQuote;
  global.IQ.formatMoney = formatMoney;
  global.IQ.isFullColorInk = isFullColorInk;
})(typeof window !== 'undefined' ? window : globalThis);

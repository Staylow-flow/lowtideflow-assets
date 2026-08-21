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

  function getState() {
    return {
      quality: readQuality(),
      inkColors: readSliderValue('iq-slider-ink-colors', 4),
      printLocations: readSliderValue('iq-slider-print-locations', 4),
      quantity: readSliderValue('iq-slider-final-quantity', 500),
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
   * Steps 1–4 shared print economics (same ink/locations for the order).
   */
  function sharedPrintEconomics(state, data) {
    var bracket = getPrintBracket(state.quantity, data.printMatrix);
    var inkColors = state.inkColors;
    var printLocations = state.printLocations;

    var totalScreens = inkColors + (printLocations - 1);
    var totalSetupCost = totalScreens * data.screenSetupFeePerScreen;

    var loc1Cost = bracket.loc1Base + (inkColors - 1) * bracket.extraInk;
    var otherLocsCost = (printLocations - 1) * bracket.locOtherBase;
    var printRunCogs = loc1Cost + otherLocsCost;

    var screenFeePerUnit = totalSetupCost / state.quantity;

    return {
      bracket: bracket,
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

  function applyQuote(result) {
    setText('iq-price-unit-1', formatMoney(result.unit1));
    if (result.unit2 != null) {
      setText('iq-price-unit-2', formatMoney(result.unit2));
    }
    setText('iq-total-price', formatMoney(result.total));

    if (typeof global.IQ.syncQuoteForm === 'function') {
      global.IQ.syncQuoteForm();
    }
    if (typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('iq:quote-updated', { detail: result }));
    }
  }

  function recalculate() {
    var data = global.IQ.PRICING_DATA;
    if (!data) return null;
    var state = getState();
    var result = calculateQuote(state, data);
    applyQuote(result);
    return { state: state, result: result };
  }

  global.IQ.getState = getState;
  global.IQ.calculateQuote = calculateQuote;
  global.IQ.applyQuote = applyQuote;
  global.IQ.recalculate = recalculate;
  global.IQ.formatMoney = formatMoney;
})(typeof window !== 'undefined' ? window : globalThis);

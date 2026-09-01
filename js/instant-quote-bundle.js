/*!
 * LTF Instant Quote — SINGLE-FILE BUNDLE (generated, do not edit by hand).
 * Concatenation order: pricing-data -> pricing -> form -> ui.
 * Edit the individual source files in /js and re-bundle; this file is the deploy artifact.
 */
/**
 * Instant Quote — pricing tables (edit here when rates change)
 */
(function (global) {
  'use strict';

  global.IQ = global.IQ || {};

  global.IQ.PRICING_DATA = {
    version: '2.0.0',

    garmentPrices: {
      tshirt: { hq: 5.0, premium: 10.0 },
      longsleeve: { hq: 10.0, premium: 15.0 },
      polo: { hq: 15.0, premium: 22.0 },
      crewneck: { hq: 15.0, premium: 22.0 },
      hoodie: { hq: 20.0, premium: 30.0 },
      windbreaker: { hq: 30.0, premium: 42.0 },
      hat: { hq: 10.0, premium: 15.0 }
    },

    /** Sorted ascending by maxQty — first matching bracket wins */
    printMatrix: [
      { maxQty: 99, loc1Base: 6.25, locOtherBase: 2.5, extraInk: 1.25 },
      { maxQty: 149, loc1Base: 5.3, locOtherBase: 2.2, extraInk: 1.05 },
      { maxQty: 199, loc1Base: 4.7, locOtherBase: 1.9, extraInk: 0.95 },
      { maxQty: 249, loc1Base: 4.05, locOtherBase: 1.7, extraInk: 0.8 },
      { maxQty: 449, loc1Base: 3.45, locOtherBase: 1.5, extraInk: 0.7 },
      { maxQty: 999, loc1Base: 2.5, locOtherBase: 1.25, extraInk: 0.5 }
    ],

    /**
     * Tick 5 on Ink Colors = 5+ / Full Color
     * (Simulated Process / DTF / CMYK) — not spot-color screen math.
     */
    fullColor: {
      screensPerLocation: 4,
      /** Multiplier on 4-color spot loc1Base for process/DTF/CMYK loc1 */
      loc1Multiplier: 1.85,
      /** Multiplier on locOtherBase for additional full-color locations */
      locOtherMultiplier: 1.65
    },

    screenSetupFeePerScreen: 25.0,
    agencyMarkupMultiplier: 1.25,
    customArtFee: 250.0
  };
})(typeof window !== 'undefined' ? window : globalThis);

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

/**
 * Instant Quote — order form → Google Apps Script / Sheets
 * Depends on: instant-quote-pricing.js (window.IQ.getState / recalculate)
 */
(function (global) {
  'use strict';

  global.IQ = global.IQ || {};

  global.IQ.FORM_CONFIG = {
    webhookUrl:
      'https://script.google.com/macros/s/AKfycbzapmVFFViHwkV8CEk_UQSoQ-ERJzGArgvD5cfOpvUzT5iEtq3xAGq5foavIfiuL9M/exec',
    minSubmitMs: 2500,
    successMessage:
      'Project brief received. We will review your quote configuration and reach out shortly.',
    loadingText: 'Submitting…'
  };

  var STYLE_LABELS = {
    tshirts: 'T-Shirts',
    longsleeves: 'Long Sleeves',
    polos: 'Polos',
    crewnecks: 'Crew Necks',
    hoodies: 'Hoodies',
    windbreakers: 'Wind Breakers',
    hats: 'Hats',
    quarterzips: '1/4 Zips'
  };

  /** Curated fast-path corrections (exact bad domain → good domain). */
  var EMAIL_TYPOS = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmail.cm': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'yahoo.con': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com',
    'outlook.co': 'outlook.com',
    'outlook.con': 'outlook.com',
    'iclould.com': 'icloud.com',
    'icloud.co': 'icloud.com'
  };

  /**
   * Popular consumer email domains. An address is only flagged as a possible
   * typo when its domain is a *near miss* of one of these (shares the first two
   * letters and is 1–2 edits away). Clearly custom domains — e.g.
   * "you@construction.com" — never match and are left alone.
   */
  var POPULAR_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'live.com',
    'msn.com',
    'comcast.net',
    'me.com',
    'ymail.com',
    'proton.me',
    'protonmail.com',
    'gmx.com'
  ];

  var pageLoadedAt = Date.now();

  function styleLabel(key) {
    return STYLE_LABELS[key] || key;
  }

  function qualityLabel(tier) {
    return tier === 'hq' ? 'High-Quality' : 'Premium-Quality';
  }

  function setHidden(id, value) {
    var node = document.getElementById(id);
    if (node) node.value = value;
  }

  function val(id) {
    var node = document.getElementById(id);
    return node ? String(node.value || '').trim() : '';
  }

  function getQuoteSnapshot() {
    if (!global.IQ.getState || !global.IQ.calculateQuote || !global.IQ.PRICING_DATA) {
      return null;
    }
    var state = global.IQ.getState();
    var result = global.IQ.calculateQuote(state, global.IQ.PRICING_DATA);
    return { state: state, result: result };
  }

  function buildStylesSummary(state) {
    if (state.split) {
      return (
        styleLabel(state.styleRow1) +
        ' + ' +
        styleLabel(state.styleRow2) +
        ' (50/50 Split)'
      );
    }
    return styleLabel(state.styleRow1);
  }

  function readArtworkFileNames() {
    var input = document.getElementById('iq-form-artwork-file');
    if (!input || !input.files) return [];
    return Array.prototype.map.call(input.files, function (file) {
      return file.name;
    });
  }

  /* Artwork transfer limits (Apps Script POST bodies cap around ~50 MB). */
  var ART_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file
  var ART_MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB per submission

  /**
   * Read one File as base64 (no data-URL prefix) so it can ride inside the JSON
   * payload. Apps Script doPost cannot reliably parse raw multipart binaries, so
   * we hand it a base64 string it can decode with Utilities.base64Decode.
   */
  function readFileAsBase64(file) {
    return new Promise(function (resolve) {
      try {
        var reader = new FileReader();
        reader.onload = function () {
          var result = String(reader.result || '');
          var comma = result.indexOf(',');
          resolve({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: comma >= 0 ? result.slice(comma + 1) : result
          });
        };
        reader.onerror = function () {
          resolve(null);
        };
        reader.readAsDataURL(file);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Encode every selected artwork file to base64, skipping anything that would
   * blow past the per-file / per-submission limits. Resolves to
   * { files: [...], skipped: [names], oversized: bool }.
   */
  function readArtworkFilesBase64() {
    var input = document.getElementById('iq-form-artwork-file');
    if (!input || !input.files || !input.files.length) {
      return Promise.resolve({ files: [], skipped: [], oversized: false });
    }

    var all = Array.prototype.slice.call(input.files);
    var skipped = [];
    var keep = all.filter(function (file) {
      if (file.size > ART_MAX_FILE_BYTES) {
        skipped.push(file.name);
        return false;
      }
      return true;
    });

    return Promise.all(keep.map(readFileAsBase64)).then(function (encoded) {
      var files = [];
      var total = 0;
      var oversized = false;
      encoded.forEach(function (entry) {
        if (!entry || !entry.data) return;
        total += entry.data.length;
        if (total > ART_MAX_TOTAL_BYTES) {
          oversized = true;
          skipped.push(entry.name);
          return;
        }
        files.push(entry);
      });
      return { files: files, skipped: skipped, oversized: oversized };
    });
  }

  /** Flat payload keys expected by Apps Script row writer (p.*). */
  function buildSheetPayload(state, result) {
    var splitQty = state.split ? Math.round(state.quantity / 2) : '';
    var quotedEstimate =
      result && result.total != null
        ? result.total
        : '';
    return {
      client_name: val('iq-form-full-name'),
      company_name: val('iq-form-company'),
      email: val('iq-form-email'),
      phone: val('iq-form-phone'),
      quoted_estimate: quotedEstimate,
      project_notes: val('iq-form-notes'),
      apparel_style: styleLabel(state.styleRow1) + ' · ' + qualityLabel(state.quality),
      ink_colors: state.fullColor ? '5+' : state.inkColors,
      print_mode: state.fullColor ? 'full_color' : 'spot_color',
      print_locations: state.printLocations,
      final_quantity: state.quantity,
      split_apparel_style: state.split ? styleLabel(state.styleRow2) : '',
      split_ink_colors: state.split ? (state.fullColor ? '5+' : state.inkColors) : '',
      split_print_locations: state.split ? state.printLocations : '',
      split_final_quantity: splitQty,
      art_url: '',
      art_file_names: readArtworkFileNames(),
      timeline: '',
      quality: qualityLabel(state.quality),
      unit_price_1: result.unit1,
      unit_price_2: result.unit2,
      total_estimate: result.total,
      custom_art: !!state.customArt,
      submitted_at: new Date().toISOString()
    };
  }

  function buildQuotePayload(state, result) {
    return {
      submittedAt: new Date().toISOString(),
      contact: {
        fullName: val('iq-form-full-name'),
        companyName: val('iq-form-company'),
        email: val('iq-form-email'),
        phone: val('iq-form-phone')
      },
      quote: {
        quality: qualityLabel(state.quality),
        inkColors: state.fullColor ? '5+' : state.inkColors,
        printMode: state.fullColor ? 'full_color' : 'spot_color',
        printLocations: state.printLocations,
        quantity: state.quantity,
        split: state.split,
        styleRow1: styleLabel(state.styleRow1),
        styleRow2: state.split ? styleLabel(state.styleRow2) : null,
        unitPrice1: result.unit1,
        unitPrice2: result.unit2,
        totalEstimate: result.total,
        customArt: state.customArt
      },
      projectNotes: val('iq-form-notes'),
      artworkFileNames: readArtworkFileNames(),
      sheet: buildSheetPayload(state, result)
    };
  }

  function syncQuoteFields() {
    var snapshot = getQuoteSnapshot();
    if (!snapshot) return;

    var state = snapshot.state;
    var result = snapshot.result;
    var format = global.IQ.formatMoney || function (v) {
      return '$' + v;
    };

    setHidden('iq-form-quote-quantity', String(state.quantity));
    setHidden('iq-form-quote-styles', buildStylesSummary(state));
    setHidden('iq-form-quote-quality', qualityLabel(state.quality));
    setHidden('iq-form-quote-ink', state.fullColor ? '5+' : String(state.inkColors));
    setHidden('iq-form-quote-locations', String(state.printLocations));
    setHidden('iq-form-quote-total', format(result.total));

    var hidden = document.getElementById('iq-form-hidden-payload');
    if (hidden) {
      hidden.value = JSON.stringify(buildQuotePayload(state, result));
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderArtworkFileList() {
    var input = document.getElementById('iq-form-artwork-file');
    var list = document.getElementById('iq-form-artwork-list');
    if (!input || !list) return;

    if (!input.files || !input.files.length) {
      list.hidden = true;
      list.innerHTML = '';
      return;
    }

    list.hidden = false;
    list.innerHTML = '';
    Array.prototype.forEach.call(input.files, function (file) {
      var item = document.createElement('li');
      item.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
      list.appendChild(item);
    });
  }

  function initArtworkUpload() {
    var drop = document.getElementById('iq-form-artwork-drop');
    var input = document.getElementById('iq-form-artwork-file');
    var browse = document.getElementById('iq-form-artwork-browse');
    if (!drop || !input) return;

    if (browse) {
      browse.addEventListener('click', function (event) {
        event.preventDefault();
        input.click();
      });
    }

    drop.addEventListener('click', function (event) {
      if (event.target === browse || (browse && browse.contains(event.target))) return;
      input.click();
    });

    input.addEventListener('change', renderArtworkFileList);

    ['dragenter', 'dragover'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.remove('is-dragover');
      });
    });

    drop.addEventListener('drop', function (event) {
      if (event.dataTransfer && event.dataTransfer.files) {
        input.files = event.dataTransfer.files;
        renderArtworkFileList();
      }
    });
  }

  var ORBIT_MS = 850;

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
    wrap.className = 'iq-orbit-wrap ltf-btn-gradient-wrap iq-form-cta-wrap';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    return wrap;
  }

  function findFieldLabel(input) {
    if (!input) return null;
    var prev = input.previousElementSibling;
    while (prev) {
      if (prev.id === 'iq-email-typo-flag' || prev.id === 'suite-number') {
        prev = prev.previousElementSibling;
        continue;
      }
      if (
        prev.tagName === 'LABEL' ||
        (prev.classList &&
          (prev.classList.contains('w-form-label') || prev.classList.contains('iq-form-label')))
      ) {
        return prev;
      }
      break;
    }
    return null;
  }

  /** Match contact fields to label-above-input 2×2; never wrap phone beside its label. */
  function fixFormFieldLayout(form) {
    if (!form || form.classList.contains('iq-form-layout-ready')) return;

    /* Undo any prior horizontal phone-row wrap so Phone matches Client / Company / Email. */
    var stalePhoneRow = form.querySelector('.iq-form-phone-row');
    if (stalePhoneRow) {
      while (stalePhoneRow.firstChild) {
        stalePhoneRow.parentNode.insertBefore(stalePhoneRow.firstChild, stalePhoneRow);
      }
      stalePhoneRow.remove();
    }

    var fieldMap = [
      { id: 'iq-form-full-name', labelClass: 'iq-field-label--name' },
      { id: 'iq-form-company', labelClass: 'iq-field-label--company' },
      { id: 'iq-form-email', labelClass: 'iq-field-label--email' },
      { id: 'iq-form-phone', labelClass: 'iq-field-label--phone' }
    ];
    fieldMap.forEach(function (entry) {
      var input = document.getElementById(entry.id);
      if (!input) return;
      input.style.display = 'block';
      input.style.width = '100%';
      input.style.maxWidth = 'none';
      input.style.boxSizing = 'border-box';
      var label = findFieldLabel(input);
      if (label) {
        label.classList.add(entry.labelClass);
        label.style.display = 'block';
        label.style.width = '100%';
        label.style.whiteSpace = 'normal';
      }
    });

    var nameInput = document.getElementById('iq-form-full-name');
    if (nameInput) {
      var nameLabel = findFieldLabel(nameInput);
      if (nameLabel) {
        var raw = String(nameLabel.textContent || '');
        if (/Full\s*Name/i.test(raw)) {
          nameLabel.textContent = raw.replace(/Full\s*Name/i, 'Client Name');
        } else if (!/Client Name/i.test(raw)) {
          nameLabel.textContent = /Required|\*/.test(raw) ? 'Client Name *' : 'Client Name';
        }
      }
    }
    form.querySelectorAll('.iq-form-label').forEach(function (span) {
      if (/Full\s*Name/i.test(span.textContent || '')) {
        span.innerHTML = String(span.innerHTML || '').replace(/Full\s*Name/i, 'Client Name');
      }
    });

    var notes = document.getElementById('iq-form-notes');
    var submit = document.getElementById('iq-form-submit');
    if (notes) {
      var notesLabel = findFieldLabel(notes);
      if (notesLabel) {
        notesLabel.classList.add('iq-form-notes-label');
      }
      if (submit) {
        /* insertBefore needs a reference node that is a direct child of form.
           Climb from the submit button to whichever ancestor sits directly
           under the form so nested CTA wrappers can't throw NotFoundError. */
        var submitAnchor = submit.closest('.iq-orbit-wrap') || submit;
        while (submitAnchor && submitAnchor.parentNode && submitAnchor.parentNode !== form) {
          submitAnchor = submitAnchor.parentNode;
        }
        if (submitAnchor && submitAnchor.parentNode === form) {
          if (notesLabel && notesLabel.parentNode === form) {
            form.insertBefore(notesLabel, submitAnchor);
          }
          if (notes.parentNode === form) {
            form.insertBefore(notes, submitAnchor);
          }
        }
      }
    }

    form.classList.add('iq-form-layout-ready');
  }

  function initFormCtaGradient() {
    var submitBtn = document.getElementById('iq-form-submit');
    if (submitBtn) {
      submitBtn.classList.add('iq-orbit-btn', 'iq-form-submit');
      ensureOrbitWrap(submitBtn);
    }

    document
      .querySelectorAll('.iq-form-cta-wrap, .iq-order-section .ltf-btn-gradient-wrap, .iq-orbit-wrap')
      .forEach(function (wrap) {
        if (wrap.dataset.ltfGradientInit) return;
        wrap.dataset.ltfGradientInit = '1';
        wrap.addEventListener('click', function () {
          wrap.classList.add('ltf-btn-gradient-active', 'iq-orbit-click');
          var btn = wrap.querySelector('#iq-form-submit, .iq-form-submit, .iq-orbit-btn');
          playOrbitClick(btn || wrap);
          clearTimeout(wrap._ltfGradientTimer);
          wrap._ltfGradientTimer = setTimeout(function () {
            wrap.classList.remove('ltf-btn-gradient-active', 'iq-orbit-click');
          }, ORBIT_MS);
        });
      });
  }

  function initArtworkModal() {
    var modal = document.getElementById('iq-artwork-modal');
    var trigger = document.getElementById('iq-artwork-info-trigger');
    var closeBtn = document.getElementById('iq-artwork-modal-close');
    var backdrop = document.getElementById('iq-artwork-modal-backdrop');
    if (!modal || !trigger) return;

    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      trigger.focus();
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      openModal();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  function ensureHoneypot(form) {
    if (document.getElementById('suite-number')) return;
    var trap = document.createElement('input');
    trap.type = 'text';
    trap.name = 'suite-number';
    trap.id = 'suite-number';
    trap.autocomplete = 'off';
    trap.tabIndex = -1;
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText =
      'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;opacity:0;';
    form.appendChild(trap);
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatPhone(digits) {
    var d = digits.slice(0, 10);
    if (d.length === 0) return '';
    if (d.length < 4) return '(' + d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  function initPhoneFormatter() {
    var phone = document.getElementById('iq-form-phone');
    if (!phone) return;
    phone.setAttribute('inputmode', 'tel');
    phone.setAttribute('autocomplete', 'tel');
    phone.addEventListener('input', function () {
      var caretEnd = phone.selectionStart === phone.value.length;
      phone.value = formatPhone(digitsOnly(phone.value));
      if (caretEnd) {
        try {
          phone.setSelectionRange(phone.value.length, phone.value.length);
        } catch (e) {}
      }
    });
  }

  /** Levenshtein edit distance (iterative, two-row). */
  function editDistance(a, b) {
    a = String(a);
    b = String(b);
    var m = a.length;
    var n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    var i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      curr[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      for (j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  /**
   * Classify an email address:
   *   incomplete — no usable "local@domain.tld" yet (say nothing)
   *   exact      — domain is a known-good popular service
   *   typo       — domain is a near miss of a popular service (offer suggestion)
   *   custom     — a legitimate-looking custom/business domain (say nothing)
   */
  function analyzeEmail(email) {
    var value = String(email || '').trim();
    var at = value.indexOf('@');
    if (at < 1) return { kind: 'incomplete' };

    var local = value.slice(0, at);
    var domain = value.slice(at + 1).toLowerCase();
    if (!local || !domain || /[@\s]/.test(domain)) return { kind: 'incomplete' };
    // Need a dot with something after it before we judge the domain.
    if (domain.indexOf('.') < 1 || /\.$/.test(domain)) return { kind: 'incomplete' };

    if (EMAIL_TYPOS[domain]) {
      return { kind: 'typo', domain: domain, suggestion: local + '@' + EMAIL_TYPOS[domain] };
    }
    if (POPULAR_DOMAINS.indexOf(domain) >= 0) {
      return { kind: 'exact', domain: domain };
    }

    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < POPULAR_DOMAINS.length; i++) {
      var d = editDistance(domain, POPULAR_DOMAINS[i]);
      if (d < bestDist) {
        bestDist = d;
        best = POPULAR_DOMAINS[i];
      }
    }

    if (best && bestDist > 0 && bestDist <= 2) {
      var samePrefix = domain.slice(0, 2) === best.slice(0, 2); // first-two-letters guard
      var closeLength = Math.abs(domain.length - best.length) <= 2;
      if (samePrefix && closeLength) {
        return { kind: 'typo', domain: domain, suggestion: local + '@' + best };
      }
    }

    return { kind: 'custom', domain: domain };
  }

  // Back-compat helper (returns corrected address or null).
  function suggestEmailFix(email) {
    var res = analyzeEmail(email);
    return res.kind === 'typo' ? res.suggestion : null;
  }

  function initEmailTypoCatcher() {
    var email = document.getElementById('iq-form-email');
    if (!email) return;

    var label = findFieldLabel(email);

    /* Inline flag lives on the same line as the "Email Address *" label. */
    var flag = document.getElementById('iq-email-typo-flag');
    if (!flag) {
      flag = document.createElement('span');
      flag.id = 'iq-email-typo-flag';
      flag.className = 'iq-email-typo-flag';
      flag.setAttribute('role', 'button');
      flag.setAttribute('tabindex', '0');
      flag.setAttribute('aria-live', 'polite');
      flag.hidden = true;
      flag.style.cssText =
        'display:none;margin-left:8px;color:#dc2626;font-weight:700;font-size:0.9em;' +
        'cursor:pointer;text-decoration:none;white-space:nowrap;';
      if (label) {
        label.appendChild(flag);
      } else {
        email.insertAdjacentElement('afterend', flag);
      }
    }

    var pending = null; // corrected address awaiting a click

    function clearFlag() {
      pending = null;
      flag.hidden = true;
      flag.style.display = 'none';
      flag.textContent = '';
      email.style.borderColor = '';
      email.classList.remove('iq-input-typo');
      email.removeAttribute('aria-invalid');
    }

    function showTypo(suggestion) {
      pending = suggestion;
      var fixedDomain = suggestion.split('@')[1];
      /* Red asterisk + inline instruction, clickable to auto-correct. */
      flag.textContent = '\u2731 Did you mean @' + fixedDomain + '? Tap to fix';
      flag.hidden = false;
      flag.style.display = 'inline';
      email.style.borderColor = '#dc2626';
      email.classList.add('iq-input-typo');
      email.setAttribute('aria-invalid', 'true');
    }

    function applyFix() {
      if (!pending) return;
      email.value = pending;
      clearFlag();
      email.focus();
    }

    function evaluate() {
      var res = analyzeEmail(email.value);
      if (res.kind === 'typo') {
        showTypo(res.suggestion);
      } else {
        clearFlag();
      }
    }

    flag.addEventListener('click', function (event) {
      event.preventDefault();
      applyFix();
    });
    flag.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyFix();
      }
    });

    email.addEventListener('blur', evaluate);
    email.addEventListener('input', function () {
      var v = email.value;
      var at = v.indexOf('@');
      // Live feedback only once a full-looking domain (has a dot) is typed.
      if (at >= 1 && v.slice(at + 1).indexOf('.') >= 1) {
        evaluate();
      } else {
        clearFlag();
      }
    });

    clearFlag();
  }

  function setRequiredAttrs() {
    ['iq-form-full-name', 'iq-form-email', 'iq-form-phone'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.required = true;
      node.setAttribute('required', 'required');
    });
  }

  function setFormStatus(message, type) {
    var status = document.getElementById('iq-form-status');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    if (type) status.classList.add('is-' + type);
  }

  function getFormShell(form) {
    return form.closest('.w-form') || form.parentElement;
  }

  function showWebflowState(form, which) {
    var shell = getFormShell(form);
    if (!shell) return;
    var done = shell.querySelector('.w-form-done');
    var fail = shell.querySelector('.w-form-fail');
    if (done) done.style.display = which === 'done' ? 'block' : 'none';
    if (fail) fail.style.display = which === 'fail' ? 'block' : 'none';
    if (which === 'done' || which === 'fail') {
      form.style.display = 'none';
    }
  }

  function validateForm() {
    var name = val('iq-form-full-name');
    var email = val('iq-form-email');
    var phone = digitsOnly(val('iq-form-phone'));

    if (!name) return 'Please enter your client name.';
    if (!email || email.indexOf('@') < 1) return 'Please enter a valid email address.';
    if (phone.length < 10) return 'Please enter a valid 10-digit phone number.';
    return '';
  }

  function isBotSubmission(form) {
    var honeypot = document.getElementById('suite-number');
    if (honeypot && String(honeypot.value || '').trim()) return true;
    var minMs = (global.IQ.FORM_CONFIG && global.IQ.FORM_CONFIG.minSubmitMs) || 2500;
    if (Date.now() - pageLoadedAt < minMs) return true;
    return false;
  }

  function silentDrop(form, submitBtn, originalLabel) {
    // Fake success for bots — no network request.
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.value = originalLabel;
    }
    showWebflowState(form, 'done');
    setFormStatus(
      (global.IQ.FORM_CONFIG && global.IQ.FORM_CONFIG.successMessage) ||
        'Project brief received.',
      'success'
    );
  }

  function submitToWebhook(payload) {
    var config = global.IQ.FORM_CONFIG || {};
    if (!config.webhookUrl) return Promise.reject(new Error('Missing webhook'));

    // Single JSON body (artwork rides along as base64 in payload.sheet.art_files).
    // text/plain keeps this a CORS-safe "simple" request (no preflight) and
    // lands in Apps Script as e.postData.contents for JSON.parse.
    var sheetJson = JSON.stringify(payload.sheet || payload);

    return fetch(config.webhookUrl, {
      method: 'POST',
      body: sheetJson,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      redirect: 'follow',
      mode: 'cors',
      credentials: 'omit'
    })
      .then(function (response) {
        // Opaque / zero-status can still mean the write landed (GAS redirect + CORS).
        if (response.type === 'opaque' || response.status === 0) {
          return { ok: true, opaque: true };
        }
        if (!response.ok) throw new Error('Submit failed');
        return response.text().then(function (text) {
          try {
            return JSON.parse(text);
          } catch (e) {
            return { ok: true, raw: text };
          }
        });
      })
      .then(function (data) {
        if (data && data.ok === false) throw new Error(data.error || 'Submit failed');
        return data;
      })
      .catch(function (err) {
        // Classic Apps Script web-app behavior: doPost succeeds, then the browser
        // cannot read the redirected response (CORS) → "Failed to fetch".
        var msg = String((err && err.message) || err || '');
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          return { ok: true, corsLikely: true };
        }
        throw err;
      });
  }

  function initOrderForm() {
    var form = document.getElementById('iq-order-form');
    if (!form) return;

    fixFormFieldLayout(form);
    ensureHoneypot(form);
    setRequiredAttrs();
    initPhoneFormatter();
    initEmailTypoCatcher();

    form.setAttribute('novalidate', 'novalidate');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();

      var submitBtn = document.getElementById('iq-form-submit');
      var originalLabel =
        (submitBtn && (submitBtn.value || submitBtn.textContent || '').trim()) ||
        'Submit Project Brief';
      var loadingText =
        (global.IQ.FORM_CONFIG && global.IQ.FORM_CONFIG.loadingText) || 'Submitting…';

      if (isBotSubmission(form)) {
        silentDrop(form, submitBtn, originalLabel);
        return;
      }

      var error = validateForm();
      if (error) {
        setFormStatus(error, 'error');
        return;
      }

      syncQuoteFields();
      var snapshot = getQuoteSnapshot();
      if (!snapshot) {
        setFormStatus('Calculator is not ready. Refresh and try again.', 'error');
        return;
      }

      var payload = buildQuotePayload(snapshot.state, snapshot.result);

      if (submitBtn) {
        submitBtn.disabled = true;
        if ('value' in submitBtn) submitBtn.value = loadingText;
      }
      setFormStatus('Submitting project brief…', '');

      readArtworkFilesBase64()
        .then(function (art) {
          payload.sheet = payload.sheet || {};
          if (art.files.length) {
            payload.sheet.art_files = art.files;
            payload.sheet.art_file_names = art.files.map(function (f) {
              return f.name;
            });
            payload.artworkFileNames = payload.sheet.art_file_names;
          }
          if (art.skipped.length) {
            payload.sheet.art_note =
              'Some files were too large to auto-upload (' +
              art.skipped.join(', ') +
              '). Client will send them separately.';
          }
          return submitToWebhook(payload);
        })
        .then(function () {
          setFormStatus(
            (global.IQ.FORM_CONFIG && global.IQ.FORM_CONFIG.successMessage) ||
              'Project brief received.',
            'success'
          );
          showWebflowState(form, 'done');
          form.reset();
          renderArtworkFileList();
          syncQuoteFields();
          global.dispatchEvent(
            new CustomEvent('iq:project-brief-submitted', { detail: payload })
          );
        })
        .catch(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            if ('value' in submitBtn) submitBtn.value = originalLabel;
          }
          setFormStatus('Something went wrong. Email us directly and we will help.', 'error');
          showWebflowState(form, 'fail');
          form.style.display = '';
        })
        .finally(function () {
          if (submitBtn && form.style.display !== 'none') {
            submitBtn.disabled = false;
            if ('value' in submitBtn) submitBtn.value = originalLabel;
          }
        });
    });
  }

  function initQuoteSync() {
    syncQuoteFields();
    document.addEventListener('iq:quote-updated', syncQuoteFields);
  }

  function init() {
    pageLoadedAt = Date.now();
    initArtworkUpload();
    initFormCtaGradient();
    initArtworkModal();
    initOrderForm();
    initQuoteSync();
  }

  global.IQ.syncQuoteForm = syncQuoteFields;
  global.IQ.buildQuotePayload = buildQuotePayload;
  global.IQ.buildSheetPayload = buildSheetPayload;
  global.IQ.analyzeEmail = analyzeEmail;
  global.IQ.suggestEmailFix = suggestEmailFix;
  global.IQ.readArtworkFilesBase64 = readArtworkFilesBase64;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

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
    var trigger = document.querySelector('.iq-mobile-picker-trigger[data-iq-for="' + slider.id + '"]');
    if (trigger) {
      var valEl = trigger.querySelector('.iq-mobile-picker-value');
      if (valEl) valEl.textContent = display;
      trigger.setAttribute('aria-valuenow', display);
    }
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
      return;
    }

    splitRow.classList.remove('is-visible');
    splitRow.style.maxHeight = '';
    if (unitCost2) unitCost2.classList.remove('is-visible');
    if (unitCol) unitCol.classList.remove('is-split-visible');
    recalculateQuote();
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

  /* ── Mobile slider → bottom-sheet pickers (≤991px only) ─────────────── */

  var MOBILE_MQ = '(max-width: 991px)';
  var mobilePickerSheet = null;
  var mobilePickerOpenFor = null;

  function isMobileIq() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function sliderDisplayValue(slider) {
    var raw = parseFloat(slider.value);
    if (slider.id === 'iq-slider-ink-colors') return formatInkDisplay(raw);
    var step = parseFloat(slider.getAttribute('data-iq-step') || slider.step || '1');
    return step >= 1 ? String(Math.round(raw)) : String(raw);
  }

  function sliderOptionList(slider) {
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var step = parseFloat(slider.getAttribute('data-iq-step') || slider.step || '1');
    var opts = [];
    for (var v = min; v <= max + 0.0001; v += step) {
      var snapped = Math.round(v * 1000) / 1000;
      opts.push({
        value: snapped,
        label: slider.id === 'iq-slider-ink-colors' ? formatInkDisplay(snapped) : String(Math.round(snapped))
      });
    }
    return opts;
  }

  function sliderTitle(slider) {
    var row = slider.closest('.iq-slider-row');
    var label = row && row.querySelector('.iq-slider-label');
    return (label && label.textContent.trim()) || slider.getAttribute('aria-label') || 'Select value';
  }

  function ensureMobilePickerSheet() {
    if (mobilePickerSheet) return mobilePickerSheet;
    var root = document.createElement('div');
    root.className = 'iq-mobile-sheet';
    root.id = 'iq-mobile-picker-sheet';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="iq-mobile-sheet-backdrop" data-iq-sheet-dismiss="1"></div>' +
      '<div class="iq-mobile-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="iq-mobile-sheet-title">' +
      '<div class="iq-mobile-sheet-handle" aria-hidden="true"></div>' +
      '<h3 class="iq-mobile-sheet-title" id="iq-mobile-sheet-title">Select</h3>' +
      '<div class="iq-mobile-sheet-options" id="iq-mobile-sheet-options"></div>' +
      '<div class="iq-mobile-sheet-actions">' +
      '<button type="button" class="iq-mobile-sheet-btn iq-mobile-sheet-btn--ghost" data-iq-sheet-dismiss="1">Cancel</button>' +
      '<button type="button" class="iq-mobile-sheet-btn iq-mobile-sheet-btn--primary" id="iq-mobile-sheet-done">Done</button>' +
      '</div></div>';
    document.body.appendChild(root);
    mobilePickerSheet = root;

    root.addEventListener('click', function (event) {
      var t = event.target;
      if (t && t.getAttribute && t.getAttribute('data-iq-sheet-dismiss')) {
        closeMobilePicker(false);
      }
    });

    var done = root.querySelector('#iq-mobile-sheet-done');
    if (done) {
      done.addEventListener('click', function () {
        closeMobilePicker(true);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mobilePickerSheet && mobilePickerSheet.classList.contains('is-open')) {
        closeMobilePicker(false);
      }
    });

    return root;
  }

  function closeMobilePicker(commit) {
    if (!mobilePickerSheet) return;
    var pending = mobilePickerOpenFor;
    mobilePickerSheet.classList.remove('is-open');
    mobilePickerSheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('iq-sheet-open');

    if (commit && pending && pending.slider && pending.draft != null) {
      pending.slider.value = String(pending.draft);
      syncSliderValue(pending.slider);
      refreshMobilePickerTriggers();
    }
    mobilePickerOpenFor = null;
  }

  function openMobilePicker(slider) {
    if (!isMobileIq()) return;
    var sheet = ensureMobilePickerSheet();
    var title = sheet.querySelector('#iq-mobile-sheet-title');
    var list = sheet.querySelector('#iq-mobile-sheet-options');
    if (!list) return;

    var current = snapValue(slider, parseFloat(slider.value));
    mobilePickerOpenFor = { slider: slider, draft: current };
    if (title) title.textContent = sliderTitle(slider);

    list.innerHTML = '';
    sliderOptionList(slider).forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'iq-mobile-sheet-option';
      btn.textContent = opt.label;
      btn.setAttribute('data-value', String(opt.value));
      if (opt.value === current) btn.classList.add('is-selected');
      btn.addEventListener('click', function () {
        mobilePickerOpenFor.draft = opt.value;
        list.querySelectorAll('.iq-mobile-sheet-option').forEach(function (el) {
          el.classList.toggle('is-selected', el === btn);
        });
      });
      list.appendChild(btn);
    });

    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('iq-sheet-open');
  }

  function refreshMobilePickerTriggers() {
    document.querySelectorAll('.iq-range[data-iq-value-target]').forEach(function (slider) {
      var trigger = document.querySelector('.iq-mobile-picker-trigger[data-iq-for="' + slider.id + '"]');
      if (!trigger) return;
      var display = sliderDisplayValue(slider);
      trigger.querySelector('.iq-mobile-picker-value').textContent = display;
      trigger.setAttribute('aria-valuenow', display);
    });
  }

  function initMobilePickers() {
    document.querySelectorAll('.iq-range[data-iq-value-target]').forEach(function (slider) {
      var control = slider.closest('.iq-slider-control');
      var row = slider.closest('.iq-slider-row');
      if (!control || !row) return;
      if (row.querySelector('.iq-mobile-picker-trigger[data-iq-for="' + slider.id + '"]')) return;

      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'iq-mobile-picker-trigger';
      trigger.setAttribute('data-iq-for', slider.id);
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.innerHTML =
        '<span class="iq-mobile-picker-label">Tap to set</span>' +
        '<span class="iq-mobile-picker-value">' +
        sliderDisplayValue(slider) +
        '</span>';
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        if (!isMobileIq()) return;
        openMobilePicker(slider);
      });
      control.appendChild(trigger);
    });

    window.matchMedia(MOBILE_MQ).addEventListener('change', function () {
      if (!isMobileIq()) closeMobilePicker(false);
      refreshMobilePickerTriggers();
    });
  }

  function init() {
    initSliders();
    initSplitToggle();
    initQualityToggle();
    initStyleRadios();
    initCustomArtToggle();
    initRunQuoteButton();
    initMobilePickers();
    recalculateQuote();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

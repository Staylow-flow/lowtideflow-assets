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
    successMessage: 'Thank you! Your submission has been received!',
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

  var EMAIL_TYPOS = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com'
  };

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
    return artworkFiles.map(function (file) {
      return file.name;
    });
  }

  /* Artwork transfer limits (Apps Script POST bodies cap around ~50 MB). */
  var ART_MAX_FILE_BYTES = 20 * 1024 * 1024;
  var ART_MAX_TOTAL_BYTES = 40 * 1024 * 1024;

  /** Read one File as base64 (no data-URL prefix) for payload.sheet.art_files. */
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

  /** Encode artworkFiles[] to base64 for Apps Script Drive upload. */
  function readArtworkFilesBase64() {
    if (!artworkFiles.length) {
      return Promise.resolve({ files: [], skipped: [], oversized: false });
    }

    var skipped = [];
    var keep = artworkFiles.filter(function (file) {
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

  function fileExt(name) {
    var parts = String(name || '').split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : '';
  }

  function fileTypeIcon(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'mp4' || ext === 'mov' || ext === 'webm') return 'video';
    if (ext === 'ai' || ext === 'eps' || ext === 'svg' || ext === 'psd') return 'vector';
    return 'image';
  }

  /** Persistent, cumulative set of artwork files across multiple selections —
   *  picking more files ADDS to this set rather than replacing it (C4). This
   *  array (not the <input> FileList, which the browser always overwrites on
   *  each picker interaction) is the single source of truth for the UI and
   *  for what actually gets submitted. */
  var artworkFiles = [];
  var artworkLaneMap = {};

  function normalizeArtworkFileKey(file) {
    return (
      String(file.name || '')
        .trim()
        .toLowerCase() +
      '|' +
      String(file.size || 0) +
      '|' +
      String(file.lastModified || 0)
    );
  }

  function artworkFileKey(file) {
    return normalizeArtworkFileKey(file);
  }

  function addArtworkFiles(fileList) {
    var seen = {};
    artworkFiles.forEach(function (f) {
      seen[artworkFileKey(f)] = true;
    });
    var files = fileList;
    if (files && typeof files.length === 'number' && !Array.isArray(files)) {
      files = Array.prototype.slice.call(files);
    }
    (files || []).forEach(function (file) {
      if (!file) return;
      var key = artworkFileKey(file);
      if (!seen[key]) {
        seen[key] = true;
        artworkFiles.push(file);
      }
    });
  }

  function clearArtworkFiles() {
    artworkFiles = [];
    artworkLaneMap = {};
  }

  function removeArtworkFile(key) {
    artworkFiles = artworkFiles.filter(function (file) {
      return artworkFileKey(file) !== key;
    });

    var lane = artworkLaneMap[key];
    if (lane) {
      if (lane.classList.contains('is-uploading')) {
        artworkUploadsInFlight = Math.max(0, artworkUploadsInFlight - 1);
      }
      if (lane.parentNode) lane.parentNode.removeChild(lane);
      delete artworkLaneMap[key];
    }

    updateArtworkQueueCount();
    if (!artworkFiles.length) {
      renderArtworkFileList();
    }
  }

  /** Keep the native file input on the drop zone (not buried in a Webflow embed)
   *  so mobile Safari can attach files reliably. */
  function ensureFileInputPlacement(drop, input) {
    if (!drop || !input) return;

    input.classList.add('iq-form-upload-input');
    if (input.id !== 'iq-form-artwork-file') {
      input.id = 'iq-form-artwork-file';
    }

    var embed = drop.querySelector('#iq-artwork-file-embed');
    if (embed && embed !== input.parentNode) {
      if (embed.contains(input)) {
        embed.removeChild(input);
      }
      if (!embed.textContent.trim() && !embed.children.length) {
        embed.parentNode.removeChild(embed);
      }
    }

    if (input.parentNode !== drop) {
      drop.appendChild(input);
    }

    input.setAttribute(
      'accept',
      '.ai,.eps,.pdf,.svg,.png,.jpg,.jpeg,.tif,.tiff,.psd,.heic,.HEIC,image/*,application/pdf,application/postscript'
    );
  }

  function isMobileUpload() {
    return window.matchMedia('(max-width: 991px)').matches;
  }

  /** iOS Safari opens the file picker most reliably from a <label for="…"> tap. */
  function wireBrowseAsLabel(browse, input) {
    if (!browse || !input || browse.tagName === 'LABEL') return browse;

    var label = document.createElement('label');
    label.setAttribute('for', input.id);
    label.className = browse.className;
    label.id = browse.id;
    label.innerHTML = browse.innerHTML;
    browse.parentNode.replaceChild(label, browse);

    label.addEventListener('click', function (event) {
      event.stopPropagation();
    });

    label.addEventListener(
      'touchend',
      function (event) {
        event.stopPropagation();
      },
      { passive: true }
    );

    return label;
  }

  function ensureArtworkUploadShell(drop) {
    if (drop.querySelector('.iq-form-upload-shell')) return;

    var inner = drop.querySelector('.iq-form-upload-inner');
    if (!inner) return;

    // Defensive cleanup: a legacy static `<ul id="iq-form-artwork-list">`
    // sometimes lingers as a direct sibling in the drop zone (from an older
    // markup version). A duplicate id here silently breaks every
    // getElementById('iq-form-artwork-list') lookup below — it resolves to
    // whichever copy comes FIRST in the DOM, not the live one this shell
    // creates — so the lanes visibly never render. Sweep the whole drop
    // zone, not just `inner`, before creating the real one.
    Array.prototype.slice
      .call(drop.querySelectorAll('#iq-form-artwork-list, #iq-form-artwork-queue, #iq-form-artwork-active, #iq-form-artwork-idle'))
      .forEach(function (stale) {
        stale.parentNode.removeChild(stale);
      });

    var shell = document.createElement('div');
    shell.className = 'iq-form-upload-shell';

    var idle = document.createElement('div');
    idle.className = 'iq-form-upload-idle';
    idle.id = 'iq-form-artwork-idle';
    idle.appendChild(inner);

    var active = document.createElement('div');
    active.className = 'iq-form-upload-active';
    active.id = 'iq-form-artwork-active';
    active.hidden = true;

    active.innerHTML =
      '<div class="iq-form-upload-queue" id="iq-form-artwork-queue" hidden>' +
      '  <div class="iq-form-upload-queue-head">' +
      '    <div class="iq-form-upload-queue-count-wrap">' +
      '      <span class="iq-form-upload-queue-count" id="iq-form-artwork-queue-count">0</span>' +
      '      <span class="iq-form-upload-queue-title" id="iq-form-artwork-queue-title">files ready</span>' +
      '    </div>' +
      '    <label class="iq-form-upload-add-more" id="iq-form-artwork-add-more" for="iq-form-artwork-file">Add more</label>' +
      '  </div>' +
      '  <ul class="iq-form-upload-lanes" id="iq-form-artwork-list"></ul>' +
      '</div>';

    shell.appendChild(idle);
    shell.appendChild(active);
    drop.appendChild(shell);
  }

  /** Marching-ants edge — sits behind the shell, static until hover/dragover (see CSS). */
  function ensureArtworkAntsOverlay(drop) {
    if (drop.querySelector('.iq-form-upload-ants')) return;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'iq-form-upload-ants');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    ['a', 'b'].forEach(function (variant) {
      var rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('class', 'iq-form-upload-ants-rect iq-form-upload-ants-rect--' + variant);
      svg.appendChild(rect);
    });
    drop.insertBefore(svg, drop.firstChild);
  }

  function setArtworkDropMode(drop, mode) {
    var idle = document.getElementById('iq-form-artwork-idle');
    var active = document.getElementById('iq-form-artwork-active');
    if (!idle || !active) return;

    drop.classList.remove('is-loading', 'is-queue', 'is-empty');
    if (mode === 'idle') {
      idle.hidden = false;
      active.hidden = true;
      drop.classList.add('is-empty');
      return;
    }
    idle.hidden = true;
    active.hidden = false;
    if (mode === 'loading') drop.classList.add('is-loading');
    if (mode === 'queue') drop.classList.add('is-queue');
  }

  /* Every upload — regardless of how "fast" the simulated transfer would
     otherwise be — always runs for at least 5000ms so there's something to
     watch (C1). Larger files can stretch up to UPLOAD_MAX_MS. */
  var UPLOAD_MIN_MS = 5000;
  var UPLOAD_MAX_MS = 8000;

  /** Fake, size-flavored upload time — always 5-8s so there's something to watch. */
  function fakeUploadDuration(bytes) {
    var mb = bytes / (1024 * 1024);
    var base = UPLOAD_MIN_MS + Math.min(mb, 42) * 65;
    var jitter = 0.94 + Math.random() * 0.12;
    return Math.max(UPLOAD_MIN_MS, Math.min(UPLOAD_MAX_MS, Math.round(base * jitter)));
  }

  function runFakeUpload(duration, onFrame, onDone) {
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = t < 1 ? 1 - Math.pow(1 - t, 2.4) : 1;
      onFrame(Math.round(eased * 100));
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  function getArtworkLaneList(drop) {
    if (!drop) return null;
    return drop.querySelector('.iq-form-upload-lanes');
  }

  function purgeStaleArtworkLists(drop) {
    if (!drop) return;
    var shell = drop.querySelector('.iq-form-upload-shell');
    Array.prototype.slice
      .call(drop.querySelectorAll('#iq-form-artwork-list, .iq-form-upload-lanes'))
      .forEach(function (list) {
        if (shell && shell.contains(list)) return;
        if (list.parentNode) list.parentNode.removeChild(list);
      });
  }

  function findArtworkLaneByKey(list, key) {
    if (!list) return null;
    var lanes = list.querySelectorAll('[data-file-key]');
    for (var i = 0; i < lanes.length; i += 1) {
      if (lanes[i].dataset.fileKey === key) return lanes[i];
    }
    return null;
  }

  function reconcileArtworkLanes(list) {
    if (!list) return;

    var valid = {};
    artworkFiles.forEach(function (file) {
      valid[artworkFileKey(file)] = true;
    });

    Object.keys(artworkLaneMap).forEach(function (key) {
      if (valid[key]) return;
      var lane = artworkLaneMap[key];
      if (lane && lane.parentNode) lane.parentNode.removeChild(lane);
      delete artworkLaneMap[key];
    });

    Array.prototype.slice.call(list.children).forEach(function (lane) {
      var key = lane.dataset && lane.dataset.fileKey;
      if (!key || valid[key]) return;
      lane.parentNode.removeChild(lane);
      delete artworkLaneMap[key];
    });
  }

  function bindArtworkLaneRemove(lane, key) {
    var removeBtn = lane.querySelector('.iq-form-upload-lane-remove');
    if (!removeBtn) return;

    function onRemove(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      removeArtworkFile(key);
    }

    removeBtn.addEventListener('click', onRemove);
    removeBtn.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') onRemove(event);
    });
  }

  function buildArtworkLane(file) {
    var key = artworkFileKey(file);
    var lane = document.createElement('li');
    lane.className = 'iq-form-upload-lane is-uploading';
    lane.dataset.fileKey = key;
    lane.innerHTML =
      '<span class="iq-form-upload-lane-icon iq-form-upload-lane-icon--' +
      fileTypeIcon(file.name) +
      '" aria-hidden="true"></span>' +
      '<div class="iq-form-upload-lane-body">' +
      '  <div class="iq-form-upload-lane-top">' +
      '    <span class="iq-form-upload-lane-name">' +
      escapeHtml(file.name) +
      '</span>' +
      '  </div>' +
      '  <span class="iq-form-upload-lane-meta">' +
      fileExt(file.name) + ' · ' + formatFileSize(file.size) +
      '</span>' +
      '  <div class="iq-form-upload-lane-bar" aria-hidden="true"><span></span></div>' +
      '</div>' +
      '<div class="iq-form-upload-lane-status-col">' +
      '  <span class="iq-form-upload-lane-pct">0%</span>' +
      '  <div class="iq-form-upload-lane-check-stack">' +
      '    <span class="iq-form-upload-lane-check" aria-hidden="true"></span>' +
      '    <span class="iq-form-upload-lane-remove" role="button" tabindex="0" aria-label="Remove ' +
      escapeHtml(file.name) +
      '">&times;</span>' +
      '  </div>' +
      '</div>';

    bindArtworkLaneRemove(lane, key);
    return lane;
  }

  /** Each lane uploads on its own independent bar/clock. Multiple files
   *  selected together are staggered by index (rather than starting all at
   *  once) while each individual bar still takes at least UPLOAD_MIN_MS. */
  function animateArtworkLane(lane, file, index, onDone) {
    var fill = lane.querySelector('.iq-form-upload-lane-bar span');
    var pctNode = lane.querySelector('.iq-form-upload-lane-pct');
    var stagger = (index || 0) * 380;
    var startDelay = stagger + Math.round(Math.random() * 220);

    window.setTimeout(function () {
      runFakeUpload(
        fakeUploadDuration(file.size),
        function (pct) {
          if (fill) fill.style.width = pct + '%';
          if (pctNode) pctNode.textContent = pct + '%';
        },
        function () {
          lane.classList.remove('is-uploading');
          lane.classList.add('is-just-complete');
          window.setTimeout(function () {
            lane.classList.remove('is-just-complete');
            lane.classList.add('is-complete');
          }, 750);
          if (onDone) onDone();
        }
      );
    }, startDelay);
  }

  var artworkUploadsInFlight = 0;

  function updateArtworkQueueCount() {
    var countNode = document.getElementById('iq-form-artwork-queue-count');
    var titleNode = document.getElementById('iq-form-artwork-queue-title');
    var total = artworkFiles.length;
    if (countNode) countNode.textContent = String(total);
    if (titleNode) {
      if (artworkUploadsInFlight > 0) {
        titleNode.textContent =
          (total === 1 ? 'file' : 'files') + ' — uploading…';
      } else {
        titleNode.textContent =
          (total === 1 ? 'file ready' : 'files ready') + ' for your brief';
      }
    }
  }

  /** Renders every file currently in the persistent `artworkFiles` set.
   *  Already-completed lanes are left alone; only files newly added since
   *  the last render get a lane + independent, staggered upload animation
   *  (C3/C4) — nothing already uploaded is ever replaced or restarted. */
  function renderArtworkFileList() {
    var drop = document.getElementById('iq-form-artwork-drop');
    var queue = document.getElementById('iq-form-artwork-queue');
    if (!drop) return;

    ensureArtworkUploadShell(drop);
    purgeStaleArtworkLists(drop);
    var list = getArtworkLaneList(drop);
    if (!list) return;

    if (!artworkFiles.length) {
      list.innerHTML = '';
      artworkLaneMap = {};
      if (queue) queue.hidden = true;
      setArtworkDropMode(drop, 'idle');
      return;
    }

    if (queue) queue.hidden = false;
    setArtworkDropMode(drop, 'queue');
    reconcileArtworkLanes(list);

    var newIndex = 0;
    artworkFiles.forEach(function (file) {
      var key = artworkFileKey(file);
      var mappedLane = artworkLaneMap[key];
      if (mappedLane && mappedLane.isConnected) return;

      var existingLane = findArtworkLaneByKey(list, key);
      if (existingLane) {
        artworkLaneMap[key] = existingLane;
        return;
      }

      var lane = buildArtworkLane(file);
      artworkLaneMap[key] = lane;
      list.appendChild(lane);

      artworkUploadsInFlight += 1;
      updateArtworkQueueCount();

      animateArtworkLane(lane, file, newIndex, function () {
        artworkUploadsInFlight = Math.max(0, artworkUploadsInFlight - 1);
        updateArtworkQueueCount();
      });
      newIndex += 1;
    });

    updateArtworkQueueCount();
    ensureFileInputPlacement(drop, document.getElementById('iq-form-artwork-file'));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function handleArtworkInputChange(input) {
    if (!input || !input.files || !input.files.length) return;
    // Copy first — iOS can clear FileList when input.value is reset.
    var picked = Array.prototype.slice.call(input.files);
    window.clearTimeout(input._iqChangeTimer);
    input._iqChangeTimer = window.setTimeout(function () {
      addArtworkFiles(picked);
      renderArtworkFileList();
      input.value = '';
    }, 100);
  }

  function openArtworkPicker(input, event) {
    if (!input) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    input.click();
  }

  function initArtworkUpload() {
    var drop = document.getElementById('iq-form-artwork-drop');
    var input = document.getElementById('iq-form-artwork-file');
    var browse = document.getElementById('iq-form-artwork-browse');
    if (!drop || !input) return;
    if (drop.dataset.iqUploadInit === '1') return;
    drop.dataset.iqUploadInit = '1';

    ensureArtworkUploadShell(drop);
    purgeStaleArtworkLists(drop);
    ensureFileInputPlacement(drop, input);
    ensureArtworkAntsOverlay(drop);
    setArtworkDropMode(drop, 'idle');

    var dragDepth = 0;

    browse = wireBrowseAsLabel(browse, input);

    drop.addEventListener('click', function (event) {
      if (drop.classList.contains('is-queue') || drop.classList.contains('is-loading')) return;
      if (event.target === input || (input.contains && input.contains(event.target))) return;
      if (browse && (event.target === browse || browse.contains(event.target))) return;
      if (event.target.closest && event.target.closest('.iq-form-upload-lane-remove')) return;
      if (!isMobileUpload()) openArtworkPicker(input, event);
    });

    drop.addEventListener(
      'touchend',
      function (event) {
        if (!isMobileUpload()) return;
        if (drop.classList.contains('is-queue') || drop.classList.contains('is-loading')) return;
        if (event.target.closest && event.target.closest('.iq-form-upload-lane-remove')) return;
        if (browse && (event.target === browse || browse.contains(event.target))) return;
        if (event.target === input) return;
        openArtworkPicker(input, event);
      },
      { passive: false }
    );

    var addMore = document.getElementById('iq-form-artwork-add-more');
    if (addMore) {
      addMore.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }

    input.addEventListener('change', function () {
      handleArtworkInputChange(input);
    });

    drop.addEventListener('dragenter', function (event) {
      event.preventDefault();
      dragDepth += 1;
      drop.classList.add('is-dragover');
    });

    drop.addEventListener('dragover', function (event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      drop.classList.add('is-dragover');
    });

    drop.addEventListener('dragleave', function (event) {
      event.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        drop.classList.remove('is-dragover');
      }
    });

    drop.addEventListener('drop', function (event) {
      event.preventDefault();
      dragDepth = 0;
      drop.classList.remove('is-dragover');
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        addArtworkFiles(event.dataTransfer.files);
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
      if (prev.id === 'iq-email-typo-hint' || prev.id === 'suite-number') {
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
        form.insertBefore(stalePhoneRow.firstChild, stalePhoneRow);
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
        var submitAnchor = submit.closest('.iq-orbit-wrap') || submit;
        if (notesLabel && notesLabel.parentNode === form) {
          form.insertBefore(notesLabel, submitAnchor);
        }
        form.insertBefore(notes, submitAnchor);
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

  function suggestEmailFix(email) {
    var parts = String(email || '').split('@');
    if (parts.length !== 2) return null;
    var local = parts[0];
    var domain = parts[1].toLowerCase();
    var fixed = EMAIL_TYPOS[domain];
    if (!fixed) return null;
    return local + '@' + fixed;
  }

  function initEmailTypoCatcher() {
    var email = document.getElementById('iq-form-email');
    var form = document.getElementById('iq-order-form');
    if (!email || !form) return;

    var hint = document.getElementById('iq-email-typo-hint');
    if (!hint) {
      hint = document.createElement('button');
      hint.type = 'button';
      hint.id = 'iq-email-typo-hint';
      hint.className = 'iq-email-typo-hint';
      hint.hidden = true;
      hint.setAttribute('aria-live', 'polite');
      email.insertAdjacentElement('afterend', hint);
    }

    function clearHint() {
      hint.hidden = true;
      hint.textContent = '';
      hint.onclick = null;
    }

    function showHint() {
      var suggestion = suggestEmailFix(email.value.trim());
      if (!suggestion) {
        clearHint();
        return;
      }
      hint.hidden = false;
      hint.textContent = 'Did you mean ' + suggestion + '? (Click to fix)';
      hint.onclick = function () {
        email.value = suggestion;
        clearHint();
        email.focus();
      };
    }

    email.addEventListener('blur', showHint);
    email.addEventListener('change', showHint);
    email.addEventListener('input', function () {
      window.clearTimeout(hint._iqTypoTimer);
      hint._iqTypoTimer = window.setTimeout(showHint, 450);
    });
    clearHint();
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
    var submitBtn = document.getElementById('iq-form-submit');
    var orbitWrap = submitBtn && submitBtn.closest('.iq-orbit-wrap');

    if (which === 'done') {
      if (fail) fail.style.display = 'none';
      form.style.display = '';

      if (submitBtn) submitBtn.style.display = 'none';
      if (done && orbitWrap) {
        done.classList.add('iq-form-success-slot', 'iq-form-submit');
        done.style.display = 'flex';
        orbitWrap.appendChild(done);
      } else if (done) {
        done.style.display = 'block';
      }
      return;
    }

    if (done) done.style.display = 'none';
    if (fail) fail.style.display = which === 'fail' ? 'block' : 'none';
    if (which === 'fail') {
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

  function setSubmitOrbitState(submitBtn, active) {
    if (!submitBtn) return;
    var wrap = submitBtn.closest('.iq-orbit-wrap');
    if (active) {
      submitBtn.classList.add('is-submitting');
      if (wrap) wrap.classList.add('is-submitting', 'ltf-btn-gradient-active', 'iq-orbit-click');
    } else {
      submitBtn.classList.remove('is-submitting');
      if (wrap) {
        wrap.classList.remove('is-submitting', 'ltf-btn-gradient-active', 'iq-orbit-click');
        clearTimeout(wrap._ltfGradientTimer);
      }
    }
  }

  function submitToWebhook(payload) {
    var config = global.IQ.FORM_CONFIG || {};
    if (!config.webhookUrl) return Promise.reject(new Error('Missing webhook'));

    // Single JSON body — artwork rides as base64 in payload.sheet.art_files.
    // text/plain keeps this a CORS-safe simple request (no preflight).
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
        else submitBtn.textContent = loadingText;
      }
      setSubmitOrbitState(submitBtn, true);
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
              'Thank you! Your submission has been received!',
            'success'
          );
          showWebflowState(form, 'done');
          clearArtworkFiles();
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
            else submitBtn.textContent = originalLabel;
          }
          setSubmitOrbitState(submitBtn, false);
          setFormStatus('Something went wrong. Email us directly and we will help.', 'error');
          showWebflowState(form, 'fail');
          form.style.display = '';
        })
        .finally(function () {
          setSubmitOrbitState(submitBtn, false);
          if (submitBtn && form.style.display !== 'none') {
            submitBtn.disabled = false;
            if ('value' in submitBtn) submitBtn.value = originalLabel;
            else submitBtn.textContent = originalLabel;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

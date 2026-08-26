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
    var input = document.getElementById('iq-form-artwork-file');
    if (!input || !input.files) return [];
    return Array.prototype.map.call(input.files, function (file) {
      return file.name;
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

  function fileTypeIcon(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'mp4' || ext === 'mov' || ext === 'webm') return 'video';
    if (ext === 'ai' || ext === 'eps' || ext === 'svg' || ext === 'psd') return 'vector';
    return 'image';
  }

  function ensureArtworkUploadShell(drop) {
    if (drop.querySelector('.iq-form-upload-shell')) return;

    var inner = drop.querySelector('.iq-form-upload-inner');
    if (!inner) return;

    var staleList = inner.querySelector('#iq-form-artwork-list');
    if (staleList) staleList.parentNode.removeChild(staleList);

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
      '<div class="iq-form-upload-progress" id="iq-form-artwork-progress" hidden>' +
      '  <div class="iq-form-upload-progress-head">' +
      '    <span class="iq-form-upload-progress-label" id="iq-form-artwork-progress-label">Reading files…</span>' +
      '    <span class="iq-form-upload-progress-pct" id="iq-form-artwork-progress-pct">0%</span>' +
      '  </div>' +
      '  <div class="iq-form-upload-progress-track" aria-hidden="true">' +
      '    <div class="iq-form-upload-progress-fill" id="iq-form-artwork-progress-fill"></div>' +
      '  </div>' +
      '  <p class="iq-form-upload-progress-sub" id="iq-form-artwork-progress-sub"></p>' +
      '</div>' +
      '<div class="iq-form-upload-queue" id="iq-form-artwork-queue" hidden>' +
      '  <div class="iq-form-upload-queue-head">' +
      '    <span class="iq-form-upload-queue-title" id="iq-form-artwork-queue-title">Files ready</span>' +
      '    <button type="button" class="iq-form-upload-add-more" id="iq-form-artwork-add-more">Add more</button>' +
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

  var UPLOAD_MIN_MS = 900;
  var UPLOAD_MAX_MS = 5000;

  /** Fake, size-flavored upload time — up to 5s so there's something to watch. */
  function fakeUploadDuration(bytes) {
    var mb = bytes / (1024 * 1024);
    var base = 900 + Math.min(mb, 42) * 95;
    var jitter = 0.82 + Math.random() * 0.32;
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

  /** Single file — big hero bar (id=iq-form-artwork-progress), then a glow flash on landing. */
  function animateSingleUpload(file, done) {
    var progress = document.getElementById('iq-form-artwork-progress');
    var queue = document.getElementById('iq-form-artwork-queue');
    var fill = document.getElementById('iq-form-artwork-progress-fill');
    var pctNode = document.getElementById('iq-form-artwork-progress-pct');
    var sub = document.getElementById('iq-form-artwork-progress-sub');
    var label = document.getElementById('iq-form-artwork-progress-label');
    if (!progress || !fill || !pctNode) {
      done();
      return;
    }

    progress.hidden = false;
    progress.classList.remove('is-complete-flash');
    if (queue) queue.hidden = true;
    if (label) label.textContent = file.name;
    if (sub) sub.textContent = formatFileSize(file.size);
    fill.style.width = '0%';
    pctNode.textContent = '0%';

    runFakeUpload(
      fakeUploadDuration(file.size),
      function (pct) {
        fill.style.width = pct + '%';
        pctNode.textContent = pct + '%';
      },
      function () {
        progress.classList.add('is-complete-flash');
        window.setTimeout(function () {
          progress.hidden = true;
          progress.classList.remove('is-complete-flash');
          done();
        }, 550);
      }
    );
  }

  function buildArtworkLane(file) {
    var lane = document.createElement('li');
    lane.className = 'iq-form-upload-lane is-uploading';
    lane.innerHTML =
      '<span class="iq-form-upload-lane-icon iq-form-upload-lane-icon--' +
      fileTypeIcon(file.name) +
      '" aria-hidden="true"></span>' +
      '<div class="iq-form-upload-lane-body">' +
      '  <div class="iq-form-upload-lane-top">' +
      '    <span class="iq-form-upload-lane-name">' +
      escapeHtml(file.name) +
      '</span>' +
      '    <span class="iq-form-upload-lane-status">' +
      '      <span class="iq-form-upload-lane-pct">0%</span>' +
      '      <span class="iq-form-upload-lane-check" aria-hidden="true"></span>' +
      '    </span>' +
      '  </div>' +
      '  <span class="iq-form-upload-lane-meta">' +
      formatFileSize(file.size) +
      '</span>' +
      '  <div class="iq-form-upload-lane-bar" aria-hidden="true"><span></span></div>' +
      '</div>';
    return lane;
  }

  /** Each lane uploads on its own clock (own duration + a little stagger) — no shared bar. */
  function animateArtworkLane(lane, file, onDone) {
    var fill = lane.querySelector('.iq-form-upload-lane-bar span');
    var pctNode = lane.querySelector('.iq-form-upload-lane-pct');
    var startDelay = Math.round(Math.random() * 260);

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

  function renderArtworkFileList() {
    var input = document.getElementById('iq-form-artwork-file');
    var list = document.getElementById('iq-form-artwork-list');
    var drop = document.getElementById('iq-form-artwork-drop');
    var queue = document.getElementById('iq-form-artwork-queue');
    var queueTitle = document.getElementById('iq-form-artwork-queue-title');
    if (!input || !list || !drop) return;

    if (!input.files || !input.files.length) {
      list.innerHTML = '';
      if (queue) queue.hidden = true;
      setArtworkDropMode(drop, 'idle');
      return;
    }

    var files = Array.prototype.slice.call(input.files);

    if (files.length === 1) {
      setArtworkDropMode(drop, 'loading');
      animateSingleUpload(files[0], function () {
        list.innerHTML = '';
        var lane = buildArtworkLane(files[0]);
        lane.classList.remove('is-uploading');
        lane.classList.add('is-complete');
        var fill = lane.querySelector('.iq-form-upload-lane-bar span');
        if (fill) fill.style.width = '100%';
        list.appendChild(lane);

        if (queueTitle) queueTitle.textContent = '1 file ready for your brief';
        if (queue) queue.hidden = false;
        setArtworkDropMode(drop, 'queue');
      });
      return;
    }

    // Multiple files — every file gets its own independent lane, uploading at once.
    setArtworkDropMode(drop, 'queue');
    list.innerHTML = '';
    if (queueTitle) queueTitle.textContent = 'Uploading ' + files.length + ' files…';
    if (queue) queue.hidden = false;

    var remaining = files.length;
    files.forEach(function (file) {
      var lane = buildArtworkLane(file);
      list.appendChild(lane);
      animateArtworkLane(lane, file, function () {
        remaining -= 1;
        if (remaining <= 0 && queueTitle) {
          queueTitle.textContent = files.length + ' files ready for your brief';
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initArtworkUpload() {
    var drop = document.getElementById('iq-form-artwork-drop');
    var input = document.getElementById('iq-form-artwork-file');
    var browse = document.getElementById('iq-form-artwork-browse');
    if (!drop || !input) return;

    ensureArtworkUploadShell(drop);
    ensureArtworkAntsOverlay(drop);
    setArtworkDropMode(drop, 'idle');

    var dragDepth = 0;

    if (browse) {
      browse.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        input.click();
      });
    }

    drop.addEventListener('click', function (event) {
      if (drop.classList.contains('is-queue') || drop.classList.contains('is-loading')) return;
      if (event.target === browse || (browse && browse.contains(event.target))) return;
      input.click();
    });

    var addMore = document.getElementById('iq-form-artwork-add-more');
    if (addMore) {
      addMore.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        input.click();
      });
    }

    input.addEventListener('change', renderArtworkFileList);

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
    if (!email) return;

    var hint = document.getElementById('iq-email-typo-hint');
    if (!hint) {
      hint = document.createElement('button');
      hint.type = 'button';
      hint.id = 'iq-email-typo-hint';
      hint.hidden = true;
      hint.setAttribute('aria-live', 'polite');
      hint.style.cssText =
        'margin:0;padding:0;border:0;background:transparent;color:#f87171;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer;text-decoration:underline;';
      email.insertAdjacentElement('afterend', hint);
    }

    function clearHint() {
      hint.hidden = true;
      hint.style.display = 'none';
      hint.textContent = '';
      hint.onclick = null;
    }

    email.addEventListener('blur', function () {
      var suggestion = suggestEmailFix(email.value.trim());
      if (!suggestion) {
        clearHint();
        return;
      }
      hint.hidden = false;
      hint.style.display = 'block';
      hint.textContent = 'Did you mean ' + suggestion + '? (Click to fix)';
      hint.onclick = function () {
        email.value = suggestion;
        clearHint();
        email.focus();
      };
    });

    email.addEventListener('input', clearHint);
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

  function submitToWebhook(payload, files) {
    var config = global.IQ.FORM_CONFIG || {};
    if (!config.webhookUrl) return Promise.reject(new Error('Missing webhook'));

    var sheetJson = JSON.stringify(payload.sheet || payload);
    var hasFiles = !!(files && files.length);
    var body;
    var headers;

    if (hasFiles) {
      // Multipart for artwork — Apps Script reads e.parameter.payload + e.files
      body = new FormData();
      body.append('payload', sheetJson);
      Array.prototype.forEach.call(files, function (file, index) {
        body.append('artwork_' + index, file, file.name);
      });
      headers = undefined;
    } else {
      // urlencoded is the most reliable path for Apps Script e.parameter.payload
      body = new URLSearchParams();
      body.append('payload', sheetJson);
      headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
    }

    return fetch(config.webhookUrl, {
      method: 'POST',
      body: body,
      headers: headers,
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
      var files = document.getElementById('iq-form-artwork-file');

      if (submitBtn) {
        submitBtn.disabled = true;
        if ('value' in submitBtn) submitBtn.value = loadingText;
      }
      setFormStatus('Submitting project brief…', '');

      submitToWebhook(payload, files && files.files)
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

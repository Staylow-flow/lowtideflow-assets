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

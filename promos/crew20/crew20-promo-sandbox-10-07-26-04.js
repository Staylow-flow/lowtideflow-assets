/* CREW20 promo add-on (10-07-26-04) - SANDBOX ONLY. Load AFTER the Spec Engine scripts.
 * Display: watches the rendered #iq-total-price (never writes its text, never touches pricing files or markup).
 * v02 look: LTF brand gradient accents, promo row centered under the quote box, old/new price side by side.
 * v03 (Nate t165u, CSS only): code + Claim boxes slimmer; 10 squares in ONE centered row under them (phones: smaller squares, still one row); old/new price closer.
 * v04 (Nate t166u, CSS + count label only): hover ring sits exactly on the white Claim box edge (no gap); phone glow kept inside the viewport (12px side room: the engine's .iq-receipt clips overflow-x on phones);
 *   squares are plain white/grey outlines; 'N Left!' sits right of the squares on the same row; 'Locked in' line position unchanged.
 * Spots box: limit/claimed come only from the promo web app (Promos tab + Promo_Claims log).
 * Submit: claims on the promo web app, then adds promo fields to the quote POST. */
(function () {
  'use strict';
  var WEB_APP_URL = 'PASTE_PROMO_WEB_APP_EXEC_URL_HERE';
  var CODE = 'CREW20', PCT = 20, LIMIT = 10; // preview defaults; the sheet wins when connected
  var SHOW_WITHOUT_URL_CODE = false; // keep the box hidden unless the link carries ?code=
  var st = { promo: null, applied: false, mine: {} }; // mine = emails claimed in this visit (retry-safe)
  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) {
    return window.IQ && IQ.formatMoney ? IQ.formatMoney(v) : '$' + v.toFixed(2);
  };
  var round = function (v) { return Math.round(v * 100) / 100; };
  var pct = function () { return (st.promo && st.promo.pct) || PCT; };

  var LIVE = /^https:\/\/script\.google\.com\//.test(WEB_APP_URL);
  // ?demo=1 = PREVIEW-only visual demo (1 spot drawn as claimed). Ignored once connected, so it can never touch real counts or claims.
  var DEMO = !LIVE && /[?&]demo=1(&|$)/.test(location.search);
  // PREVIEW: no web app URL yet -> discount on screen only, real default count (0 claimed), no claim, submit untouched.
  function api(params) {
    if (!LIVE) return Promise.resolve(params.code === CODE
      ? { ok: true, code: CODE, active: true, open: true, pct: PCT, limit: LIMIT, claimed: DEMO ? 1 : 0, preview: true }
      : { ok: false, reason: 'unknown_code' });
    var qs = Object.keys(params).map(function (k) {
      return k + '=' + encodeURIComponent(params[k] == null ? '' : params[k]);
    }).join('&');
    return fetch(WEB_APP_URL + '?' + qs, { redirect: 'follow', credentials: 'omit' })
      .then(function (r) { return r.json(); });
  }

  var G = 'linear-gradient(45deg,#4D259D,#2AAAB8,#1F7781,#0B8050,#7040C0,#4D259D)'; // LTF brand gradient (site CSS)
  var GLOW = '0 0 16px #4D259D73,0 0 28px #1F778147'; // site .ltf-btn-gradient-wrap hover glow (rgba .45/.28 as hex)
  // Rough brush X (white), drawn past the square's edge
  var X = '<svg viewBox="0 0 40 40" aria-hidden="true"><path filter="url(#c20-rough)" d="M2 5 6 2 12 6 19 13 27 20 36 30 38 35 35 38 28 34 21 27 13 20 6 11ZM36 3 39 6 33 12 26 19 18 27 9 35 5 39 1 36 8 29 15 21 22 15 30 8Z"/></svg>';

  function css() {
    var s = document.createElement('style');
    var gb = 'border:2px solid transparent;background:linear-gradient(#00001c,#00001c) padding-box,' + G + ' border-box;';
    s.textContent =
      '#crew20{--g:' + GLOW + ';flex:0 0 100%;width:100%;display:flex;flex-direction:column;align-items:center;gap:12px;font:inherit;font-size:16px;color:#E2E8F0;text-align:center}' +
      '#crew20[hidden]{display:none}' +
      '#c20-three{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}' +
      '#c20-code,#c20-btn{box-sizing:border-box;width:210px;height:60px;margin:0;border-radius:10px}' +
      '#c20-code{' + gb + 'padding:0 12px;color:#fff;font:inherit;font-size:22px;font-weight:700;letter-spacing:.12em;text-align:center;text-transform:uppercase;outline:none}' +
      '#c20-btn{position:relative;border:0;background:#fff;color:#00001c;font:inherit;font-size:18px;font-weight:900;text-transform:uppercase;cursor:pointer;transition:box-shadow .35s}' +
      '#c20-btn:before{content:"";position:absolute;inset:0;border-radius:10px;padding:2px;background:' + G + ';background-size:200% 200%;' +
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;opacity:0;transition:opacity .35s;pointer-events:none}' +
      '#c20-btn:focus-visible{outline:none}#c20-code:focus,.c20-ok #c20-btn:hover,.c20-ok #c20-btn:focus-visible{box-shadow:var(--g)}' +
      '.c20-ok #c20-btn:hover:before,.c20-ok #c20-btn:focus-visible:before{opacity:1;animation:c20-shift 3s linear infinite}' +
      '#c20-btn:disabled{cursor:default}.c20-closed #c20-btn{opacity:.5}' +
      '@keyframes c20-shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}' +
      '#c20-spots{flex:0 0 100%;display:flex;align-items:center;justify-content:center;gap:12px;padding:4px 0 25px}' +
      '#c20-spots[hidden]{display:none}' +
      '#c20-sq{display:grid;grid-template-columns:repeat(10,20px);gap:12px}' +
      '#c20-sq i{position:relative;width:20px;height:20px;box-sizing:border-box;border-radius:3px;border:2px solid #C3C8D4}' +
      '#c20-sq svg{position:absolute;left:-7px;top:-7px;width:30px;height:30px;fill:#fff;overflow:visible;filter:drop-shadow(0 0 3px rgba(0,0,28,.9))}' +
      '#c20-left{font-size:15px;font-weight:700;line-height:1;color:#fff;white-space:nowrap}' +
      '#c20-msg{font-size:17px;opacity:.85;min-height:1.3em}' +
      '#c20-badge{font-size:11px;letter-spacing:.08em;opacity:.4}#c20-badge:empty{display:none}' +
      '#iq-total-price.c20-struck{translate:-22% 0;color:#7C8296;text-decoration:line-through;text-decoration-thickness:2px;transition:translate .6s,color .6s}' +
      '#c20-new{position:absolute!important;z-index:1;box-sizing:border-box;padding-left:8px;display:flex;align-items:center;justify-content:flex-start;margin:0;color:#fff;font-weight:700;line-height:1.02;white-space:nowrap;opacity:0;translate:-20px 0;transition:opacity .5s .2s,translate .6s .1s;pointer-events:none}' +
      '#c20-new.c20-in{opacity:1;translate:0 0}#c20-new[hidden]{display:none}' +
      '@media (max-width:720px){#c20-three{gap:10px;padding:0 12px}#c20-code,#c20-btn{width:calc(50% - 5px);max-width:170px;height:50px}#c20-code{font-size:18px;padding:0 6px}#c20-btn{font-size:15px}' +
      '#c20-sq{zoom:.8;gap:9px}#c20-spots{gap:9px}#c20-left{font-size:14px}#iq-total-price.c20-struck{translate:-26% 0}' +
      '#crew20{--g:0 0 8px #4D259D80,0 0 14px #1F77814D}}';
    document.head.appendChild(s);
  }

  function build(code) {
    var total = $('iq-total-price');
    if (!total || $('crew20')) return null;
    // Promo row sits under the quote card (full-width flex row, centered); the new price is a sibling inside the card.
    var card = total.closest('.iq-total-wrapper') || total.parentNode;
    var np = document.createElement('span');
    np.id = 'c20-new';
    np.hidden = true;
    np.innerHTML = '<span></span>';
    card.appendChild(np);
    var box = document.createElement('div');
    box.id = 'crew20';
    box.hidden = true;
    box.innerHTML =
      '<svg width="0" height="0" style="position:absolute"><filter id="c20-rough"><feTurbulence baseFrequency=".6" numOctaves="2"/>' +
      '<feDisplacementMap in="SourceGraphic" scale="3.5"/></filter></svg>' +
      '<div id="c20-three"><input id="c20-code" aria-label="Promo code" autocomplete="off">' +
      '<button type="button" id="c20-btn">Claim ' + PCT + '% off</button>' +
      '<div id="c20-spots" hidden aria-live="polite"><div id="c20-sq"></div><span id="c20-left"></span></div></div>' +
      '<span id="c20-msg"></span><span id="c20-badge"></span>';
    card.parentNode.insertBefore(box, card.nextSibling);
    $('c20-code').value = code;
    $('c20-btn').addEventListener('click', onClaimClick);
    new MutationObserver(render).observe(total, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', render);
    return box;
  }

  // Spots box: only ever drawn from a server (or preview default) limit/claimed pair. Nothing is pre-filled.
  function spots(p) {
    var lim = Math.floor(Number(p && p.limit)), got = Math.floor(Number(p && p.claimed));
    if (!(lim > 0) || !(got >= 0)) { $('c20-spots').hidden = true; return; }
    got = Math.min(got, lim);
    var left = lim - got, h = '';
    for (var i = 0; i < Math.min(lim, 50); i++) h += i < got ? '<i class="c20-x">' + X + '</i>' : '<i></i>';
    $('c20-sq').innerHTML = h;
    $('c20-left').textContent = left > 0 ? left + ' Left!' : 'All ' + lim + ' claimed';
    $('c20-spots').setAttribute('aria-label', $('c20-left').textContent);
    $('c20-spots').hidden = false;
  }

  function showState(p) {
    var box = $('crew20');
    st.promo = p && p.ok ? p : null;
    if (!p || !p.ok || !p.active) { box.hidden = true; unapply(); return false; } // inactive/unknown/error: hide all
    box.hidden = false;
    box.className = p.open && p.limit > p.claimed ? 'c20-ok' : 'c20-closed';
    $('c20-btn').textContent = 'Claim ' + pct() + '% off';
    $('c20-badge').textContent = p.preview ? 'PREVIEW - ' + (DEMO ? 'demo count' : 'not connected') : '';
    spots(p);
    if (!p.open || !(p.limit > p.claimed)) {
      $('c20-btn').disabled = true;
      $('c20-msg').textContent = 'This promo is closed.';
      unapply();
      return false;
    }
    return true;
  }

  function onClaimClick() {
    var btn = $('c20-btn');
    var code = $('c20-code').value.trim().toUpperCase();
    btn.disabled = true;
    $('c20-msg').textContent = '';
    api({ action: 'check', code: code }).then(function (p) {
      if (p && p.reason === 'unknown_code') { $('c20-msg').textContent = 'That code isn\u2019t valid.'; btn.disabled = false; return; }
      if (!showState(p)) return;
      st.applied = true;
      btn.textContent = pct() + '% off applied';
      $('c20-msg').textContent = 'Locked in when you submit your project brief.';
      render();
    }).catch(function () { $('c20-msg').textContent = 'Couldn\u2019t reach the promo server. Try again.'; btn.disabled = false; });
  }

  function baseTotal() {
    var t = $('iq-total-price');
    var n = t ? parseFloat((t.textContent || '').replace(/[^0-9.-]/g, '')) : NaN;
    return isNaN(n) ? 0 : n;
  }

  var FS = 0; // engine's own price font size, read once
  function render() { // re-runs on every total change (Calculate, count-up frames) and resize; never writes the engine's text
    var np = $('c20-new'), t = $('iq-total-price');
    if (!np || !st.applied) return;
    var base = baseTotal(), w = t.offsetWidth, sp = np.firstChild;
    if (!FS) { var cs = getComputedStyle(t); FS = parseFloat(cs.fontSize) || 48; np.style.fontFamily = cs.fontFamily; }
    t.classList.toggle('c20-struck', base > 0);
    np.hidden = !(base > 0);
    if (np.hidden) return;
    // old price centers in the left half, new price in the right half; shrink both together if a half is too tight
    np.style.fontSize = FS + 'px';
    sp.textContent = t.textContent;
    var f = Math.max(20, Math.min(FS, Math.floor(FS * (w / 2 - 14) / (sp.offsetWidth || 1))));
    sp.textContent = money(round(base * (1 - pct() / 100)));
    np.style.fontSize = t.style.fontSize = f + 'px';
    np.style.left = (t.offsetLeft + w / 2) + 'px';
    np.style.width = (w / 2) + 'px';
    var a = t.getBoundingClientRect(), b = t.offsetParent.getBoundingClientRect(); // rect keeps the engine's own Y offset
    np.style.top = (a.top - b.top - t.offsetParent.clientTop) + 'px';
    np.style.height = a.height + 'px';
    if (!np.classList.contains('c20-in')) requestAnimationFrame(function () { np.classList.add('c20-in'); });
  }

  function unapply() {
    st.applied = false;
    var np = $('c20-new'), t = $('iq-total-price');
    if (np) { np.hidden = true; np.classList.remove('c20-in'); }
    if (t) { t.classList.remove('c20-struck'); t.style.fontSize = ''; }
  }

  function hidden(form, name, value) {
    var el = form.querySelector('input[name="' + name + '"]');
    if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
    el.value = value;
  }

  // Quote POST goes to IQ.FORM_CONFIG.webhookUrl as JSON, so promo fields ride inside that body.
  function hookSubmit() {
    var realFetch = window.fetch;
    window.fetch = function (url, opts) {
      var hook = st.applied && window.IQ && IQ.FORM_CONFIG && String(url) === IQ.FORM_CONFIG.webhookUrl &&
        opts && opts.method === 'POST' && typeof opts.body === 'string';
      if (!hook) return realFetch.apply(this, arguments);
      var self = this, args = arguments, sheet;
      try { sheet = JSON.parse(opts.body); } catch (e) { return realFetch.apply(self, args); }
      var snap = IQ.calculateQuote(IQ.getState(), IQ.PRICING_DATA); // base, straight from the engine
      var base = round(snap.total), p = pct(), price = round(base * (1 - p / 100));
      if (!(base > 0)) return realFetch.apply(self, args); // no claim on a $0 quote
      var code = st.promo.code, form = $('iq-order-form');
      var summary = (sheet.final_quantity || '') + ' x ' + (sheet.apparel_style || '') + ' | ' + money(base) + ' -> ' + money(price);
      return api({ action: 'claim', code: code, email: sheet.email, quote: summary }).then(function (r) {
        var em = String(sheet.email || '').trim().toLowerCase();
        if (r && r.reason === 'already_claimed' && st.mine[em]) r.ok = true; // resubmit after a failed POST
        if (r && r.limit) spots(r); // real count from the server
        if (r && r.ok) {
          st.mine[em] = true;
          sheet.promo_code = code; sheet.promo_discount_pct = p;
          sheet.promo_base_total = base; sheet.promo_price = price;
          sheet.quoted_estimate = price; sheet.total_estimate = price;
          sheet.project_notes = '[PROMO ' + code + ' -' + p + '%: ' + money(price) + ' (was ' + money(base) + ')] ' + (sheet.project_notes || '');
          if (form) { hidden(form, 'promo_code', code); hidden(form, 'promo_discount_pct', p); hidden(form, 'promo_price', price); }
        } else {
          sheet.project_notes = '[PROMO ' + code + ' not applied: ' + ((r && r.reason) || 'error') + '] ' + (sheet.project_notes || '');
          if ($('c20-msg')) $('c20-msg').textContent = r && r.reason === 'already_claimed'
            ? 'This email already used ' + code + ', so the quote went in at the regular price.'
            : 'Promo wasn\u2019t applied (' + ((r && r.reason) || 'error') + '). Your quote went in at the regular price.';
          unapply();
        }
      }, function () {
        sheet.project_notes = '[PROMO ' + code + ' requested - claim server unreachable, verify] ' + (sheet.project_notes || '');
      }).then(function () {
        var o = {}; for (var k in opts) o[k] = opts[k];
        o.body = JSON.stringify(sheet);
        return realFetch.call(self, url, o);
      });
    };
  }

  function init() {
    var code = (new URLSearchParams(location.search).get('code') || '').trim().toUpperCase();
    if (!code && !SHOW_WITHOUT_URL_CODE) return;
    if (!window.fetch) return;
    css();
    if (!build(code)) return;
    if (LIVE) hookSubmit(); // preview never touches the quote submit
    if (code) api({ action: 'check', code: code }).then(showState, function () { showState(null); });
    else $('crew20').hidden = false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

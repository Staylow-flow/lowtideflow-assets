/* LTF upload-align v1 (Oct 19 2026) - Live /spec-engine.
   Aligns the upload panel content to the left price box:
   >=992: Browse top/width/height = Calculate; title top = Total label top;
          Accepted vertical center = OTD link center; all centered in the panel.
   <=991: Browse horizontal center/width = Calculate; title/hint untouched.
   Never changes either box's height. Inline styles only, no translate. */
(function () {
  'use strict';
  var Q = function (s) { return document.querySelector(s); };
  var DESK = window.matchMedia('(min-width: 992px)');
  var raf = 0, busy = false;
  function set(el, k, v) { el.style.setProperty(k, v, 'important'); }
  function clr(el, ks) { ks.forEach(function (k) { el.style.removeProperty(k); }); }
  var KEYS = ['top', 'left', 'right', 'bottom', 'transform', 'margin-left', 'margin-right', 'margin-top', 'width', 'height', 'min-height', 'max-width', 'justify-self'];
  function rect(el) { return el.getBoundingClientRect(); }
  function placeAbs(el, top, cx, w, h) {
    set(el, 'transform', 'none'); set(el, 'right', 'auto'); set(el, 'bottom', 'auto');
    set(el, 'margin-left', '0px'); set(el, 'margin-right', '0px'); set(el, 'margin-top', '0px');
    if (w != null) { set(el, 'width', w + 'px'); set(el, 'max-width', 'none'); }
    if (h != null) { set(el, 'height', h + 'px'); set(el, 'min-height', '0px'); }
    var op = el.offsetParent; if (!op) return;
    var pr = rect(op), ew = rect(el).width;
    set(el, 'top', (top - pr.top - op.clientTop) + 'px');
    set(el, 'left', (cx - ew / 2 - pr.left - op.clientLeft) + 'px');
  }
  function run() {
    raf = 0; if (busy) return; busy = true;
    try {
      var box = Q('#iq-form-artwork-drop'), title = Q('.iq-form-upload-title'),
          hint = Q('#iq-form-upload-hint'), btn = Q('#iq-form-artwork-browse'),
          calc = Q('#iq-run-quote'), label = Q('.iq-total-label'), otd = Q('.iq-artwork-info-link');
      if (!box || !title || !hint || !btn || !calc || !label || !otd) return;
      var bh = box.style.height, lh;
      [title, hint, btn].forEach(function (e) { clr(e, KEYS); });
      var c = rect(calc); if (!c.width) return;
      if (DESK.matches) {
        var b = rect(box), cx = b.left + b.width / 2, L = rect(Q('.iq-total-wrapper') || box);
        /* Guard: only align when both boxes share top+bottom and Browse fits; otherwise leave Live as-is. */
        if (Math.abs(b.top - L.top) > 2 || Math.abs(b.bottom - L.bottom) > 2 || c.width > b.width - 40) return;
        placeAbs(btn, c.top, cx, c.width, c.height);
        placeAbs(title, rect(label).top, cx, null, null);
        var o = rect(otd), hh = rect(hint).height;
        placeAbs(hint, o.top + o.height / 2 - hh / 2, cx, null, null);
      } else {
        set(btn, 'width', c.width + 'px'); set(btn, 'max-width', 'none');
        set(btn, 'justify-self', 'start'); set(btn, 'margin-left', '0px'); set(btn, 'margin-right', '0px');
        var ml = 0;
        for (var i = 0; i < 4; i++) {
          var br = rect(btn), dx = (c.left + c.width / 2) - (br.left + br.width / 2);
          if (Math.abs(dx) < 0.3) break;
          ml += (i === 0 ? dx : dx * 2); /* centered flex/grid parents move the item by half the margin */
          set(btn, 'margin-left', ml + 'px');
        }
      }
    } finally { busy = false; }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(run); }
  function start() {
    kick();
    window.addEventListener('resize', kick, { passive: true });
    if (DESK.addEventListener) DESK.addEventListener('change', kick);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);
    var root = Q('.ltf-spec-calc-art') || document.body;
    new MutationObserver(function () { if (!busy) kick(); })
      .observe(root, { childList: true, subtree: true, characterData: true });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(kick);
      ['.iq-total-wrapper', '#iq-form-artwork-drop', '#iq-run-quote', '.iq-total-label'].forEach(function (s) { var e = Q(s); if (e) ro.observe(e); });
    }
    window.addEventListener('load', kick);
    setTimeout(kick, 600); setTimeout(kick, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

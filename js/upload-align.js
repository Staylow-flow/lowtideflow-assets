/* LTF upload-align v1 (Oct 19 2026) - Live /spec-engine.
   Aligns the upload panel content to the left price box:
   >=992: Browse top/width/height = Calculate; title top = Total label top;
          Accepted vertical center = OTD link center; all centered in the panel.
   <=991: Browse horizontal center/width = Calculate; title/hint untouched.
   Never changes either box's height. Inline styles only, no translate.
   v2: CREW20 (?code=) pins #crew20 to a px width; inside the grid that px width
   kept column 1 at its load width when narrowing, so the price box stayed taller
   than the upload box. Each run releases that width, lets the grid re-size, then
   re-pins it to the price box width.
   v3: instant-quote-embed.css (head <link> @9a0e19d) forces the title to
   font-weight 900 !important at >=992 in the idle state; inline 700 !important (v4: Nate wants 700; v3 was 500)
   here overrides it on desktop only. v5: title 700 @ 88% at all widths, centered on #iq-total-price (desktop), price-offset mirrored (stacked) (<=991 untouched, stays 700). */
(function () {
  'use strict';
  var Q = function (s) { return document.querySelector(s); };
  var DESK = window.matchMedia('(min-width: 992px)');
  var raf = 0, busy = false;
  function set(el, k, v) { el.style.setProperty(k, v, 'important'); }
  function clr(el, ks) { ks.forEach(function (k) { el.style.removeProperty(k); }); }
  var KEYS = ['top', 'left', 'right', 'bottom', 'transform', 'margin-left', 'margin-right', 'margin-top', 'width', 'height', 'min-height', 'max-width', 'justify-self', 'position', 'border-radius', 'font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-transform', 'text-wrap', 'white-space', 'font-family', 'text-align', 'padding-left', 'padding-right', 'grid-row', 'grid-column'];
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
      var c20 = Q('#crew20'), tw = Q('.iq-total-wrapper');
      if (c20 && tw && !c20.hidden) {
        c20.style.removeProperty('width');
        var nw = tw.getBoundingClientRect().width;
        if (nw) c20.style.width = nw + 'px';
      }
      var idle = !box.classList.contains('is-queue') && !box.classList.contains('is-loading');
      [title, hint, btn].forEach(function (e) { clr(e, KEYS); });
      var price = Q('#iq-total-price'), Lw = Q('.iq-total-wrapper');
      if (idle && DESK.matches) {
        set(title, 'font-weight', '700');
        var fs = parseFloat(getComputedStyle(title).fontSize);
        if (fs) set(title, 'font-size', (Math.round(fs * 0.88 * 100) / 100) + 'px'); /* v5: 88% of page size */
      }
      if (!idle) return; /* v6: queue/loading: leave the page's own layout, inline styles cleared above */
      var c = rect(calc); if (!c.width) return;
      if (DESK.matches) {
        var b = rect(box), cx = b.left + b.width / 2, L = rect(Q('.iq-total-wrapper') || box);
        /* Guard: only align when both boxes share top+bottom and Browse fits; otherwise leave Live as-is. */
        if (Math.abs(b.top - L.top) > 2 || Math.abs(b.bottom - L.bottom) > 2 || c.width > b.width - 40) return;
        placeAbs(btn, c.top, cx, c.width, c.height);
        var pr0 = rect(price || label), th = rect(title).height;
        placeAbs(title, pr0.top + pr0.height / 2 - th / 2 - 10, cx, null, null); /* v6: centered on price, 10px up */
        var o = rect(otd), hh = rect(hint).height;
        placeAbs(hint, o.top + o.height / 2 - hh / 2, cx, null, null);
      } else if (idle && price && Lw) {
        /* v6 stacked: mirror the Calc box. Title <-> price, Browse <-> Calculate, Accepted <-> Out the Door.
           Box-relative offsets copied from the Calc box; absolute inside .iq-form-upload-inner (no reflow). */
        var b2 = rect(box), l2 = rect(Lw), cx2 = c.left + c.width / 2, /* Calculate's center = Live Browse centering */ pc = rect(price), ps = getComputedStyle(price),
            cs = getComputedStyle(calc), os = getComputedStyle(otd), o2 = rect(otd);
        [title, btn, hint].forEach(function (el) { set(el, 'position', 'absolute'); set(el, 'grid-row', 'auto'); set(el, 'grid-column', 'auto'); }); /* abs grid items would use their grid area as containing block */
        /* title: 2 balanced lines, bold, sized off the price */
        set(title, 'font-weight', '700'); set(title, 'text-transform', 'uppercase'); set(title, 'text-align', 'center');
        set(title, 'line-height', '1.05'); set(title, 'font-family', ps.fontFamily);
        var tfs = Math.round(parseFloat(ps.fontSize) * 0.6 * 100) / 100;
        set(title, 'font-size', tfs + 'px'); set(title, 'white-space', 'nowrap');
        var one = rect(title).width, maxw = b2.width - 40;
        if (one * 0.62 > maxw) { tfs = Math.floor(tfs * maxw / (one * 0.62) * 100) / 100; set(title, 'font-size', tfs + 'px'); one = rect(title).width; }
        set(title, 'white-space', 'normal'); set(title, 'text-wrap', 'balance');
        var tw2 = Math.ceil(one * 0.62);
        set(btn, 'border-radius', cs.borderRadius); set(btn, 'font-size', cs.fontSize);
        set(btn, 'font-weight', cs.fontWeight); set(btn, 'letter-spacing', cs.letterSpacing);
        set(hint, 'font-size', os.fontSize); set(hint, 'text-align', 'center');
        for (var pass = 0; pass < 2; pass++) {
          b2 = rect(box);
          set(title, 'width', tw2 + 'px'); set(title, 'max-width', 'none');
          placeAbs(title, b2.top + (pc.top + pc.height / 2 - l2.top) - rect(title).height / 2, cx2, tw2, null);
          placeAbs(btn, b2.top + (c.top - l2.top), cx2, c.width, c.height);
          placeAbs(hint, b2.top + (o2.top - l2.top), cx2, c.width, null);
        }
      } else {
        set(btn, 'width', c.width + 'px'); set(btn, 'max-width', 'none');
        set(btn, 'justify-self', 'start'); set(btn, 'margin-left', '0px'); set(btn, 'margin-right', '0px');
        var ml = 0;
        for (var i = 0; i < 4; i++) {
          var br = rect(btn); if (!br.width) break; var dx = (c.left + c.width / 2) - (br.left + br.width / 2);
          if (Math.abs(dx) < 0.3) break;
          ml += (i === 0 ? dx : dx * 2);
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
      .observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(kick);
      ['.iq-total-wrapper', '#iq-form-artwork-drop', '#iq-run-quote', '.iq-total-label'].forEach(function (s) { var e = Q(s); if (e) ro.observe(e); });
    }
    window.addEventListener('load', kick);
    setTimeout(kick, 600); setTimeout(kick, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/**
 * Lowtideflow — Specs Vault Slam + Gemini edge ring + nebula gas bloom
 *
 * • Cards runway = full sticky height (not cage clip)
 * • Thin gradient ring locked on the white border (above card)
 * • Title card (01) gets same ring + gas on scroll 0–14%
 * • Gas is a delayed nebula / solar-flare glow trailing the ring — not a second stroke
 *
 * The effect body is left as the original IIFE so its tuning stays untouched;
 * the wrapper below only exposes init() to the bundle entry point instead of
 * self-booting on load.
 */

let bindAll = null;

(function () {
  'use strict';

  var C = {
    teal: [42, 170, 184],
    purple: [77, 37, 157],
    purpleM: [112, 64, 192],
    green: [31, 119, 129],
    greenD: [11, 128, 80],
  };
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var RESET_AT = 0.06;
  var RING_W = 6;
  var GAS_PAD = 80;
  var GAS_DELAY = 0.07;
  var GAS_PAL = [C.purple, C.purpleM, C.purple, C.teal, C.purpleM, C.green];
  var INT = 1.5;
  var FX_OPACITY = 0.625;
  var SETTLE_FADE_MS = 2400;
  var IDLE_MS = 180;
  var BLEND_LERP = 0.1;

  var BEATS = [
    { start: 0, end: 0.14, slam: false },
    { start: 0, end: 0.35, slam: true, restY: 0 },
    { start: 0.35, end: 0.66, slam: true, restY: 0 },
    { start: 0.66, end: 1, slam: true, restY: 0 },
  ];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  function readProgress(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var track = section.offsetHeight - vh;
    if (track <= 8) return 0;
    if (rect.top > 0) return 0;
    return clamp(-rect.top / track, 0, 1);
  }

  function isPinned(section) {
    return section.getBoundingClientRect().top <= 0;
  }

  function localBeat(progress, beat) {
    if (!beat) return 0;
    var span = beat.end - beat.start;
    if (span <= 0) return progress >= beat.end ? 1 : 0;
    return clamp((progress - beat.start) / span, 0, 1);
  }

  function beatSlams(beat) {
    return beat && beat.slam !== false;
  }

  function cardRadius(card) {
    var cs = getComputedStyle(card);
    var r = parseFloat(cs.borderTopLeftRadius);
    return isFinite(r) && r > 0 ? r : 12;
  }

  function cardBorderW(card) {
    var cs = getComputedStyle(card);
    var bw = parseFloat(cs.borderTopWidth);
    return isFinite(bw) && bw > 0 ? bw : 3;
  }

  /** Measure Y travel so card starts below the cards runway (full sticky height). */
  function measureSlamTravel(cardsHost, card) {
    var saved = card.style.transform;
    card.style.transform = 'translate3d(0,0,0)';
    var hostH = cardsHost.clientHeight;
    var relTop = card.offsetTop || 0;
    var cardH = card.offsetHeight || 280;
    card.style.transform = saved;
    return Math.max(hostH - relTop + cardH + 48, hostH * 0.85);
  }

  function createFxLayer(host, zIndex, kind) {
    var layer = document.createElement('div');
    layer.className = 'ltf-nebula-' + kind + '-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ltf-card-fx', kind);
    layer.style.cssText =
      'position:absolute;pointer-events:none;overflow:' +
      (kind === 'gas' ? 'visible' : 'hidden') +
      ';z-index:' +
      zIndex +
      ';';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    layer.appendChild(canvas);
    host.appendChild(layer);

    return {
      wrap: layer,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      cssW: 0,
      cssH: 0,
    };
  }

  function prepHost(host, sticky) {
    var runway = sticky.clientHeight || window.innerHeight || 800;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'hidden';
    host.style.minHeight = runway + 'px';
    host.style.height = runway + 'px';
  }

  /* Only ever run before building a fresh set of layers. This used to live in
     prepHost, which remeasure() also calls on resize — so the first resize tore
     the canvases out of the DOM while fx[] kept pointing at the detached nodes.
     Their clientWidth then read 0, resizeLayer bailed, and every effect went
     silently blank for the rest of the page's life. */
  function clearFxLayers(host) {
    host.querySelectorAll('.ltf-nebula-gas-layer, .ltf-nebula-ring-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepCards(cards, fx) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var cardZ = (i + 1) * 3;
      cards[i].style.willChange = 'transform';
      cards[i].style.transition = 'none';
      cards[i].style.position = 'absolute';
      cards[i].style.zIndex = String(cardZ);
      cards[i].style.backgroundClip = 'padding-box';
      if (fx[i]) {
        fx[i].gas.wrap.style.zIndex = String(cardZ + 1);
        fx[i].ring.wrap.style.zIndex = String(cardZ + 2);
      }
    }
  }

  function syncLayerToCard(host, layer, card, pad) {
    var hr = host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    var p = pad || 0;
    layer.wrap.style.left = r.left - hr.left - p + 'px';
    layer.wrap.style.top = r.top - hr.top - p + 'px';
    layer.wrap.style.width = r.width + p * 2 + 'px';
    layer.wrap.style.height = r.height + p * 2 + 'px';
  }

  function resizeLayer(layer) {
    var w = layer.wrap.clientWidth;
    var h = layer.wrap.clientHeight;
    if (w < 2 || h < 2) return false;
    if (layer.cssW === w && layer.cssH === h) return true;
    layer.canvas.width = w;
    layer.canvas.height = h;
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.cssW = w;
    layer.cssH = h;
    return true;
  }

  function cardDrawBox(layer, card, pad) {
    var p = pad || 0;
    return {
      x: p,
      y: p,
      w: layer.cssW - p * 2,
      h: layer.cssH - p * 2,
      r: cardRadius(card),
      bw: cardBorderW(card),
    };
  }

  function roundRectPath(ctx, x, y, w, h, rad) {
    var rr = Math.max(0, Math.min(rad, w / 2, h / 2));
    if (rr < 0.5) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** Path centered on the white border edge. */
  function borderMetrics(box, lineW) {
    var inset = box.bw * 0.5;
    var x = box.x + inset;
    var y = box.y + inset;
    var w = box.w - inset * 2;
    var h = box.h - inset * 2;
    var rad = Math.max(0, box.r - inset);
    var peri = 2 * (w + h) - 8 * rad + 2 * Math.PI * rad;
    return { x: x, y: y, w: w, h: h, rad: rad, peri: peri, lineW: lineW };
  }

  function drawBorderStroke(ctx, m, len, alpha, blur, dashOffset, composite) {
    if (len < 1.5 || alpha < 0.02 || m.peri < 8) return;

    var g = ctx.createLinearGradient(m.x, m.y, m.x + m.w, m.y + m.h);
    g.addColorStop(0, rgba(C.purple, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.25, rgba(C.teal, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.5, rgba(C.green, clamp(0.88 * alpha * INT, 0, 1)));
    g.addColorStop(0.75, rgba(C.purpleM, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(1, rgba(C.greenD, clamp(0.85 * alpha * INT, 0, 1)));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = g;
    ctx.globalCompositeOperation = composite || 'source-over';
    ctx.lineWidth = m.lineW;
    try {
      ctx.filter = blur ? 'blur(' + blur + 'px)' : 'none';
    } catch (e) {}
    roundRectPath(ctx, m.x, m.y, m.w, m.h, m.rad);
    ctx.setLineDash([len, m.peri + 2]);
    ctx.lineDashOffset = -dashOffset;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.filter = 'none';
    ctx.restore();
  }

  function drawRing(ctx, box, sweep, alpha, dashOffset) {
    if (sweep < 0.015 || alpha < 0.02) return;
    var m = borderMetrics(box, RING_W);
    var len = sweep * m.peri;
    drawBorderStroke(ctx, m, len, alpha, 0, dashOffset, 'source-over');
  }

  function hash01(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  /** Smooth hash between integer cells so gas morphs instead of sparkling. */
  function hashMorph(seed, cell) {
    var i = Math.floor(cell);
    var f = cell - i;
    f = f * f * (3 - 2 * f);
    return lerp(hash01(seed + i * 19.13), hash01(seed + (i + 1) * 19.13), f);
  }

  function wrapPeri(d, peri) {
    if (peri <= 0) return 0;
    var x = d % peri;
    return x < 0 ? x + peri : x;
  }

  /** Point + outward normal + clockwise tangent on the border-centered round rect. */
  function pointOnRoundRect(m, dist) {
    var x = m.x;
    var y = m.y;
    var w = m.w;
    var h = m.h;
    var r = Math.max(0, m.rad);
    var d = wrapPeri(dist, m.peri);
    var straightW = Math.max(0, w - 2 * r);
    var straightH = Math.max(0, h - 2 * r);
    var arc = (Math.PI * r) / 2;
    var px = x;
    var py = y;
    var nx = 0;
    var ny = -1;
    var tx = 1;
    var ty = 0;

    function take(len, place) {
      if (len < 0.25) return false;
      if (d > len) {
        d -= len;
        return false;
      }
      place(len < 0.001 ? 0 : d / len);
      return true;
    }

    if (
      take(straightW, function (t) {
        px = x + r + t * straightW;
        py = y;
        nx = 0;
        ny = -1;
        tx = 1;
        ty = 0;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(arc, function (t) {
        var a = -Math.PI / 2 + t * (Math.PI / 2);
        nx = Math.cos(a);
        ny = Math.sin(a);
        px = x + w - r + nx * r;
        py = y + r + ny * r;
        tx = -ny;
        ty = nx;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(straightH, function (t) {
        px = x + w;
        py = y + r + t * straightH;
        nx = 1;
        ny = 0;
        tx = 0;
        ty = 1;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(arc, function (t) {
        var a = t * (Math.PI / 2);
        nx = Math.cos(a);
        ny = Math.sin(a);
        px = x + w - r + nx * r;
        py = y + h - r + ny * r;
        tx = -ny;
        ty = nx;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(straightW, function (t) {
        px = x + w - r - t * straightW;
        py = y + h;
        nx = 0;
        ny = 1;
        tx = -1;
        ty = 0;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(arc, function (t) {
        var a = Math.PI / 2 + t * (Math.PI / 2);
        nx = Math.cos(a);
        ny = Math.sin(a);
        px = x + r + nx * r;
        py = y + h - r + ny * r;
        tx = -ny;
        ty = nx;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }
    if (
      take(straightH, function (t) {
        px = x;
        py = y + h - r - t * straightH;
        nx = -1;
        ny = 0;
        tx = 0;
        ty = -1;
      })
    ) {
      return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
    }

    var a = Math.PI + (arc < 0.25 ? 0 : (d / arc) * (Math.PI / 2));
    nx = Math.cos(a);
    ny = Math.sin(a);
    px = x + r + nx * r;
    py = y + r + ny * r;
    tx = -ny;
    ty = nx;
    return { x: px, y: py, nx: nx, ny: ny, tx: tx, ty: ty };
  }

  function drawGlowBlob(ctx, x, y, radius, rgb, a) {
    if (a < 0.012 || radius < 3) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(rgb, clamp(a, 0, 0.42)));
    g.addColorStop(0.28, rgba(rgb, clamp(a * 0.48, 0, 0.28)));
    g.addColorStop(0.62, rgba(rgb, clamp(a * 0.16, 0, 0.14)));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Nebula / solar-flare gas trailing the thin ring.
   * Radial blobs carry the look (Safari-safe). Wide low-alpha strokes are a
   * haze only — never a second crisp border. Blooms both inward and outward.
   */
  function drawGasBloom(ctx, box, sweep, alpha, dashOffset, now) {
    if (sweep < 0.015 || alpha < 0.02) return;

    var m = borderMetrics(box, RING_W);
    var len = sweep * m.peri;
    if (len < 1.5 || m.peri < 8) return;

    var t = now || 0;
    var morph = dashOffset * 0.11 + t * 0.000045;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    drawBorderStroke(ctx, borderMetrics(box, 96), len, alpha * 0.09, 0, dashOffset, 'screen');
    drawBorderStroke(ctx, borderMetrics(box, 62), len, alpha * 0.07, 0, dashOffset, 'screen');
    drawBorderStroke(ctx, borderMetrics(box, 38), len, alpha * 0.05, 8, dashOffset, 'screen');

    var count = Math.max(6, Math.min(26, Math.round(len / 26)));
    var i;
    for (i = 0; i < count; i++) {
      var u = (i + 0.5) / count;
      var dist = dashOffset + u * len;
      var h1 = hashMorph(i * 13.7 + 1.1, morph);
      var h2 = hashMorph(i * 17.3 + 2.2, morph);
      var h3 = hashMorph(i * 9.1 + 3.3, morph);
      var h4 = hashMorph(i * 23.9 + 4.4, morph);
      var pt = pointOnRoundRect(m, dist + (h1 - 0.5) * 22);
      var nOff = (h2 - 0.32) * 28;
      var tOff = (h3 - 0.5) * 16;
      var bx = pt.x + pt.nx * nOff + pt.tx * tOff;
      var by = pt.y + pt.ny * nOff + pt.ty * tOff;
      var rad = 22 + h4 * 44;
      var col = GAS_PAL[i % GAS_PAL.length];
      var flicker = 0.7 + 0.3 * Math.sin(t * 0.0022 + i * 1.61 + dist * 0.012);
      var a = alpha * (0.16 + h2 * 0.2) * flicker;
      drawGlowBlob(ctx, bx, by, rad, col, a);

      if (h3 > 0.52) {
        var dir = h3 > 0.78 ? 1 : -1;
        var tend = 14 + h1 * 32;
        drawGlowBlob(
          ctx,
          bx + pt.tx * tend * dir + pt.nx * (h4 - 0.5) * 12,
          by + pt.ty * tend * dir + pt.ny * (h4 - 0.5) * 12,
          rad * (0.38 + h1 * 0.22),
          col,
          a * 0.68
        );
      }
    }

    var bigN = Math.max(3, Math.min(9, Math.round(len / 78)));
    for (i = 0; i < bigN; i++) {
      var bu = (i + 0.35) / bigN;
      var bDist = dashOffset + bu * len;
      var bh = hashMorph(i * 31.1 + 8.8, morph * 0.7);
      var bpt = pointOnRoundRect(m, bDist);
      var bn = (bh - 0.28) * 18;
      drawGlowBlob(
        ctx,
        bpt.x + bpt.nx * bn,
        bpt.y + bpt.ny * bn,
        48 + bh * 42,
        GAS_PAL[(i * 2) % GAS_PAL.length],
        alpha * (0.1 + bh * 0.1) * (0.75 + 0.25 * Math.sin(t * 0.0014 + i * 2.3))
      );
    }

    ctx.restore();
  }

  /** Slow fade once a card's slam beat has finished (t → 1). */
  function settleFade(state, cardKey, beatT, now) {
    if (beatT < 0.995) {
      state.cardSettledAt[cardKey] = 0;
      return 1;
    }
    if (!state.cardSettledAt[cardKey]) state.cardSettledAt[cardKey] = now;
    var elapsed = now - state.cardSettledAt[cardKey];
    var t = clamp(elapsed / SETTLE_FADE_MS, 0, 1);
    return 1 - t * t;
  }

  function applyCards(cards, travels, progress, pinned) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i];
      var t = localBeat(progress, beat);
      var e = beatSlams(beat) ? (t === 0 || t === 1 ? t : easeOutCubic(t)) : 0;
      beats[i] = t;

      if (!beatSlams(beat)) {
        cards[i].style.transform = 'translate3d(0,0,0)';
      } else {
        var travel = travels[i];
        var y = pinned ? lerp(travel, beat.restY, e) : travel;
        cards[i].style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      }
    }
    return beats;
  }

  function bindSection(section) {
    var sticky = section.querySelector('.ltf-specs-vault-sticky') || section;
    var cardsHost =
      section.querySelector('.ltf-specs-vault-cards') ||
      section.querySelector('[data-ltf-slam-cards]');
    if (!cardsHost) return;

    var cards = [
      section.querySelector('.ltf-spec-card-01'),
      section.querySelector('.ltf-spec-card-02'),
      section.querySelector('.ltf-spec-card-03'),
      section.querySelector('.ltf-spec-card-04'),
    ].filter(Boolean);
    if (cards.length < 2) {
      cards = Array.prototype.slice.call(section.querySelectorAll('.ltf-spec-card'));
    }
    if (cards.length < 2) return;

    prepHost(cardsHost, sticky);
    clearFxLayers(cardsHost);

    var fx = [];
    var travels = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      if (!BEATS[i]) {
        travels[i] = 0;
        fx[i] = null;
        continue;
      }
      if (beatSlams(BEATS[i])) travels[i] = measureSlamTravel(cardsHost, cards[i]);
      else travels[i] = 0;
      var cardZ = (i + 1) * 3;
      fx[i] = {
        gas: createFxLayer(cardsHost, cardZ + 1, 'gas'),
        ring: createFxLayer(cardsHost, cardZ + 2, 'ring'),
      };
    }
    prepCards(cards, fx);

    var state = {
      target: 0,
      prevTarget: 0,
      lastScrollAt: 0,
      idleDrift: 0,
      syncBlend: 1,
      scrollSweep: {},
      idleSweep: {},
      cardSettledAt: {},
      lastT: 0,
    };

    function remeasure() {
      prepHost(cardsHost, sticky);
      for (i = 0; i < cards.length; i++) {
        if (BEATS[i] && beatSlams(BEATS[i])) travels[i] = measureSlamTravel(cardsHost, cards[i]);
      }
    }

    function sampleTarget() {
      state.prevTarget = state.target;
      state.target = readProgress(section);
      if (Math.abs(state.target - state.prevTarget) > 0.0004) {
        state.lastScrollAt = performance.now();
      }
    }

    function paintFx(fxItem, card, scrollSweep, idleSweep, scrollAlpha, idleAlpha, idleDrift, now) {
    var showScroll = scrollAlpha > 0.02;
    var showIdle = idleAlpha > 0.02;

    syncLayerToCard(cardsHost, fxItem.gas, card, GAS_PAD);
    syncLayerToCard(cardsHost, fxItem.ring, card);

    if (!showScroll && !showIdle) {
      if (fxItem.gas.cssW) fxItem.gas.ctx.clearRect(0, 0, fxItem.gas.cssW, fxItem.gas.cssH);
      if (fxItem.ring.cssW) fxItem.ring.ctx.clearRect(0, 0, fxItem.ring.cssW, fxItem.ring.cssH);
      return;
    }

    var gasScroll = clamp(scrollSweep - GAS_DELAY, 0, 1);
    var gasIdle = clamp(idleSweep - GAS_DELAY, 0, 1);
    var box;
    var peri = 1;
    var idleOffset = idleDrift;

    if (resizeLayer(fxItem.ring)) {
      box = cardDrawBox(fxItem.ring, card);
      peri = borderMetrics(box, RING_W).peri || 1;
      idleOffset = idleDrift * peri;
    }

    if (resizeLayer(fxItem.gas)) {
      box = cardDrawBox(fxItem.gas, card, GAS_PAD);
      var gctx = fxItem.gas.ctx;
      gctx.clearRect(0, 0, fxItem.gas.cssW, fxItem.gas.cssH);
      if (showScroll && gasScroll > 0.02) drawGasBloom(gctx, box, gasScroll, scrollAlpha, 0, now);
      if (showIdle && gasIdle > 0.02) drawGasBloom(gctx, box, gasIdle, idleAlpha, idleOffset, now);
    }

    if (fxItem.ring.cssW) {
      box = cardDrawBox(fxItem.ring, card);
      var rctx = fxItem.ring.ctx;
      rctx.clearRect(0, 0, fxItem.ring.cssW, fxItem.ring.cssH);
      if (showScroll && scrollSweep > 0.02 && scrollSweep < 0.995) {
        drawRing(rctx, box, scrollSweep, scrollAlpha, 0);
      }
      if (showIdle && idleSweep > 0.02 && idleSweep < 0.995) {
        drawRing(rctx, box, idleSweep, idleAlpha, idleOffset);
      }
    }
  }

    function frame(now) {
      if (!state.active) {
        state.raf = 0;
        return;
      }
      if (!state.lastT) state.lastT = now;
      state.lastT = now;

      sampleTarget();
      if (state.target < RESET_AT) {
        state.scrollSweep = {};
        state.idleSweep = {};
        state.cardSettledAt = {};
      }

      var pinned = isPinned(section);
      var scrolling = now - state.lastScrollAt < IDLE_MS;
      var beats = applyCards(cards, travels, state.target, pinned);

      if (scrolling) {
        state.syncBlend = lerp(state.syncBlend, 1, BLEND_LERP * 2.2);
      } else {
        state.syncBlend = lerp(state.syncBlend, 0, BLEND_LERP);
        if (!REDUCE.matches) state.idleDrift = (now * 0.00005) % 1;
      }

      for (i = 0; i < cards.length; i++) {
        if (!fx[i] || !BEATS[i]) continue;

        var t = beats[i];
        var key = String(i);
        if (state.scrollSweep[key] == null) state.scrollSweep[key] = 0;
        if (state.idleSweep[key] == null) state.idleSweep[key] = 0;

        if (scrolling || REDUCE.matches) state.scrollSweep[key] = t;
        state.idleSweep[key] = lerp(state.idleSweep[key], t, scrolling ? 0.2 : 0.1);

        var fade = settleFade(state, key, t, now);
        var baseAlpha = clamp(t * 1.15 * INT * FX_OPACITY * fade, 0, 1);
        var idleOffset = state.idleDrift * 0.18;

        paintFx(
          fx[i],
          cards[i],
          state.scrollSweep[key],
          state.idleSweep[key],
          baseAlpha * state.syncBlend,
          baseAlpha * (1 - state.syncBlend),
          idleOffset,
          now
        );
      }

      section.style.setProperty('--ltf-vault-progress', state.target.toFixed(4));
      state.raf = state.active ? requestAnimationFrame(frame) : 0;
    }

    /* Freeze the vault canvases whenever the section is offscreen. */
    function syncActive() {
      var shouldRun = state.inView && !document.hidden;
      if (shouldRun === state.active) return;
      state.active = shouldRun;
      if (shouldRun) {
        state.lastT = 0;
        state.raf = requestAnimationFrame(frame);
      } else if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        remeasure();
        for (i = 0; i < fx.length; i++) {
          if (!fx[i]) continue;
          fx[i].gas.cssW = 0;
          fx[i].gas.cssH = 0;
          fx[i].ring.cssW = 0;
          fx[i].ring.cssH = 0;
        }
        sampleTarget();
      },
      { passive: true }
    );

    sampleTarget();

    state.inView = true;
    state.active = false;
    state.raf = 0;

    if (typeof IntersectionObserver === 'function') {
      state.inView = false;
      new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          state.inView = entries[e].isIntersecting;
        }
        syncActive();
      }, { rootMargin: '200px' }).observe(section);
    }

    document.addEventListener('visibilitychange', syncActive);
    syncActive();
  }

  function init() {
    var mobile = window.matchMedia('(max-width: 991px)');
    if (mobile.matches) return;

    var nodes = document.querySelectorAll('[data-ltf-specs-slam], .ltf-specs-vault');
    Array.prototype.forEach.call(nodes, function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (!el.querySelector('.ltf-spec-card-02, .ltf-spec-card')) return;
      if (el.dataset.ltfSlamBound === '1') return;
      el.dataset.ltfSlamBound = '1';
      if (!el.hasAttribute('data-ltf-specs-slam')) el.setAttribute('data-ltf-specs-slam', '');
      bindSection(el);
    });
  }

  bindAll = init;
})();

/** Idempotent — safe to call again after Webflow swaps DOM in. */
export function init() {
  if (bindAll) bindAll();
}

export default init;

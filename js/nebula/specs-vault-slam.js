/**
 * Lowtideflow — Specs Vault Slam + Gemini edge ring + soft gas bloom
 *
 * • Crisp gradient ring on white border (above card)
 * • Soft blurred gas bloom behind card (slightly delayed, no hard clip)
 * • Scroll-synced sweep crossfades into idle drift
 */
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
  var RING_PAD = 14;
  var GAS_PAD = 48;
  var GAS_DELAY = 0.07;
  var INT = 1.5;
  var IDLE_MS = 180;
  var BLEND_LERP = 0.1;

  var BEATS = [
    null,
    { start: 0, end: 0.35, restY: 0 },
    { start: 0.35, end: 0.66, restY: 0 },
    { start: 0.66, end: 1, restY: 0 },
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
    if (!beat) return 1;
    var span = beat.end - beat.start;
    if (span <= 0) return progress >= beat.end ? 1 : 0;
    return clamp((progress - beat.start) / span, 0, 1);
  }

  function cardRadius(card) {
    var cs = getComputedStyle(card);
    var r = parseFloat(cs.borderTopLeftRadius);
    return isFinite(r) && r > 0 ? r : 12;
  }

  function offsetTopWithin(el, ancestor) {
    var top = 0;
    var node = el;
    while (node && node !== ancestor) {
      top += node.offsetTop || 0;
      node = node.offsetParent;
    }
    return node === ancestor ? top : null;
  }

  function measureSlamTravel(sticky, cardsHost, card) {
    var stickyH = sticky.clientHeight || window.innerHeight || 800;
    var cardH = card.offsetHeight || 280;
    var relTop = offsetTopWithin(card, sticky);
    if (relTop == null) relTop = offsetTopWithin(cardsHost, sticky) + (card.offsetTop || 0);
    return Math.max(stickyH - relTop + cardH + 96, cardH + 160);
  }

  function createFxLayer(host, zIndex, kind) {
    var layer = document.createElement('div');
    layer.className = 'ltf-nebula-' + kind + '-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ltf-card-fx', kind);
    layer.style.cssText =
      'position:absolute;pointer-events:none;overflow:visible;z-index:' + zIndex + ';';

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

  function prepSticky(sticky) {
    if (getComputedStyle(sticky).position === 'static') sticky.style.position = 'relative';
    sticky.style.overflow = 'visible';
    sticky.querySelectorAll('.ltf-nebula-gas-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepHost(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'hidden';
    host.querySelectorAll('.ltf-nebula-ring-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepCards(cards, fx) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var cardZ = (i + 1) * 4;
      cards[i].style.willChange = 'transform';
      cards[i].style.transition = 'none';
      cards[i].style.position = 'absolute';
      cards[i].style.zIndex = String(cardZ);
      if (fx[i]) {
        if (fx[i].gas) fx[i].gas.wrap.style.zIndex = String(cardZ - 1);
        if (fx[i].ring) fx[i].ring.wrap.style.zIndex = String(cardZ + 1);
      }
    }
  }

  function syncLayerBox(host, layer, card, pad) {
    var hr = host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    layer.wrap.style.left = r.left - hr.left - pad + 'px';
    layer.wrap.style.top = r.top - hr.top - pad + 'px';
    layer.wrap.style.width = r.width + pad * 2 + 'px';
    layer.wrap.style.height = r.height + pad * 2 + 'px';
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

  function ringBox(layer, card, pad) {
    return {
      x: pad,
      y: pad,
      w: Math.max(8, layer.cssW - pad * 2),
      h: Math.max(8, layer.cssH - pad * 2),
      r: cardRadius(card),
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

  function ringMetrics(box, lineW) {
    var inset = lineW * 0.5;
    var x = box.x + inset;
    var y = box.y + inset;
    var w = box.w - inset * 2;
    var h = box.h - inset * 2;
    var rad = Math.max(0, box.r - inset);
    var peri = 2 * (w + h) - 8 * rad + 2 * Math.PI * rad;
    return { x: x, y: y, w: w, h: h, rad: rad, peri: peri };
  }

  function drawRingStroke(ctx, m, len, alpha, lineW, blur, dashOffset, composite) {
    if (len < 1.5 || alpha < 0.02) return;

    var g = ctx.createLinearGradient(m.x, m.y, m.x + m.w, m.y + m.h);
    g.addColorStop(0, rgba(C.purple, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.25, rgba(C.teal, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.5, rgba(C.green, clamp(0.88 * alpha * INT, 0, 1)));
    g.addColorStop(0.75, rgba(C.purpleM, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(1, rgba(C.greenD, clamp(0.85 * alpha * INT, 0, 1)));

    ctx.save();
    roundRectPath(ctx, m.x, m.y, m.w, m.h, m.rad);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = g;
    ctx.globalCompositeOperation = composite || 'source-over';
    try {
      ctx.filter = blur ? 'blur(' + blur + 'px)' : 'none';
    } catch (e) {}
    ctx.lineWidth = lineW;
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
    var m = ringMetrics(box, RING_W);
    if (m.peri < 8) return;
    var len = sweep * m.peri;
    drawRingStroke(ctx, m, len, alpha, RING_W + 1.5, 2, dashOffset, 'source-over');
    drawRingStroke(ctx, m, len, alpha, RING_W, 0, dashOffset, 'source-over');
  }

  function drawGasBloom(ctx, box, sweep, alpha, dashOffset) {
    if (sweep < 0.015 || alpha < 0.02) return;
    var m = ringMetrics(box, RING_W + 10);
    if (m.peri < 8) return;
    var len = sweep * m.peri;
    drawRingStroke(ctx, m, len, alpha * 0.55, RING_W + 14, 22, dashOffset, 'screen');
    drawRingStroke(ctx, m, len, alpha * 0.35, RING_W + 22, 32, dashOffset, 'screen');
  }

  function applyCards(cards, travels, progress, pinned) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i];
      var t = localBeat(progress, beat);
      var e = beat ? (t === 0 || t === 1 ? t : easeOutCubic(t)) : 0;
      beats[i] = t;

      if (!beat) {
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

    prepSticky(sticky);
    prepHost(cardsHost);
    section.style.overflow = 'visible';

    var fx = [];
    var travels = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      travels[i] = BEATS[i] ? measureSlamTravel(sticky, cardsHost, cards[i]) : 0;
      if (!BEATS[i]) {
        fx[i] = null;
        continue;
      }
      var cardZ = (i + 1) * 4;
      fx[i] = {
        gas: createFxLayer(sticky, cardZ - 1, 'gas'),
        ring: createFxLayer(cardsHost, cardZ + 1, 'ring'),
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
      lastT: 0,
    };

    function remeasureTravels() {
      for (i = 0; i < cards.length; i++) {
        if (BEATS[i]) travels[i] = measureSlamTravel(sticky, cardsHost, cards[i]);
      }
    }

    function sampleTarget() {
      state.prevTarget = state.target;
      state.target = readProgress(section);
      if (Math.abs(state.target - state.prevTarget) > 0.0004) {
        state.lastScrollAt = performance.now();
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      if (state.target < RESET_AT) {
        state.scrollSweep = {};
        state.idleSweep = {};
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

        if (scrolling || REDUCE.matches) {
          state.scrollSweep[key] = t;
        }
        state.idleSweep[key] = lerp(state.idleSweep[key], t, scrolling ? 0.2 : 0.1);

        var scrollSweep = state.scrollSweep[key];
        var idleSweep = state.idleSweep[key];
        var gasScrollSweep = clamp(scrollSweep - GAS_DELAY, 0, 1);
        var gasIdleSweep = clamp(idleSweep - GAS_DELAY, 0, 1);
        var baseAlpha = clamp(t * 1.15 * INT, 0, 1);
        var scrollAlpha = baseAlpha * state.syncBlend;
        var idleAlpha = baseAlpha * (1 - state.syncBlend);
        var idleOffset = state.idleDrift * (ringMetrics(ringBox(fx[i].ring, cards[i], RING_PAD), RING_W).peri || 1) * 0.18;

        syncLayerBox(sticky, fx[i].gas, cards[i], GAS_PAD);
        syncLayerBox(cardsHost, fx[i].ring, cards[i], RING_PAD);

        if (resizeLayer(fx[i].gas)) {
          var gasBox = ringBox(fx[i].gas, cards[i], GAS_PAD);
          var gctx = fx[i].gas.ctx;
          gctx.clearRect(0, 0, fx[i].gas.cssW, fx[i].gas.cssH);
          if (scrollAlpha > 0.02 && gasScrollSweep > 0.02) {
            drawGasBloom(gctx, gasBox, gasScrollSweep, scrollAlpha, 0);
          }
          if (idleAlpha > 0.02 && gasIdleSweep > 0.02) {
            drawGasBloom(gctx, gasBox, gasIdleSweep, idleAlpha, idleOffset);
          }
        }

        if (resizeLayer(fx[i].ring)) {
          var ringBoxData = ringBox(fx[i].ring, cards[i], RING_PAD);
          var rctx = fx[i].ring.ctx;
          rctx.clearRect(0, 0, fx[i].ring.cssW, fx[i].ring.cssH);
          if (scrollAlpha > 0.02 && scrollSweep > 0.02 && scrollSweep < 0.995) {
            drawRing(rctx, ringBoxData, scrollSweep, scrollAlpha, 0);
          }
          if (idleAlpha > 0.02 && idleSweep > 0.02 && idleSweep < 0.995) {
            drawRing(rctx, ringBoxData, idleSweep, idleAlpha, idleOffset);
          }
        }
      }

      section.style.setProperty('--ltf-vault-progress', state.target.toFixed(4));
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        remeasureTravels();
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
    requestAnimationFrame(frame);
  }

  function init() {
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

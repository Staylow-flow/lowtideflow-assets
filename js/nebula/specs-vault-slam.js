/**
 * Lowtideflow — Specs Vault Slam + Gemini edge ring
 *
 * Gradient sweep on top of the white border (rounded, scroll-synced).
 * No gas FX.
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
  var RING_W = 4;
  var RING_PAD = 14; // canvas bleed so blur follows rounded corners
  var INT = 1.5;
  var IDLE_MS = 180;

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

  function createRingLayer(host, zIndex) {
    var layer = document.createElement('div');
    layer.className = 'ltf-nebula-ring-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ltf-card-fx', 'ring');
    layer.style.cssText =
      'position:absolute;pointer-events:none;overflow:visible;z-index:' +
      zIndex +
      ';border-radius:0;';

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

  function prepHost(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'hidden';
    host.querySelectorAll('.ltf-nebula-ring-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepCards(cards, rings) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var cardZ = (i + 1) * 2;
      cards[i].style.willChange = 'transform';
      cards[i].style.transition = 'none';
      cards[i].style.position = 'absolute';
      cards[i].style.zIndex = String(cardZ);
      if (rings[i]) rings[i].wrap.style.zIndex = String(cardZ + 1);
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

  function ringBox(layer, card) {
    var pad = RING_PAD;
    var r = cardRadius(card);
    return {
      x: pad,
      y: pad,
      w: Math.max(8, layer.cssW - pad * 2),
      h: Math.max(8, layer.cssH - pad * 2),
      r: r,
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

  /** Gradient ring centered on the white border — rounded to match the card. */
  function drawRing(ctx, box, sweep, alpha, idleDrift) {
    if (sweep < 0.015 || alpha < 0.02) return;

    var inset = RING_W * 0.5;
    var x = box.x + inset;
    var y = box.y + inset;
    var w = box.w - inset * 2;
    var h = box.h - inset * 2;
    var rad = Math.max(0, box.r - inset);
    var peri =
      2 * (w + h) -
      8 * rad +
      2 * Math.PI * rad;
    if (peri < 8) return;

    var len = sweep * peri;
    if (len < 1.5) return;

    var dashOffset = idleDrift * peri * 0.18;
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, rgba(C.purple, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.25, rgba(C.teal, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(0.5, rgba(C.green, clamp(0.88 * alpha * INT, 0, 1)));
    g.addColorStop(0.75, rgba(C.purpleM, clamp(0.92 * alpha * INT, 0, 1)));
    g.addColorStop(1, rgba(C.greenD, clamp(0.85 * alpha * INT, 0, 1)));

    ctx.save();
    roundRectPath(ctx, x, y, w, h, rad);
    ctx.clip();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = g;
    ctx.globalCompositeOperation = 'source-over';

    try {
      ctx.filter = 'blur(2px)';
    } catch (e) {}
    ctx.lineWidth = RING_W + 1.5;
    roundRectPath(ctx, x, y, w, h, rad);
    ctx.setLineDash([len, peri + 2]);
    ctx.lineDashOffset = -dashOffset;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.filter = 'none';
    ctx.lineWidth = RING_W;
    ctx.globalAlpha = clamp(alpha * INT, 0, 1);
    roundRectPath(ctx, x, y, w, h, rad);
    ctx.setLineDash([len, peri + 2]);
    ctx.lineDashOffset = -dashOffset;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function slamTravel(cardsHost, card) {
    var hostH = cardsHost.clientHeight || 400;
    var cardH = card.offsetHeight || 280;
    return hostH + cardH + 32;
  }

  function applyCards(cards, cardsHost, progress, pinned) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i];
      var t = localBeat(progress, beat);
      var e = beat ? (t === 0 || t === 1 ? t : easeOutCubic(t)) : 0;
      beats[i] = t;

      if (!beat) {
        cards[i].style.transform = 'translate3d(0,0,0)';
      } else if (!pinned) {
        var preTravel = slamTravel(cardsHost, cards[i]);
        cards[i].style.transform = 'translate3d(0,' + preTravel.toFixed(2) + 'px,0)';
      } else {
        var travel = slamTravel(cardsHost, cards[i]);
        cards[i].style.transform =
          'translate3d(0,' + lerp(travel, beat.restY, e).toFixed(2) + 'px,0)';
      }
    }
    return beats;
  }

  function bindSection(section) {
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

    prepHost(cardsHost);

    var rings = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      rings[i] = BEATS[i] ? createRingLayer(cardsHost, (i + 1) * 2 + 1) : null;
    }
    prepCards(cards, rings);

    var state = {
      host: cardsHost,
      target: 0,
      prevTarget: 0,
      lastScrollAt: 0,
      idleDrift: 0,
      fx: {},
      lastT: 0,
    };

    function sampleTarget() {
      state.prevTarget = state.target;
      state.target = readProgress(section);
      if (Math.abs(state.target - state.prevTarget) > 0.0004) {
        state.lastScrollAt = performance.now();
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      state.lastT = now;

      sampleTarget();
      if (state.target < RESET_AT) state.fx = {};

      var pinned = isPinned(section);
      var scrolling = now - state.lastScrollAt < IDLE_MS;
      var beats = applyCards(cards, cardsHost, state.target, pinned);

      if (!scrolling && !REDUCE.matches) {
        state.idleDrift = (now * 0.00005) % 1;
      }

      for (i = 0; i < cards.length; i++) {
        if (!rings[i] || !BEATS[i]) continue;

        var t = beats[i];
        var key = String(i);
        if (state.fx[key] == null) state.fx[key] = 0;

        if (scrolling || REDUCE.matches) {
          state.fx[key] = t;
        } else {
          state.fx[key] = lerp(state.fx[key], t, 0.12);
        }

        var sweep = state.fx[key];
        var wrapAlpha = clamp(sweep * 1.15 * INT, 0, 1);
        var showRing = sweep > 0.02 && sweep < 0.995;

        syncLayerBox(cardsHost, rings[i], cards[i], RING_PAD);
        if (!resizeLayer(rings[i])) continue;

        var ctx = rings[i].ctx;
        ctx.clearRect(0, 0, rings[i].cssW, rings[i].cssH);

        if (showRing) {
          drawRing(
            ctx,
            ringBox(rings[i], cards[i]),
            sweep,
            wrapAlpha,
            scrolling ? 0 : state.idleDrift
          );
        }
      }

      section.style.setProperty('--ltf-vault-progress', state.target.toFixed(4));
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        for (i = 0; i < rings.length; i++) {
          if (rings[i]) {
            rings[i].cssW = 0;
            rings[i].cssH = 0;
          }
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

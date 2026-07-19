/**
 * Lowtideflow — Specs Vault Slam + Gemini-style edge wrap
 *
 * Per-card FX layer (behind that card only, max ~20px past white border):
 *   • While a card reveals → nebula gradient sweeps around its perimeter
 *   • When it slams shut → small gas puff, fades ~0.9s
 *
 * Nebula: #4D259D #2AAAB8 #1F7781 #0B8050 #7040C0
 * Wire: data-ltf-specs-slam on .ltf-specs-vault
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
  var SCROLL_LERP = REDUCE.matches ? 1 : 0.16;
  var FX_LERP = REDUCE.matches ? 1 : 0.18;
  var RESET_AT = 0.06;
  var SLAM_AT = 0.92;
  var EDGE_OUT = 20;
  var RING_W = 5.25; // +50% vs prior 3.5
  var PUFF_LIFE = 0.85;
  var INT = 1.5; // depth / intensity boost

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
    var scrollable = section.offsetHeight - vh;
    if (scrollable > 8) return clamp(-rect.top / scrollable, 0, 1);
    return clamp((vh - rect.top) / (vh + Math.max(rect.height, 1)), 0, 1);
  }

  function localBeat(progress, beat) {
    if (!beat) return 1;
    var span = beat.end - beat.start;
    if (span <= 0) return progress >= beat.end ? 1 : 0;
    return clamp((progress - beat.start) / span, 0, 1);
  }

  /** One canvas layer per animating card — sits directly under that card in the stack. */
  function createCardLayer(host, layerZ) {
    var layer = document.createElement('div');
    layer.className = 'ltf-nebula-gas-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ltf-card-fx', '');
    layer.style.cssText =
      'position:absolute;pointer-events:none;overflow:visible;z-index:' +
      layerZ +
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
      puffs: [],
    };
  }

  function prepHost(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'hidden';
    host.querySelectorAll('.ltf-nebula-gas-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepCards(cards, layers) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var cardZ = (i + 1) * 2;
      cards[i].style.willChange = 'transform';
      cards[i].style.transition = 'none';
      cards[i].style.position = 'absolute';
      cards[i].style.zIndex = String(cardZ);
      if (layers[i]) layers[i].wrap.style.zIndex = String(cardZ - 1);
    }
  }

  function syncLayer(host, layer, card) {
    var hr = host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    var pad = EDGE_OUT;
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

  function localBox(layer) {
    var pad = EDGE_OUT;
    return {
      x: pad,
      y: pad,
      w: Math.max(8, layer.cssW - pad * 2),
      h: Math.max(8, layer.cssH - pad * 2),
      r: 12,
    };
  }

  function roundRectPath(ctx, x, y, w, h, rad) {
    var rr = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawWrap(ctx, box, sweep, now, alpha) {
    if (sweep < 0.02 || alpha < 0.02) return;

    var out = 6;
    var x = box.x - out;
    var y = box.y - out;
    var w = box.w + out * 2;
    var h = box.h + out * 2;
    var peri = (w + h) * 2;
    var len = sweep * peri;
    if (len < 2) return;

    var shift = (now * 0.00025) % 1;
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, rgba(C.purple, clamp(0.95 * alpha * INT, 0, 1)));
    g.addColorStop(0.25, rgba(C.teal, clamp(0.95 * alpha * INT, 0, 1)));
    g.addColorStop(0.5, rgba(C.green, clamp(0.9 * alpha * INT, 0, 1)));
    g.addColorStop(0.75, rgba(C.purpleM, clamp(0.95 * alpha * INT, 0, 1)));
    g.addColorStop(1, rgba(C.greenD, clamp(0.85 * alpha * INT, 0, 1)));

    ctx.save();
    try {
      ctx.filter = 'blur(9px)';
    } catch (e) {}
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = g;
    ctx.lineWidth = RING_W;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    roundRectPath(ctx, x, y, w, h, box.r + out);
    ctx.setLineDash([len, peri + 1]);
    ctx.lineDashOffset = -shift * peri * 0.15;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.filter = 'none';
    ctx.lineWidth = 3;
    ctx.globalAlpha = clamp(alpha * 0.85 * INT, 0, 1);
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, box.r + out - 1);
    ctx.setLineDash([len, peri + 1]);
    ctx.lineDashOffset = -shift * peri * 0.15;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    var cx = box.x + box.w * 0.5;
    var cy = box.y + box.h * 0.5;
    var hg = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(box.w, box.h) * 0.35,
      cx,
      cy,
      Math.max(box.w, box.h) * 0.55 + EDGE_OUT
    );
    hg.addColorStop(0, rgba(C.teal, 0));
    hg.addColorStop(0.55, rgba(C.purple, clamp(0.12 * alpha * sweep * INT, 0, 0.35)));
    hg.addColorStop(1, rgba(C.purpleM, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(box.x - EDGE_OUT, box.y - EDGE_OUT, box.w + EDGE_OUT * 2, box.h + EDGE_OUT * 2);
  }

  function spawnPuff(layer, box) {
    var cx = box.x + box.w * 0.5;
    var cy = box.y + box.h * 0.5;
    var hw = box.w * 0.5;
    var hh = box.h * 0.5;
    var n = REDUCE.matches ? 10 : 22;
    var parts = [];
    var i;
    for (i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      var rimX = cx + Math.cos(ang) * hw * 1.02;
      var rimY = cy + Math.sin(ang) * hh * 1.02;
      var nx = Math.cos(ang);
      var ny = Math.sin(ang);
      var spd = 40 + Math.random() * 90;
      parts.push({
        x: rimX,
        y: rimY,
        vx: nx * spd,
        vy: ny * spd,
        r: 4 + Math.random() * 10,
        life: 0.35 + Math.random() * 0.45,
        age: 0,
        rgb: i % 2 ? C.teal : C.purple,
      });
    }
    layer.puffs.push({ parts: parts, started: performance.now() });
  }

  function drawPuffs(ctx, layer, dt) {
    var next = [];
    var p;
    for (p = 0; p < layer.puffs.length; p++) {
      var puff = layer.puffs[p];
      var elapsed = (performance.now() - puff.started) / 1000;
      if (elapsed > PUFF_LIFE) continue;

      var fade = elapsed < 0.08 ? elapsed / 0.08 : 1 - (elapsed - 0.08) / (PUFF_LIFE - 0.08);
      fade = clamp(fade, 0, 1);

      var alive = 0;
      var i;
      for (i = 0; i < puff.parts.length; i++) {
        var pt = puff.parts[i];
        pt.age += dt;
        if (pt.age >= pt.life) continue;
        alive++;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        var t = pt.age / pt.life;
        var a = (1 - t) * fade;
        ctx.beginPath();
        ctx.fillStyle = rgba(pt.rgb, clamp(0.675 * a, 0, 1));
        ctx.arc(pt.x, pt.y, pt.r * (1 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0 || fade > 0.05) next.push(puff);
    }
    layer.puffs = next;
  }

  function applyCards(cards, progress, vh) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i];
      var t = localBeat(progress, beat);
      var e = beat ? (t === 0 || t === 1 ? t : easeOutCubic(t)) : 0;
      beats[i] = t;
      cards[i].style.transform = beat
        ? 'translate3d(0,' + lerp(vh, beat.restY, e).toFixed(2) + 'px,0)'
        : 'translate3d(0,0,0)';
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

    var layers = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      layers[i] = BEATS[i] ? createCardLayer(cardsHost, (i + 1) * 2 - 1) : null;
    }
    prepCards(cards, layers);

    var state = {
      host: cardsHost,
      target: 0,
      current: 0,
      fx: {},
      fired: {},
      lastT: 0,
    };

    function sampleTarget() {
      state.target = readProgress(section);
    }

    function hardReset() {
      state.fired = {};
      state.fx = {};
      for (i = 0; i < layers.length; i++) {
        if (!layers[i]) continue;
        layers[i].puffs = [];
        if (layers[i].cssW) layers[i].ctx.clearRect(0, 0, layers[i].cssW, layers[i].cssH);
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, SCROLL_LERP);
      if (state.current < RESET_AT) hardReset();

      var beats = applyCards(cards, state.current, window.innerHeight || 800);

      for (i = 0; i < cards.length; i++) {
        var layer = layers[i];
        if (!layer || !BEATS[i]) continue;

        syncLayer(cardsHost, layer, cards[i]);
        if (!resizeLayer(layer)) continue;

        var t = beats[i];
        var key = String(i);
        if (state.fx[key] == null) state.fx[key] = 0;
        state.fx[key] = lerp(state.fx[key], t, FX_LERP);

        var ctx = layer.ctx;
        ctx.clearRect(0, 0, layer.cssW, layer.cssH);

        var box = localBox(layer);
        var sweep = state.fx[key];
        var wrapAlpha = clamp(sweep * 1.2 * INT, 0, 1);
        if (sweep > 0.03 && sweep < 0.98) {
          drawWrap(ctx, box, sweep, now, wrapAlpha);
        }

        if (t >= SLAM_AT && !state.fired[key]) {
          state.fired[key] = true;
          spawnPuff(layer, box);
        }

        if (layer.puffs.length) {
          ctx.globalCompositeOperation = 'screen';
          try {
            ctx.filter = 'blur(12px)';
          } catch (e) {}
          drawPuffs(ctx, layer, dt);
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        for (i = 0; i < layers.length; i++) {
          if (layers[i]) {
            layers[i].cssW = 0;
            layers[i].cssH = 0;
          }
        }
        sampleTarget();
      },
      { passive: true }
    );

    sampleTarget();
    state.current = state.target;
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

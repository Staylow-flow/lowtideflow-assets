/**
 * Lowtideflow — Specs Vault Slam + Gemini-style edge wrap
 *
 * Per-card FX:
 *   • Gas puff + soft halo → behind the card (no clip)
 *   • Gradient sweep → on top of the white border (flush overlap)
 *
 * Nebula: #4D259D #2AAAB8 #1F7781 #0B8050 #7040C0
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
  var GAS_BLEED = 28; // soft gas halo past card edge
  var RING_W = 5.25;
  var PUFF_LIFE = 0.85;
  var INT = 1.5;
  var SLAM_TRAVEL = 320; // card rise distance — not full viewport

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

  /** Sticky pin progress: 0 when vault top hits viewport top, 1 when vault releases. */
  function readProgress(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var track = section.offsetHeight - vh;
    if (track > 8) return clamp(-rect.top / track, 0, 1);
    return clamp((vh - rect.top) / (vh + Math.max(rect.height, 1)), 0, 1);
  }

  function localBeat(progress, beat) {
    if (!beat) return 1;
    var span = beat.end - beat.start;
    if (span <= 0) return progress >= beat.end ? 1 : 0;
    return clamp((progress - beat.start) / span, 0, 1);
  }

  function createFxLayer(host, zIndex, kind) {
    var layer = document.createElement('div');
    layer.className = 'ltf-nebula-gas-layer ltf-nebula-' + kind + '-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ltf-card-fx', kind);
    layer.style.cssText =
      'position:absolute;pointer-events:none;overflow:visible;z-index:' +
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
      kind: kind,
      cssW: 0,
      cssH: 0,
      puffs: [],
    };
  }

  function prepHost(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'visible';
    host.querySelectorAll('.ltf-nebula-gas-layer').forEach(function (el) {
      el.remove();
    });
  }

  function prepSticky(sticky) {
    if (!sticky) return;
    sticky.style.overflow = 'visible';
  }

  function prepCards(cards, fx) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var cardZ = (i + 1) * 3;
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

  function boxFromLayer(layer, pad) {
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

  /** Gradient ring flush on the white border — drawn above the card. */
  function drawRing(ctx, box, sweep, now, alpha) {
    if (sweep < 0.02 || alpha < 0.02) return;

    var x = box.x;
    var y = box.y;
    var w = box.w;
    var h = box.h;
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
      ctx.filter = 'blur(4px)';
    } catch (e) {}
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = g;
    ctx.lineWidth = RING_W + 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    roundRectPath(ctx, x, y, w, h, box.r);
    ctx.setLineDash([len, peri + 1]);
    ctx.lineDashOffset = -shift * peri * 0.15;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.filter = 'none';
    ctx.lineWidth = RING_W;
    ctx.globalAlpha = clamp(alpha * INT, 0, 1);
    roundRectPath(ctx, x, y, w, h, box.r);
    ctx.setLineDash([len, peri + 1]);
    ctx.lineDashOffset = -shift * peri * 0.15;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Soft nebula halo behind card during reveal. */
  function drawGasHalo(ctx, box, sweep, alpha) {
    if (sweep < 0.03 || alpha < 0.02) return;
    var cx = box.x + box.w * 0.5;
    var cy = box.y + box.h * 0.5;
    var hg = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(box.w, box.h) * 0.38,
      cx,
      cy,
      Math.max(box.w, box.h) * 0.52 + GAS_BLEED
    );
    hg.addColorStop(0, rgba(C.teal, 0));
    hg.addColorStop(0.5, rgba(C.purple, clamp(0.1 * alpha * sweep * INT, 0, 0.28)));
    hg.addColorStop(1, rgba(C.purpleM, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    try {
      ctx.filter = 'blur(10px)';
    } catch (e) {}
    ctx.fillStyle = hg;
    ctx.fillRect(
      box.x - GAS_BLEED,
      box.y - GAS_BLEED,
      box.w + GAS_BLEED * 2,
      box.h + GAS_BLEED * 2
    );
    ctx.filter = 'none';
    ctx.restore();
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
      var rimX = cx + Math.cos(ang) * hw * 1.01;
      var rimY = cy + Math.sin(ang) * hh * 1.01;
      var nx = Math.cos(ang);
      var ny = Math.sin(ang);
      var spd = 40 + Math.random() * 90;
      parts.push({
        x: rimX,
        y: rimY,
        vx: nx * spd,
        vy: ny * spd,
        r: 4 + Math.random() * 12,
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

  function slamTravel(cards, cardIndex) {
    var card = cards[cardIndex];
    var h = card ? card.offsetHeight || 280 : 280;
    return Math.max(SLAM_TRAVEL, h + 48);
  }

  function applyCards(cards, progress) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i];
      var t = localBeat(progress, beat);
      var e = beat ? (t === 0 || t === 1 ? t : easeOutCubic(t)) : 0;
      beats[i] = t;
      var travel = beat ? slamTravel(cards, i) : 0;
      cards[i].style.transform = beat
        ? 'translate3d(0,' + lerp(travel, beat.restY, e).toFixed(2) + 'px,0)'
        : 'translate3d(0,0,0)';
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

    var fx = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      if (!BEATS[i]) {
        fx[i] = null;
        continue;
      }
      var cardZ = (i + 1) * 3;
      fx[i] = {
        gas: createFxLayer(cardsHost, cardZ - 1, 'gas'),
        ring: createFxLayer(cardsHost, cardZ + 1, 'ring'),
      };
    }
    prepCards(cards, fx);

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
      for (i = 0; i < fx.length; i++) {
        if (!fx[i]) continue;
        fx[i].gas.puffs = [];
        fx[i].ring.puffs = [];
        if (fx[i].gas.cssW) fx[i].gas.ctx.clearRect(0, 0, fx[i].gas.cssW, fx[i].gas.cssH);
        if (fx[i].ring.cssW) fx[i].ring.ctx.clearRect(0, 0, fx[i].ring.cssW, fx[i].ring.cssH);
      }
    }

    function paintLayer(layer, box, sweep, now, wrapAlpha, dt, isGas, allowRing) {
      var ctx = layer.ctx;
      ctx.clearRect(0, 0, layer.cssW, layer.cssH);

      if (isGas) {
        if (allowRing && sweep > 0.03 && sweep < 0.98) {
          drawGasHalo(ctx, box, sweep, wrapAlpha);
        }
        if (layer.puffs.length) {
          ctx.globalCompositeOperation = 'screen';
          try {
            ctx.filter = 'blur(14px)';
          } catch (e) {}
          drawPuffs(ctx, layer, dt);
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (allowRing && sweep > 0.03 && sweep < 0.98) {
        drawRing(ctx, box, sweep, now, wrapAlpha);
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, SCROLL_LERP);
      if (state.current < RESET_AT) hardReset();

      var beats = applyCards(cards, state.current);

      for (i = 0; i < cards.length; i++) {
        if (!fx[i] || !BEATS[i]) continue;

        var t = beats[i];
        var key = String(i);
        if (state.fx[key] == null) state.fx[key] = 0;
        state.fx[key] = lerp(state.fx[key], t, FX_LERP);

        var sweep = state.fx[key];
        var wrapAlpha = clamp(sweep * 1.2 * INT, 0, 1);
        var allowRing = sweep > 0.03 && sweep < 0.98;

        syncLayerBox(cardsHost, fx[i].gas, cards[i], GAS_BLEED);
        syncLayerBox(cardsHost, fx[i].ring, cards[i], 0);

        if (resizeLayer(fx[i].gas)) {
          var gasBox = boxFromLayer(fx[i].gas, GAS_BLEED);
          if (t >= SLAM_AT && !state.fired[key]) {
            state.fired[key] = true;
            spawnPuff(fx[i].gas, gasBox);
          }
          paintLayer(fx[i].gas, gasBox, sweep, now, wrapAlpha, dt, true, allowRing);
        }

        if (resizeLayer(fx[i].ring)) {
          var ringBox = boxFromLayer(fx[i].ring, 0);
          paintLayer(fx[i].ring, ringBox, sweep, now, wrapAlpha, dt, false, allowRing);
        }
      }

      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
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

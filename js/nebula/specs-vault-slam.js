/**
 * Lowtideflow — Specs Vault Slam + Gemini-style edge wrap
 *
 * Simple, tight FX (behind cards, max ~20px past white border):
 *   • While a card reveals on scroll → nebula gradient sweeps around the perimeter
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
  var EDGE_OUT = 20; // max px past white border
  var RING_W = 3.5;
  var PUFF_LIFE = 0.85;

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

  function createOverlay(host) {
    var old = host.querySelector('.ltf-nebula-gas-layer');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-gas-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.overflow = 'hidden';
    host.insertBefore(wrap, host.firstChild);

    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d') };
  }

  function resizeCanvas(state) {
    var w = state.wrap.clientWidth;
    var h = state.wrap.clientHeight;
    if (w < 2 || h < 2) return false;
    if (state.cssW === w && state.cssH === h) return true;
    state.canvas.width = w;
    state.canvas.height = h;
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.cssW = w;
    state.cssH = h;
    return true;
  }

  function cardBox(state, card) {
    var hr = state.wrap.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left - hr.left,
      y: r.top - hr.top,
      w: r.width,
      h: r.height,
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

  /** Gemini-style sweep: gradient arc grows with reveal progress. */
  function drawWrap(ctx, box, sweep, now, alpha) {
    if (sweep < 0.02 || alpha < 0.02) return;

    var out = 6; // ring sits just outside white border; glow bleeds to ~20px
    var x = box.x - out;
    var y = box.y - out;
    var w = box.w + out * 2;
    var h = box.h + out * 2;
    var peri = (w + h) * 2;
    var len = sweep * peri;
    if (len < 2) return;

    var shift = (now * 0.00025) % 1;
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, rgba(C.purple, 0.95 * alpha));
    g.addColorStop(0.25, rgba(C.teal, 0.95 * alpha));
    g.addColorStop(0.5, rgba(C.green, 0.9 * alpha));
    g.addColorStop(0.75, rgba(C.purpleM, 0.95 * alpha));
    g.addColorStop(1, rgba(C.greenD, 0.85 * alpha));

    ctx.save();
    try {
      ctx.filter = 'blur(6px)';
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

    // Tight inner ring (crisper edge)
    ctx.filter = 'none';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.85;
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, box.r + out - 1);
    ctx.setLineDash([len, peri + 1]);
    ctx.lineDashOffset = -shift * peri * 0.15;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Soft outer halo capped at ~20px
    var cx = box.x + box.w * 0.5;
    var cy = box.y + box.h * 0.5;
    var hg = ctx.createRadialGradient(cx, cy, Math.min(box.w, box.h) * 0.35, cx, cy, Math.max(box.w, box.h) * 0.55 + EDGE_OUT);
    hg.addColorStop(0, rgba(C.teal, 0));
    hg.addColorStop(0.55, rgba(C.purple, 0.08 * alpha * sweep));
    hg.addColorStop(1, rgba(C.purpleM, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(box.x - EDGE_OUT, box.y - EDGE_OUT, box.w + EDGE_OUT * 2, box.h + EDGE_OUT * 2);
  }

  function spawnPuff(state, box) {
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
    state.puffs.push({ parts: parts, started: performance.now() });
  }

  function drawPuffs(ctx, state, dt) {
    var next = [];
    var p;
    for (p = 0; p < state.puffs.length; p++) {
      var puff = state.puffs[p];
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
        ctx.fillStyle = rgba(pt.rgb, 0.45 * a);
        ctx.arc(pt.x, pt.y, pt.r * (1 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0 || fade > 0.05) next.push(puff);
    }
    state.puffs = next;
  }

  function prepCards(cards) {
    var i;
    for (i = 0; i < cards.length; i++) {
      cards[i].style.willChange = 'transform';
      cards[i].style.transition = 'none';
      cards[i].style.position = 'absolute';
      cards[i].style.zIndex = String(20 + i);
    }
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

    prepCards(cards);
    var overlay = createOverlay(cardsHost);
    var state = {
      wrap: overlay.wrap,
      canvas: overlay.canvas,
      ctx: overlay.ctx,
      cssW: 0,
      cssH: 0,
      target: 0,
      current: 0,
      fx: {}, // per-card smoothed sweep 0-1
      fired: {},
      puffs: [],
      lastT: 0,
    };

    function sampleTarget() {
      state.target = readProgress(section);
    }

    function hardReset() {
      state.fired = {};
      state.puffs = [];
      state.fx = {};
      if (state.ctx && state.cssW) state.ctx.clearRect(0, 0, state.cssW, state.cssH);
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, SCROLL_LERP);

      if (state.current < RESET_AT) hardReset();

      var beats = applyCards(cards, state.current, window.innerHeight || 800);

      if (!resizeCanvas(state)) {
        requestAnimationFrame(frame);
        return;
      }

      var ctx = state.ctx;
      ctx.clearRect(0, 0, state.cssW, state.cssH);

      var i;
      for (i = 0; i < cards.length; i++) {
        if (!BEATS[i]) continue;
        var t = beats[i];
        var key = String(i);
        if (state.fx[key] == null) state.fx[key] = 0;
        state.fx[key] = lerp(state.fx[key], t, FX_LERP);

        var box = cardBox(state, cards[i]);
        var sweep = state.fx[key];
        var wrapAlpha = clamp(sweep * 1.2, 0, 1);
        if (sweep > 0.03 && sweep < 0.98) {
          drawWrap(ctx, box, sweep, now, wrapAlpha * 0.75);
        }

        if (t >= SLAM_AT && !state.fired[key]) {
          state.fired[key] = true;
          spawnPuff(state, box);
        }
      }

      if (state.puffs.length) {
        ctx.globalCompositeOperation = 'screen';
        try {
          ctx.filter = 'blur(8px)';
        } catch (e) {}
        drawPuffs(ctx, state, dt);
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'source-over';
      }

      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        state.cssW = 0;
        state.cssH = 0;
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

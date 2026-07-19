/**
 * Lowtideflow — Nebula Scroll Engine (Section 2 Specs Vault)
 *
 * Performance model (no per-pixel DOM thrash):
 *   1) Passive scroll listener only updates a target timeline number
 *   2) One shared requestAnimationFrame loop lerps current → target
 *   3) Transforms use CSS variables + translate3d (compositor-friendly)
 *   4) Nebula burst renders on a dedicated canvas overlay
 *
 * Wire on Specs vault:
 *   <section class="ltf-specs-vault"
 *            data-ltf-nebula-scroll
 *            data-ltf-slam-threshold="0.88">
 */
(function () {
  'use strict';

  var TEAL = [31, 119, 129];
  var TEALL = [42, 170, 184];
  var PURPLE = [77, 37, 157];
  var PURPLEM = [112, 64, 192];
  var GREEN = [11, 128, 80];
  var PALETTE = [TEAL, TEALL, PURPLE, PURPLEM, GREEN];
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var LERP = REDUCE.matches ? 1 : 0.12;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function mixRgb(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t)),
    ];
  }

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  /** Sticky vault progress from section geometry (0 pin → 1 release). */
  function readVaultProgress(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var scrollable = section.offsetHeight - vh;
    if (scrollable > 8) return clamp(-rect.top / scrollable, 0, 1);
    var h = Math.max(rect.height, 1);
    return clamp((vh - rect.top) / (vh + h), 0, 1);
  }

  function createOverlay(sticky) {
    var existing = sticky.querySelector('.ltf-nebula-scroll-layer');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-scroll-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20;will-change:transform;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(sticky).position;
    if (pos === 'static' || !pos) sticky.style.position = 'relative';
    sticky.appendChild(wrap);

    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d') };
  }

  function resizeCanvas(state) {
    var dpr = 1; // locked scale — no high-DPR thrash on large iMacs
    var w = state.wrap.clientWidth;
    var h = state.wrap.clientHeight;
    if (w < 1 || h < 1) return;
    state.canvas.width = Math.floor(w * dpr);
    state.canvas.height = Math.floor(h * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cssW = w;
    state.cssH = h;
  }

  function spawnBurst(state, ox, oy, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var count = Math.round((REDUCE.matches ? 18 : 48) * intensity);
    var particles = [];
    var i;
    for (i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      var speed = (100 + Math.random() * 220) * intensity;
      particles.push({
        x: ox + (Math.random() - 0.5) * 16,
        y: oy + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.85),
        vy: Math.sin(angle) * speed * (0.55 + Math.random() * 0.85),
        r: 8 + Math.random() * 28,
        life: 0.4 + Math.random() * 0.65,
        age: 0,
        spin: (Math.random() - 0.5) * 2.4,
        colorA: PALETTE[(Math.random() * PALETTE.length) | 0],
        colorB: PALETTE[(Math.random() * PALETTE.length) | 0],
        wobble: Math.random() * Math.PI * 2,
      });
    }
    state.bursts.push({
      particles: particles,
      started: performance.now(),
      ox: ox,
      oy: oy,
    });
  }

  function drawBursts(state, dt) {
    var ctx = state.ctx;
    var w = state.cssW;
    var h = state.cssH;
    ctx.clearRect(0, 0, w, h);
    var next = [];
    var b;
    for (b = 0; b < state.bursts.length; b++) {
      var burst = state.bursts[b];
      var elapsed = (performance.now() - burst.started) / 1000;
      var flash = Math.max(0, 1 - elapsed * 1.55);
      if (flash > 0.02) {
        var g = ctx.createRadialGradient(burst.ox, burst.oy, 0, burst.ox, burst.oy, 130 + flash * 180);
        g.addColorStop(0, rgba(TEALL, 0.3 * flash));
        g.addColorStop(0.35, rgba(PURPLE, 0.18 * flash));
        g.addColorStop(0.7, rgba(GREEN, 0.08 * flash));
        g.addColorStop(1, rgba(PURPLE, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      var alive = 0;
      var i;
      for (i = 0; i < burst.particles.length; i++) {
        var p = burst.particles[i];
        p.age += dt;
        var t = p.age / p.life;
        if (t >= 1) continue;
        alive++;
        p.vx *= Math.pow(0.9, dt * 60);
        p.vy *= Math.pow(0.9, dt * 60);
        p.vy += 20 * dt;
        p.wobble += p.spin * dt;
        p.x += (p.vx + Math.cos(p.wobble) * 22) * dt;
        p.y += (p.vy + Math.sin(p.wobble * 1.2) * 14) * dt;
        var fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        fade = clamp(fade, 0, 1);
        var rgb = mixRgb(p.colorA, p.colorB, t);
        var radius = p.r * (0.5 + t * 1.35);
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.22 * fade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.55 * fade);
        ctx.arc(p.x, p.y, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0 || flash > 0.02) next.push(burst);
    }
    state.bursts = next;
    return state.bursts.length > 0;
  }

  /**
   * Apply slam transforms via CSS vars only (GPU). No layout reads in the hot path
   * except origin sampling when a burst fires.
   */
  function applyCards(cards, progress) {
    var n = cards.length;
    var beats = new Array(n);
    var i;
    for (i = 0; i < n; i++) {
      var local = progress * n - i;
      var t = clamp(local, 0, 1);
      var e = t === 0 ? 0 : t === 1 ? 1 : easeOutCubic(t);
      beats[i] = t;

      var y = lerp(70 + i * 16, i * 6, e);
      var scale = lerp(0.96, 1, e);
      var opacity = local < -0.12 ? 0.4 : lerp(0.55, 1, clamp(local + 0.12, 0, 1));
      var nebula = clamp((t - 0.55) / 0.45, 0, 1); // explosion scale/opacity map

      var card = cards[i];
      card.style.setProperty('--ltf-slam-y', y.toFixed(2) + 'px');
      card.style.setProperty('--ltf-slam-scale', scale.toFixed(3));
      card.style.setProperty('--ltf-slam-opacity', opacity.toFixed(3));
      card.style.setProperty('--ltf-nebula-t', nebula.toFixed(3));
      card.style.transform =
        'translate3d(0, var(--ltf-slam-y), 0) scale(var(--ltf-slam-scale))';
      card.style.opacity = 'var(--ltf-slam-opacity)';
      card.style.zIndex = String(1 + i);
      if (!card.dataset.ltfEngineReady) {
        card.style.willChange = 'transform, opacity';
        card.style.transition = 'none';
        card.dataset.ltfEngineReady = '1';
      }
    }
    return beats;
  }

  function cardOrigin(sticky, card) {
    var host = sticky.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left + r.width * 0.5 - host.left,
      y: r.top + r.height * 0.4 - host.top,
    };
  }

  function bindSection(section) {
    var threshold = parseFloat(section.getAttribute('data-ltf-slam-threshold') || '0.88');
    if (!isFinite(threshold)) threshold = 0.88;

    var sticky = section.querySelector('.ltf-specs-vault-sticky') || section;
    var cards = Array.prototype.slice.call(section.querySelectorAll('.ltf-spec-card'));
    if (!cards.length) return;

    // Strip legacy fart hooks so old scripts can't double-bind
    section.removeAttribute('data-ltf-nebula-fart');
    section.removeAttribute('data-ltf-fart-threshold');

    var overlay = createOverlay(sticky);
    var state = {
      wrap: overlay.wrap,
      canvas: overlay.canvas,
      ctx: overlay.ctx,
      cssW: 0,
      cssH: 0,
      bursts: [],
      fired: {},
      target: 0,
      current: 0,
      needsDraw: false,
      lastT: 0,
      raf: 0,
    };
    resizeCanvas(state);

    function sampleTarget() {
      state.target = readVaultProgress(section);
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        resizeCanvas(state);
        var o = cardOrigin(sticky, cards[i]);
        spawnBurst(state, o.x, o.y, i === cards.length - 1 ? 1.1 : 0.85);
        state.needsDraw = true;
      }
      if (state.current < 0.08) state.fired = {};
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0004) state.current = state.target;

      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));
      var beats = applyCards(cards, state.current);
      fireIfNeeded(beats);

      var bursting = drawBursts(state, dt);
      state.needsDraw = bursting;

      state.raf = requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        resizeCanvas(state);
        sampleTarget();
      },
      { passive: true }
    );

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        resizeCanvas(state);
      }).observe(sticky);
    }

    sampleTarget();
    state.current = state.target;
    state.raf = requestAnimationFrame(frame);
  }

  function init() {
    var nodes = document.querySelectorAll('[data-ltf-nebula-scroll], .ltf-specs-vault');
    if (!nodes.length) return;
    Array.prototype.forEach.call(nodes, function (el) {
      if (!el.hasAttribute('data-ltf-nebula-scroll')) {
        el.setAttribute('data-ltf-nebula-scroll', '');
      }
      bindSection(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

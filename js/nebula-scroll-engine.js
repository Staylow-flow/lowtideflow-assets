/**
 * Lowtideflow — Nebula Scroll Engine (Section 2 Specs Vault)
 *
 * Performance model (no per-pixel DOM thrash):
 *   1) Passive scroll / resize only wake the loop (optional)
 *   2) Shared requestAnimationFrame loop samples vault progress → lerps timeline
 *   3) Card transforms use translate3d (compositor-friendly)
 *   4) Nebula gas bloom + burst particles render on a dedicated canvas overlay
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
  var LERP = REDUCE.matches ? 1 : 0.14;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:40;isolation:isolate;will-change:transform;';

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
    if (w < 1 || h < 1) return false;
    if (state.cssW === w && state.cssH === h) return true;
    state.canvas.width = Math.floor(w * dpr);
    state.canvas.height = Math.floor(h * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cssW = w;
    state.cssH = h;
    return true;
  }

  function spawnBurst(state, ox, oy, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var count = Math.round((REDUCE.matches ? 22 : 56) * intensity);
    var particles = [];
    var i;
    for (i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
      var speed = (120 + Math.random() * 260) * intensity;
      particles.push({
        x: ox + (Math.random() - 0.5) * 18,
        y: oy + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.85),
        vy: Math.sin(angle) * speed * (0.55 + Math.random() * 0.85),
        r: 10 + Math.random() * 32,
        life: 0.45 + Math.random() * 0.7,
        age: 0,
        spin: (Math.random() - 0.5) * 2.6,
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

  /** Continuous gas bloom that tracks per-card slam progress (visible before burst). */
  function drawGasBlooms(state, origins, nebulaAmounts) {
    var ctx = state.ctx;
    var i;
    for (i = 0; i < origins.length; i++) {
      var amt = nebulaAmounts[i] || 0;
      if (amt < 0.02) continue;
      var o = origins[i];
      var radius = 40 + amt * 160;
      var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, radius);
      g.addColorStop(0, rgba(TEALL, 0.42 * amt));
      g.addColorStop(0.28, rgba(PURPLE, 0.28 * amt));
      g.addColorStop(0.55, rgba(GREEN, 0.14 * amt));
      g.addColorStop(1, rgba(PURPLEM, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBursts(state, dt) {
    var ctx = state.ctx;
    var next = [];
    var b;
    for (b = 0; b < state.bursts.length; b++) {
      var burst = state.bursts[b];
      var elapsed = (performance.now() - burst.started) / 1000;
      var flash = Math.max(0, 1 - elapsed * 1.35);
      if (flash > 0.02) {
        var g = ctx.createRadialGradient(
          burst.ox,
          burst.oy,
          0,
          burst.ox,
          burst.oy,
          150 + flash * 220
        );
        g.addColorStop(0, rgba(TEALL, 0.45 * flash));
        g.addColorStop(0.3, rgba(PURPLE, 0.28 * flash));
        g.addColorStop(0.65, rgba(GREEN, 0.12 * flash));
        g.addColorStop(1, rgba(PURPLE, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, state.cssW, state.cssH);
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
        p.vy += 22 * dt;
        p.wobble += p.spin * dt;
        p.x += (p.vx + Math.cos(p.wobble) * 24) * dt;
        p.y += (p.vy + Math.sin(p.wobble * 1.2) * 16) * dt;
        var fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        fade = clamp(fade, 0, 1);
        var rgb = mixRgb(p.colorA, p.colorB, t);
        var radius = p.r * (0.5 + t * 1.4);
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.28 * fade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.62 * fade);
        ctx.arc(p.x, p.y, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0 || flash > 0.02) next.push(burst);
    }
    state.bursts = next;
    return state.bursts.length > 0;
  }

  /**
   * Apply slam transforms (GPU). Returns { beats, nebulaAmounts }.
   */
  function applyCards(cards, progress) {
    var n = cards.length;
    var beats = new Array(n);
    var nebulaAmounts = new Array(n);
    var i;
    for (i = 0; i < n; i++) {
      var local = progress * n - i;
      var t = clamp(local, 0, 1);
      var e = t === 0 ? 0 : t === 1 ? 1 : easeOutBack(easeOutCubic(t));
      beats[i] = t;

      var y = lerp(78 + i * 18, i * 6, e);
      var scale = lerp(0.94, 1, e);
      var opacity = local < -0.15 ? 0.35 : lerp(0.55, 1, clamp(local + 0.15, 0, 1));
      var nebula = clamp((t - 0.45) / 0.55, 0, 1);
      nebulaAmounts[i] = nebula;

      var card = cards[i];
      card.style.transform =
        'translate3d(0,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(1 + i);
      card.style.setProperty('--ltf-nebula-t', nebula.toFixed(3));
      if (!card.dataset.ltfEngineReady) {
        card.style.willChange = 'transform, opacity';
        card.style.transition = 'none';
        card.dataset.ltfEngineReady = '1';
      }
    }
    return { beats: beats, nebulaAmounts: nebulaAmounts };
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
    var cards = Array.prototype.slice.call(
      section.querySelectorAll('.ltf-spec-card, .ltf-card')
    );
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
      lastT: 0,
      raf: 0,
      originsDirty: true,
      origins: [],
    };
    resizeCanvas(state);

    function sampleTarget() {
      state.target = readVaultProgress(section);
    }

    function refreshOrigins() {
      state.origins = cards.map(function (card) {
        return cardOrigin(sticky, card);
      });
      state.originsDirty = false;
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        resizeCanvas(state);
        refreshOrigins();
        var o = state.origins[i];
        spawnBurst(state, o.x, o.y, i === cards.length - 1 ? 1.25 : 0.95);
      }
      if (state.current < 0.08) state.fired = {};
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      // rAF connection: read scroll geometry every frame → lerp timeline
      sampleTarget();
      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0005) state.current = state.target;

      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));
      var applied = applyCards(cards, state.current);
      fireIfNeeded(applied.beats);

      if (!resizeCanvas(state)) {
        state.raf = requestAnimationFrame(frame);
        return;
      }

      // Origins track card motion; refresh cheaply each frame while vault is active
      if (state.current > 0.01 || state.originsDirty || state.bursts.length) {
        refreshOrigins();
      }

      state.ctx.clearRect(0, 0, state.cssW, state.cssH);
      drawGasBlooms(state, state.origins, applied.nebulaAmounts);
      drawBursts(state, dt);

      state.raf = requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', sampleTarget, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        state.cssW = 0;
        state.cssH = 0;
        state.originsDirty = true;
        resizeCanvas(state);
        sampleTarget();
      },
      { passive: true }
    );

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        state.cssW = 0;
        state.cssH = 0;
        state.originsDirty = true;
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
      if (!el.hasAttribute('data-ltf-slam-threshold')) {
        el.setAttribute('data-ltf-slam-threshold', '0.88');
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

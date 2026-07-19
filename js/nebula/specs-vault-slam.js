/**
 * Lowtideflow — Specs Vault Slam (JS replaces Webflow IX)
 *
 * Scroll-mapped card stack for `.ltf-specs-vault` + nebula gas bursts.
 * Uses passive scroll → target progress, requestAnimationFrame + lerp for motion.
 *
 * Why Gemini's snippet failed on Clean-slate:
 *   - Looked for #sliding-section-2 (does not exist)
 *   - Wrote transforms on every scroll tick (no rAF/lerp)
 *   - Used calc() inside transform (flaky)
 *
 * Wire on the Specs vault <section>:
 *   data-ltf-specs-slam
 *   data-ltf-slam-threshold="0.88"   (optional)
 *
 * Disable / delete the Webflow "Specs Card Reveal" interaction so it cannot fight.
 *
 * Depot:
 *   <script defer src="https://raw.githubusercontent.com/Staylow-flow/lowtideflow-assets/<SHA>/js/nebula/specs-vault-slam.js"></script>
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
  var LERP = REDUCE.matches ? 1 : 0.16;

  // Gemini-style beats (card 1 is the resting base — not animated).
  // Final restY = 0 so Webflow left/top fan offsets keep the stack look.
  var BEATS = [
    null, // card 01
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

  function readProgress(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var scrollable = section.offsetHeight - vh;
    if (scrollable > 8) return clamp(-rect.top / scrollable, 0, 1);
    var h = Math.max(rect.height, 1);
    return clamp((vh - rect.top) / (vh + h), 0, 1);
  }

  function localBeat(progress, beat) {
    if (!beat) return 1;
    var span = beat.end - beat.start;
    if (span <= 0) return progress >= beat.end ? 1 : 0;
    return clamp((progress - beat.start) / span, 0, 1);
  }

  function createOverlay(sticky) {
    var existing = sticky.querySelector('.ltf-nebula-gas-layer');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-gas-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:40;isolation:isolate;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(sticky).position;
    if (pos === 'static' || !pos) sticky.style.position = 'relative';
    sticky.appendChild(wrap);

    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d') };
  }

  function resizeCanvas(state) {
    var w = state.wrap.clientWidth;
    var h = state.wrap.clientHeight;
    if (w < 1 || h < 1) return false;
    if (state.cssW === w && state.cssH === h) return true;
    state.canvas.width = Math.floor(w);
    state.canvas.height = Math.floor(h);
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.cssW = w;
    state.cssH = h;
    return true;
  }

  function spawnBurst(state, ox, oy, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var count = Math.round((REDUCE.matches ? 24 : 64) * intensity);
    var particles = [];
    var i;
    for (i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      var speed = (140 + Math.random() * 280) * intensity;
      particles.push({
        x: ox + (Math.random() - 0.5) * 18,
        y: oy + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.85),
        vy: Math.sin(angle) * speed * (0.55 + Math.random() * 0.85),
        r: 12 + Math.random() * 34,
        life: 0.5 + Math.random() * 0.75,
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

  function drawGasBlooms(state, origins, amounts) {
    var ctx = state.ctx;
    var i;
    for (i = 0; i < origins.length; i++) {
      var amt = amounts[i] || 0;
      if (amt < 0.02) continue;
      var o = origins[i];
      var radius = 48 + amt * 180;
      var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, radius);
      g.addColorStop(0, rgba(TEALL, 0.5 * amt));
      g.addColorStop(0.28, rgba(PURPLE, 0.32 * amt));
      g.addColorStop(0.55, rgba(GREEN, 0.16 * amt));
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
      var flash = Math.max(0, 1 - elapsed * 1.25);
      if (flash > 0.02) {
        var g = ctx.createRadialGradient(
          burst.ox,
          burst.oy,
          0,
          burst.ox,
          burst.oy,
          160 + flash * 240
        );
        g.addColorStop(0, rgba(TEALL, 0.5 * flash));
        g.addColorStop(0.3, rgba(PURPLE, 0.3 * flash));
        g.addColorStop(0.65, rgba(GREEN, 0.14 * flash));
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
        ctx.fillStyle = rgba(rgb, 0.3 * fade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.65 * fade);
        ctx.arc(p.x, p.y, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0 || flash > 0.02) next.push(burst);
    }
    state.bursts = next;
  }

  function cardOrigin(sticky, card) {
    var host = sticky.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left + r.width * 0.5 - host.left,
      y: r.top + r.height * 0.4 - host.top,
    };
  }

  function prepCards(cards) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.style.willChange = 'transform';
      card.style.transition = 'none';
      card.style.zIndex = String(10 + i);
      // Ensure absolute stack can translate without layout thrash
      var cs = window.getComputedStyle(card);
      if (cs.position === 'static') card.style.position = 'absolute';
    }
  }

  /**
   * Gemini timeline in pure px (vh → pixels):
   *   card2: 0–35%   → 100vh → 0
   *   card3: 35–66%  → 100vh → 16px
   *   card4: 66–100% → 100vh → 32px
   */
  function applyCards(cards, progress, vh) {
    var amounts = [];
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i] || null;
      var t = localBeat(progress, beat);
      var e = t === 0 || t === 1 ? t : easeOutCubic(t);
      beats[i] = t;

      var y;
      if (!beat) {
        y = 0;
        amounts[i] = 0;
      } else {
        var fromY = vh; // 100vh in px
        var toY = beat.restY;
        y = lerp(fromY, toY, e);
        amounts[i] = clamp((t - 0.45) / 0.55, 0, 1);
      }

      cards[i].style.transform =
        'translate3d(0,' + y.toFixed(2) + 'px,0)';
    }
    return { beats: beats, amounts: amounts };
  }

  function bindSection(section) {
    var threshold = parseFloat(section.getAttribute('data-ltf-slam-threshold') || '0.88');
    if (!isFinite(threshold)) threshold = 0.88;

    var sticky = section.querySelector('.ltf-specs-vault-sticky') || section;
    var cards = [
      section.querySelector('.ltf-spec-card-01'),
      section.querySelector('.ltf-spec-card-02'),
      section.querySelector('.ltf-spec-card-03'),
      section.querySelector('.ltf-spec-card-04'),
    ].filter(Boolean);

    if (cards.length < 4) {
      cards = Array.prototype.slice.call(section.querySelectorAll('.ltf-spec-card'));
    }
    if (cards.length < 2) return;

    prepCards(cards);

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
      origins: [],
    };

    function sampleTarget() {
      state.target = readProgress(section);
    }

    function refreshOrigins() {
      state.origins = cards.map(function (card) {
        return cardOrigin(sticky, card);
      });
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (!BEATS[i]) continue; // skip base card
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        resizeCanvas(state);
        refreshOrigins();
        var o = state.origins[i] || {
          x: state.cssW * 0.72,
          y: state.cssH * 0.45,
        };
        spawnBurst(state, o.x, o.y, i === cards.length - 1 ? 1.35 : 1);
      }
      if (state.current < 0.06) state.fired = {};
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0004) state.current = state.target;

      var vh = window.innerHeight || 800;
      var applied = applyCards(cards, state.current, vh);
      fireIfNeeded(applied.beats);
      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));

      if (resizeCanvas(state)) {
        if (state.current > 0.01 || state.bursts.length) refreshOrigins();
        state.ctx.clearRect(0, 0, state.cssW, state.cssH);
        drawGasBlooms(state, state.origins, applied.amounts);
        drawBursts(state, dt);
      }

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
    // Snap initial poses so cards aren't stuck mid-stack before first paint
    applyCards(cards, state.current, window.innerHeight || 800);
    requestAnimationFrame(frame);
  }

  function init() {
    var nodes = document.querySelectorAll(
      '[data-ltf-specs-slam], .ltf-specs-vault[data-ltf-nebula-gas], .ltf-specs-vault'
    );
    if (!nodes.length) return;

    var bound = false;
    Array.prototype.forEach.call(nodes, function (el) {
      // Prefer explicit attr; otherwise first visible .ltf-specs-vault
      var prefers =
        el.hasAttribute('data-ltf-specs-slam') || el.hasAttribute('data-ltf-nebula-gas');
      if (!prefers && bound) return;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (!el.querySelector('.ltf-spec-card-02')) return;
      if (!el.hasAttribute('data-ltf-specs-slam')) {
        el.setAttribute('data-ltf-specs-slam', '');
      }
      bindSection(el);
      bound = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

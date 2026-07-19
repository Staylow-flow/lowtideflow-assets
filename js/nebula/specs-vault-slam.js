/**
 * Lowtideflow — Specs Vault Slam + Edge Nebula Leak
 *
 * Scroll-mapped card stack + gas that explodes BEHIND the slamming card,
 * leaks from white/edge perimeter, soft smoke + whirl, fades out ~1.7s.
 * Resets when you scroll back to the top of the vault.
 *
 * Reusable on any section:
 *   data-ltf-specs-slam
 *   data-ltf-slam-threshold="0.88"   (optional)
 *   children: .ltf-spec-card-01…04  (or .ltf-spec-card)
 *
 * Depot (jsDelivr — do not use raw.githubusercontent):
 *   <script defer src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@SHA/js/nebula/specs-vault-slam.js"></script>
 */
(function () {
  'use strict';

  var TEAL = [31, 119, 129];
  var TEALL = [42, 170, 184];
  var PURPLE = [77, 37, 157];
  var PURPLEM = [112, 64, 192];
  var GREEN = [11, 128, 80];
  var WHITE = [230, 236, 245];
  var PALETTE = [TEAL, TEALL, PURPLE, PURPLEM, GREEN];
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var LERP = REDUCE.matches ? 1 : 0.16;
  var BURST_LIFE = 1.75; // seconds — then totally gone
  var RESET_PROGRESS = 0.06;

  // Card 1 = base. Cards 2–4 slam on Gemini-style beats.
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

  /**
   * Gas layer MUST sit behind cards. Use z-index:-1 under an isolated stack host.
   * After drawing particles we punch opaque card rectangles out so gas never
   * covers titles (edge-leak only).
   */
  function createOverlay(cardsHost) {
    var existing = cardsHost.querySelector('.ltf-nebula-gas-layer');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-gas-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:-64px;pointer-events:none;overflow:visible;z-index:-1;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(cardsHost).position;
    if (pos === 'static' || !pos) cardsHost.style.position = 'relative';
    // Keep host stacking so negative z-index stays behind card siblings
    cardsHost.style.isolation = 'isolate';
    cardsHost.insertBefore(wrap, cardsHost.firstChild);

    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d'), pad: 64 };
  }

  /** Cut card faces out of the canvas so glow cannot sit on text. */
  function punchCardFaces(state, cards) {
    var ctx = state.ctx;
    var hr = state.wrap.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    var i;
    for (i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var x = r.left - hr.left;
      var y = r.top - hr.top;
      roundRect(ctx, x, y, r.width, r.height, 12);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
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

  function cardFrame(host, card, pad) {
    pad = pad == null ? 64 : pad;
    var hr = host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left - hr.left,
      y: r.top - hr.top,
      w: r.width,
      h: r.height,
      cx: r.left + r.width * 0.5 - hr.left,
      cy: r.top + r.height * 0.5 - hr.top,
      pad: pad,
    };
  }

  /**
   * Edge-biased spawn: particles born on the card perimeter and push OUTWARD
   * (white-edge gas leak + soft whirl / solar-flare tangents).
   */
  function spawnEdgeBurst(state, frame, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var count = Math.round((REDUCE.matches ? 36 : 90) * intensity);
    var particles = [];
    var i;
    var hw = frame.w * 0.5;
    var hh = frame.h * 0.5;

    for (i = 0; i < count; i++) {
      var kind = Math.random();
      // sample ellipse rim
      var ang = Math.random() * Math.PI * 2;
      var rimX = frame.cx + Math.cos(ang) * hw * (0.92 + Math.random() * 0.12);
      var rimY = frame.cy + Math.sin(ang) * hh * (0.92 + Math.random() * 0.12);
      // outward normal + whirl tangent
      var nx = Math.cos(ang);
      var ny = Math.sin(ang);
      var tx = -ny;
      var ty = nx;
      var outSpeed = (90 + Math.random() * 220) * intensity;
      var whirl = (40 + Math.random() * 120) * (Math.random() < 0.5 ? -1 : 1) * intensity;

      var life, r, type, colorA, colorB, alpha;
      if (kind < 0.35) {
        // soft smoke bloom
        type = 'smoke';
        life = 1.1 + Math.random() * 0.65;
        r = 28 + Math.random() * 48;
        colorA = mixRgb(PURPLE, TEAL, Math.random());
        colorB = mixRgb(TEALL, WHITE, 0.35);
        alpha = 0.22;
        outSpeed *= 0.55;
      } else if (kind < 0.7) {
        // gas leak along edge → white rim
        type = 'gas';
        life = 0.9 + Math.random() * 0.7;
        r = 10 + Math.random() * 22;
        colorA = mixRgb(TEALL, WHITE, 0.45 + Math.random() * 0.35);
        colorB = mixRgb(PURPLEM, GREEN, Math.random());
        alpha = 0.42;
      } else {
        // flare / spark whirl
        type = 'flare';
        life = 0.55 + Math.random() * 0.55;
        r = 3 + Math.random() * 9;
        colorA = mixRgb(WHITE, TEALL, Math.random() * 0.5);
        colorB = PALETTE[(Math.random() * PALETTE.length) | 0];
        alpha = 0.7;
        outSpeed *= 1.25;
        whirl *= 1.4;
      }

      particles.push({
        type: type,
        x: rimX,
        y: rimY,
        vx: nx * outSpeed * (0.55 + Math.random() * 0.7) + tx * whirl * 0.35,
        vy: ny * outSpeed * (0.55 + Math.random() * 0.7) + ty * whirl * 0.35,
        r: r,
        life: life,
        age: 0,
        spin: whirl * 0.02,
        wobble: ang,
        colorA: colorA,
        colorB: colorB,
        alpha: alpha,
      });
    }

    state.bursts.push({
      particles: particles,
      started: performance.now(),
      ox: frame.cx,
      oy: frame.cy,
      hw: hw,
      hh: hh,
      life: BURST_LIFE,
    });
  }

  function drawEdgeHalo(ctx, burst, fade) {
    if (fade < 0.02) return;
    // soft white-edge ring leaking outward
    var g = ctx.createRadialGradient(
      burst.ox,
      burst.oy,
      Math.min(burst.hw, burst.hh) * 0.55,
      burst.ox,
      burst.oy,
      Math.max(burst.hw, burst.hh) * 1.35
    );
    g.addColorStop(0, rgba(WHITE, 0));
    g.addColorStop(0.45, rgba(TEALL, 0.18 * fade));
    g.addColorStop(0.7, rgba(PURPLE, 0.22 * fade));
    g.addColorStop(1, rgba(PURPLEM, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(
      burst.ox,
      burst.oy,
      burst.hw * 1.25,
      burst.hh * 1.25,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawBursts(state, dt) {
    var ctx = state.ctx;
    var next = [];
    var b;
    for (b = 0; b < state.bursts.length; b++) {
      var burst = state.bursts[b];
      var elapsed = (performance.now() - burst.started) / 1000;
      var lifeT = clamp(elapsed / burst.life, 0, 1);
      // hold briefly, then ease out — fully gone by BURST_LIFE
      var fade =
        lifeT < 0.18
          ? lifeT / 0.18
          : lifeT > 0.55
            ? 1 - (lifeT - 0.55) / 0.45
            : 1;
      fade = clamp(fade, 0, 1);
      if (lifeT >= 1) continue;

      drawEdgeHalo(ctx, burst, fade);

      var alive = 0;
      var i;
      for (i = 0; i < burst.particles.length; i++) {
        var p = burst.particles[i];
        p.age += dt;
        var t = p.age / p.life;
        if (t >= 1) continue;
        alive++;

        // drag + slight lift (smoke rises)
        var drag = p.type === 'smoke' ? 0.94 : p.type === 'flare' ? 0.88 : 0.91;
        p.vx *= Math.pow(drag, dt * 60);
        p.vy *= Math.pow(drag, dt * 60);
        if (p.type === 'smoke') p.vy -= 18 * dt;
        else p.vy += 8 * dt;

        // mini whirl around burst center
        var dx = p.x - burst.ox;
        var dy = p.y - burst.oy;
        p.vx += -dy * p.spin * dt * 8;
        p.vy += dx * p.spin * dt * 8;
        p.wobble += p.spin * dt * 4;
        p.x += (p.vx + Math.cos(p.wobble) * (p.type === 'flare' ? 18 : 10)) * dt;
        p.y += (p.vy + Math.sin(p.wobble * 1.15) * (p.type === 'flare' ? 14 : 8)) * dt;

        var pfade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
        pfade = clamp(pfade * fade, 0, 1);
        var rgb = mixRgb(p.colorA, p.colorB, t);
        // edge-white bias mid-life
        if (p.type === 'gas') rgb = mixRgb(rgb, WHITE, 0.25 * (1 - t));

        var radius = p.r * (p.type === 'smoke' ? 0.7 + t * 1.8 : 0.55 + t * 1.2);
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, p.alpha * pfade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.type !== 'smoke') {
          ctx.beginPath();
          ctx.fillStyle = rgba(mixRgb(rgb, WHITE, 0.5), p.alpha * 1.4 * pfade);
          ctx.arc(p.x, p.y, radius * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (alive > 0 || fade > 0.02) next.push(burst);
    }
    state.bursts = next;
  }

  function prepCards(cards) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.style.willChange = 'transform';
      card.style.transition = 'none';
      card.style.zIndex = String(10 + i);
      card.style.position = 'absolute';
    }
  }

  function applyCards(cards, progress, vh) {
    var beats = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var beat = BEATS[i] || null;
      var t = localBeat(progress, beat);
      var e = t === 0 || t === 1 ? t : easeOutCubic(t);
      beats[i] = t;
      var y = beat ? lerp(vh, beat.restY, e) : 0;
      cards[i].style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
    }
    return { beats: beats };
  }

  function bindSection(section) {
    var threshold = parseFloat(section.getAttribute('data-ltf-slam-threshold') || '0.88');
    if (!isFinite(threshold)) threshold = 0.88;

    var cardsHost =
      section.querySelector('.ltf-specs-vault-cards') ||
      section.querySelector('[data-ltf-slam-cards]') ||
      section;
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

    var overlay = createOverlay(cardsHost);
    var state = {
      wrap: overlay.wrap,
      canvas: overlay.canvas,
      ctx: overlay.ctx,
      pad: overlay.pad,
      cssW: 0,
      cssH: 0,
      bursts: [],
      fired: {},
      target: 0,
      current: 0,
      lastT: 0,
    };

    function sampleTarget() {
      state.target = readProgress(section);
    }

    function hardReset() {
      state.fired = {};
      state.bursts = [];
      if (state.ctx && state.cssW) {
        state.ctx.clearRect(0, 0, state.cssW, state.cssH);
      }
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (!BEATS[i]) continue;
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        resizeCanvas(state);
        var frame = cardFrame(state.wrap, cards[i]);
        spawnEdgeBurst(state, frame, i === cards.length - 1 ? 1.35 : 1);
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0004) state.current = state.target;

      // Scroll back to top → clear FX and allow full replay
      if (state.current < RESET_PROGRESS) {
        if (Object.keys(state.fired).length || state.bursts.length) hardReset();
      }

      var vh = window.innerHeight || 800;
      var applied = applyCards(cards, state.current, vh);
      fireIfNeeded(applied.beats);
      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));

      if (resizeCanvas(state)) {
        state.ctx.clearRect(0, 0, state.cssW, state.cssH);
        if (state.bursts.length) {
          drawBursts(state, dt);
          punchCardFaces(state, cards);
        }
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
    applyCards(cards, state.current, window.innerHeight || 800);
    requestAnimationFrame(frame);
  }

  function init() {
    var nodes = document.querySelectorAll('[data-ltf-specs-slam], .ltf-specs-vault');
    if (!nodes.length) return;

    Array.prototype.forEach.call(nodes, function (el) {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (!el.querySelector('.ltf-spec-card-02, .ltf-spec-card')) return;
      if (el.dataset.ltfSlamBound === '1') return;
      el.dataset.ltfSlamBound = '1';
      if (!el.hasAttribute('data-ltf-specs-slam')) {
        el.setAttribute('data-ltf-specs-slam', '');
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

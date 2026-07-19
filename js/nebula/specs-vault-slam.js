/**
 * Lowtideflow — Specs Vault Slam + Nebula Gradient Rim Leak
 *
 * Card slam (scroll) + slam FX:
 *   - Animated nebula gradient RING just outside the white card border
 *     (same idea as gradient-input-wrapper padding reveal)
 *   - Vibrant gas particles expelling OUT past the white border
 *   - Card faces punched out so text stays clean (effect behind/around)
 *   - Clipped inside the cards column — never touches section edges
 *   - Fades ~1.8s then gone; resets when scrolling back to vault top
 *
 * Nebula tones: #4D259D #2AAAB8 #1F7781 #0B8050 #7040C0
 *
 * Wire: data-ltf-specs-slam on section
 * Depot: jsDelivr @commit …/js/nebula/specs-vault-slam.js
 */
(function () {
  'use strict';

  var TEAL = [31, 119, 129]; // #1F7781
  var TEALL = [42, 170, 184]; // #2AAAB8
  var PURPLE = [77, 37, 157]; // #4D259D
  var PURPLEM = [112, 64, 192]; // #7040C0
  var GREEN = [11, 128, 80]; // #0B8050
  var WHITE = [229, 229, 229]; // card border #e5e5e5
  var PALETTE = [PURPLE, TEALL, TEAL, GREEN, PURPLEM];
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var LERP = REDUCE.matches ? 1 : 0.16;
  var BURST_LIFE = 1.85;
  var RESET_PROGRESS = 0.06;
  var RING_PAD = 4; // px outside white border (like wrapper padding)

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

  function createOverlay(cardsHost) {
    var existing = cardsHost.querySelector('.ltf-nebula-gas-layer');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-gas-layer';
    wrap.setAttribute('aria-hidden', 'true');
    // Stay inside cards column — no bleed to section edges
    wrap.style.cssText =
      'position:absolute;inset:8px;pointer-events:none;overflow:hidden;z-index:0;border-radius:4px;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(cardsHost).position;
    if (pos === 'static' || !pos) cardsHost.style.position = 'relative';
    cardsHost.style.isolation = 'isolate';
    cardsHost.style.overflow = 'hidden';
    cardsHost.insertBefore(wrap, cardsHost.firstChild);

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

  function cardFrame(host, card) {
    var hr = host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left - hr.left,
      y: r.top - hr.top,
      w: r.width,
      h: r.height,
      cx: r.left + r.width * 0.5 - hr.left,
      cy: r.top + r.height * 0.5 - hr.top,
      radius: 12,
    };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /**
   * Spawn: rim leak + outward expulsion (past white border).
   * Gradient ring is drawn separately each frame while burst lives.
   */
  function spawnEdgeBurst(state, frame, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var count = Math.round((REDUCE.matches ? 48 : 110) * intensity);
    var particles = [];
    var hw = frame.w * 0.5;
    var hh = frame.h * 0.5;
    var i;

    for (i = 0; i < count; i++) {
      var kind = Math.random();
      var ang = Math.random() * Math.PI * 2;
      // Birth just OUTSIDE white border
      var rimScale = 1.02 + Math.random() * 0.06;
      var rimX = frame.cx + Math.cos(ang) * hw * rimScale;
      var rimY = frame.cy + Math.sin(ang) * hh * rimScale;
      var nx = Math.cos(ang);
      var ny = Math.sin(ang);
      var tx = -ny;
      var ty = nx;
      var outSpeed = (160 + Math.random() * 320) * intensity;
      var whirl = (60 + Math.random() * 160) * (Math.random() < 0.5 ? -1 : 1);

      var type, life, r, colorA, colorB, alpha;
      if (kind < 0.3) {
        type = 'smoke';
        life = 1.15 + Math.random() * 0.6;
        r = 22 + Math.random() * 42;
        colorA = mixRgb(PURPLE, TEAL, Math.random());
        colorB = mixRgb(TEALL, PURPLEM, Math.random());
        alpha = 0.28;
        outSpeed *= 0.5;
      } else if (kind < 0.72) {
        type = 'gas';
        life = 0.85 + Math.random() * 0.7;
        r = 8 + Math.random() * 20;
        colorA = mixRgb(TEALL, WHITE, 0.2 + Math.random() * 0.35);
        colorB = mixRgb(PURPLE, GREEN, Math.random());
        alpha = 0.55;
      } else {
        type = 'flare';
        life = 0.5 + Math.random() * 0.55;
        r = 2 + Math.random() * 8;
        colorA = mixRgb(WHITE, TEALL, 0.35);
        colorB = PALETTE[(Math.random() * PALETTE.length) | 0];
        alpha = 0.85;
        outSpeed *= 1.35;
      }

      particles.push({
        type: type,
        x: rimX,
        y: rimY,
        vx: nx * outSpeed * (0.65 + Math.random() * 0.6) + tx * whirl * 0.4,
        vy: ny * outSpeed * (0.65 + Math.random() * 0.6) + ty * whirl * 0.4,
        r: r,
        life: life,
        age: 0,
        spin: whirl * 0.025,
        wobble: ang,
        colorA: colorA,
        colorB: colorB,
        alpha: alpha,
      });
    }

    state.bursts.push({
      particles: particles,
      started: performance.now(),
      frame: {
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        cx: frame.cx,
        cy: frame.cy,
        radius: frame.radius,
      },
      life: BURST_LIFE,
      hueShift: Math.random(),
    });
  }

  /** Moving nebula gradient ring just outside white border (wrapper-padding idea). */
  function drawGradientRing(ctx, burst, fade, now) {
    var f = burst.frame;
    var t = (now * 0.0004 + burst.hueShift) % 1;
    var g = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
    g.addColorStop(0, rgba(mixRgb(PURPLE, TEALL, t), 0.95 * fade));
    g.addColorStop(0.28, rgba(mixRgb(TEALL, TEAL, t), 0.95 * fade));
    g.addColorStop(0.52, rgba(mixRgb(TEAL, GREEN, t), 0.95 * fade));
    g.addColorStop(0.76, rgba(mixRgb(GREEN, PURPLEM, t), 0.95 * fade));
    g.addColorStop(1, rgba(mixRgb(PURPLEM, PURPLE, t), 0.95 * fade));

    ctx.save();
    ctx.shadowColor = rgba(PURPLEM, 0.5 * fade);
    ctx.shadowBlur = 16 * fade;
    ctx.strokeStyle = g;
    ctx.lineWidth = RING_PAD + 2; // ~gradient border thickness
    ctx.lineJoin = 'round';
    roundRectPath(
      ctx,
      f.x - RING_PAD * 0.5,
      f.y - RING_PAD * 0.5,
      f.w + RING_PAD,
      f.h + RING_PAD,
      f.radius + RING_PAD * 0.5
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawBursts(state, dt, now) {
    var ctx = state.ctx;
    var next = [];
    var b;

    for (b = 0; b < state.bursts.length; b++) {
      var burst = state.bursts[b];
      var elapsed = (now - burst.started) / 1000;
      var lifeT = clamp(elapsed / burst.life, 0, 1);
      var fade =
        lifeT < 0.12
          ? lifeT / 0.12
          : lifeT > 0.5
            ? 1 - (lifeT - 0.5) / 0.5
            : 1;
      fade = clamp(fade, 0, 1);
      if (lifeT >= 1) continue;

      // Draw ring into a temp pass: use main canvas then punch faces later
      drawGradientRing(ctx, burst, fade, now);

      var alive = 0;
      var i;
      for (i = 0; i < burst.particles.length; i++) {
        var p = burst.particles[i];
        p.age += dt;
        var t = p.age / p.life;
        if (t >= 1) continue;
        alive++;

        var drag = p.type === 'smoke' ? 0.93 : p.type === 'flare' ? 0.87 : 0.9;
        p.vx *= Math.pow(drag, dt * 60);
        p.vy *= Math.pow(drag, dt * 60);
        if (p.type === 'smoke') p.vy -= 22 * dt;
        else p.vy += 6 * dt;

        var dx = p.x - burst.frame.cx;
        var dy = p.y - burst.frame.cy;
        p.vx += -dy * p.spin * dt * 10;
        p.vy += dx * p.spin * dt * 10;
        p.wobble += p.spin * dt * 5;
        p.x += (p.vx + Math.cos(p.wobble) * 12) * dt;
        p.y += (p.vy + Math.sin(p.wobble * 1.2) * 10) * dt;

        var pfade = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
        pfade = clamp(pfade * fade, 0, 1);
        var rgb = mixRgb(p.colorA, p.colorB, t);
        if (p.type === 'gas') rgb = mixRgb(rgb, WHITE, 0.2 * (1 - t));

        var radius = p.r * (p.type === 'smoke' ? 0.75 + t * 1.7 : 0.55 + t * 1.15);
        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, p.alpha * pfade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.type !== 'smoke') {
          ctx.beginPath();
          ctx.fillStyle = rgba(mixRgb(rgb, WHITE, 0.55), Math.min(1, p.alpha * 1.5 * pfade));
          ctx.arc(p.x, p.y, radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (alive > 0 || fade > 0.02) next.push(burst);
    }
    state.bursts = next;
  }

  function punchCardFaces(state, cards) {
    var ctx = state.ctx;
    var hr = state.wrap.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    var i;
    for (i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      roundRectPath(ctx, r.left - hr.left, r.top - hr.top, r.width, r.height, 12);
      ctx.fill();
    }
    ctx.restore();
  }

  function prepCards(cards) {
    var i;
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.style.willChange = 'transform';
      card.style.transition = 'none';
      card.style.zIndex = String(20 + i);
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
      if (state.ctx && state.cssW) state.ctx.clearRect(0, 0, state.cssW, state.cssH);
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (!BEATS[i]) continue;
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        resizeCanvas(state);
        spawnEdgeBurst(state, cardFrame(state.wrap, cards[i]), i === cards.length - 1 ? 1.4 : 1.1);
      }
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0004) state.current = state.target;

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
          drawBursts(state, dt, now);
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
    Array.prototype.forEach.call(nodes, function (el) {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (!el.querySelector('.ltf-spec-card-02, .ltf-spec-card')) return;
      if (el.dataset.ltfSlamBound === '1') return;
      el.dataset.ltfSlamBound = '1';
      if (!el.hasAttribute('data-ltf-specs-slam')) el.setAttribute('data-ltf-specs-slam', '');
      bindSection(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

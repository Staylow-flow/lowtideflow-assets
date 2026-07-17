/**
 * Lowtideflow — Nebula Gas mini "Fart" explosion
 *
 * Same brand gas language as rock-scene.js (teal / purple / green FBM feel),
 * but a lightweight 2D canvas burst — not bolted onto the hero module.
 *
 * Drive: section scroll-progress ratio on [data-ltf-nebula-fart].
 * Cards (`.ltf-card`) close/stack as progress rises; when progress crosses
 * the threshold (default 0.92), fire a one-shot nebula gas puff.
 *
 * Usage (Clean-slate Specs section):
 *   <section class="ltf-section ltf-section-light"
 *            data-ltf-nebula-fart
 *            data-ltf-fart-threshold="0.92">
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

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  /** Section progress: 0 = just entering, 1 = fully scrolled past (closing done). */
  function sectionProgress(el) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var h = Math.max(rect.height, 1);
    // Travel from section top hitting viewport bottom → section bottom leaving top
    var start = vh;
    var end = -h;
    var y = rect.top;
    return clamp((start - y) / (start - end), 0, 1);
  }

  function createOverlay(host) {
    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-fart-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(host).position;
    if (pos === 'static' || !pos) host.style.position = 'relative';
    host.appendChild(wrap);

    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d') };
  }

  function resizeCanvas(state) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = state.wrap.clientWidth;
    var h = state.wrap.clientHeight;
    if (w < 1 || h < 1) return;
    state.canvas.width = Math.floor(w * dpr);
    state.canvas.height = Math.floor(h * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cssW = w;
    state.cssH = h;
  }

  function spawnBurst(state, originX, originY) {
    var particles = [];
    var count = REDUCE.matches ? 28 : 72;
    var i;
    for (i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55;
      var speed = 90 + Math.random() * 280;
      var life = 0.55 + Math.random() * 0.85;
      var c0 = PALETTE[(Math.random() * PALETTE.length) | 0];
      var c1 = PALETTE[(Math.random() * PALETTE.length) | 0];
      particles.push({
        x: originX + (Math.random() - 0.5) * 24,
        y: originY + (Math.random() - 0.5) * 18,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.9),
        vy: Math.sin(angle) * speed * (0.45 + Math.random() * 0.85) - 40,
        r: 10 + Math.random() * 38,
        life: life,
        age: 0,
        spin: (Math.random() - 0.5) * 2.4,
        colorA: c0,
        colorB: c1,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    state.burst = {
      particles: particles,
      started: performance.now(),
      originX: originX,
      originY: originY,
    };
  }

  function drawBurst(state, dt) {
    var burst = state.burst;
    if (!burst) return false;
    var ctx = state.ctx;
    var w = state.cssW;
    var h = state.cssH;
    ctx.clearRect(0, 0, w, h);

    // Soft nebula core flash (matches hero gas glow language)
    var elapsed = (performance.now() - burst.started) / 1000;
    var flash = Math.max(0, 1 - elapsed * 1.35);
    if (flash > 0.02) {
      var g = ctx.createRadialGradient(
        burst.originX,
        burst.originY,
        0,
        burst.originX,
        burst.originY,
        180 + flash * 220
      );
      g.addColorStop(0, rgba(TEALL, 0.28 * flash));
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

      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
      p.vy += 18 * dt; // soft settle
      p.wobble += p.spin * dt;
      p.x += (p.vx + Math.cos(p.wobble) * 28) * dt;
      p.y += (p.vy + Math.sin(p.wobble * 1.3) * 18) * dt;

      var fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      fade = clamp(fade, 0, 1);
      var rgb = mixRgb(p.colorA, p.colorB, t);
      var radius = p.r * (0.55 + t * 1.35);

      ctx.beginPath();
      ctx.fillStyle = rgba(rgb, 0.22 * fade);
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = rgba(rgb, 0.55 * fade);
      ctx.arc(p.x, p.y, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    if (alive === 0 && flash <= 0.02) {
      ctx.clearRect(0, 0, w, h);
      state.burst = null;
      return false;
    }
    return true;
  }

  /** Scroll-driven card closing cycle (stack toward a closed deck). */
  function applyCardClose(cards, progress) {
    // Closing window: 0.35 → 1.0 of section progress
    var closeT = clamp((progress - 0.35) / 0.65, 0, 1);
    // Ease-out cubic
    var e = 1 - Math.pow(1 - closeT, 3);
    var i;
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      var stackX = (i - (cards.length - 1) / 2) * 10 * (1 - e);
      var stackY = i * 14 * e;
      var rot = (i - 1.5) * 1.2 * (1 - e);
      var scale = lerp(1, 0.94, e);
      var opacity = lerp(1, 0.88, e);
      card.style.transform =
        'translate3d(' +
        stackX.toFixed(2) +
        'px,' +
        stackY.toFixed(2) +
        'px,0) rotate(' +
        rot.toFixed(2) +
        'deg) scale(' +
        scale.toFixed(3) +
        ')';
      card.style.opacity = String(opacity.toFixed(3));
      card.style.zIndex = String(10 + i);
      card.style.willChange = 'transform, opacity';
      if (!card.dataset.ltfFartStyled) {
        card.style.transition = 'none';
        card.dataset.ltfFartStyled = '1';
      }
    }
    return e;
  }

  function bindSection(section) {
    var threshold = parseFloat(section.getAttribute('data-ltf-fart-threshold') || '0.92');
    if (!isFinite(threshold)) threshold = 0.92;

    var overlay = createOverlay(section);
    var state = {
      wrap: overlay.wrap,
      canvas: overlay.canvas,
      ctx: overlay.ctx,
      cssW: 0,
      cssH: 0,
      burst: null,
      fired: false,
      raf: 0,
      lastT: 0,
    };
    resizeCanvas(state);

    var cards = Array.prototype.slice.call(section.querySelectorAll('.ltf-card'));
    var grid = section.querySelector('.ltf-cards-grid');
    if (grid) {
      grid.style.position = grid.style.position || 'relative';
    }

    function fireIfNeeded(progress, closeAmt) {
      if (state.fired) return;
      if (progress < threshold) return;
      if (closeAmt < 0.98 && progress < 0.99) return;
      state.fired = true;
      resizeCanvas(state);
      var ox = state.cssW * 0.62;
      var oy = state.cssH * 0.48;
      if (cards.length) {
        var last = cards[cards.length - 1].getBoundingClientRect();
        var host = section.getBoundingClientRect();
        ox = last.left + last.width * 0.5 - host.left;
        oy = last.top + last.height * 0.45 - host.top;
      }
      spawnBurst(state, ox, oy);
      tick(performance.now());
    }

    function onScroll() {
      var progress = sectionProgress(section);
      section.style.setProperty('--ltf-fart-progress', progress.toFixed(4));
      var closeAmt = applyCardClose(cards, progress);
      fireIfNeeded(progress, closeAmt);
    }

    function tick(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;
      var running = drawBurst(state, dt);
      if (running) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.raf = 0;
        state.lastT = 0;
      }
    }

    var resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(function () {
            resizeCanvas(state);
          })
        : null;
    if (resizeObs) resizeObs.observe(section);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      resizeCanvas(state);
      onScroll();
    });

    // Allow re-fire when scrolling back up past mid-section
    window.addEventListener(
      'scroll',
      function () {
        var p = sectionProgress(section);
        if (p < 0.45) state.fired = false;
      },
      { passive: true }
    );

    onScroll();
  }

  function init() {
    var nodes = document.querySelectorAll('[data-ltf-nebula-fart]');
    if (!nodes.length) return;
    Array.prototype.forEach.call(nodes, bindSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

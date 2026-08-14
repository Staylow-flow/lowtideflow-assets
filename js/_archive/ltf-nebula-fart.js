/**
 * Lowtideflow — Specs Vault card slam + Nebula Gas "Fart"
 *
 * Rebuilds the stacked Specs interaction in JS (MCP cannot copy IX2):
 *   - Tall sticky vault (`ltf-specs-vault`) scroll progress 0 → 1
 *   - Each `.ltf-spec-card` slides up and slams into the stack in sequence
 *   - On each slam completion → mini nebula gas burst (hero gas palette)
 *
 * Wire on the vault section:
 *   data-ltf-nebula-fart
 *   data-ltf-fart-threshold="0.88"   (per-card slam fire point, 0–1 of that card’s beat)
 */
(function () {
  'use strict';

  var TEAL = [31, 119, 129];
  var TEALL = [42, 170, 184];
  var PURPLE = [77, 37, 157];
  var PURPLEM = [112, 64, 192];
  var GREEN = [11, 128, 80];
  var PALETTE = [TEAL, TEALL, PURPLE, PURPLEM, GREEN];

  var FAN_STEP = 20; // matches ltf-spec-card-0N left/top offsets
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /** Snap ease for the final slam */
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

  /**
   * Sticky vault progress: 0 when section pins, 1 when pin releases.
   * Falls back to generic section travel if height ≈ viewport.
   */
  function vaultProgress(section) {
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var scrollable = section.offsetHeight - vh;
    if (scrollable > 8) {
      return clamp(-rect.top / scrollable, 0, 1);
    }
    var h = Math.max(rect.height, 1);
    return clamp((vh - rect.top) / (vh + h), 0, 1);
  }

  function createOverlay(host) {
    var sticky = host.querySelector('.ltf-specs-vault-sticky') || host;
    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-fart-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(sticky).position;
    if (pos === 'static' || !pos) sticky.style.position = 'relative';
    sticky.appendChild(wrap);

    return { host: sticky, wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d') };
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

  function spawnBurst(state, originX, originY, intensity) {
    intensity = intensity == null ? 1 : intensity;
    var particles = [];
    var count = Math.round((REDUCE.matches ? 22 : 64) * intensity);
    var i;
    for (i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
      var speed = (110 + Math.random() * 260) * intensity;
      var life = 0.45 + Math.random() * 0.7;
      var c0 = PALETTE[(Math.random() * PALETTE.length) | 0];
      var c1 = PALETTE[(Math.random() * PALETTE.length) | 0];
      particles.push({
        x: originX + (Math.random() - 0.5) * 20,
        y: originY + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.9),
        vy: Math.sin(angle) * speed * (0.55 + Math.random() * 0.85),
        r: 8 + Math.random() * 32,
        life: life,
        age: 0,
        spin: (Math.random() - 0.5) * 2.8,
        colorA: c0,
        colorB: c1,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    state.bursts.push({
      particles: particles,
      started: performance.now(),
      originX: originX,
      originY: originY,
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
        var g = ctx.createRadialGradient(
          burst.originX,
          burst.originY,
          0,
          burst.originX,
          burst.originY,
          140 + flash * 200
        );
        g.addColorStop(0, rgba(TEALL, 0.32 * flash));
        g.addColorStop(0.35, rgba(PURPLE, 0.2 * flash));
        g.addColorStop(0.7, rgba(GREEN, 0.09 * flash));
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
        p.vy += 22 * dt;
        p.wobble += p.spin * dt;
        p.x += (p.vx + Math.cos(p.wobble) * 26) * dt;
        p.y += (p.vy + Math.sin(p.wobble * 1.3) * 16) * dt;

        var fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        fade = clamp(fade, 0, 1);
        var rgb = mixRgb(p.colorA, p.colorB, t);
        var radius = p.r * (0.5 + t * 1.4);

        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.24 * fade);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = rgba(rgb, 0.58 * fade);
        ctx.arc(p.x, p.y, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      if (alive > 0 || flash > 0.02) next.push(burst);
    }

    state.bursts = next;
    return state.bursts.length > 0;
  }

  /**
   * Drive stacked cards: each scroll beat slides one card up into the deck.
   * Returns array of per-card eased progress 0–1.
   */
  function applyCardSlams(cards, progress) {
    var n = cards.length;
    if (!n) return [];
    var beats = [];
    var i;

    for (i = 0; i < n; i++) {
      var local = progress * n - i;
      var t = clamp(local, 0, 1);
      var e = t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(easeOutCubic(t));
      beats.push(t);

      var card = cards[i];
      // Before beat: wait below / fanned out. During: slam up into stack.
      var fromY = 72 + i * 18;
      var toY = i * 6;
      var fromX = 0;
      var toX = 0;
      var y = lerp(fromY, toY, e);
      var x = lerp(fromX, toX, e);
      var scale = lerp(0.96, 1, e);
      var opacity = local < -0.15 ? 0.35 : lerp(0.55, 1, clamp(local + 0.15, 0, 1));

      // Keep CSS fan offsets (left/top on combo classes); we only transform relative slam
      card.style.transform =
        'translate3d(' +
        x.toFixed(2) +
        'px,' +
        y.toFixed(2) +
        'px,0) scale(' +
        scale.toFixed(3) +
        ')';
      card.style.opacity = String(opacity.toFixed(3));
      card.style.zIndex = String(1 + i);
      card.style.willChange = 'transform, opacity';
      if (!card.dataset.ltfSlamStyled) {
        card.style.transition = 'none';
        card.dataset.ltfSlamStyled = '1';
      }
    }
    return beats;
  }

  function cardOrigin(state, card) {
    var host = state.host.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left + r.width * 0.5 - host.left,
      y: r.top + r.height * 0.4 - host.top,
    };
  }

  function bindSection(section) {
    var slamFire = parseFloat(section.getAttribute('data-ltf-fart-threshold') || '0.88');
    if (!isFinite(slamFire)) slamFire = 0.88;

    var overlay = createOverlay(section);
    var state = {
      host: overlay.host,
      wrap: overlay.wrap,
      canvas: overlay.canvas,
      ctx: overlay.ctx,
      cssW: 0,
      cssH: 0,
      bursts: [],
      fired: {},
      raf: 0,
      lastT: 0,
    };
    resizeCanvas(state);

    var cards = Array.prototype.slice.call(
      section.querySelectorAll('.ltf-spec-card, .ltf-card')
    );

    function fireCard(i, card) {
      if (state.fired[i]) return;
      state.fired[i] = true;
      resizeCanvas(state);
      var o = cardOrigin(state, card);
      spawnBurst(state, o.x, o.y, i === cards.length - 1 ? 1.15 : 0.85);
      if (!state.raf) {
        state.lastT = 0;
        state.raf = requestAnimationFrame(tick);
      }
    }

    function onScroll() {
      var progress = vaultProgress(section);
      section.style.setProperty('--ltf-vault-progress', progress.toFixed(4));
      var beats = applyCardSlams(cards, progress);

      var i;
      for (i = 0; i < beats.length; i++) {
        if (beats[i] >= slamFire) fireCard(i, cards[i]);
      }

      // Reset when scrolled back above the vault pin
      if (progress < 0.08) {
        state.fired = {};
      }
    }

    function tick(now) {
      if (!state.lastT) state.lastT = now;
      var dt = clamp((now - state.lastT) / 1000, 0.001, 0.05);
      state.lastT = now;
      var running = drawBursts(state, dt);
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
    if (resizeObs) resizeObs.observe(state.host);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      resizeCanvas(state);
      onScroll();
    });

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

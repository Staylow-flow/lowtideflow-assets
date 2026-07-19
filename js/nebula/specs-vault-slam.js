/**
 * Lowtideflow — Specs Vault Slam + Perimeter Gas Mist Trail
 *
 * Card slam from scroll (unchanged beats).
 * Slam FX: HTML5 canvas overlay glides a soft nebula mist core around the
 * slamming card perimeter (soft clear trail + screen + blur). Not CSS borders.
 *
 * Nebula tones: #4D259D #2AAAB8 #1F7781 #0B8050 #7040C0
 *
 * Wire: data-ltf-specs-slam on section
 * Depot: jsDelivr …/js/nebula/specs-vault-slam.js
 */
(function () {
  'use strict';

  // Nebula palette (LTF)
  var CORE = [42, 170, 184]; // #2AAAB8 hard core
  var BLEED_A = [77, 37, 157]; // #4D259D
  var BLEED_B = [112, 64, 192]; // #7040C0
  var BLEED_C = [31, 119, 129]; // #1F7781
  var BLEED_D = [11, 128, 80]; // #0B8050

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var LERP = REDUCE.matches ? 1 : 0.14;
  var RESET_PROGRESS = 0.06;
  var TRAIL_LOOPS = 1.15; // how many perimeter circuits
  var TRAIL_SPEED = REDUCE.matches ? 0.028 : 0.012; // progress per frame toward target
  var FADE_TAIL = 0.12; // soft clear alpha (lower = longer mist trail)
  var OVERLAY_PAD = 12; // canvas overhang around cards host (kept inside sticky clip)

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
   * Canvas sits over the cards stack (like gas-border-canvas over textarea).
   * z-index under cards so mist wraps the border without covering copy.
   */
  function createOverlay(cardsHost) {
    var existing = cardsHost.querySelector('.ltf-nebula-gas-layer');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.className = 'ltf-nebula-gas-layer';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;top:-' +
      OVERLAY_PAD +
      'px;left:-' +
      OVERLAY_PAD +
      'px;width:calc(100% + ' +
      OVERLAY_PAD * 2 +
      'px);height:calc(100% + ' +
      OVERLAY_PAD * 2 +
      'px);pointer-events:none;overflow:hidden;z-index:1;border-radius:16px;';

    var canvas = document.createElement('canvas');
    canvas.className = 'ltf-gas-border-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    var pos = window.getComputedStyle(cardsHost).position;
    if (pos === 'static' || !pos) cardsHost.style.position = 'relative';
    cardsHost.style.isolation = 'isolate';
    cardsHost.style.overflow = 'hidden';
    cardsHost.insertBefore(wrap, cardsHost.firstChild);

    // Cards must stack above the mist canvas
    return { wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d'), pad: OVERLAY_PAD };
  }

  function resizeCanvas(state) {
    var w = state.wrap.clientWidth;
    var h = state.wrap.clientHeight;
    if (w < 2 || h < 2) return false;
    if (state.cssW === w && state.cssH === h) return true;
    state.canvas.width = Math.floor(w);
    state.canvas.height = Math.floor(h);
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.cssW = w;
    state.cssH = h;
    return true;
  }

  /** Card rect in canvas space (accounts for overlay pad). */
  function cardBox(state, card) {
    var hr = state.wrap.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    return {
      x: r.left - hr.left,
      y: r.top - hr.top,
      w: Math.max(8, r.width),
      h: Math.max(8, r.height),
    };
  }

  /**
   * Map progress 0→1 along rounded-rect perimeter (clockwise from top-left).
   * Returns {x,y} for the hard mist core.
   */
  function perimeterPoint(box, progress) {
    var pad = 2; // ride just outside the white border
    var x0 = box.x - pad;
    var y0 = box.y - pad;
    var w = box.w + pad * 2;
    var h = box.h + pad * 2;
    var peri = (w + h) * 2;
    var d = ((progress % 1) + 1) % 1 * peri;

    if (d < w) return { x: x0 + d, y: y0 };
    d -= w;
    if (d < h) return { x: x0 + w, y: y0 + d };
    d -= h;
    if (d < w) return { x: x0 + w - d, y: y0 + h };
    d -= w;
    return { x: x0, y: y0 + h - d };
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
      target: 0,
      current: 0,
      lastT: 0,
      fired: {},
      // active mist trails: { cardIndex, progress, targetProgress, box, strength }
      trails: [],
    };

    function sampleTarget() {
      state.target = readProgress(section);
    }

    function hardReset() {
      state.fired = {};
      state.trails = [];
      if (state.ctx && state.cssW) {
        state.ctx.globalCompositeOperation = 'source-over';
        state.ctx.filter = 'none';
        state.ctx.clearRect(0, 0, state.cssW, state.cssH);
      }
    }

    function triggerGasTrail(cardIndex) {
      if (!resizeCanvas(state)) return;
      var box = cardBox(state, cards[cardIndex]);
      state.trails.push({
        cardIndex: cardIndex,
        progress: 0,
        targetProgress: TRAIL_LOOPS,
        box: box,
        strength: cardIndex === cards.length - 1 ? 1.25 : 1,
      });
    }

    function fireIfNeeded(beats) {
      var i;
      for (i = 0; i < beats.length; i++) {
        if (!BEATS[i]) continue;
        if (beats[i] < threshold || state.fired[i]) continue;
        state.fired[i] = true;
        triggerGasTrail(i);
      }
    }

    function softClear(ctx) {
      ctx.filter = 'none';
      // Fade existing pixels (works on light grey vault — no painted slab)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, ' + FADE_TAIL + ')';
      ctx.fillRect(0, 0, state.cssW, state.cssH);
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawMistCore(ctx, x, y, strength, lifeFade) {
      var a = strength * lifeFade;
      ctx.globalCompositeOperation = 'screen';
      try {
        ctx.filter = 'blur(14px)';
      } catch (e) {
        /* older Safari */
      }

      // Layered volumetric mist — nebula tones
      var g1 = ctx.createRadialGradient(x, y, 1.5, x, y, 42 * strength);
      g1.addColorStop(0, rgba(CORE, 1 * a));
      g1.addColorStop(0.22, rgba(BLEED_A, 0.7 * a));
      g1.addColorStop(0.5, rgba(BLEED_B, 0.45 * a));
      g1.addColorStop(0.75, rgba(BLEED_C, 0.22 * a));
      g1.addColorStop(1, rgba(BLEED_D, 0));
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(x, y, 52 * strength, 0, Math.PI * 2);
      ctx.fill();

      // Secondary soft green/teal bleed
      var g2 = ctx.createRadialGradient(x, y, 4, x, y, 70 * strength);
      g2.addColorStop(0, rgba(BLEED_D, 0.35 * a));
      g2.addColorStop(0.4, rgba(BLEED_C, 0.2 * a));
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(x, y, 74 * strength, 0, Math.PI * 2);
      ctx.fill();

      ctx.filter = 'none';
    }

    function updateTrails() {
      if (!state.trails.length) return false;
      var ctx = state.ctx;
      softClear(ctx);

      var next = [];
      var i;
      for (i = 0; i < state.trails.length; i++) {
        var trail = state.trails[i];
        // Refresh box each frame so slam transform stays aligned
        trail.box = cardBox(state, cards[trail.cardIndex]);

        // LERP glide along perimeter
        trail.progress = lerp(trail.progress, trail.targetProgress, TRAIL_SPEED);
        if (trail.targetProgress - trail.progress < 0.002) {
          trail.progress = trail.targetProgress;
        }

        var lifeFade = 1;
        if (trail.progress > trail.targetProgress - 0.25) {
          lifeFade = clamp((trail.targetProgress - trail.progress) / 0.25, 0, 1);
        }

        var pt = perimeterPoint(trail.box, trail.progress);
        drawMistCore(ctx, pt.x, pt.y, trail.strength, lifeFade);

        if (trail.progress < trail.targetProgress - 0.0005 || lifeFade > 0.02) {
          next.push(trail);
        }
      }
      state.trails = next;

      // When trails finish, fully clear residual mist
      if (!state.trails.length) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, state.cssW, state.cssH);
      }
      return true;
    }

    function frame(now) {
      if (!state.lastT) state.lastT = now;
      state.lastT = now;

      sampleTarget();
      state.current = lerp(state.current, state.target, LERP);
      if (Math.abs(state.current - state.target) < 0.0004) state.current = state.target;

      if (state.current < RESET_PROGRESS) {
        if (Object.keys(state.fired).length || state.trails.length) hardReset();
      }

      var vh = window.innerHeight || 800;
      var applied = applyCards(cards, state.current, vh);
      fireIfNeeded(applied.beats);
      section.style.setProperty('--ltf-vault-progress', state.current.toFixed(4));

      if (resizeCanvas(state)) {
        if (state.trails.length) updateTrails();
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

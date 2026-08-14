/**
 * Lowtideflow — Spline runtime boulder (self-hosted bundle)
 *
 * Renders the Spline-exported boulder with native materials/lighting on a
 * stacked canvas. Nebula stays in rock-scene.js (data-spline-scene mode).
 */

const DEFAULT_SPLINE_BASE =
  'https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@6cb901e/boulder-3d-assets/spline-bundle';

const ROCK_OBJECT_NAMES = ['Dodecahedron', 'Boulder', 'Rock'];

/* Match rock-scene.js scroll + idle physics */
const MAX_HSCROLL_YAW      = (5 * Math.PI) / 180;
const HSCROLL_Y_BIAS       = -0.125;
const SCROLL_ROT_DOWN      = Math.PI * 2 * 2 * 0.7 * 4;
const ROCK_SCROLL_COAST    = 1.30;
const ROCK_SPIN_DECAY      = 0.9984;
const SCROLL_IMPULSE_GAIN  = 0.135;
const SCROLL_VEL_SCALE     = 0.0055;
const IDLE_YAW_AMP1        = 0.07 * 1.1;
const IDLE_YAW_AMP2        = 0.03 * 1.1;
const IDLE_NOD_AMP         = 0.025 * 1.1;

const ROCK_LIFT_PX_DEFAULT = 200;
const ROCK_SCALE_MULT      = 1.15;

/* Spline defaults to window.devicePixelRatio (2 on Retina = 4× the fragments). */
const MAX_DPR       = 1.5;
const IO_ROOT_MARGIN = '200px';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function injectSplineCanvasStyles() {
  if (document.getElementById('ltf-spline-canvas-css')) return;
  const style = document.createElement('style');
  style.id = 'ltf-spline-canvas-css';
  style.textContent = `
    .hero-canvas-wrapper[data-spline-scene],
    [data-ltf-rock][data-spline-scene] {
      position: relative;
    }
    canvas.ltf-spline-canvas {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 1 !important;
      pointer-events: none !important;
      display: block !important;
    }
    .hero-canvas-wrapper[data-spline-scene] #canvas3d,
    [data-ltf-rock][data-spline-scene] #canvas3d {
      position: relative !important;
      z-index: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function preloadSplineScene(url) {
  if (!url || document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'fetch';
  link.href = url;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function findRockObject(app) {
  for (const name of ROCK_OBJECT_NAMES) {
    const obj = app.findObjectByName(name);
    if (obj) return obj;
  }
  return null;
}

function dispatchMotion(yaw, pitch) {
  window.dispatchEvent(new CustomEvent('ltf-spline-rock-motion', {
    detail: { yaw, pitch },
  }));
}

/** Defer heavy work past first paint without blocking interaction. */
function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 1200 });
  } else {
    setTimeout(fn, 200);
  }
}

class SplineBoulder {
  constructor(container) {
    this.container = container;
    this.baseUrl = (container.getAttribute('data-spline-base') || DEFAULT_SPLINE_BASE).replace(/\/$/, '');
    this.sceneUrl = container.getAttribute('data-spline-scene-url') || `${this.baseUrl}/scene.splinecode`;
    this.app = null;
    this.rock = null;
    this.canvas = null;
    this.running = false;
    this.raf = 0;
    this.time = 0;
    this._lastNow = 0;

    this.scrollProgress = 0;
    this.scrollTarget = 0;
    this._lastScrollProgress = 0;
    this.scrollPitchVelocity = 0;
    this.scrollPitchOffset = 0;
    this.rockPitchAccum = 0;
    this.hScrollYawTarget = 0;
    this.hScrollYaw = 0;

    this.baseYaw = 0;
    this.basePitch = 0.05;
    this.baseRoll = 0.03;

    this.inView = false;
    this.booted = false;
    this._active = false;

    injectSplineCanvasStyles();
    this._bindEvents();
    this._observeVisibility();
  }

  /**
   * Drives both lazy boot and offscreen pause: the 1.7 MB runtime is only
   * fetched once the hero is near the viewport, and the rAF loop stops
   * entirely whenever the hero scrolls away or the tab is backgrounded.
   */
  _observeVisibility() {
    if (typeof IntersectionObserver !== 'function') {
      this.inView = true;
      preloadSplineScene(this.sceneUrl);
      whenIdle(() => this._boot());
      return;
    }

    this._io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.inView = entry.isIntersecting;
      }
      if (this.inView && !this.booted) {
        this.booted = true;
        preloadSplineScene(this.sceneUrl);
        whenIdle(() => this._boot());
      }
      this._syncActive();
    }, { rootMargin: IO_ROOT_MARGIN });
    this._io.observe(this.container);

    this._onVisibilityFn = () => this._syncActive();
    document.addEventListener('visibilitychange', this._onVisibilityFn);
  }

  /** Only burn frames when the hero is on screen and the tab is foregrounded. */
  _syncActive() {
    const shouldRun = this.running && this.inView && !document.hidden;
    if (shouldRun === this._active) return;
    this._active = shouldRun;

    if (shouldRun) {
      this._lastNow = 0;
      this.raf = requestAnimationFrame(this._frameBound);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  async _boot() {
    try {
      this.canvas = this.container.querySelector('canvas.ltf-spline-canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ltf-spline-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.container.appendChild(this.canvas);
      }

      this.canvas.style.opacity = '0';

      const { Application } = await import(`${this.baseUrl}/runtime.js`);
      this.app = new Application(this.canvas);
      await this.app.load(this.sceneUrl);
      this.app.setBackgroundColor('rgba(0,0,0,0)');

      this.rock = findRockObject(this.app);
      if (!this.rock) {
        console.warn('[LTF Spline] No rock object found. Expected one of:', ROCK_OBJECT_NAMES.join(', '));
      } else {
        console.log('[LTF Spline] rock object:', this.rock.name || '(unnamed)');
      }
      this._applyRockLayout();

      this._applyPixelRatio();

      this.canvas.style.transition = 'opacity 0.45s ease';
      this.canvas.style.opacity = '1';
      this._onResize();
      this.running = true;
      this._frameBound = this._tick.bind(this);
      this._active = false;
      this._syncActive();
      console.log('[LTF Spline] ready | scene:', this.sceneUrl);
    } catch (err) {
      console.error('[LTF Spline] Failed to load bundled scene:', err);
      if (this.canvas) this.canvas.style.opacity = '0';
    }
  }

  /**
   * Spline reads window.devicePixelRatio from the scene's publish settings,
   * so a Retina display renders 4× the fragments. Clamp it on the renderer.
   */
  _applyPixelRatio() {
    const attr = this.container.getAttribute('data-max-dpr');
    const maxDpr = attr != null && attr !== '' ? Number(attr) : MAX_DPR;
    if (!Number.isFinite(maxDpr) || maxDpr <= 0) return;

    const target = Math.min(window.devicePixelRatio || 1, maxDpr);
    const renderer = this.app?._renderer;
    if (typeof renderer?.setPixelRatio !== 'function') return;
    if (renderer.getPixelRatio?.() === target) return;
    renderer.setPixelRatio(target);
  }

  /** Lift moves the rendered canvas; scale multiplies the mesh once. */
  _applyRockLayout() {
    const liftAttr = this.container.getAttribute('data-rock-lift-px');
    const liftPx = liftAttr != null && liftAttr !== ''
      ? Number(liftAttr)
      : ROCK_LIFT_PX_DEFAULT;
    if (this.canvas && Number.isFinite(liftPx)) {
      this.canvas.style.transform = `translateY(${-liftPx}px)`;
    }

    if (this._scaleApplied) return;
    const scaleAttr = this.container.getAttribute('data-rock-scale');
    const scaleMult = scaleAttr != null && scaleAttr !== ''
      ? Number(scaleAttr)
      : ROCK_SCALE_MULT;
    if (this.rock?.scale && Number.isFinite(scaleMult) && scaleMult !== 1) {
      this.rock.scale.x *= scaleMult;
      this.rock.scale.y *= scaleMult;
      this.rock.scale.z *= scaleMult;
      this._scaleApplied = true;
    }
  }

  _bindEvents() {
    this._onScrollFn = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    };
    window.addEventListener('scroll', this._onScrollFn, { passive: true });

    this._onWheelFn = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.55) return;
      this.hScrollYawTarget = clamp(
        this.hScrollYawTarget - e.deltaX * 0.00055,
        -MAX_HSCROLL_YAW,
        MAX_HSCROLL_YAW
      );
    };
    window.addEventListener('wheel', this._onWheelFn, { passive: true });

    this._onResizeFn = () => this._onResize();
    window.addEventListener('resize', this._onResizeFn);
  }

  _onResize() {
    if (!this.canvas) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(rect.width, 100);
    const h = Math.max(rect.height, 100);
    if (typeof this.app?.setSize === 'function') {
      this.app.setSize(w, h);
      this._applyPixelRatio();
    }
  }

  _tick(now) {
    if (!this.running || !this._active) {
      this.raf = 0;
      return;
    }
    const dt = this._lastNow ? Math.min(now - this._lastNow, 50) : 16;
    this._lastNow = now;
    this.time += dt;
    const t = this.time;

    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;
    this.hScrollYaw += (this.hScrollYawTarget - this.hScrollYaw) * 0.07;

    this.rockPitchAccum += 0.0000225 * dt;

    const scrollDelta = this.scrollProgress - this._lastScrollProgress;
    this._lastScrollProgress = this.scrollProgress;
    if (Math.abs(scrollDelta) > 0.000001) {
      const dirGain = scrollDelta >= 0 ? 1.0 : 0.25;
      this.scrollPitchVelocity += scrollDelta * SCROLL_ROT_DOWN * dirGain
                                * SCROLL_IMPULSE_GAIN * ROCK_SCROLL_COAST;
    }
    this.scrollPitchVelocity *= Math.pow(ROCK_SPIN_DECAY, dt);
    this.scrollPitchOffset += this.scrollPitchVelocity * dt * SCROLL_VEL_SCALE;

    const pitch = this.basePitch + this.rockPitchAccum + this.scrollPitchOffset;
    const idleYaw = Math.sin(t * 0.00020) * IDLE_YAW_AMP1 + Math.sin(t * 0.00039) * IDLE_YAW_AMP2;
    const idleNod = Math.sin(t * 0.00015 + 1.4) * IDLE_NOD_AMP;
    const yaw = this.baseYaw + idleYaw + this.hScrollYaw + HSCROLL_Y_BIAS;
    const roll = this.baseRoll + idleNod;

    if (this.rock?.rotation) {
      this.rock.rotation.x = pitch;
      this.rock.rotation.y = yaw;
      this.rock.rotation.z = roll;
    }

    dispatchMotion(yaw, pitch);
    this.raf = this._active ? requestAnimationFrame(this._frameBound) : 0;
  }

  destroy() {
    this.running = false;
    this._active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this._io?.disconnect();
    if (this._onVisibilityFn) {
      document.removeEventListener('visibilitychange', this._onVisibilityFn);
    }
    window.removeEventListener('scroll', this._onScrollFn);
    window.removeEventListener('wheel', this._onWheelFn);
    window.removeEventListener('resize', this._onResizeFn);
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.container.__ltfSpline = null;
  }
}

function resolveContainers() {
  const seen = new Set();
  const nodes = [];
  document.querySelectorAll('[data-spline-scene]').forEach((node) => {
    if (seen.has(node)) return;
    seen.add(node);
    nodes.push(node);
  });
  return nodes;
}

function init() {
  resolveContainers().forEach((node) => {
    if (!node.__ltfSpline) node.__ltfSpline = new SplineBoulder(node);
  });
}

function boot() {
  init();
  setTimeout(init, 400);
  setTimeout(init, 1400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
window.addEventListener('load', boot);

export { SplineBoulder, init };

/**
 * Lowtideflow — Rock Scene  (ES Module)
 * Three.js WebGL rock (soapstone.glb) + nebula gas particle cloud for the hero.
 *
 * Loaded as <script type="module"> — importmap in HTML resolves 'three' and 'three/addons/'.
 * Auto-inits on every [data-ltf-rock] container in the DOM.
 * Model URL is read from the container's data-model-url attribute.
 *
 * Interactions:
 *   Scroll     → rock tumbles forward on the X axis
 *   Mouse move → rock yaws + gas cloud counter-rotates (parallax depth)
 *   Idle       → slow sinusoidal oscillation pivoting back to rest
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ─── Brand palette ──────────────────────────────────────────────────────── */
const PALETTE = [
  new THREE.Color(0x1f7781),  // teal
  new THREE.Color(0x4d259d),  // purple
  new THREE.Color(0x0b8050),  // green
  new THREE.Color(0x2a4070),  // navy
  new THREE.Color(0x2aaab8),  // teal-light
  new THREE.Color(0x7040c0),  // purple-mid
];

/*
 * Nebula gas zones — 6 color blobs anchored around the scene.
 * Each zone produces a cluster of particles seeded near (cx, cy, cz)
 * with the given spread radius. Blobs intentionally overlap so colors
 * bleed into each other like a gradient collage.
 */
const GAS_ZONES = [
  { ci: 0, cx: -4.5,  cy:  1.8, cz: -1.2, spread: 3.8 },  // teal   — left upper
  { ci: 1, cx:  4.0,  cy: -1.5, cz:  0.8, spread: 3.2 },  // purple — right mid
  { ci: 2, cx: -2.8,  cy: -3.5, cz:  1.8, spread: 3.0 },  // green  — lower left
  { ci: 3, cx:  0.5,  cy:  4.0, cz: -2.8, spread: 4.5 },  // navy   — upper centre
  { ci: 4, cx:  3.5,  cy:  3.0, cz:  0.2, spread: 2.8 },  // teal-l — upper right
  { ci: 5, cx: -1.5,  cy: -4.5, cz: -0.8, spread: 3.5 },  // pur-m  — lower centre
];

const PARTICLE_COUNT = 6000;

/* ─── Tiny utilities ─────────────────────────────────────────────────────── */
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ═══════════════════════════════════════════════════════════════════════════
   RockScene — one instance per [data-ltf-rock] container
═══════════════════════════════════════════════════════════════════════════ */
class RockScene {
  constructor(container) {
    this.container = container;
    this.modelUrl  = container.getAttribute('data-model-url') || '/soapstone.glb';

    this.w = 1; this.h = 1;

    this.mouseX  = 0; this.mouseY  = 0;
    this.mouseTX = 0; this.mouseTY = 0;
    this.scrollProgress = 0;
    this.scrollTarget   = 0;
    this.time     = 0;
    this._lastNow = 0;

    this.scene     = null;
    this.camera    = null;
    this.renderer  = null;
    this.rockGroup = null;
    this.gasGroup  = null;  // wrapper group — counter-rotates vs rock
    this.particles = null;

    this.pPositions = null;
    this.pPhases    = null;
    this.pSpeeds    = null;
    this.pBaseX     = null;
    this.pBaseY     = null;
    this.pBaseZ     = null;

    this.running = false;
    this.raf     = 0;

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._initParticles();
    this._loadModel();
    this._bindEvents();
    this._onResize();

    this._frameBound = this._tick.bind(this);
    this.running = true;
    this.raf = requestAnimationFrame(this._frameBound);
  }

  /* ── Renderer ──────────────────────────────────────────────────────────── */
  _initRenderer() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping      = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);
  }

  /* ── Scene + camera ────────────────────────────────────────────────────── */
  _initScene() {
    this.scene  = new THREE.Scene();

    /* Camera pulled back to accommodate 4× rock scale */
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    this.camera.position.set(0, 0.5, 18);
    this.camera.lookAt(0, 0.5, 0);

    /* Rock group — offset right + up 15% of visible scene height */
    this.rockGroup = new THREE.Group();
    this.rockGroup.position.set(0.4, 1.8, 0);
    this.scene.add(this.rockGroup);

    /* Gas group — separate so it can counter-rotate independently */
    this.gasGroup = new THREE.Group();
    this.scene.add(this.gasGroup);
  }

  /* ── Iridescent lighting — all intensities −10% ──────────────────────── */
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0x0d1520, 0.495));

    const key = new THREE.DirectionalLight(0xd8e0f0, 1.35);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const teal = new THREE.PointLight(0x1f7781, 3.15, 18);
    teal.position.set(-5, 1.5, 5);
    this.scene.add(teal);

    const purple = new THREE.PointLight(0x4d259d, 2.7, 16);
    purple.position.set(5, -0.5, -5);
    this.scene.add(purple);

    const green = new THREE.PointLight(0x0b8050, 1.8, 12);
    green.position.set(-1.5, -6, 2.5);
    this.scene.add(green);
  }

  /* ── Nebula gas cloud ───────────────────────────────────────────────────── */
  _initParticles() {
    const n = PARTICLE_COUNT;
    const positions = new Float32Array(n * 3);
    const colors    = new Float32Array(n * 3);

    this.pPhases = new Float32Array(n);
    this.pSpeeds = new Float32Array(n);
    this.pBaseX  = new Float32Array(n);
    this.pBaseY  = new Float32Array(n);
    this.pBaseZ  = new Float32Array(n);

    const zoneCount = GAS_ZONES.length;

    for (let i = 0; i < n; i++) {
      const zone = GAS_ZONES[i % zoneCount];
      const s    = zone.spread;

      /* Seed each particle within its zone using a stretched box distribution
         (flatter on Y and Z so gas reads as wide, not spherical) */
      const bx = zone.cx + rand(-s,       s      );
      const by = zone.cy + rand(-s * 0.55, s * 0.55);
      const bz = zone.cz + rand(-s * 0.45, s * 0.45);

      positions[i * 3]     = bx;
      positions[i * 3 + 1] = by;
      positions[i * 3 + 2] = bz;

      this.pBaseX[i] = bx;
      this.pBaseY[i] = by;
      this.pBaseZ[i] = bz;

      /* Color: zone hue + brightness scatter for depth illusion */
      const col    = PALETTE[zone.ci];
      const bright = 0.65 + Math.random() * 0.55;
      colors[i * 3]     = clamp(col.r * bright, 0, 1);
      colors[i * 3 + 1] = clamp(col.g * bright, 0, 1);
      colors[i * 3 + 2] = clamp(col.b * bright, 0, 1);

      this.pPhases[i] = Math.random() * Math.PI * 2;
      this.pSpeeds[i] = rand(0.00010, 0.00028);  // per-particle drift variation
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const mat = new THREE.PointsMaterial({
      size: 1.5,              // screen-space pixels
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: false, // true single-pixel feel at any distance
      depthWrite: false,
    });

    this.particles  = new THREE.Points(geo, mat);
    this.pPositions = positions;
    this.gasGroup.add(this.particles);
  }

  /* ── GLB loader — 4× scale ───────────────────────────────────────────── */
  _loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      this.modelUrl,

      (gltf) => {
        const model = gltf.scene;

        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const longestDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 11.2 / longestDim;   // 4× original (was 2.8)
        model.scale.setScalar(scale);
        model.position.copy(center.negate().multiplyScalar(scale));

        model.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const m = child.material;
          m.roughness  = clamp((m.roughness  ?? 0.8) - 0.12, 0.05, 1.0);
          m.metalness  = clamp((m.metalness  ?? 0.0) + 0.18, 0.0,  1.0);
          m.needsUpdate = true;
        });

        model.rotation.set(0.05, -0.2, 0.03);
        this.rockGroup.add(model);
        console.log('[LTF Rock] Model loaded:', this.modelUrl);
      },

      undefined,

      (err) => {
        console.error('[LTF Rock] Failed to load model:', this.modelUrl, err);
      }
    );
  }

  /* ── Event bindings ─────────────────────────────────────────────────────── */
  _bindEvents() {
    this._onResizeFn = () => this._onResize();
    window.addEventListener('resize', this._onResizeFn);

    this._onScrollFn = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    };
    window.addEventListener('scroll', this._onScrollFn, { passive: true });

    this._onMouseFn = (e) => {
      this.mouseTX = (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouseTY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', this._onMouseFn, { passive: true });
  }

  /* ── Resize ─────────────────────────────────────────────────────────────── */
  _onResize() {
    let rect = this.container.getBoundingClientRect();
    if ((rect.width < 2 || rect.height < 2) && this.container.parentElement) {
      rect = this.container.parentElement.getBoundingClientRect();
    }
    this.w = Math.max(rect.width,  100);
    this.h = Math.max(rect.height, 100);
    this.renderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  /* ── Per-frame tick ──────────────────────────────────────────────────────── */
  _tick(now) {
    if (!this.running) return;

    const dt = this._lastNow ? Math.min(now - this._lastNow, 50) : 16;
    this._lastNow = now;
    this.time += dt;

    const t = this.time;

    /* Smooth mouse */
    this.mouseX += (this.mouseTX - this.mouseX) * 0.055;
    this.mouseY += (this.mouseTY - this.mouseY) * 0.055;

    /* Smooth scroll */
    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;

    /* ── Rock: scroll tumble + mouse yaw + idle oscillation ─────────────── */
    if (this.rockGroup) {
      /* Scroll → X tumble */
      const targetRotX = -0.15 + this.scrollProgress * Math.PI * 2.5;
      this.rockGroup.rotation.x += (targetRotX - this.rockGroup.rotation.x) * 0.07;

      /* Idle oscillation — slow sine pivot, returns to zero naturally.
         Mouse overrides: adds on top of idle so it feels responsive. */
      const idleYaw   = Math.sin(t * 0.00022) * 0.13;   // ±7.5° slow rock
      const idlePitch = Math.sin(t * 0.00016 + 1.1) * 0.045; // subtle nod

      /* Y: mouse + idle rest */
      const targetY = this.mouseX * 0.40 + idleYaw;
      this.rockGroup.rotation.y += (targetY - this.rockGroup.rotation.y) * 0.050;

      /* Z: mouse tilt + idle pitch */
      const targetZ = -this.mouseY * 0.06 + idlePitch;
      this.rockGroup.rotation.z += (targetZ - this.rockGroup.rotation.z) * 0.040;
    }

    /* ── Nebula gas: turbulence drift ──────────────────────────────────────── */
    if (this.particles) {
      const pos = this.pPositions;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const phase = this.pPhases[i];
        /* s: per-particle speed multiplier, range ~1.2–1.56 */
        const s = 1.0 + this.pSpeeds[i] * 2000;

        /* Layered turbulence: primary slow wave + faster harmonic per particle */
        pos[i * 3]     = this.pBaseX[i]
          + 0.48 * Math.sin(t * 0.000195 * s + phase)
          + 0.20 * Math.sin(t * 0.000420       + phase * 2.3);

        pos[i * 3 + 1] = this.pBaseY[i]
          + 0.40 * Math.cos(t * 0.000155 * s + phase * 1.3)
          + 0.16 * Math.cos(t * 0.000330       + phase * 1.7);

        pos[i * 3 + 2] = this.pBaseZ[i]
          + 0.30 * Math.sin(t * 0.000120 * s + phase * 0.8);
      }

      this.particles.geometry.attributes.position.needsUpdate = true;

      /* Gas counter-rotates gently vs rock — creates depth separation */
      if (this.rockGroup) {
        const counterY = -this.rockGroup.rotation.y * 0.10;
        this.gasGroup.rotation.y += (counterY - this.gasGroup.rotation.y) * 0.022;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this._frameBound);
  }

  /* ── Cleanup ──────────────────────────────────────────────────────────── */
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize',      this._onResizeFn);
    window.removeEventListener('scroll',      this._onScrollFn);
    window.removeEventListener('pointermove', this._onMouseFn);
    const el = this.renderer.domElement;
    if (el.parentNode) el.parentNode.removeChild(el);
    this.renderer.dispose();
    this.container.__ltfRock = null;
  }
}

/* ─── Auto-init ─────────────────────────────────────────────────────────── */
function init() {
  document.querySelectorAll('[data-ltf-rock]').forEach((node) => {
    if (!node.__ltfRock) node.__ltfRock = new RockScene(node);
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

window.LtfRockScene = { init, RockScene };

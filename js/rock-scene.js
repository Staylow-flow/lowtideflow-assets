/**
 * Lowtideflow — Rock Scene
 * Three.js WebGL rock (soapstone.glb) + iridescent particle cloud for the hero.
 *
 * Requires three.min.js + GLTFLoader.js to be loaded before this script.
 * Auto-inits on every [data-ltf-rock] container found in the DOM.
 * Model URL is read from the container's data-model-url attribute.
 *
 * Interactions:
 *   Scroll     → rock tumbles forward on the X axis
 *   Mouse move → rock yaws + the particle cloud drifts toward the cursor
 */
(function () {
  'use strict';

  /* ─── Guard ─────────────────────────────────────────────────────────────── */
  if (typeof THREE === 'undefined') {
    console.warn('[LTF Rock] three.js not found — rock scene disabled.');
    return;
  }

  /* ─── Brand palette (iridescent particle colors) ────────────────────────── */
  var PALETTE = [
    new THREE.Color(0x1f7781),  // --ltf-accent-teal
    new THREE.Color(0x4d259d),  // --ltf-accent-purple
    new THREE.Color(0x0b8050),  // --ltf-accent-green
    new THREE.Color(0x2a4070),  // soft navy (dim anchor)
    new THREE.Color(0x2aaab8),  // teal-light variant
    new THREE.Color(0x7040c0),  // purple-mid variant
  ];

  var PARTICLE_COUNT = 380;

  /* ─── Tiny utilities ─────────────────────────────────────────────────────── */
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ═══════════════════════════════════════════════════════════════════════════
     RockScene — one instance per [data-ltf-rock] container
  ═══════════════════════════════════════════════════════════════════════════ */
  function RockScene(container) {
    this.container = container;

    /* Model URL: prefer data-model-url on the element, fall back to root path */
    this.modelUrl = container.getAttribute('data-model-url') || '/soapstone.glb';

    /* Canvas dimensions */
    this.w = 1;
    this.h = 1;

    /* Interaction state */
    this.mouseX  = 0; this.mouseY  = 0;   // smoothed
    this.mouseTX = 0; this.mouseTY = 0;   // raw targets
    this.scrollProgress = 0;
    this.scrollTarget   = 0;
    this.time = 0;

    /* Three.js objects */
    this.scene     = null;
    this.camera    = null;
    this.renderer  = null;
    this.rockGroup = null;   // outer group — driven by scroll + mouse
    this.particles = null;   // THREE.Points orbiting the rock

    /* Particle attribute arrays (reused every frame) */
    this.pPositions = null;
    this.pPhases    = null;
    this.pSpeeds    = null;
    this.pBaseR     = null;
    this.pBaseTheta = null;
    this.pBasePhi   = null;

    /* RAF + running flag */
    this.running  = false;
    this.raf      = 0;
    this._lastNow = 0;

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
  RockScene.prototype._initRenderer = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,              // transparent canvas — flow-bg blobs show through
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    /* Handle both old (r152) and new (r165+) color-space API */
    if (this.renderer.outputColorSpace !== undefined) {
      this.renderer.outputColorSpace = (THREE.SRGBColorSpace || 'srgb');
    } else {
      this.renderer.outputEncoding = (THREE.sRGBEncoding || 3001);
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    /* Canvas is absolutely positioned by CSS (.ltf-rock-stage canvas) */
    this.container.appendChild(this.renderer.domElement);
  };

  /* ── Scene + camera ────────────────────────────────────────────────────── */
  RockScene.prototype._initScene = function () {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0.25, 7.5);
    this.camera.lookAt(0, 0, 0);

    /* Rock group — offset to match original boulder PNG position (center-left) */
    this.rockGroup = new THREE.Group();
    this.rockGroup.position.set(0.5, -0.1, 0);
    this.scene.add(this.rockGroup);
  };

  /* ── Iridescent lighting ────────────────────────────────────────────────── */
  RockScene.prototype._initLights = function () {
    /* Very dim ambient so no face is completely black */
    this.scene.add(new THREE.AmbientLight(0x0d1520, 0.55));

    /* Key light — top-right, cool white — defines the main surface form */
    var key = new THREE.DirectionalLight(0xd8e0f0, 1.5);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    /* Teal fill — front-left — colours the near face */
    var teal = new THREE.PointLight(0x1f7781, 3.5, 14);
    teal.position.set(-4, 1, 4);
    this.scene.add(teal);

    /* Purple rim — back-right — wraps the silhouette edge */
    var purple = new THREE.PointLight(0x4d259d, 3.0, 12);
    purple.position.set(4, -0.5, -4);
    this.scene.add(purple);

    /* Green kicker — below — subtle underlit glow */
    var green = new THREE.PointLight(0x0b8050, 2.0, 9);
    green.position.set(-1, -5, 2);
    this.scene.add(green);
  };

  /* ── Iridescent particle cloud ──────────────────────────────────────────── */
  RockScene.prototype._initParticles = function () {
    var n = PARTICLE_COUNT;

    /* Pre-allocate typed arrays for position updates every frame */
    var positions = new Float32Array(n * 3);
    var colors    = new Float32Array(n * 3);
    this.pPhases    = new Float32Array(n);
    this.pSpeeds    = new Float32Array(n);
    this.pBaseR     = new Float32Array(n);
    this.pBaseTheta = new Float32Array(n);
    this.pBasePhi   = new Float32Array(n);

    for (var i = 0; i < n; i++) {
      /* Spherical-shell distribution around the rock origin */
      var r     = rand(1.4, 3.1);
      var theta = Math.acos(clamp(2 * Math.random() - 1, -0.9999, 0.9999));
      var phi   = Math.random() * Math.PI * 2;

      /* Slightly flatten the vertical axis — rock is wider than tall */
      positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta) * 0.62;
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      /* Cycle through palette with per-particle brightness variation */
      var col    = PALETTE[i % PALETTE.length];
      var bright = 0.8 + Math.random() * 0.35;
      colors[i * 3]     = clamp(col.r * bright, 0, 1);
      colors[i * 3 + 1] = clamp(col.g * bright, 0, 1);
      colors[i * 3 + 2] = clamp(col.b * bright, 0, 1);

      this.pPhases[i]    = Math.random() * Math.PI * 2;
      this.pSpeeds[i]    = rand(0.00012, 0.00048);  // orbital speed (radians/ms)
      this.pBaseR[i]     = r;
      this.pBaseTheta[i] = theta;
      this.pBasePhi[i]   = phi;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    var mat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      blending: THREE.AdditiveBlending,  // particles bloom into bright mixed hues
      transparent: true,
      opacity: 0.78,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.pPositions = positions;
    this.scene.add(this.particles);
  };

  /* ── GLB loader ─────────────────────────────────────────────────────────── */
  RockScene.prototype._loadModel = function () {
    var self = this;
    var LoaderCtor = (typeof THREE.GLTFLoader !== 'undefined')
      ? THREE.GLTFLoader
      : null;

    if (!LoaderCtor) {
      console.warn('[LTF Rock] THREE.GLTFLoader not found. Load GLTFLoader.js before rock-scene.js.');
      return;
    }

    var loader = new LoaderCtor();
    loader.load(
      this.modelUrl,

      /* onLoad */
      function (gltf) {
        var model = gltf.scene;

        /* ── Auto-scale to a consistent visual size ── */
        var box    = new THREE.Box3().setFromObject(model);
        var size   = box.getSize(new THREE.Vector3());
        var center = box.getCenter(new THREE.Vector3());

        var longestDim = Math.max(size.x, size.y, size.z, 0.001);
        var scale = 2.8 / longestDim;   // normalise longest axis to ~2.8 world units
        model.scale.setScalar(scale);

        /* Centre the model on the group's local origin */
        model.position.copy(center.negate().multiplyScalar(scale));

        /* ── Tweak PBR material for better iridescent light response ── */
        model.traverse(function (child) {
          if (!child.isMesh || !child.material) return;
          var m = child.material;
          /* Reduce roughness slightly so the coloured point-lights reflect */
          m.roughness    = clamp((m.roughness    || 0.8) - 0.12, 0.05, 1.0);
          m.metalness    = clamp((m.metalness    || 0.0) + 0.18, 0.0, 1.0);
          m.needsUpdate  = true;
        });

        /* Slight initial tilt so it reads as a boulder, not a flat slab */
        model.rotation.set(0.05, -0.2, 0.03);

        self.rockGroup.add(model);
      },

      /* onProgress — optional */
      undefined,

      /* onError */
      function (err) {
        console.error('[LTF Rock] Failed to load', self.modelUrl, err);
      }
    );
  };

  /* ── Event bindings ─────────────────────────────────────────────────────── */
  RockScene.prototype._bindEvents = function () {
    var self = this;

    this._onResizeFn = function () { self._onResize(); };
    window.addEventListener('resize', this._onResizeFn);

    this._onScrollFn = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      self.scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    };
    window.addEventListener('scroll', this._onScrollFn, { passive: true });

    this._onMouseFn = function (e) {
      self.mouseTX = (e.clientX / window.innerWidth  - 0.5) * 2;
      self.mouseTY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', this._onMouseFn, { passive: true });
  };

  /* ── Resize handler ─────────────────────────────────────────────────────── */
  RockScene.prototype._onResize = function () {
    var rect = this.container.getBoundingClientRect();
    if ((rect.width < 2 || rect.height < 2) && this.container.parentElement) {
      rect = this.container.parentElement.getBoundingClientRect();
    }
    this.w = Math.max(rect.width,  100);
    this.h = Math.max(rect.height, 100);
    this.renderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  };

  /* ── Per-frame tick ──────────────────────────────────────────────────────── */
  RockScene.prototype._tick = function (now) {
    if (!this.running) return;

    var dt = this._lastNow ? Math.min(now - this._lastNow, 50) : 16;
    this._lastNow = now;
    this.time += dt;

    /* ── Smooth mouse ──────────────────────────────────────────────────── */
    this.mouseX += (this.mouseTX - this.mouseX) * 0.055;
    this.mouseY += (this.mouseTY - this.mouseY) * 0.055;

    /* ── Smooth scroll ──────────────────────────────────────────────────── */
    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;

    /* ── Rock group: scroll tumble + mouse yaw + idle drift ────────────── */
    if (this.rockGroup) {
      /* Scroll → forward tumble (X axis = the rock "rolls" over itself) */
      var targetRotX = -0.15 + this.scrollProgress * Math.PI * 2.5;
      this.rockGroup.rotation.x += (targetRotX - this.rockGroup.rotation.x) * 0.07;

      /* Mouse → horizontal yaw */
      this.rockGroup.rotation.y += (this.mouseX * 0.45 - this.rockGroup.rotation.y) * 0.055;

      /* Mouse → slight Z tilt for parallax depth */
      this.rockGroup.rotation.z += (-this.mouseY * 0.07 - this.rockGroup.rotation.z) * 0.045;

      /* Constant slow idle drift keeps it alive when nothing is happening */
      this.rockGroup.rotation.y += 0.00022;
    }

    /* ── Particles: orbit + mouse drift ────────────────────────────────── */
    if (this.particles) {
      var pos = this.pPositions;
      var n   = PARTICLE_COUNT;
      var t   = this.time;

      for (var i = 0; i < n; i++) {
        /* Advance orbital angle */
        var phi   = this.pBasePhi[i]   + t * this.pSpeeds[i];
        /* Slight elevation wobble */
        var theta = this.pBaseTheta[i] + 0.09 * Math.sin(t * 0.00062 + this.pPhases[i] * 1.4);
        /* Breathing radius */
        var r     = this.pBaseR[i]     + 0.20 * Math.sin(t * 0.00092 + this.pPhases[i]);

        pos[i * 3]     =  r * Math.sin(theta) * Math.cos(phi);
        pos[i * 3 + 1] =  r * Math.cos(theta) * 0.62;
        pos[i * 3 + 2] =  r * Math.sin(theta) * Math.sin(phi);
      }

      this.particles.geometry.attributes.position.needsUpdate = true;

      /* Mouse drags the entire cloud gently */
      this.particles.position.x += (this.mouseX  *  0.5 - this.particles.position.x) * 0.032;
      this.particles.position.y += (-this.mouseY * 0.38 - this.particles.position.y) * 0.032;
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this._frameBound);
  };

  /* ── Cleanup ──────────────────────────────────────────────────────────── */
  RockScene.prototype.destroy = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize',      this._onResizeFn);
    window.removeEventListener('scroll',      this._onScrollFn);
    window.removeEventListener('pointermove', this._onMouseFn);
    var el = this.renderer.domElement;
    if (el.parentNode) el.parentNode.removeChild(el);
    this.renderer.dispose();
    this.container.__ltfRock = null;
  };

  /* ─── Auto-init ─────────────────────────────────────────────────────────── */
  function init() {
    var nodes = document.querySelectorAll('[data-ltf-rock]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__ltfRock) {
        nodes[i].__ltfRock = new RockScene(nodes[i]);
      }
    }
  }

  function boot() {
    init();
    window.setTimeout(init, 400);
    window.setTimeout(init, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);

  /* Public API — same pattern as LtfFlowBackground */
  window.LtfRockScene = { init: init, RockScene: RockScene };

})();

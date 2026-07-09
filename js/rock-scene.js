/**
 * Lowtideflow — Rock Scene  (ES Module)
 *
 * Background: FBM domain-warped nebula shader — fractal gas turbulence in brand
 *             palette with transparent dark voids, wispy tendrils, dense cores.
 * Foreground: soapstone.glb rock — centered, autonomous idle oscillation,
 *             scroll tumble, minimal mouse nudge.
 *
 * Loaded as <script type="module"> — importmap resolves 'three' and 'three/addons/'.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ─────────────────────────────────────────────────────────────────────────────
   NEBULA SHADER — FBM Domain Warping

   Technique: Inigo Quilez "domain warping" — fbm(fbm(fbm(p)))
   This creates the organic swirling tendrils seen in real nebula photos.

   Alpha channel drives gas density: thick gas = opaque, void = transparent.
   The dark #00001C HTML background bleeds through thin regions naturally.
───────────────────────────────────────────────────────────────────────────── */
const NEBULA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NEBULA_FRAG = /* glsl */`
  precision highp float;

  uniform float time;
  uniform float timeOffset;
  uniform float rockYaw;
  uniform float rockPitch;
  uniform float aspect;
  uniform float alphaScale;
  uniform float nebulaInertia;
  uniform float gasCenterX;   /* bounds anchor X (UV) */
  uniform float gasCenterY;   /* bounds anchor Y (UV) */
  uniform float gasReach;     /* outer soft fade (UV units) */
  uniform float gasInner;     /* inner full-strength radius */
  uniform float edgeWarp;     /* FBM wobble on boundary */
  uniform float gasStretchX;  /* horizontal scale (>1 wider) */
  uniform float gasStretchY;  /* vertical scale (<1 taller cloud) */
  uniform vec2  mouseXY;
  varying vec2 vUv;

  const vec3 TEAL    = vec3(0.122, 0.467, 0.506);
  const vec3 PURPLE  = vec3(0.302, 0.145, 0.616);
  const vec3 GREEN   = vec3(0.043, 0.502, 0.314);
  const vec3 TEALL   = vec3(0.165, 0.667, 0.722);
  const vec3 PURPLEM = vec3(0.439, 0.251, 0.753);
  const vec3 NAVY    = vec3(0.165, 0.251, 0.439);

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 17.5);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.52;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      val += amp * vnoise(p * freq);
      freq *= 2.07;
      amp  *= 0.50;
      p    += vec2(1.74, 9.14);
    }
    return val;
  }

  vec3 nebulaColor(float t, vec2 pos) {
    vec3 c;
    if      (t < 0.20) c = mix(PURPLE,  TEAL,    t * 5.0);
    else if (t < 0.40) c = mix(TEAL,    TEALL,   (t - 0.20) * 5.0);
    else if (t < 0.60) c = mix(TEALL,   GREEN,   (t - 0.40) * 5.0);
    else if (t < 0.80) c = mix(GREEN,   PURPLEM, (t - 0.60) * 5.0);
    else               c = mix(PURPLEM, PURPLE,  (t - 0.80) * 5.0);
    return c;
  }

  void main() {
    vec2 uv = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);

    float t     = time + timeOffset;
    float yaw   = rockYaw;
    float pitch = rockPitch;

    /* Global swirl — follows rock rotation + scroll inertia */
    vec2  center = vec2(0.5 * aspect + 0.5 * (aspect - 1.0) * 0.5, 0.5);
    vec2  ruv    = uv - center;
    float angle  = t * 0.014 + yaw * 0.28 + pitch * 0.14 + nebulaInertia * 1.35;
    float ca = cos(angle), sa = sin(angle);
    uv = vec2(ruv.x * ca - ruv.y * sa, ruv.x * sa + ruv.y * ca) + center;

    /* Light mouse stir — UV only, no density streaks */
    vec2  mouseV   = vec2(mouseXY.x * 0.5 + 0.5, 0.5);
    vec2  mouseA   = vec2((mouseV.x - 0.5) * aspect + 0.5, 0.5);
    float mouseDist = distance(vUv, mouseV);
    float mouseMask = pow(1.0 - smoothstep(0.03, 0.165, mouseDist), 1.15);
    vec2  toMouse = uv - mouseA;
    float localSpin = mouseMask * mouseXY.x * 0.12;
    float lca = cos(localSpin), lsa = sin(localSpin);
    vec2  uvTwist = vec2(
      toMouse.x * lca - toMouse.y * lsa,
      toMouse.x * lsa + toMouse.y * lca
    ) + mouseA;
    uv = mix(uv, uvTwist, mouseMask * 0.28);

    /* Domain warp — this is the sweet swirling color field */
    vec2 q = vec2(
      fbm(uv * 2.2 + t * 0.10),
      fbm(uv * 2.2 + vec2(5.20, 1.30) + t * 0.09)
    );
    vec2 r = vec2(
      fbm(uv * 2.6 + 3.0 * q + vec2(1.70, 9.20) + t * 0.07),
      fbm(uv * 2.6 + 3.0 * q + vec2(8.30, 2.80) + t * 0.06)
    );
    float f  = fbm(uv * 2.0 + 4.0 * r + t * 0.04);
    float f2 = fbm(uv * 2.0 + 4.0 * r + t * 0.04 + vec2(0.18, 0.11));

    vec3 col = mix(nebulaColor(f, uv), nebulaColor(f2, uv), 0.28);
    col = mix(col, PURPLE, clamp(length(q) * 0.58 - 0.28, 0.0, 0.44));
    col = mix(col, NAVY,   clamp(0.58 - f * 0.42, 0.0, 0.155));
    col = mix(col, TEALL,  clamp(r.x - 0.5, 0.0, 0.22));

    float gas = pow(clamp(f * 1.65 - 0.30, 0.0, 1.0), 1.35);

    /* Constraint field — slider width/height/reach define the volume */
    vec2  rockUV  = vec2(gasCenterX, gasCenterY);
    vec2  p       = vUv - rockUV;
    p.x *= aspect * gasStretchX;
    p.y *= gasStretchY;

    float distRaw = length(p);
    float ang     = atan(p.y, p.x);

    vec2  warpUV  = p * 2.8 + vec2(t * 0.042, t * 0.031) + vec2(yaw * 0.12, pitch * 0.07);
    float edgeN1  = (fbm(warpUV) - 0.5) * edgeWarp;
    float edgeN2  = (fbm(warpUV * 1.55 + vec2(t * 0.022, -t * 0.018)) - 0.5) * edgeWarp * 0.42;
    float dist    = distRaw + edgeN1 + edgeN2;

    /* S-curve streaks — curved flow lines, color interest not void cuts */
    float flowCurve = sin(p.x * 6.8 + t * 0.09 + yaw * 0.2) * 0.022
                    + sin(p.x * 3.2 - t * 0.06 + pitch * 0.15) * 0.012;
    float sParam    = p.x * 1.12 + sin((p.y + flowCurve) * 5.5 + t * 0.07) * 0.036;
    float streakSeed = fbm(vec2(sParam * 0.35 + t * 0.04, distRaw * 4.0));
    float streakWave = sin(sParam * 12.0 + streakSeed * 6.0 + t * 0.08) * 0.5 + 0.5;
    float streak    = pow(streakWave, 3.4);
    streak *= smoothstep(gasInner * 0.55, gasReach * 0.90, distRaw);
    streak *= 1.0 - smoothstep(gasReach * 0.86, gasReach * 1.10, distRaw);
    col = mix(col, PURPLEM, streak * 0.20);
    col = mix(col, TEALL,  streak * 0.14);
    col = mix(col, PURPLE, streak * 0.10);
    gas += streak * 0.06;

    /* Octopus arms — curl at boundary band, extend gas outward (additive) */
    float armField = fbm(vec2(ang * 2.1 + t * 0.065 + yaw * 0.35, distRaw * 3.2 + pitch * 0.25));
    float armCurl  = fbm(vec2(ang * 3.8 - t * 0.095 + nebulaInertia * 0.4, distRaw * 5.5 + t * 0.04));
    float armBand  = smoothstep(gasInner + 0.05, gasReach * 0.50, distRaw)
                   * (1.0 - smoothstep(gasReach * 0.80, gasReach * 1.12, distRaw));

    float armPush  = (armField - 0.48) * 0.11 * armBand;
    float curlLift = pow(clamp(armCurl, 0.0, 1.0), 1.35) * armBand * 0.075;
    float distFlow = dist - armPush - curlLift;

    float body = 1.0 - smoothstep(gasInner, gasReach, distFlow);
    body = pow(max(body, 0.0), 0.68);

    float armPhase = sin(ang * 3.0 + armField * 6.28 + t * 0.14) * 0.5 + 0.5;
    float tendril  = pow(armPhase, 2.1) * armCurl * armBand;
    tendril *= smoothstep(gasReach * 0.55, gasReach * 1.04, distRaw);
    float armGas   = tendril * gas * (0.50 + armField * 0.50);

    col = mix(col, PURPLE, tendril * 0.26);
    col = mix(col, NAVY,   tendril * 0.16);
    col = mix(col, PURPLEM, armGas * 0.12);
    col  = clamp(col, 0.0, 1.0);

    /* Body volume + flowing arm wisps — not a flat opacity mask at edge */
    float alpha = (gas * body + armGas * 0.88) * alphaScale;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

/* ─── Constants ──────────────────────────────────────────────────────────── */
const MAX_HSCROLL_YAW      = (5 * Math.PI) / 180;
const HSCROLL_Y_BIAS       = -0.125;           // CCW compensation (+5% from prior)
const SCROLL_ROT_DOWN      = Math.PI * 2 * 2 * 0.7 * 4;  // 4× scroll rotation range
const GAS_FOLLOW_DELAY_MS  = 300;              // gas lags rock by 0.3 s
const GAS_COAST_TAU_MS     = 3000;             // 2–4 s ease-out coast (midpoint)
const ROCK_SCROLL_COAST    = 1.30;             // +30% post-scroll spin momentum
const ROCK_SPIN_DECAY      = 0.9984;             // friction — coast ~2 s, no snap-back
const SCROLL_IMPULSE_GAIN  = 0.135;              // ×0.1 from prior tuning
const SCROLL_VEL_SCALE     = 0.0055;
const ROCK_LIFT_PX         = 150;
const ROCK_SCALE_BASE      = 12.936 * 1.25;  /* +25% rock size */
const CAMERA_Z             = 24;
const CAMERA_FOV           = 45;
const GAS_REACH_BEHIND     = 0.56;
const GAS_REACH_FRONT      = 0.48;
const GAS_INNER            = 0.10;
const GAS_EDGE_WARP        = 0.11;
const GAS_CENTER_X         = 0.48;
const GAS_CENTER_Y         = 0.50;
const GAS_STRETCH_X        = 1.0;
const GAS_STRETCH_Y        = 0.86;
const BEHIND_FG_VISIBLE    = true;  // override with ?behind=0
const ROCK_VISIBLE         = true;  // override with ?rock=0
const FRONT_FG_VISIBLE     = false; // off by default — behind layer carries the gas field
const BEHIND_FG_OPACITY    = 1.0;
const FRONT_FG_OPACITY     = 0.45;  // optional second pass — ?front=1

const GAS_TUNING_DEFAULTS = {
  gasCenterX:  GAS_CENTER_X,
  gasCenterY:  GAS_CENTER_Y,
  gasStretchX: GAS_STRETCH_X,
  gasStretchY: GAS_STRETCH_Y,
  gasReach:    GAS_REACH_BEHIND,
  gasInner:    GAS_INNER,
  edgeWarp:    GAS_EDGE_WARP,
  alphaScale:  BEHIND_FG_OPACITY,
  rockLiftPx:  ROCK_LIFT_PX,
};

function parsePassOn(q, keys, defaultOn) {
  for (let i = 0; i < keys.length; i++) {
    if (q.has(keys[i])) return q.get(keys[i]) !== '0';
  }
  return defaultOn;
}

/** Three-pass toggles: ?behind=1&rock=0&front=0 | shorthand ?layers=behind */
function layerVisibility() {
  if (typeof location === 'undefined') {
    return { behind: BEHIND_FG_VISIBLE, rock: ROCK_VISIBLE, front: FRONT_FG_VISIBLE, frontInspect: false };
  }
  const q = new URLSearchParams(location.search);
  const mode = (q.get('layers') || q.get('mode') || '').toLowerCase();
  if (mode === 'behind' || mode === 'bg') {
    return { behind: true, rock: false, front: false, frontInspect: false };
  }
  return {
    behind: parsePassOn(q, ['behind', 'behindFg', 'bg'], BEHIND_FG_VISIBLE),
    rock:   parsePassOn(q, ['rock'], ROCK_VISIBLE),
    front:  parsePassOn(q, ['front', 'frontFg', 'fg'], FRONT_FG_VISIBLE),
    frontInspect: (q.has('frontInspect') && q.get('frontInspect') !== '0')
               || (q.has('fgInspect')     && q.get('fgInspect')     !== '0'),
  };
}

function behindOpacity() {
  if (typeof location === 'undefined') return BEHIND_FG_OPACITY;
  const q = new URLSearchParams(location.search);
  const raw = q.get('behindOp') ?? q.get('bgOp');
  if (raw == null || raw === '') return BEHIND_FG_OPACITY;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? clamp(n, 0, 1) : BEHIND_FG_OPACITY;
}

function frontOpacity() {
  if (typeof location === 'undefined') return FRONT_FG_OPACITY;
  const q = new URLSearchParams(location.search);
  const raw = q.get('frontOp') ?? q.get('fgOp');
  if (raw == null || raw === '') return FRONT_FG_OPACITY;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? clamp(n, 0, 1) : FRONT_FG_OPACITY;
}

function rockLiftWorld(viewportH, px = ROCK_LIFT_PX) {
  const fovRad   = (CAMERA_FOV * Math.PI) / 180;
  const visibleH = 2 * CAMERA_Z * Math.tan(fovRad / 2);
  return (px / viewportH) * visibleH;
}

function rockLiftUV(viewportH, px = ROCK_LIFT_PX) {
  return (px / viewportH) * 0.95;
}

/** Exponential smoothing factor for a time constant in ms. */
function lagAlpha(dt, tauMs) {
  return 1 - Math.exp(-dt / tauMs);
}

/* ─── Utility ────────────────────────────────────────────────────────────── */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ═══════════════════════════════════════════════════════════════════════════
   RockScene
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

    this.scene      = null;
    this.bgScene    = null;
    this.bgCamera   = null;
    this.fgScene    = null;
    this.fgCamera   = null;
    this.camera     = null;
    this.renderer   = null;
    this.rockGroup  = null;
    this.nebulaUni  = null;
    this.fgNebulaUni = null;

    this.running          = false;
    this.raf              = 0;
    this.rockPitchAccum   = 0;
    this.scrollPitchOffset = 0;
    this.scrollPitchVelocity = 0;
    this._lastScrollProgress  = 0;
    this.hScrollYawTarget  = 0;
    this.hScrollYaw        = 0;
    this.nebulaVelocity    = 0;
    this.nebulaAngleAccum  = 0;
    this.nebulaYawDelayed   = 0;   // gas follows rock with 0.3 s lag
    this.nebulaPitchDelayed = 0;
    this._prevPitch         = 0;
    this._prevDelayedPitch  = 0;
    this._gasCenterYManual  = false;
    this.rockLiftPx         = ROCK_LIFT_PX;

    this._initRenderer();
    this._initScenes();
    this._initNebula();
    this._initLights();
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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.autoClear = false;
    this.container.appendChild(this.renderer.domElement);
  }

  /* ── Scenes + cameras ──────────────────────────────────────────────────── */
  _initScenes() {
    this.bgScene  = new THREE.Scene();
    this.bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.fgScene  = new THREE.Scene();
    this.fgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 150);
    this.camera.position.set(0, 0, 24);
    this.camera.lookAt(0, 0, 0);

    this.rockGroup = new THREE.Group();
    this.rockGroup.position.set(0, 0, 0);
    this.scene.add(this.rockGroup);
  }

  _applyRockLift() {
    if (this.rockGroup) {
      this.rockGroup.position.y = rockLiftWorld(this.h, this.rockLiftPx);
    }
    if (this.nebulaUni && !this._gasCenterYManual) {
      this.nebulaUni.gasCenterY.value = GAS_CENTER_Y + rockLiftUV(this.h, this.rockLiftPx);
    }
  }

  /* ── Nebula background quad ─────────────────────────────────────────────── */
  _initNebula() {
    const geo = new THREE.PlaneGeometry(2, 2);

    function makeNebulaUniforms(timeOffset, alphaScale, gasReach) {
      return {
        time:          { value: 0.0 },
        timeOffset:    { value: timeOffset },
        rockYaw:       { value: 0.0 },
        rockPitch:     { value: 0.0 },
        aspect:        { value: 1.0 },
        alphaScale:    { value: alphaScale },
        nebulaInertia: { value: 0.0 },
        gasCenterX:    { value: GAS_CENTER_X },
        gasCenterY:    { value: GAS_CENTER_Y },
        gasReach:      { value: gasReach },
        gasInner:      { value: GAS_INNER },
        edgeWarp:      { value: GAS_EDGE_WARP },
        gasStretchX:   { value: GAS_STRETCH_X },
        gasStretchY:   { value: GAS_STRETCH_Y },
        mouseXY:       { value: new THREE.Vector2(0, 0) },
      };
    }

    const bgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: makeNebulaUniforms(0.0, BEHIND_FG_OPACITY, GAS_REACH_BEHIND),
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
    });
    this.bgScene.add(new THREE.Mesh(geo, bgMat));
    this.nebulaUni = bgMat.uniforms;

    const fgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: makeNebulaUniforms(3.7, FRONT_FG_OPACITY, GAS_REACH_FRONT),
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
    });
    this.fgScene.add(new THREE.Mesh(geo, fgMat));
    this.fgNebulaUni = fgMat.uniforms;
  }

  /* ── Iridescent rock lighting ─────────────────────────────────────────── */
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0x0d1520, 0.50));

    const key = new THREE.DirectionalLight(0xd8e0f0, 1.35);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const teal = new THREE.PointLight(0x1f7781, 3.15, 24);
    teal.position.set(-7, 2, 6);
    this.scene.add(teal);

    const purple = new THREE.PointLight(0x4d259d, 2.70, 20);
    purple.position.set(7, -1, -6);
    this.scene.add(purple);

    const green = new THREE.PointLight(0x0b8050, 1.80, 16);
    green.position.set(-2, -8, 3);
    this.scene.add(green);
  }

  /* ── GLB loader ──────────────────────────────────────────────────────────── */
  _loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      this.modelUrl,

      (gltf) => {
        const model = gltf.scene;

        /* Scale to target size */
        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const longestDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = ROCK_SCALE_BASE / longestDim;
        model.scale.setScalar(scale);

        /* Re-centre the model on the group origin */
        model.position.copy(center.negate().multiplyScalar(scale));

        /* After centering, apply a corrective X offset to counter any visual
           asymmetry in the soapstone mesh (boulder heavier on one side).
           Adjust ROCK_X_CORRECT if rock still drifts left/right. */
        const ROCK_X_CORRECT = -0.6;
        model.position.x += ROCK_X_CORRECT;

        model.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const m = child.material;
          m.roughness  = clamp((m.roughness  ?? 0.8) - 0.12, 0.05, 1.0);
          m.metalness  = clamp((m.metalness  ?? 0.0) + 0.18, 0.0,  1.0);
          m.needsUpdate = true;
        });

        model.rotation.set(0.05, -0.2, 0.03);
        this.rockGroup.add(model);
        this.rockGroup.visible = layerVisibility().rock;
        const lv = layerVisibility();
        console.log('[LTF Rock] loaded | behind:', lv.behind, '| rock:', lv.rock, '| front:', lv.front, '| url:', location.href);
      },

      undefined,

      (err) => {
        console.error('[LTF Rock] Failed to load model:', this.modelUrl, err);
      }
    );
  }

  /* ── Events ─────────────────────────────────────────────────────────────── */
  _bindEvents() {
    this._onResizeFn = () => this._onResize();
    window.addEventListener('resize', this._onResizeFn);

    this._onScrollFn = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    };
    window.addEventListener('scroll', this._onScrollFn, { passive: true });

    this._onMouseFn = (e) => {
      this.mouseTX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouseTY = 0;
    };
    window.addEventListener('pointermove', this._onMouseFn, { passive: true });

    /* Mac trackpad / mouse horizontal scroll → rock Y-axis tilt ±5° */
    this._onWheelFn = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.55) return;
      this.hScrollYawTarget = clamp(
        this.hScrollYawTarget - e.deltaX * 0.00055,
        -MAX_HSCROLL_YAW,
        MAX_HSCROLL_YAW
      );
    };
    window.addEventListener('wheel', this._onWheelFn, { passive: true });
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
    this._applyRockLift();
    if (this.nebulaUni) {
      this.nebulaUni.aspect.value = this.w / this.h;
    }
    if (this.fgNebulaUni) {
      this.fgNebulaUni.aspect.value = this.w / this.h;
    }
  }

  /* ── Per-frame tick ──────────────────────────────────────────────────────── */
  _tick(now) {
    if (!this.running) return;

    const dt = this._lastNow ? Math.min(now - this._lastNow, 50) : 16;
    this._lastNow = now;
    this.time += dt;

    const t = this.time;

    this.mouseX += (this.mouseTX - this.mouseX) * 0.028;
    this.mouseY = 0;
    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;

    /* Horizontal wheel tilt — spring toward target, clamped ±5° */
    this.hScrollYaw += (this.hScrollYawTarget - this.hScrollYaw) * 0.07;

    /* ── Rock rotation ────────────────────────────────────────────────────
       X: auto-spin + scroll (down → 2 rot, up → 0.5× rate).
       Y: idle wobble + horizontal scroll tilt (±5°, CCW bias).
       Z: subtle idle nod only.                                           */
    if (this.rockGroup) {
      /* Slow continuous tumble — ~1 full rotation per 140 s */
      this.rockPitchAccum += 0.0000225 * dt;

      /* Scroll → impulse only (no spring). Heavy rock coasts, never rubber-bands. */
      const scrollDelta = this.scrollProgress - this._lastScrollProgress;
      this._lastScrollProgress = this.scrollProgress;

      if (Math.abs(scrollDelta) > 0.000001) {
        const dirGain = scrollDelta >= 0 ? 1.0 : 0.25;
        this.scrollPitchVelocity += scrollDelta * SCROLL_ROT_DOWN * dirGain
                                  * SCROLL_IMPULSE_GAIN * ROCK_SCROLL_COAST;
      }

      this.scrollPitchVelocity *= Math.pow(ROCK_SPIN_DECAY, dt);
      this.scrollPitchOffset  += this.scrollPitchVelocity * dt * SCROLL_VEL_SCALE;

      this.rockGroup.rotation.x = this.rockPitchAccum + this.scrollPitchOffset;

      /* Idle wobble + horizontal-scroll Y tilt + CCW symmetry bias */
      const idleYaw = Math.sin(t * 0.00020) * 0.07 + Math.sin(t * 0.00039) * 0.03;
      const idleNod = Math.sin(t * 0.00015 + 1.4) * 0.025;
      const targetY = idleYaw + this.hScrollYaw + HSCROLL_Y_BIAS;

      this.rockGroup.rotation.y += (targetY - this.rockGroup.rotation.y) * 0.036;
      this.rockGroup.rotation.z += (idleNod - this.rockGroup.rotation.z) * 0.030;
    }

    /* ── Nebula — lags rock 0.3 s, coasts 2–4 s with ease-out ───────────── */
    if (this.rockGroup) {
      const rockYaw   = this.rockGroup.rotation.y;
      const rockPitch = this.rockGroup.rotation.x;
      const gasLag    = lagAlpha(dt, GAS_FOLLOW_DELAY_MS);

      this.nebulaYawDelayed   += (rockYaw   - this.nebulaYawDelayed)   * gasLag;
      this.nebulaPitchDelayed += (rockPitch - this.nebulaPitchDelayed) * gasLag;

      const pitchDelta = (this.nebulaPitchDelayed - this._prevDelayedPitch) / dt;
      this._prevDelayedPitch = this.nebulaPitchDelayed;
      this._prevPitch        = rockPitch;

      const nebulaTarget = pitchDelta * 0.38;
      const gasAccel     = lagAlpha(dt, GAS_FOLLOW_DELAY_MS * 0.6);
      this.nebulaVelocity += (nebulaTarget - this.nebulaVelocity) * gasAccel;
      this.nebulaVelocity *= Math.exp(-dt / GAS_COAST_TAU_MS);
      this.nebulaAngleAccum += this.nebulaVelocity * dt;
    }

    /* ── Nebula uniforms (delayed rock coupling) ─────────────────────────── */
    const nebulaTime  = t * 0.00042;
    const nebulaYaw   = this.nebulaYawDelayed;
    const nebulaPitch = this.nebulaPitchDelayed;

    const layers   = layerVisibility();
    const behindOp = behindOpacity();
    const frontOp  = frontOpacity();
    const frontOn  = layers.front || layers.frontInspect;

    if (this.nebulaUni && layers.behind) {
      this.nebulaUni.alphaScale.value       = behindOp;
      this.nebulaUni.time.value             = nebulaTime;
      this.nebulaUni.rockYaw.value          = nebulaYaw;
      this.nebulaUni.rockPitch.value        = nebulaPitch;
      this.nebulaUni.nebulaInertia.value    = this.nebulaAngleAccum;
      this.nebulaUni.mouseXY.value.set(this.mouseX, this.mouseY);
    }
    if (this.fgNebulaUni && frontOn) {
      this.fgNebulaUni.alphaScale.value     = frontOp;
      this.fgNebulaUni.time.value           = nebulaTime;
      this.fgNebulaUni.rockYaw.value        = nebulaYaw;
      this.fgNebulaUni.rockPitch.value      = nebulaPitch;
      this.fgNebulaUni.nebulaInertia.value  = this.nebulaAngleAccum;
      this.fgNebulaUni.mouseXY.value.set(this.mouseX, this.mouseY);
    }

    if (this.rockGroup) this.rockGroup.visible = layers.rock;

    /* ── Three-pass render: behind FG → rock → front FG ──────────────────── */
    this.renderer.clear();
    if (layers.behind) {
      this.renderer.render(this.bgScene, this.bgCamera);
    }
    if (layers.rock) {
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }
    if (frontOn) {
      this.renderer.clearDepth();
      this.renderer.render(this.fgScene, this.fgCamera);
    }

    const dbg = document.getElementById('ltf-layer-debug');
    if (dbg) {
      const behindLabel = layers.behind
        ? 'Behind FG: ON @' + Math.round(behindOp * 100) + '%'
        : 'Behind FG: OFF';
      const rockLabel = 'Rock: ' + (layers.rock ? 'ON' : 'OFF');
      const frontLabel = frontOn
        ? 'Front FG: ' + (layers.frontInspect && !layers.front ? 'INSPECT @' : 'ON @')
          + Math.round(frontOp * 100) + '%'
        : 'Front FG: OFF';
      dbg.textContent = behindLabel + '  |  ' + rockLabel + '  |  ' + frontLabel;
    }

    this.raf = requestAnimationFrame(this._frameBound);
  }

  /* ── Cleanup ──────────────────────────────────────────────────────────── */
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize',      this._onResizeFn);
    window.removeEventListener('scroll',      this._onScrollFn);
    window.removeEventListener('pointermove', this._onMouseFn);
    window.removeEventListener('wheel',       this._onWheelFn);
    const el = this.renderer.domElement;
    if (el.parentNode) el.parentNode.removeChild(el);
    this.renderer.dispose();
    this.container.__ltfRock = null;
  }
}

function getPrimaryRockScene() {
  const node = document.querySelector('[data-ltf-rock]');
  return node?.__ltfRock ?? null;
}

function readGasTuning() {
  const scene = getPrimaryRockScene();
  const u = scene?.nebulaUni;
  if (!u) return null;
  return {
    gasCenterX:  u.gasCenterX.value,
    gasCenterY:  u.gasCenterY.value,
    gasStretchX: u.gasStretchX.value,
    gasStretchY: u.gasStretchY.value,
    gasReach:    u.gasReach.value,
    gasInner:    u.gasInner.value,
    edgeWarp:    u.edgeWarp.value,
    alphaScale:  u.alphaScale.value,
    rockLiftPx:  scene.rockLiftPx,
  };
}

function applyGasTuning(tuning) {
  const scene = getPrimaryRockScene();
  const u = scene?.nebulaUni;
  if (!u || !tuning) return;
  if (tuning.gasCenterX  != null) u.gasCenterX.value  = tuning.gasCenterX;
  if (tuning.gasCenterY  != null) {
    scene._gasCenterYManual = true;
    u.gasCenterY.value = tuning.gasCenterY;
  }
  if (tuning.gasStretchX != null) u.gasStretchX.value = tuning.gasStretchX;
  if (tuning.gasStretchY != null) u.gasStretchY.value = tuning.gasStretchY;
  if (tuning.gasReach    != null) u.gasReach.value    = tuning.gasReach;
  if (tuning.gasInner    != null) u.gasInner.value    = tuning.gasInner;
  if (tuning.edgeWarp    != null) u.edgeWarp.value    = tuning.edgeWarp;
  if (tuning.alphaScale  != null) u.alphaScale.value  = tuning.alphaScale;
  if (tuning.rockLiftPx  != null) {
    scene.rockLiftPx = tuning.rockLiftPx;
    scene._applyRockLift();
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

window.LtfRockScene = {
  init, RockScene, layerVisibility, behindOpacity, frontOpacity,
  GAS_TUNING_DEFAULTS, getPrimaryRockScene, readGasTuning, applyGasTuning,
};

export {
  init, RockScene, layerVisibility, behindOpacity, frontOpacity,
  GAS_TUNING_DEFAULTS, getPrimaryRockScene, readGasTuning, applyGasTuning,
};

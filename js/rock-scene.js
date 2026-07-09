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
  uniform float timeOffset;   /* phase shift so fg/bg layers don't overlap */
  uniform float rockYaw;
  uniform float rockPitch;
  uniform float aspect;
  uniform float alphaScale;      /* 0.90 bg, 0.38 fg */
  uniform float haloOuter;       /* smoothstep outer radius */
  uniform float tentacleStrength;/* warp amplitude: 0.26 bg, 0.48 fg */
  uniform float rockExclusion;   /* opacity hole at rock centre: 0.0 bg, 1.0 fg */
  uniform float edgeOnly;        /* 0 = bg volume, 1 = fg edge tentacles only */
  uniform float gasRadius;       /* 1.0 = default reach, 0.75 = 25% tighter */
  uniform float nebulaInertia;   /* momentum-driven swirl offset accumulator */
  uniform vec2  mouseXY;         /* smoothed -1..1 mouse, shared both layers */
  uniform vec2  mousePrevXY;     /* prior frame — draws air-sweep trail */
  uniform vec2  mouseTailXY;     /* ~120 ms lag — long finger-streak line */
  uniform float gasLiftY;        /* UV lift — locks nebula halo to rock */
  varying vec2 vUv;

  /* ── Brand palette ────────────────────────────────────────────── */
  const vec3 TEAL    = vec3(0.122, 0.467, 0.506);  /* #1f7781 */
  const vec3 PURPLE  = vec3(0.302, 0.145, 0.616);  /* #4d259d */
  const vec3 GREEN   = vec3(0.043, 0.502, 0.314);  /* #0b8050 */
  const vec3 TEALL   = vec3(0.165, 0.667, 0.722);  /* #2aaab8 */
  const vec3 PURPLEM = vec3(0.439, 0.251, 0.753);  /* #7040c0 */
  const vec3 NAVY    = vec3(0.165, 0.251, 0.439);  /* #2a4070 */

  /* ── Value noise ─────────────────────────────────────────────── */
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 17.5);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);  /* smoothstep */
    return mix(
      mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  /* ── Fractal Brownian Motion — 5 octaves ─────────────────────── */
  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.52;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      val += amp * vnoise(p * freq);
      freq *= 2.07;
      amp  *= 0.50;
      p    += vec2(1.74, 9.14);  /* offset each octave to break periodicity */
    }
    return val;
  }

  /* ── Smooth color palette indexed 0→1 ───────────────────────── */
  vec3 nebulaColor(float t, vec2 pos) {
    /* 5-stop gradient through brand colors */
    vec3 c;
    if      (t < 0.20) c = mix(PURPLE,  TEAL,    t * 5.0);
    else if (t < 0.40) c = mix(TEAL,    TEALL,   (t - 0.20) * 5.0);
    else if (t < 0.60) c = mix(TEALL,   GREEN,   (t - 0.40) * 5.0);
    else if (t < 0.80) c = mix(GREEN,   PURPLEM, (t - 0.60) * 5.0);
    else               c = mix(PURPLEM, PURPLE,  (t - 0.80) * 5.0);
    return c;
  }

  void main() {
    /* Aspect-correct UV */
    vec2 uv = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);

    float t     = time + timeOffset;
    float yaw   = rockYaw;
    float pitch = rockPitch;

    /* Swirl rotation — rock axes + scroll inertia only (no global mouse) */
    vec2  center = vec2(0.5 * aspect + 0.5 * (aspect - 1.0) * 0.5, 0.5);
    vec2  ruv    = uv - center;
    float angle  = t * 0.014 + yaw * 0.28 + pitch * 0.14 + nebulaInertia * 1.35;
    float ca = cos(angle), sa = sin(angle);
    uv = vec2(ruv.x * ca - ruv.y * sa, ruv.x * sa + ruv.y * ca) + center;

    /* ── Mouse — long finger streak + point stir ─────────────────────── */
    vec2  mouseV     = vec2(mouseXY.x     * 0.5 + 0.5, mouseXY.y     * 0.5 + 0.5);
    vec2  mousePrevV = vec2(mousePrevXY.x * 0.5 + 0.5, mousePrevXY.y * 0.5 + 0.5);
    vec2  mouseTailV = vec2(mouseTailXY.x * 0.5 + 0.5, mouseTailXY.y * 0.5 + 0.5);
    vec2  mouseA     = vec2((mouseV.x - 0.5) * aspect + 0.5, mouseV.y);

    float mouseDist  = distance(vUv, mouseV);
    float mouseMask  = pow(1.0 - smoothstep(0.0, 0.18, mouseDist), 1.8);

    /* Long trail segment (tail → cursor) */
    vec2  baLong     = mouseV - mouseTailV;
    vec2  paLong     = vUv - mouseTailV;
    float segLenLong = length(baLong);
    float segTLong   = clamp(dot(paLong, baLong) / max(dot(baLong, baLong), 0.00004), 0.0, 1.0);
    float fingerDist = length(paLong - baLong * segTLong);
    float fingerMask = pow(1.0 - smoothstep(0.0, 0.095, fingerDist), 2.2);
    fingerMask      *= smoothstep(0.012, 0.07, segLenLong);

    /* Short segment (prev → cursor) for crisp leading edge */
    vec2  ba         = mouseV - mousePrevV;
    vec2  pa         = vUv - mousePrevV;
    float segLen     = length(ba);
    float segT       = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00004), 0.0, 1.0);
    float sweepDist  = length(pa - ba * segT);
    float sweepMask  = pow(1.0 - smoothstep(0.0, 0.14, sweepDist), 1.4);
    sweepMask       *= smoothstep(0.003, 0.045, segLen);

    float trailMask  = max(fingerMask, sweepMask * 0.85);

    vec2  toMouse    = uv - mouseA;
    float localSpin  = (mouseMask + trailMask * 2.2) * (mouseXY.x * 0.22 + mouseXY.y * 0.10);
    float lca = cos(localSpin), lsa = sin(localSpin);
    vec2  uvTwist = vec2(
      toMouse.x * lca - toMouse.y * lsa,
      toMouse.x * lsa + toMouse.y * lca
    ) + mouseA;
    uv = mix(uv, uvTwist, mouseMask * 0.38 + trailMask * 0.72);

    vec2 pushDir  = normalize(toMouse + vec2(0.0001));
    vec2 fingerDir = normalize(baLong + vec2(0.0001));
    uv += pushDir   * mouseMask   * dot(mouseXY, pushDir) * 0.045;
    uv += fingerDir * trailMask   * 0.12;
    uv += vec2(-fingerDir.y, fingerDir.x) * trailMask * 0.05;

    /* ── Domain warp layer 1 ────────────────────────────────────── */
    vec2 q = vec2(
      fbm(uv * 2.2 + vec2(0.00, 0.00) + t * 0.10),
      fbm(uv * 2.2 + vec2(5.20, 1.30) + t * 0.09)
    );

    /* ── Domain warp layer 2 ────────────────────────────────────── */
    vec2 r = vec2(
      fbm(uv * 2.6 + 3.0 * q + vec2(1.70, 9.20) + t * 0.07),
      fbm(uv * 2.6 + 3.0 * q + vec2(8.30, 2.80) + t * 0.06)
    );

    /* ── Final noise ────────────────────────────────────────────── */
    float f  = fbm(uv * 2.0 + 4.0 * r + t * 0.04);
    /* Second nearby sample — blending the two meshes the color transitions */
    float f2 = fbm(uv * 2.0 + 4.0 * r + t * 0.04 + vec2(0.18, 0.11));

    /* Dual-sample color blend: softens hard color borders into gradient mesh */
    vec3 col = mix(nebulaColor(f, uv), nebulaColor(f2, uv), 0.28);
    col = mix(col, PURPLE, clamp(length(q) * 0.55 - 0.32, 0.0, 0.38)); /* +10% purple */
    col = mix(col, NAVY,   clamp(0.55 - f * 0.45,       0.0, 0.14)); /* +5% navy in voids */
    col = mix(col, TEALL,  clamp(r.x - 0.5,             0.0, 0.22));

    /* ── Density — moderate threshold ──────────────────────────── */
    float density = pow(clamp(f * 1.8 - 0.35, 0.0, 1.0), 1.6);

    /* Glow on dense cores */
    col += col * density * 0.65;
    col  = clamp(col, 0.0, 1.0);

    /* ── Organic tentacle halo ────────────────────────────────────
       Instead of a clean circle, the boundary is FBM-warped along
       the angular direction — this creates swirling arm-like tendrils
       that poke out in some directions while staying concave in others.
       The tentacles rotate slowly and react to the rock's pitch axis.   */
    /* Halo center — lifted with rock (gasLiftY uniform) */
    vec2  haloUV      = vUv + vec2(0.0, gasLiftY);
    vec2  rockUV      = vec2(0.48, 0.50);

    vec2  dvRaw       = haloUV - rockUV;
    float vertBias    = dvRaw.y > 0.0 ? 1.35 : 1.0;
    vec2  dv          = vec2(dvRaw.x, dvRaw.y * vertBias);
    float baseDist    = length(dv);
    float baseAngle   = atan(dvRaw.y, dvRaw.x);

    /* Angular FBM: tentacleStrength controls arm amplitude (fg > bg) */
    float tentacleField = fbm(vec2(
      baseAngle * 1.6 + t * 0.07 + yaw * 0.6,
      baseDist  * 3.0 + pitch * 0.4
    ));
    float tentacleField2 = fbm(vec2(
      baseAngle * 2.8 - t * 0.11 + pitch * 0.55,
      baseDist  * 5.5 + t * 0.06 + yaw * 0.35
    ));
    float tentacleWarp = (tentacleField - 0.48) * tentacleStrength;

    /* FG layer: narrow rim band for long sharp curling tentacles */
    float warpBand = edgeOnly > 0.5
      ? smoothstep(0.18, 0.26, baseDist) * smoothstep(0.72, 0.34, baseDist)
      : smoothstep(0.08, 0.22, baseDist) * smoothstep(0.55, 0.28, baseDist);
    float warpedDist = baseDist - tentacleWarp * warpBand;
    float haloOuterR = haloOuter * gasRadius;

    /* Halo fade — gasRadius scales outer reach inward */
    float halo = 1.0 - smoothstep(0.15, haloOuterR, warpedDist);
    halo = pow(halo, 1.05);

    /* Screen-edge safety — extra fade at top so gas stays low on rock */
    float edgeSafe = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    halo *= smoothstep(0.0, 0.20, edgeSafe);
    halo *= smoothstep(0.0, 0.12, vUv.y);

    density *= halo;

    /* Finger streak — void channel + bright rim (both layers) */
    float fingerCore = pow(1.0 - smoothstep(0.0, 0.055, fingerDist), 3.5) * fingerMask;
    float fingerRim  = smoothstep(0.04, 0.08, fingerDist)
                     * (1.0 - smoothstep(0.08, 0.13, fingerDist)) * fingerMask;
    density *= 1.0 - fingerCore * 0.80;
    col = mix(col, TEALL,  fingerRim * 0.70);
    col = mix(col, PURPLEM, fingerRim * 0.40);

    /* Mouse + sweep boost */
    float mouseStir = edgeOnly > 0.5 ? 0.70 : 1.0;
    float interact  = max(mouseMask, trailMask * 1.5);
    density *= 1.0 + interact * 0.45 * mouseStir;
    col += col * interact * 0.28 * mouseStir;
    col  = clamp(col, 0.0, 1.0);

    if (edgeOnly > 0.5) {
      /* FG: ~10% edge glow + strong on-rock tentacles (flapping/warping) */
      float edgeW = 0.10;
      float innerGlow = smoothstep(0.20, 0.20 + edgeW * 0.45, baseDist)
                      * (1.0 - smoothstep(0.20 + edgeW * 0.85, 0.20 + edgeW * 1.15, baseDist));
      float outerGlow = smoothstep(0.28, 0.36, baseDist)
                      * (1.0 - smoothstep(0.50 * gasRadius, 0.58 * gasRadius, warpedDist));
      float edgeGlow  = max(innerGlow * 0.42, outerGlow * 0.28);

      /* On-rock tentacles — same gas DNA, reaching/flapping over the face */
      float rockFace = 1.0 - smoothstep(0.03, 0.22, baseDist);
      float onRock   = rockFace * pow(clamp(tentacleField * tentacleField2 * 4.2, 0.0, 1.0), 0.48);
      float flap     = sin(baseAngle * 5.0 + t * 0.24 + tentacleWarp * 2.5) * 0.5 + 0.5;
      float warpFlap = fbm(vec2(baseAngle * 3.5 + t * 0.18, baseDist * 7.0 - t * 0.12));
      onRock *= 0.30 + flap * 0.45 + warpFlap * 0.25;

      /* Long outward arms beyond the silhouette */
      float tentacleAccent = pow(clamp(abs(tentacleWarp) * 5.2, 0.0, 1.0), 0.32);
      float tentacleArms   = tentacleAccent
                             * smoothstep(0.16, 0.30, baseDist)
                             * (1.0 - smoothstep(0.62 * gasRadius, 0.76 * gasRadius, warpedDist));

      float fgMask = clamp(edgeGlow + onRock * 0.92 + tentacleArms * 0.68, 0.0, 1.0);
      density *= fgMask;
      col *= 0.68 + tentacleAccent * 0.32 + onRock * 0.22;
      col  = clamp(col, 0.0, 1.0);
    } else {
      /* BG: soft exclusion + finger-drag streak voids in the gas */
      float rockCore = 1.0 - smoothstep(0.04, 0.30, baseDist);
      density *= (1.0 - rockCore * rockExclusion);
      density *= 1.0 + rockCore * 0.38;

      float streakSeed = fbm(vec2(baseAngle * 2.4 + t * 0.06, baseDist * 4.5 + pitch * 0.3));
      float streakWave = sin(baseAngle * 8.0 + streakSeed * 7.0 + t * 0.09) * 0.5 + 0.5;
      float stripCore  = pow(streakWave, 4.2);
      float voidStrip  = smoothstep(0.62, 0.88, stripCore);
      voidStrip *= smoothstep(0.10, 0.42, baseDist) * (1.0 - smoothstep(0.72 * gasRadius, 0.92 * gasRadius, baseDist));
      density *= 1.0 - voidStrip * 0.78;

      float stripEdge = smoothstep(0.42, 0.62, streakWave) * (1.0 - smoothstep(0.62, 0.80, streakWave));
      stripEdge *= smoothstep(0.08, 0.42, baseDist);
      col = mix(col, TEALL,  stripEdge * 0.28);
      col = mix(col, PURPLEM, stripEdge * 0.18);
      col  = clamp(col, 0.0, 1.0);
    }

    gl_FragColor = vec4(col, clamp(density * alphaScale, 0.0, 1.0));
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
const ROCK_LIFT_Y          = 1.15;               // lifts rock to match nebula halo
const GAS_LIFT_UV          = -0.18;              // negative UV y = halo shifts up with rock
const MOUSE_TRAIL_LAG      = 7;                  // ring-buffer frames for finger line

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

    this._mousePrevX = 0;
    this._mousePrevY = 0;
    this._mouseRing = Array.from({ length: 12 }, () => ({ x: 0, y: 0 }));
    this._mouseRingIdx = 0;

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
    this.rockGroup.position.set(0, ROCK_LIFT_Y, 0);
    this.scene.add(this.rockGroup);
  }

  /* ── Nebula background quad ─────────────────────────────────────────────── */
  _initNebula() {
    const geo = new THREE.PlaneGeometry(2, 2);

    /* ── Background layer — behind rock, tighter halo, full opacity ── */
    const bgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: {
        time:             { value: 0.0 },
        timeOffset:       { value: 0.0 },
        rockYaw:          { value: 0.0 },
        rockPitch:        { value: 0.0 },
        aspect:           { value: 1.0 },
        alphaScale:       { value: 1.0  },
        haloOuter:        { value: 0.46 },
        tentacleStrength: { value: 0.32 },
        rockExclusion:    { value: 0.0  },
        edgeOnly:         { value: 0.0  },
        gasRadius:        { value: 0.75 },
        nebulaInertia:    { value: 0.0  },
        mouseXY:          { value: new THREE.Vector2(0, 0) },
        mousePrevXY:      { value: new THREE.Vector2(0, 0) },
        mouseTailXY:      { value: new THREE.Vector2(0, 0) },
        gasLiftY:         { value: GAS_LIFT_UV },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
    });
    this.bgScene.add(new THREE.Mesh(geo, bgMat));
    this.nebulaUni = bgMat.uniforms;

    /* ── Foreground — edge-curl tentacles only (in front of rock) ── */
    const fgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: {
        time:             { value: 0.0 },
        timeOffset:       { value: 3.7 },
        rockYaw:          { value: 0.0 },
        rockPitch:        { value: 0.0 },
        aspect:           { value: 1.0 },
        alphaScale:       { value: 0.81 },
        haloOuter:        { value: 0.78 },
        tentacleStrength: { value: 0.88 },
        rockExclusion:    { value: 1.0  },
        edgeOnly:         { value: 1.0  },
        gasRadius:        { value: 0.75 },
        nebulaInertia:    { value: 0.0  },
        mouseXY:          { value: new THREE.Vector2(0, 0) },
        mousePrevXY:      { value: new THREE.Vector2(0, 0) },
        mouseTailXY:      { value: new THREE.Vector2(0, 0) },
        gasLiftY:         { value: GAS_LIFT_UV },
      },
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
        const scale = 12.936 / longestDim;  /* +10% from 11.76 */
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
        console.log('[LTF Rock] Model loaded:', this.modelUrl);
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
      this.mouseTX = (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouseTY = (e.clientY / window.innerHeight - 0.5) * 2;
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
    if (this.nebulaUni) this.nebulaUni.aspect.value = this.w / this.h;
    if (this.fgNebulaUni) this.fgNebulaUni.aspect.value = this.w / this.h;
  }

  /* ── Per-frame tick ──────────────────────────────────────────────────────── */
  _tick(now) {
    if (!this.running) return;

    const dt = this._lastNow ? Math.min(now - this._lastNow, 50) : 16;
    this._lastNow = now;
    this.time += dt;

    const t = this.time;

    const prevMX = this._mousePrevX;
    const prevMY = this._mousePrevY;

    this.mouseX += (this.mouseTX - this.mouseX) * 0.055;
    this.mouseY += (this.mouseTY - this.mouseY) * 0.055;
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

    /* Mouse trail ring buffer — long finger-streak line */
    this._mouseRingIdx = (this._mouseRingIdx + 1) % 12;
    this._mouseRing[this._mouseRingIdx] = { x: this.mouseX, y: this.mouseY };
    const tailSlot = (this._mouseRingIdx - MOUSE_TRAIL_LAG + 12) % 12;
    const tail = this._mouseRing[tailSlot];

    if (this.nebulaUni) {
      this.nebulaUni.time.value         = nebulaTime;
      this.nebulaUni.rockYaw.value      = nebulaYaw;
      this.nebulaUni.rockPitch.value    = nebulaPitch;
      this.nebulaUni.nebulaInertia.value = this.nebulaAngleAccum;
      this.nebulaUni.mouseXY.value.set(this.mouseX, this.mouseY);
      this.nebulaUni.mousePrevXY.value.set(prevMX, prevMY);
      this.nebulaUni.mouseTailXY.value.set(tail.x, tail.y);
    }
    if (this.fgNebulaUni) {
      this.fgNebulaUni.time.value         = nebulaTime;
      this.fgNebulaUni.rockYaw.value      = nebulaYaw;
      this.fgNebulaUni.rockPitch.value    = nebulaPitch;
      this.fgNebulaUni.nebulaInertia.value = this.nebulaAngleAccum;
      this.fgNebulaUni.mouseXY.value.set(this.mouseX, this.mouseY);
      this.fgNebulaUni.mousePrevXY.value.set(prevMX, prevMY);
      this.fgNebulaUni.mouseTailXY.value.set(tail.x, tail.y);
    }

    this._mousePrevX = this.mouseX;
    this._mousePrevY = this.mouseY;

    /* ── Three-pass render: bg nebula → rock → fg nebula ─────────────────── */
    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.fgScene, this.fgCamera);

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

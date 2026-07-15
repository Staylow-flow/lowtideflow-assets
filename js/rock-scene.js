/**
 * Lowtideflow — Rock Scene  (ES Module)
 *
 * Background: FBM domain-warped nebula shader — fractal gas turbulence in brand
 *             palette with transparent dark voids, wispy tendrils, dense cores.
 * Foreground: soapstone.glb rock — centered, autonomous idle oscillation,
 *             scroll tumble, hover mouse nudge (±10.5° yaw, ±16° roll on X).
 *
 * Loaded as <script type="module"> — importmap resolves 'three' and 'three/addons/'.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';

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
  uniform float gasStretchX;
  uniform float gasStretchY;
  uniform float widthTighten;    /* locked layout — horizontal guide scale */
  uniform float topYFactor;      /* locked — softer Y above center */
  uniform float topFadeStart;    /* locked viewport nav clearance */
  uniform float topFadeEnd;
  uniform float streakReachMult; /* locked streak extension past reach */
  uniform float purpleFarMult;   /* locked purple far streak extension */
  uniform float purpleReachBoost; /* purple plume bulk extends past main oval */
  uniform float flareReachMult;   /* solar-flare lobe length past gasReach */
  uniform float flareSpeed;       /* animation rate for live flares */
  uniform float purpleFlareStrength;
  uniform float blueSpikeStrength;
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

  /* Soft core near rock — airy center, not a hard outer oval */
  float softCore(vec2 p, float distRaw, float inner, float reach, float edgeWarp,
                 float t, float yaw, float pitch) {
    vec2  warpUV = p * 2.8 + vec2(t * 0.042, t * 0.031) + vec2(yaw * 0.12, pitch * 0.07);
    float edgeN1 = (fbm(warpUV) - 0.5) * edgeWarp * 0.85;
    float edgeN2 = (fbm(warpUV * 1.55 + vec2(t * 0.022, -t * 0.018)) - 0.5) * edgeWarp * 0.32;
    float dist   = distRaw + edgeN1 + edgeN2;

    float wobble   = (fbm(p * 3.8 + vec2(t * 0.062, distRaw * 1.6)) - 0.5) * reach * 0.11;
    float reachEff = reach + wobble;

    float core = 1.0 - smoothstep(inner * 0.72, reachEff * 0.50, dist);
    float edge = 1.0 - smoothstep(reachEff * 0.35, reachEff * 0.96, dist);
    float body = pow(max(core * edge, 0.0), 0.48);

    /* Outer halo — soft glow rim past rock silhouette */
    float halo = 1.0 - smoothstep(reachEff * 0.42, reachEff * 1.10, dist);
    halo = pow(max(halo, 0.0), 1.28) * 0.62;
    body = max(body, halo);

    float above  = max(p.y, 0.0);
    float topCap = 1.0 - smoothstep(reach * 0.62, reach * 0.92, above);
    body *= mix(1.0, topCap, 0.28);

    return body;
  }

  /* 0→peak→0 within each cycle — quiet at reset boundary */
  float flarePulse(float ph) {
    float shoot = sin(ph * 3.14159265);
    shoot *= smoothstep(0.01, 0.08, ph);
    shoot *= 1.0 - smoothstep(0.90, 0.98, ph);
    return shoot * shoot;
  }

  /* Thin ray lobe from origin, length animates with pulse */
  float liveRayLobe(vec2 p, vec2 origin, vec2 dir, float lenNow, float width) {
    vec2  q    = p - origin;
    float proj = dot(q, dir);
    vec2  foot = dir * proj;
    float perp = length(q - foot);
    float inR  = step(0.0, proj) * (1.0 - step(lenNow, proj));
    float taper = 1.0 - proj / max(lenNow, 0.001);
    float w     = width * (0.45 + taper * 0.55);
    float along = (1.0 - smoothstep(lenNow * 0.90, lenNow, proj))
                * smoothstep(0.0, lenNow * 0.14, proj);
    float cross = exp(-(perp * perp) / (w * w + 0.0001));
    return inR * along * cross;
  }

  /* Purple flow streak — shoots out, curls, retracts */
  float livePurpleFlare(vec2 p, vec2 origin, vec2 dir, float lenNow, float reach, float t, float seed) {
    vec2  q       = p - origin;
    float proj    = dot(q, dir);
    float inR     = step(0.0, proj) * (1.0 - step(lenNow, proj));
    vec2  perpDir = vec2(-dir.y, dir.x);
    float curl    = sin(proj * 13.0 + t * 0.62 + seed * 2.3) * reach * 0.11;
          curl   += (fbm(dir * proj * 3.2 + vec2(t * 0.09, seed)) - 0.5) * reach * 0.16;
    float perp    = abs(dot(q - dir * proj, perpDir) - curl);
    float taper   = 1.0 - proj / max(lenNow, 0.001);
    float w       = reach * (0.09 + taper * 0.11);
    float flow    = fbm(q * 4.8 + vec2(t * 0.13, seed * 0.7));
    float along   = (1.0 - smoothstep(lenNow * 0.86, lenNow, proj))
                  * smoothstep(0.0, lenNow * 0.10, proj);
    float cross   = exp(-(perp * perp) / (w * w + 0.0001));
    return inR * along * cross * (0.48 + flow * 0.72);
  }

  /* Teal / blue curved star spike — occasional sharp jut */
  float liveBlueSpike(vec2 p, vec2 origin, vec2 dir, float lenNow, float reach, float t, float seed) {
    vec2  q       = p - origin;
    float proj    = dot(q, dir);
    float inR     = step(0.0, proj) * (1.0 - step(lenNow, proj));
    vec2  perpDir = vec2(-dir.y, dir.x);
    float bend    = sin(proj * 11.0 - t * 0.34 + seed * 1.9) * reach * 0.13;
          bend   += (fbm(vec2(proj * 2.4, seed) + t * 0.06) - 0.5) * reach * 0.07;
    float perp    = abs(dot(q - dir * proj, perpDir) - bend);
    float w       = reach * 0.032 * (1.0 - proj / max(lenNow, 0.001) * 0.35);
    float along   = (1.0 - smoothstep(lenNow * 0.92, lenNow, proj))
                  * smoothstep(0.0, lenNow * 0.18, proj);
    float cross   = exp(-(perp * perp) / (w * w + 0.0001));
    return inR * pow(along * cross, 1.55);
  }

  /*
   * Live flares — each slot cycles: idle → shoot out → retract → new random direction.
   * Direction + launch point change every cycle (not locked to screen positions).
   */
  vec3 buildLiveFlares(vec2 p, float reach, float t) {
    float solarOut  = 0.0;
    float purpleOut = 0.0;
    float blueOut   = 0.0;
    float flareReach = reach * flareReachMult;
    float tAnim = t * flareSpeed;

    for (int i = 0; i < 8; i++) {
      float seed   = float(i) + 1.0;
      float period = 1.7 + hash(vec2(seed, 9.17)) * 1.5;
      float cycleT = tAnim + hash(vec2(seed, 4.31)) * period;
      float phase  = fract(cycleT / period);
      float cycleId = floor(cycleT / period);
      float pulse  = flarePulse(phase);

      /* New random compass each cycle — top-left, bottom-right, etc. */
      float ang  = hash(vec2(cycleId + seed * 17.0, seed * 3.71)) * 6.2831853;
      vec2  dir  = vec2(cos(ang), sin(ang));
      float launch = reach * (0.38 + hash(vec2(cycleId, seed + 11.0)) * 0.32);
      vec2  origin = dir * launch;
      float maxLen = flareReach * (0.55 + hash(vec2(cycleId, seed + 19.0)) * 0.75);
      float lenNow = maxLen * pulse;

      float kind   = hash(vec2(cycleId, seed + 23.0));
      float isPurp = step(0.10, kind) * (1.0 - step(kind, 0.80));
      float isBlue = step(0.80, kind) * (1.0 - step(kind, 0.93));
      float isSolar = step(kind, 0.10) + step(0.93, kind);

      float purple = livePurpleFlare(p, origin, dir, lenNow * purpleReachBoost, reach, tAnim, seed + cycleId) * isPurp;
      float blue   = liveBlueSpike(p, origin, dir, lenNow, reach, tAnim, seed + cycleId) * isBlue;
      float solar  = liveRayLobe(p, origin, dir, lenNow, reach * 0.055) * isSolar;

      purpleOut = max(purpleOut, purple * pulse);
      blueOut   = max(blueOut,   blue   * pulse);
      solarOut  = max(solarOut,  solar  * pulse);
    }
    return vec3(solarOut, purpleOut, blueOut);
  }

  void main() {
    float t     = time + timeOffset;
    float yaw   = rockYaw;
    float pitch = rockPitch;

    vec2 center = vec2(0.5 * aspect + 0.5 * (aspect - 1.0) * 0.5, 0.5);

    /* Light mouse stir — applied per-plume below */
    vec2  mouseV   = vec2(mouseXY.x * 0.5 + 0.5, 0.5);
    vec2  mouseA   = vec2((mouseV.x - 0.5) * aspect + 0.5, 0.5);
    float mouseDist = distance(vUv, mouseV);
    float mouseMask = pow(1.0 - smoothstep(0.03, 0.165, mouseDist), 1.15);

    /* Locked bounds field — all size from GAS_LOCKED_BOUNDS uniforms */
    vec2  rockUV  = vec2(gasCenterX, gasCenterY);
    vec2  p       = vUv - rockUV;
    p.x *= aspect * gasStretchX * widthTighten;
    p.y *= mix(gasStretchY, gasStretchY * topYFactor, step(0.0, p.y));
    float distRaw = length(p);
    float core = softCore(p, distRaw, gasInner, gasReach, edgeWarp, t, yaw, pitch);

    vec3 flares = buildLiveFlares(p, gasReach, t);
    float solarFl  = flares.x;
    float purpleFl = flares.y * purpleFlareStrength;
    float blueSp   = flares.z * blueSpikeStrength;

    /* Core-only plume masks — expanded glow around rock */
    float maskA = core * 0.96;
    float maskB = core * 0.88;
    float maskC = core * 0.92;

    /* ── Plume A — teal / green: fastest spin, drifts outward ── */
    vec2 uvA = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);
    vec2 ruvA = uvA - center;
    float spinA = t * 0.017 + yaw * 0.34 + pitch * 0.10 + nebulaInertia * 1.45;
    float cA = cos(spinA), sA = sin(spinA);
    uvA = vec2(ruvA.x * cA - ruvA.y * sA, ruvA.x * sA + ruvA.y * cA) + center;
    uvA += vec2(sin(t * 0.072) * 0.042, cos(t * 0.058) * 0.030);
    vec2 toMouseA = uvA - mouseA;
    float twistA = mouseMask * mouseXY.x * 0.14;
    uvA = mix(uvA, vec2(toMouseA.x * cos(twistA) - toMouseA.y * sin(twistA),
                          toMouseA.x * sin(twistA) + toMouseA.y * cos(twistA)) + mouseA, mouseMask * 0.22);

    vec2 qA = vec2(fbm(uvA * 2.2 + t * 0.11), fbm(uvA * 2.2 + vec2(5.20, 1.30) + t * 0.10));
    vec2 rA = vec2(
      fbm(uvA * 2.6 + 3.0 * qA + vec2(1.70, 9.20) + t * 0.08),
      fbm(uvA * 2.6 + 3.0 * qA + vec2(8.30, 2.80) + t * 0.07)
    );
    float fA  = fbm(uvA * 2.0 + 4.0 * rA + t * 0.05);
    float fA2 = fbm(uvA * 2.0 + 4.0 * rA + t * 0.05 + vec2(0.18, 0.11));
    vec3 colA = mix(nebulaColor(fA, uvA), nebulaColor(fA2, uvA), 0.26);
    colA = mix(colA, TEAL,  clamp(fA * 1.5 - 0.30, 0.0, 0.55));
    colA = mix(colA, GREEN, clamp(fA2 - 0.35, 0.0, 0.45));
    colA = mix(colA, TEALL, clamp(rA.x - 0.48, 0.0, 0.28));
    float densA = pow(clamp(fA * 1.80 - 0.35, 0.0, 1.0), 1.60);

    /* ── Plume B — purple / navy: counter-spin ── */
    vec2 uvB = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);
    vec2 ruvB = uvB - center;
    float spinB = -t * 0.015 + yaw * 0.12 - pitch * 0.16 + nebulaInertia * 0.62;
    float cB = cos(spinB), sB = sin(spinB);
    uvB = vec2(ruvB.x * cB - ruvB.y * sB, ruvB.x * sB + ruvB.y * cB) + center;
    uvB += vec2(cos(t * 0.063) * -0.038, sin(t * 0.051) * 0.034);
    vec2 toMouseB = uvB - mouseA;
    float twistB = mouseMask * mouseXY.y * 0.11;
    uvB = mix(uvB, vec2(toMouseB.x * cos(twistB) - toMouseB.y * sin(twistB),
                          toMouseB.x * sin(twistB) + toMouseB.y * cos(twistB)) + mouseA, mouseMask * 0.18);

    vec2 qB = vec2(fbm(uvB * 2.2 - t * 0.12), fbm(uvB * 2.2 + vec2(3.10, 4.70) - t * 0.09));
    vec2 rB = vec2(
      fbm(uvB * 2.6 + 3.0 * qB + vec2(2.10, 5.30) - t * 0.10),
      fbm(uvB * 2.6 + 3.0 * qB + vec2(6.80, 1.10) - t * 0.08)
    );
    float fB  = fbm(uvB * 2.0 + 4.0 * rB - t * 0.06);
    float fB2 = fbm(uvB * 2.0 + 4.0 * rB - t * 0.06 + vec2(0.22, 0.15));
    vec3 colB = mix(nebulaColor(fB, uvB), nebulaColor(fB2, uvB), 0.32);
    colB = mix(colB, PURPLE, clamp(length(qB) * 0.58 - 0.28, 0.0, 0.48));
    colB = mix(colB, NAVY,   clamp(0.58 - fB * 0.42, 0.0, 0.22));
    colB = mix(colB, PURPLEM, clamp(fB2 - 0.40, 0.0, 0.38));
    float densB = pow(clamp(fB * 1.80 - 0.35, 0.0, 1.0), 1.60);

    /* ── Plume C — teal-light / cyan: slow roll ── */
    vec2 uvC = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);
    vec2 ruvC = uvC - center;
    float spinC = t * 0.009 + pitch * 0.24 - yaw * 0.06 + nebulaInertia * 0.38;
    float cC = cos(spinC), sC = sin(spinC);
    uvC = vec2(ruvC.x * cC - ruvC.y * sC, ruvC.x * sC + ruvC.y * cC) + center;
    uvC += vec2(sin(t * 0.044) * 0.028, cos(t * 0.067) * -0.040);
    vec2 toMouseC = uvC - mouseA;
    float twistC = mouseMask * (mouseXY.x - mouseXY.y) * 0.09;
    uvC = mix(uvC, vec2(toMouseC.x * cos(twistC) - toMouseC.y * sin(twistC),
                          toMouseC.x * sin(twistC) + toMouseC.y * cos(twistC)) + mouseA, mouseMask * 0.15);

    vec2 qC = vec2(fbm(uvC * 2.3 + t * 0.07), fbm(uvC * 2.3 + vec2(4.40, 2.20) + t * 0.06));
    vec2 rC = vec2(
      fbm(uvC * 2.7 + 3.0 * qC + vec2(3.40, 6.10) + t * 0.05),
      fbm(uvC * 2.7 + 3.0 * qC + vec2(7.20, 0.80) + t * 0.04)
    );
    float fC  = fbm(uvC * 2.1 + 4.0 * rC + t * 0.03);
    float fC2 = fbm(uvC * 2.1 + 4.0 * rC + t * 0.03 + vec2(0.14, 0.19));
    vec3 colC = mix(nebulaColor(fC, uvC), nebulaColor(fC2, uvC), 0.30);
    colC = mix(colC, TEALL,  clamp(fC * 1.6 - 0.32, 0.0, 0.52));
    colC = mix(colC, TEAL,   clamp(rC.y - 0.46, 0.0, 0.32));
    colC = mix(colC, GREEN,  clamp(fC2 - 0.42, 0.0, 0.30));
    float densC = pow(clamp(fC * 1.80 - 0.35, 0.0, 1.0), 1.60);

    /* Density × per-plume flare masks — marbled lanes with gaps between lobes */
    float alphaA = densA * maskA;
    float alphaB = densB * maskB;
    float alphaC = densC * maskC;
    float gas = clamp(alphaA + alphaB * 0.88 + alphaC * 0.86
                    - alphaA * alphaB * 0.14 - alphaB * alphaC * 0.12
                    - alphaA * alphaC * 0.10, 0.0, 1.0);

    /* Marble composite — distinct color lanes */
    float domA = alphaA * alphaA;
    float domB = alphaB * alphaB;
    float domC = alphaC * alphaC;
    float domSum = domA + domB + domC + 0.0008;
    vec3 col = (colA * domA + colB * domB + colC * domC) / domSum;
    col = mix(col, PURPLEM, clamp(alphaA * alphaB * 2.0, 0.0, 0.24));
    col = mix(col, TEALL,   clamp(alphaA * alphaC * 1.8, 0.0, 0.20));
    col += col * gas * 0.48;
    col  = clamp(col, 0.0, 1.0);

    /* Flare color accents — animated overlay, not baked into core masks */
    col = mix(col, PURPLE,  purpleFl * densB * 0.78);
    col = mix(col, PURPLEM, purpleFl * densB * 0.45);
    col = mix(col, TEALL,   blueSp * (densA * 0.48 + densC * 0.42));
    col = mix(col, TEAL,    blueSp * densA * 0.32);
    col = mix(col, NAVY,    blueSp * 0.16 + purpleFl * densB * 0.14);

    /* Outward streaks — follow live flare activity, not static rim */
    float streakBase = max(core * 0.38, max(purpleFl * 0.72, blueSp * 0.55));
    float armField = fbm(p * 3.5 + vec2(t * 0.065 + yaw * 0.35, distRaw * 1.2 + pitch * 0.25));
    float armCurl  = fbm(p * 5.5 + vec2(-t * 0.095 + nebulaInertia * 0.4, distRaw * 2.0 + t * 0.04));
    float armFine  = fbm(p * 9.2 + vec2(t * 0.11, -distRaw * 2.8 + t * 0.06));
    float wispBand = smoothstep(gasReach * 0.84, gasReach * 1.00, distRaw)
                   * (1.0 - smoothstep(gasReach * 0.94, gasReach * streakReachMult, distRaw));
    float wispBand2 = smoothstep(gasReach * 0.90, gasReach * 1.04, distRaw)
                    * (1.0 - smoothstep(gasReach * 1.00, gasReach * streakReachMult * 1.05, distRaw));
    float wisp  = pow(max(armField - 0.48, 0.0), 2.2) * pow(armCurl, 1.6) * wispBand * streakBase;
    float wisp2 = pow(max(armFine - 0.44, 0.0), 3.0) * pow(armField, 2.0) * wispBand2 * streakBase;
    float streaks = wisp + wisp2 * 0.85 + solarFl * 0.32;

    /* Purple far streaks — random emphasis past typical rim */
    float purpField = fbm(p * 4.6 + vec2(t * 0.07 + yaw * 0.2, distRaw * 1.5 + pitch * 0.15));
    float purpFine  = fbm(p * 7.8 + vec2(-t * 0.09, distRaw * 2.6 + t * 0.05));
    float purpNear  = smoothstep(gasReach * 0.86, gasReach * 1.00, distRaw)
                    * (1.0 - smoothstep(gasReach * 0.96, gasReach * streakReachMult * 1.06, distRaw));
    float purpFar   = smoothstep(gasReach * 0.94, gasReach * 1.08, distRaw)
                    * (1.0 - smoothstep(gasReach * 1.02, gasReach * purpleFarMult, distRaw));
    float purpStreak = pow(max(purpField - 0.32, 0.0), 1.85) * purpNear * purpleFl;
    float purpExtend = pow(max(purpFine - 0.24, 0.0), 2.0) * purpFar * purpleFl;
    float purpleOut  = purpStreak + purpExtend * 1.35 + purpleFl * densB * 0.65;

    col = mix(col, PURPLE,  streaks * 0.10 + purpleOut * 0.42);
    col = mix(col, TEALL,   streaks * 0.14 + blueSp * densC * 0.22);
    col = mix(col, PURPLEM, wisp2 * 0.08 + purpleOut * 0.30);
    col = mix(col, NAVY,    purpleOut * 0.12 + blueSp * 0.10);

    /* Nav clearance — only fades near very top of viewport */
    float topFade = 1.0 - smoothstep(topFadeStart, topFadeEnd, vUv.y);
    float alpha = clamp(gas + purpleFl * 0.85 + blueSp * 0.62 + solarFl * 0.35
                      + streaks * 0.36 + purpleOut * 0.55, 0.0, 1.0) * topFade * alphaScale;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

/* Thin whipping tentacle strings — extends 15% past main gas bounds to soften the mask edge */
const TENTACLE_FRAG = /* glsl */`
  precision highp float;

  uniform float time;
  uniform float timeOffset;
  uniform float rockYaw;
  uniform float rockPitch;
  uniform float aspect;
  uniform float alphaScale;
  uniform float nebulaInertia;
  uniform float gasCenterX;
  uniform float gasCenterY;
  uniform float gasReach;
  uniform float gasInner;
  uniform float edgeWarp;
  uniform float gasStretchX;
  uniform float gasStretchY;
  uniform float widthTighten;
  uniform float topYFactor;
  uniform float tentacleExtend;
  uniform float streakReachMult;
  uniform float purpleFarMult;
  uniform vec2  mouseXY;
  varying vec2 vUv;

  const vec3 TEAL    = vec3(0.122, 0.467, 0.506);
  const vec3 PURPLE  = vec3(0.302, 0.145, 0.616);
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

  void main() {
    vec2 uv = vec2((vUv.x - 0.5) * aspect + 0.5, vUv.y);
    float t     = time + timeOffset;
    float yaw   = rockYaw;
    float pitch = rockPitch;

    vec2 rockUV = vec2(gasCenterX, gasCenterY);
    vec2 p      = vUv - rockUV;
    p.x *= aspect * gasStretchX * tentacleExtend * widthTighten;
    p.y *= mix(gasStretchY * tentacleExtend, gasStretchY * tentacleExtend * topYFactor, step(0.0, p.y));

    float distRaw = length(p);
    float reach   = gasReach * tentacleExtend;
    float inner   = gasInner * tentacleExtend;

    vec2 warpUV = p * 3.2 + vec2(t * 0.055, -t * 0.042) + vec2(yaw * 0.10, pitch * 0.06);
    float edgeN = (fbm(warpUV) - 0.5) * edgeWarp * tentacleExtend;
    float dist  = distRaw + edgeN;

    /* Outer rim — thin jutting streaks, extends to purpleFarMult */
    float farCut   = gasReach * purpleFarMult * tentacleExtend;
    float hideBand = smoothstep(gasReach * 0.72, gasReach * 0.90, distRaw)
                   * (1.0 - smoothstep(reach * 0.84, farCut, distRaw));
    hideBand *= 1.0 - smoothstep(inner * 0.88, inner * 1.04, distRaw);

    float whipPhase = fbm(p * 4.2 + vec2(t * 0.24 + yaw * 0.28, distRaw * 1.8 + t * 0.14));
    float whipCurl  = fbm(p * 6.5 + vec2(-t * 0.30 + nebulaInertia * 0.42, distRaw * 2.6 - t * 0.18));
    float whipSnap  = fbm(p * 8.8 + vec2(t * 0.38 + pitch * 0.22, distRaw * 3.2 + t * 0.26));
    float whipFine  = fbm(p * 11.5 + vec2(-t * 0.22, distRaw * 4.2 + t * 0.18));

    /* sin(phase) with p-based phase — continuous, no atan seam */
    float phaseBase = p.x * 5.5 + p.y * 3.8;
    float stringAng = phaseBase + whipPhase * 9.5 + t * 0.34 + sin(distRaw * 14.0 - t * 0.42) * 0.9;
    float stringRad = distRaw * 18.0 + whipCurl * 6.0 - t * 0.28;
    float stringCore = abs(sin(stringAng + fbm(vec2(stringRad, whipSnap)) * 2.5));
    float stringThin = pow(stringCore, 11.0);

    float curlLen = sin(p.x * 3.2 - p.y * 2.6 + whipCurl * 5.0 + distRaw * 11.0 - t * 0.32);
    curlLen = pow(clamp(curlLen * 0.5 + 0.5, 0.0, 1.0), 1.9);
    float tendril = stringThin * curlLen * hideBand;
    tendril *= 0.65 + whipSnap * 0.55;

    float strand2 = pow(abs(sin(phaseBase * 1.3 - t * 0.40 + whipSnap * 7.0)), 14.0);
    strand2 *= pow(whipCurl, 1.4) * hideBand * 1.05;
    tendril = max(tendril, strand2);

    float strand3 = pow(abs(sin(phaseBase * 1.7 + t * 0.45 - whipPhase * 5.0)), 12.0);
    strand3 *= fbm(p * 3.2 + vec2(t * 0.2, distRaw * 2.8)) * hideBand * 0.95;
    tendril = max(tendril, strand3);

    float strand4 = pow(abs(sin(phaseBase * 2.4 + t * 0.52 + whipFine * 8.0)), 16.0);
    strand4 *= pow(whipFine, 1.3) * hideBand * 0.88;
    tendril = max(tendril, strand4);

    /* Light secondary bundles — thinner than before */
    float thickAng = phaseBase * 0.72 + whipPhase * 7.0 + t * 0.26 + distRaw * 6.0;
    float thickStrand = pow(abs(sin(thickAng + whipCurl * 3.5)), 8.5);
    thickStrand *= pow(whipSnap, 1.1) * hideBand * 0.55;
    tendril = max(tendril, thickStrand);

    tendril = min(tendril * 1.55, 1.0);

    vec3 col = mix(PURPLE, TEALL, whipPhase);
    col = mix(col, PURPLEM, whipCurl * 0.68);
    col = mix(col, NAVY,   whipSnap * 0.38);
    col = mix(col, TEALL,  tendril * 0.22);

    float alpha = tendril * alphaScale;
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
const ROCK_SCALE_BASE      = 12.936 * 1.25;  /* +25% rock size */
const CAMERA_Z             = 24;
const CAMERA_FOV           = 45;

/**
 * Rock motion baseline — locked fallback (Jul 14 2026, pre-hover restore).
 * Restore these values if a motion tweak overshoots; idle amps below are +10%.
 */
const ROCK_MOTION_BASELINE = Object.freeze({
  idleYawAmp1:     0.07,
  idleYawAmp2:     0.03,
  idleNodAmp:      0.025,
  idleYawLerp:     0.036,
  idleNodLerp:     0.030,
  mouseLerp:       0.028,
  maxMouseYawDeg:  15,
  maxMouseRollDeg: 8,
});

const MAX_MOUSE_YAW  = (ROCK_MOTION_BASELINE.maxMouseYawDeg * 0.7 * Math.PI) / 180;
const MAX_MOUSE_ROLL = (ROCK_MOTION_BASELINE.maxMouseRollDeg * 2.0 * Math.PI) / 180;
const IDLE_YAW_AMP1  = ROCK_MOTION_BASELINE.idleYawAmp1 * 1.1;
const IDLE_YAW_AMP2  = ROCK_MOTION_BASELINE.idleYawAmp2 * 1.1;
const IDLE_NOD_AMP   = ROCK_MOTION_BASELINE.idleNodAmp  * 1.1;

/** Single source of truth — gas volume, layout, and rock lift */
const GAS_LOCKED_BOUNDS = Object.freeze({
  gasCenterX:       0.50,
  gasCenterY:       0.63,   /* aligned with rock — glow wraps silhouette */
  gasStretchX:      0.82,   /* wider horizontal glow */
  gasStretchY:      1.78,   /* taller vertical glow */
  gasReach:         0.76,   /* outer glow radius past rock */
  gasInner:         0.26,   /* soft full-body halo, not tight core blob */
  edgeWarp:         0.20,
  alphaScale:       1.0,
  rockLiftPx:       100,
  widthTighten:     0.96,   /* stop squeezing width — let glow spread */
  topYFactor:       0.94,   /* extend above rock for nav clearance */
  topFadeStart:     0.80,
  topFadeEnd:       0.94,
  streakReachMult:  1.62,
  purpleFarMult:    2.25,
  tentacleExtend:   1.28,
  purpleReachBoost: 1.18,
  flareReachMult:   2.35,
  flareSpeed:       1.40,   /* faster flare cycles */
  purpleFlareStrength: 1.0,
  blueSpikeStrength:   0.82,
});

const BEHIND_FG_VISIBLE    = true;  // override with ?behind=0
const ROCK_VISIBLE         = true;  // override with ?rock=0
const FRONT_FG_VISIBLE     = true;  // whipping tentacle strings — ?front=0 to hide
const BEHIND_FG_OPACITY    = 1.0;
const FRONT_FG_OPACITY     = 0.88;  // tentacle overlay opacity — ?frontOp=

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

function rockLiftWorld(viewportH, px = GAS_LOCKED_BOUNDS.rockLiftPx) {
  const fovRad   = (CAMERA_FOV * Math.PI) / 180;
  const visibleH = 2 * CAMERA_Z * Math.tan(fovRad / 2);
  return (px / viewportH) * visibleH;
}

function rockLiftUV(viewportH, px = GAS_LOCKED_BOUNDS.rockLiftPx) {
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
    this.mouseRollOffset = 0;
    this._pointerOver = false;
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
    this.rockLiftPx         = GAS_LOCKED_BOUNDS.rockLiftPx;

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
  }

  /* ── Nebula background quad ─────────────────────────────────────────────── */
  _initNebula() {
    const geo = new THREE.PlaneGeometry(2, 2);

    function makeNebulaUniforms(timeOffset, alphaScale, gasReach) {
      const b = GAS_LOCKED_BOUNDS;
      return {
        time:            { value: 0.0 },
        timeOffset:      { value: timeOffset },
        rockYaw:         { value: 0.0 },
        rockPitch:       { value: 0.0 },
        aspect:          { value: 1.0 },
        alphaScale:      { value: alphaScale },
        nebulaInertia:   { value: 0.0 },
        gasCenterX:      { value: b.gasCenterX },
        gasCenterY:      { value: b.gasCenterY },
        gasReach:        { value: gasReach },
        gasInner:        { value: b.gasInner },
        edgeWarp:        { value: b.edgeWarp },
        gasStretchX:     { value: b.gasStretchX },
        gasStretchY:     { value: b.gasStretchY },
        widthTighten:    { value: b.widthTighten },
        topYFactor:      { value: b.topYFactor },
        topFadeStart:    { value: b.topFadeStart },
        topFadeEnd:      { value: b.topFadeEnd },
        streakReachMult:  { value: b.streakReachMult },
        purpleFarMult:         { value: b.purpleFarMult },
        purpleReachBoost:      { value: b.purpleReachBoost },
        flareReachMult:        { value: b.flareReachMult },
        flareSpeed:            { value: b.flareSpeed },
        purpleFlareStrength:   { value: b.purpleFlareStrength },
        blueSpikeStrength:   { value: b.blueSpikeStrength },
        mouseXY:             { value: new THREE.Vector2(0, 0) },
      };
    }

    function makeTentacleUniforms(timeOffset, alphaScale, gasReach) {
      return {
        ...makeNebulaUniforms(timeOffset, alphaScale, gasReach),
        tentacleExtend: { value: GAS_LOCKED_BOUNDS.tentacleExtend },
      };
    }

    const bgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: makeNebulaUniforms(0.0, BEHIND_FG_OPACITY, GAS_LOCKED_BOUNDS.gasReach),
      transparent: true,
      depthWrite:  false,
      depthTest:   false,
    });
    this.bgScene.add(new THREE.Mesh(geo, bgMat));
    this.nebulaUni = bgMat.uniforms;

    const fgMat = new THREE.ShaderMaterial({
      vertexShader:   NEBULA_VERT,
      fragmentShader: TENTACLE_FRAG,
      uniforms: makeTentacleUniforms(5.2, FRONT_FG_OPACITY, GAS_LOCKED_BOUNDS.gasReach),
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
      if (!this._pointerOver) return;
      const rect = this.container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      this.mouseTX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      this.mouseTY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    };
    this._onPointerEnterFn = () => { this._pointerOver = true; };
    this._onPointerLeaveFn = () => {
      this._pointerOver = false;
      this.mouseTX = 0;
      this.mouseTY = 0;
    };
    this.container.addEventListener('pointerenter', this._onPointerEnterFn, { passive: true });
    this.container.addEventListener('pointerleave', this._onPointerLeaveFn, { passive: true });
    this.container.addEventListener('pointermove', this._onMouseFn, { passive: true });

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

    this.mouseX += (this.mouseTX - this.mouseX) * ROCK_MOTION_BASELINE.mouseLerp;
    this.mouseY += (this.mouseTY - this.mouseY) * ROCK_MOTION_BASELINE.mouseLerp;
    this.scrollProgress += (this.scrollTarget - this.scrollProgress) * 0.07;

    /* Horizontal wheel tilt — spring toward target, clamped ±5° */
    this.hScrollYaw += (this.hScrollYawTarget - this.hScrollYaw) * 0.07;

    /* ── Rock rotation ────────────────────────────────────────────────────
       X: auto-spin + scroll + mouse roll (vertical hover, ±16°).
       Y: idle wobble + horizontal scroll tilt + mouse yaw (±10.5° cap).
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

      const basePitch = this.rockPitchAccum + this.scrollPitchOffset;
      const mouseRollTarget = clamp(this.mouseY * MAX_MOUSE_ROLL, -MAX_MOUSE_ROLL, MAX_MOUSE_ROLL);
      this.mouseRollOffset += (mouseRollTarget - this.mouseRollOffset) * ROCK_MOTION_BASELINE.mouseLerp;
      this.rockGroup.rotation.x = basePitch + this.mouseRollOffset;

      /* Idle wobble (+10% natural drift) + scroll Y tilt + hover mouse nudge */
      const idleYaw = Math.sin(t * 0.00020) * IDLE_YAW_AMP1
                    + Math.sin(t * 0.00039) * IDLE_YAW_AMP2;
      const idleNod = Math.sin(t * 0.00015 + 1.4) * IDLE_NOD_AMP;
      const mouseYaw = clamp(this.mouseX * MAX_MOUSE_YAW, -MAX_MOUSE_YAW, MAX_MOUSE_YAW);
      const targetY = idleYaw + this.hScrollYaw + HSCROLL_Y_BIAS + mouseYaw;
      const targetZ = idleNod;

      this.rockGroup.rotation.y += (targetY - this.rockGroup.rotation.y) * ROCK_MOTION_BASELINE.idleYawLerp;
      this.rockGroup.rotation.z += (targetZ - this.rockGroup.rotation.z) * ROCK_MOTION_BASELINE.idleNodLerp;
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
        ? 'Tentacles: ' + (layers.frontInspect && !layers.front ? 'INSPECT @' : 'ON @')
          + Math.round(frontOp * 100) + '%'
        : 'Tentacles: OFF';
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
    window.removeEventListener('wheel',       this._onWheelFn);
    this.container.removeEventListener('pointerenter', this._onPointerEnterFn);
    this.container.removeEventListener('pointerleave', this._onPointerLeaveFn);
    this.container.removeEventListener('pointermove', this._onMouseFn);
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
  GAS_LOCKED_BOUNDS, ROCK_MOTION_BASELINE, getPrimaryRockScene,
};

export {
  init, RockScene, layerVisibility, behindOpacity, frontOpacity,
  GAS_LOCKED_BOUNDS, ROCK_MOTION_BASELINE, getPrimaryRockScene,
};

/**
 * Offline layout search — run: node precompute-layout-v2.mjs
 * Writes precomputed-layout-v2.json for embedding in masonry-embed-v2.js
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_HALF_DUR = 55;
const LAYOUT_SAMPLES = 12;
const CROSS_COL_MIN_SEP = 0.6;
const HEIGHT_SHRINK = 0.9;
const MAX_HW = 1.25;

const IMAGE_KEYS = [];
const html = readFileSync(join(__dirname, "demo-v2.html"), "utf8");
const re = /seed\/(ltf-\d+)\/(\d+)\/(\d+)/g;
let m;
while ((m = re.exec(html))) {
  IMAGE_KEYS.push({
    key: "seed:" + m[1],
    w: +m[2],
    h: +m[3],
  });
}

const PROFILES = [
  { id: "4@684", cols: 4, vh: 684, vw: 1440, gap: 14 },
  { id: "4@684w1024", cols: 4, vh: 684, vw: 1024, gap: 14 },
  { id: "3@778", cols: 3, vh: 778, vw: 768, gap: 14 },
  { id: "2@641", cols: 2, vh: 641, vw: 390, gap: 14 },
];

const staggerPattern = [0, 0.14, 0.06, 0.2, 0.1, 0.16, 0.08];

function shuffleArray(arr, salt) {
  const copy = arr.slice();
  let seed = ((salt + 1) * 1103515245) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rotateArray(arr, offset) {
  const n = arr.length;
  const o = ((offset % n) + n) % n;
  return arr.slice(o).concat(arr.slice(0, o));
}

function templateHeightPx(img, colW) {
  let ratio = (img.h / img.w) * HEIGHT_SHRINK;
  if (ratio > MAX_HW + 0.01) ratio = MAX_HW * HEIGHT_SHRINK;
  return colW * ratio;
}

function columnPadTop(colIdx, cols, vh) {
  const staggerMul = colIdx === 0 || colIdx === cols - 1 ? 1.08 : 1;
  let base = staggerPattern[colIdx % staggerPattern.length];
  if (colIdx % 2 === 1) base = Math.min(base, 0.07);
  return base * vh * staggerMul;
}

function scrollOffsetPx(colIdx, pEff, singleH) {
  const up = colIdx % 2 === 0;
  return up ? pEff * singleH : (1 - pEff) * singleH;
}

function buildModel(orderIndices, rot, colIdx, cols, colW, gap, sharedSingleH, videoExtraH) {
  const n = orderIndices.length;
  const list = rotateArray(orderIndices, rot);
  const tiles = [];
  let y = 0;
  for (let i = 0; i < list.length; i++) {
    const img = IMAGE_KEYS[list[i]];
    let h = templateHeightPx(img, colW);
    if (colIdx === 0 && i === 3) h = colW * ((540 / 960) * HEIGHT_SHRINK);
    tiles.push({ key: img.key, top: y, bottom: y + h, h });
    y += h + gap;
  }
  return { tiles, total: sharedSingleH || y };
}

function visibleSimulated(colIdx, model, padTop, vh, pEff) {
  const singleH = model.total;
  const scroll = scrollOffsetPx(colIdx, pEff, singleH);
  const bandTop = padTop;
  const bandBottom = vh;
  const out = [];
  for (let wrapK = -1; wrapK <= 1; wrapK++) {
    const wrapShift = wrapK * singleH;
    for (const t of model.tiles) {
      const top = padTop + t.top - scroll + wrapShift;
      const bottom = padTop + t.bottom - scroll + wrapShift;
      const overlap = Math.min(bottom, bandBottom) - Math.max(top, bandTop);
      if (overlap < 8) continue;
      out.push({ col: colIdx, key: t.key, top, bottom, centerY: (top + bottom) / 2 });
    }
  }
  return out;
}

function duplicateIssues(visibleItems, vh, colCount) {
  const issues = [];
  const byKey = {};
  visibleItems.forEach((it) => {
    if (!byKey[it.key]) byKey[it.key] = [];
    byKey[it.key].push(it);
  });
  const byCol = {};
  visibleItems.forEach((it) => {
    if (!byCol[it.col]) byCol[it.col] = {};
    byCol[it.col][it.key] = (byCol[it.col][it.key] || 0) + 1;
  });
  Object.keys(byCol).forEach((ck) => {
    Object.keys(byCol[ck]).forEach((k) => {
      if (byCol[ck][k] > 1) issues.push({ type: "same-column-dup" });
    });
  });
  Object.keys(byKey).forEach((key) => {
    const items = byKey[key];
    if (items.length < 2) return;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.col === b.col) continue;
        const bandOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const adj = Math.abs(a.col - b.col) === 1;
        if (adj) {
          if (bandOverlap >= 24) issues.push({ type: "adjacent-cross-dup" });
          continue;
        }
        const sep = Math.abs(a.centerY - b.centerY);
        if (sep + 1 < vh * CROSS_COL_MIN_SEP && bandOverlap >= 24) {
          issues.push({ type: "cross-dup-close" });
        }
      }
    }
  });
  return issues;
}

function coverageMin(orders, rots, delays, profile, sharedSingleH, colW) {
  const { cols, vh, gap } = profile;
  const pads = [];
  for (let c = 0; c < cols; c++) pads[c] = columnPadTop(c, cols, vh);
  let minRatio = 1;
  for (let step = 0; step < LAYOUT_SAMPLES; step++) {
    const p = (step + 0.5) / LAYOUT_SAMPLES;
    for (let c = 0; c < cols; c++) {
      const pEff = (p + (delays[c] || 0) / LOOP_HALF_DUR) % 1;
      const model = buildModel(orders[c], rots[c], c, cols, colW, gap, sharedSingleH);
      const vis = visibleSimulated(c, model, pads[c], vh, pEff);
      const bandTop = pads[c];
      const bandH = Math.max(1, vh - bandTop);
      const intervals = vis
        .map((it) => [Math.max(it.top, bandTop), Math.min(it.bottom, vh)])
        .filter((iv) => iv[1] > iv[0])
        .sort((a, b) => a[0] - b[0]);
      let covered = 0;
      const merged = [];
      intervals.forEach((iv) => {
        if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push(iv.slice());
        else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      });
      merged.forEach((iv) => {
        covered += iv[1] - iv[0];
      });
      const ratio = covered / bandH;
      if (ratio < minRatio) minRatio = ratio;
    }
  }
  return minRatio;
}

function evaluate(orders, rots, delays, profile, sharedSingleH, colW) {
  const { cols, vh } = profile;
  const pads = [];
  for (let c = 0; c < cols; c++) pads[c] = columnPadTop(c, cols, vh);
  let score = 0;
  for (let step = 0; step < LAYOUT_SAMPLES; step++) {
    const p = (step + 0.5) / LAYOUT_SAMPLES;
    const visible = [];
    for (let c = 0; c < cols; c++) {
      const pEff = (p + (delays[c] || 0) / LOOP_HALF_DUR) % 1;
      const model = buildModel(orders[c], rots[c], c, cols, colW, profile.gap, sharedSingleH);
      visible.push(...visibleSimulated(c, model, pads[c], vh, pEff));
    }
    const issues = duplicateIssues(visible, vh, cols);
    score += issues.length * 100;
  }
  const cov = coverageMin(orders, rots, delays, profile, sharedSingleH, colW);
  if (cov < 0.85) score += Math.round((0.85 - cov) * 9000);
  return score;
}

function optimizeRotsDelays(orders, rots, delays, profile, sharedSingleH, colW) {
  const n = IMAGE_KEYS.length;
  for (let pass = 0; pass < 4; pass++) {
    for (let c = 0; c < profile.cols; c++) {
      let bestR = rots[c];
      let best = evaluate(orders, rots, delays, profile, sharedSingleH, colW);
      for (let r = 0; r < n; r++) {
        rots[c] = r;
        const sc = evaluate(orders, rots, delays, profile, sharedSingleH, colW);
        if (sc < best) {
          best = sc;
          bestR = r;
        }
      }
      rots[c] = bestR;
    }
    for (let c = 0; c < profile.cols; c++) {
      let bestD = delays[c];
      let best = evaluate(orders, rots, delays, profile, sharedSingleH, colW);
      for (let d = 0; d < 24; d++) {
        delays[c] = (d / 24) * LOOP_HALF_DUR;
        const sc = evaluate(orders, rots, delays, profile, sharedSingleH, colW);
        if (sc < best) {
          best = sc;
          bestD = delays[c];
        }
      }
      delays[c] = bestD;
    }
  }
  return evaluate(orders, rots, delays, profile, sharedSingleH, colW);
}

function estimateSharedSingleH(profile, colW) {
  const n = IMAGE_KEYS.length;
  const indices = [...Array(n).keys()];
  let max = 0;
  for (let c = 0; c < profile.cols; c++) {
    const model = buildModel(indices, 0, c, profile.cols, colW, profile.gap, 0);
    max = Math.max(max, model.tiles.reduce((s, t) => s + t.h, 0) + profile.gap * model.tiles.length);
  }
  return max + profile.vh * 0.35;
}

function solveProfile(profile) {
  const n = IMAGE_KEYS.length;
  const colW = (profile.vw - profile.gap * (profile.cols - 1)) / profile.cols;
  const sharedSingleH = estimateSharedSingleH(profile, colW);
  let best = null;
  let bestScore = 1e12;
  const maxAttempts = +(process.env.ATTEMPTS || 2500);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orders = [];
    const rots = [];
    const delays = [];
    const base = shuffleArray(
      [...Array(n).keys()],
      (profile.vw + attempt * 53 + profile.cols * 17) >>> 0
    );
    const stride = Math.max(1, Math.floor(n / profile.cols) + (attempt % 3));
    for (let c = 0; c < profile.cols; c++) {
      if (attempt % 4 === 3) {
        orders[c] = shuffleArray([...Array(n).keys()], attempt * 97 + c * 131);
      } else {
        orders[c] = rotateArray(base.slice(), (c * stride + attempt) % n);
      }
      rots[c] = (c * 3 + attempt) % n;
      delays[c] = ((c / profile.cols) * LOOP_HALF_DUR * 0.4 + attempt * 0.55) % LOOP_HALF_DUR;
    }
    const sc = optimizeRotsDelays(orders, rots, delays, profile, sharedSingleH, colW);
    if (sc < bestScore) {
      bestScore = sc;
      best = {
        orders: orders.map((o) => o.slice()),
        rots: rots.slice(),
        delays: delays.map((d) => +d.toFixed(2)),
        score: sc,
      };
    }
    if (bestScore === 0) break;
  }
  console.log(profile.id, "best score", bestScore);
  return best;
}

const out = {};
for (const profile of PROFILES) {
  out[profile.id] = solveProfile(profile);
}

writeFileSync(join(__dirname, "precomputed-layout-v2.json"), JSON.stringify(out, null, 2));
console.log("Wrote precomputed-layout-v2.json");

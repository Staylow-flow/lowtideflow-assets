/**
 * v2 acceptance — node home/masonry-grid/verify-demo-v2.mjs
 */
import { chromium } from "playwright";
import { pathToFileURL } from "url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { renameSync, existsSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoUrl = pathToFileURL(join(__dirname, "demo-v2.html")).href;
const artifactDir = "/opt/cursor/artifacts";
const MAX_HW = 1.25;
const COVERAGE_MIN = 0.85;
const SAMPLE_STEPS = 12;
const CROSS_COL_MIN_SEP = 0.6;
const errors = [];
const widthReports = [];

/** Canonical id from src / seed (stable for originals + loop clones). */
export function canonicalImageKey(raw) {
  if (!raw) return "unknown";
  if (raw.indexOf("video:") === 0) return raw;
  const m = String(raw).match(/seed\/([^/?#]+)/);
  if (m) return "seed:" + m[1];
  return String(raw).split("?")[0];
}

/**
 * Duplicate rules for one animation sample.
 * visibleItems: { col, key, top, bottom, centerY }[]
 */
export function duplicateIssuesFromVisible(visibleItems, vh, colCount) {
  const issues = [];
  const byCol = {};
  visibleItems.forEach((it) => {
    if (!byCol[it.col]) byCol[it.col] = [];
    byCol[it.col].push(it);
  });

  Object.keys(byCol).forEach((colKey) => {
    const col = parseInt(colKey, 10);
    const counts = {};
    byCol[col].forEach((it) => {
      counts[it.key] = (counts[it.key] || 0) + 1;
    });
    Object.keys(counts).forEach((key) => {
      if (counts[key] > 1) {
        issues.push({ type: "same-column-dup", col, key, count: counts[key] });
      }
    });
  });

  const byKey = {};
  visibleItems.forEach((it) => {
    if (!byKey[it.key]) byKey[it.key] = [];
    byKey[it.key].push(it);
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
          if (bandOverlap >= 24) {
            issues.push({
              type: "adjacent-cross-dup",
              key,
              cols: [a.col, b.col],
              sep: +Math.abs(a.centerY - b.centerY).toFixed(1),
              overlap: +bandOverlap.toFixed(1),
            });
          }
          continue;
        }
        const sep = Math.abs(a.centerY - b.centerY);
        if (sep + 1 < vh * CROSS_COL_MIN_SEP && bandOverlap >= 24) {
          issues.push({
            type: "cross-dup-close",
            key,
            cols: [a.col, b.col],
            sep: +sep.toFixed(1),
            minSep: +(vh * CROSS_COL_MIN_SEP).toFixed(1),
          });
        }
      }
    }
  });

  let videoVisible = 0;
  visibleItems.forEach((it) => {
    if (it.key.indexOf("video:") === 0) videoVisible += 1;
  });
  if (videoVisible > 1) issues.push({ type: "video-dup", videoVisible });

  return issues;
}

function runDuplicateCheckRegression() {
  const vh = 620;
  const walkingManTwice = [
    { col: 0, key: "seed:ltf-02", top: 120, bottom: 340, centerY: 230 },
    { col: 0, key: "seed:ltf-02", top: 360, bottom: 580, centerY: 470 },
    { col: 1, key: "seed:ltf-05", top: 100, bottom: 300, centerY: 200 },
  ];
  const issues = duplicateIssuesFromVisible(walkingManTwice, vh, 4);
  if (!issues.some((i) => i.type === "same-column-dup" && i.key === "seed:ltf-02")) {
    throw new Error(
      "Regression: broken check (f57805f-style) — same-column duplicate must fail"
    );
  }
  const overlapOnlyWouldMiss =
    walkingManTwice.filter((a, i) =>
      walkingManTwice.some(
        (b, j) =>
          i < j &&
          a.key === b.key &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 12
      )
    ).length === 0;
  if (!overlapOnlyWouldMiss) {
    throw new Error("Regression fixture: overlap-only heuristic should not fire");
  }
}

runDuplicateCheckRegression();

async function waitReady(page, { eagerAllForVerify = true } = {}) {
  await page.waitForFunction(
    () => document.querySelector("[data-ltf-masonry-v2]"),
    { timeout: 120000 }
  );
  await page.evaluate(async (eagerAll) => {
    const root = document.querySelector("[data-ltf-masonry-v2]");
    if (root && root.rebuildLtfMasonryV2) root.rebuildLtfMasonryV2();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (eagerAll) {
      root.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a").forEach((img) => {
        img.loading = "eager";
        img.setAttribute("data-ltf-eager", "1");
      });
      if (root.promoteLtfMasonryImages) root.promoteLtfMasonryImages();
    }
  }, eagerAllForVerify);
  await page.waitForFunction(
    () => {
      const root = document.querySelector("[data-ltf-masonry-v2]");
      if (!root || root.getAttribute("data-ltf-masonry-layout-settled") !== "1") return false;
      const tracks = document.querySelectorAll(".ltf-masonry-column__track.is-a");
      if (!tracks.length) return false;
      return Array.from(tracks).every((t) => t.getAttribute("data-ltf-loop-ready") === "1");
    },
    { timeout: 90000 }
  );
  await page.waitForFunction(
    () => {
      const imgs = document.querySelectorAll(
        '.ltf-masonry-column img.ltf-masonry-tile__img.is-a[data-ltf-eager="1"]'
      );
      if (!imgs.length) return false;
      return Array.from(imgs).every((i) => i.complete && i.naturalWidth > 0);
    },
    { timeout: 120000 }
  );
  await page.evaluate(async () => {
    const imgs = Array.from(
      document.querySelectorAll('.ltf-masonry-column img.ltf-masonry-tile__img.is-a[data-ltf-eager="1"]')
    );
    await Promise.all(
      imgs.map((img) => {
        if (typeof img.decode === "function") return img.decode().catch(() => {});
        return Promise.resolve();
      })
    );
  });
  await page.waitForTimeout(200);
}

async function assertViewportSample(page, label, w, h, screenshotName) {
  await page.setViewportSize({ width: w, height: h });
  await waitReady(page);

  const report = await page.evaluate(
    async ({ sampleSteps, coverageMin, crossColMinSep }) => {
      function canonicalImageKey(raw) {
        if (!raw) return "unknown";
        if (raw.indexOf("video:") === 0) return raw;
        const m = String(raw).match(/seed\/([^/?#]+)/);
        if (m) return "seed:" + m[1];
        return String(raw).split("?")[0];
      }

      function tileKey(tile) {
        const img = tile.querySelector("img.ltf-masonry-tile__img.is-a");
        if (img) {
          return canonicalImageKey(img.getAttribute("src") || img.currentSrc || "img");
        }
        const v = tile.querySelector("video.ltf-masonry-tile__video.is-a");
        if (v) return "video:" + (v.getAttribute("data-src") || v.getAttribute("poster") || "v");
        return canonicalImageKey(tile.getAttribute("data-ltf-tile-key") || "unknown");
      }

      function duplicateIssuesFromVisible(visibleItems, vh, colCount) {
        const issues = [];
        const byCol = {};
        visibleItems.forEach((it) => {
          if (!byCol[it.col]) byCol[it.col] = [];
          byCol[it.col].push(it);
        });
        Object.keys(byCol).forEach((colKey) => {
          const col = parseInt(colKey, 10);
          const counts = {};
          byCol[col].forEach((it) => {
            counts[it.key] = (counts[it.key] || 0) + 1;
          });
          Object.keys(counts).forEach((key) => {
            if (counts[key] > 1) {
              issues.push({ type: "same-column-dup", col, key, count: counts[key] });
            }
          });
        });
        const byKey = {};
        visibleItems.forEach((it) => {
          if (!byKey[it.key]) byKey[it.key] = [];
          byKey[it.key].push(it);
        });
        Object.keys(byKey).forEach((key) => {
          const items = byKey[key];
          if (items.length < 2) return;
          for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i];
              const b = items[j];
              if (a.col === b.col) continue;
              const bandOverlap =
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              const adj = Math.abs(a.col - b.col) === 1;
              if (adj) {
                if (bandOverlap >= 24) {
                  issues.push({
                    type: "adjacent-cross-dup",
                    key,
                    cols: [a.col, b.col],
                    sep: +Math.abs(a.centerY - b.centerY).toFixed(1),
                    overlap: +bandOverlap.toFixed(1),
                  });
                }
                continue;
              }
              const sep = Math.abs(a.centerY - b.centerY);
              if (sep + 1 < vh * crossColMinSep && bandOverlap >= 24) {
                issues.push({
                  type: "cross-dup-close",
                  key,
                  cols: [a.col, b.col],
                  sep: +sep.toFixed(1),
                  minSep: +(vh * crossColMinSep).toFixed(1),
                });
              }
            }
          }
        });
        let videoVisible = 0;
        visibleItems.forEach((it) => {
          if (it.key.indexOf("video:") === 0) videoVisible += 1;
        });
        if (videoVisible > 1) issues.push({ type: "video-dup", videoVisible });
        return issues;
      }

      function tileLoaded(tile) {
        const r = tile.getBoundingClientRect();
        if (r.height < 4) return false;
        const img = tile.querySelector("img.ltf-masonry-tile__img.is-a");
        if (img) return img.naturalWidth > 0;
        const v = tile.querySelector("video.ltf-masonry-tile__video.is-a");
        if (v) {
          const poster = v.getAttribute("poster");
          return !!(poster || v.videoWidth > 0 || v.getAttribute("data-src"));
        }
        return false;
      }

      function visibleTileOverlap(tile) {
        const r = tile.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return 0;
        const top = Math.max(r.top, vRect.top);
        const bottom = Math.min(r.bottom, vRect.bottom);
        return Math.max(0, bottom - top);
      }

      function mergeIntervals(intervals) {
        if (!intervals.length) return [];
        const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
        const out = [sorted[0].slice()];
        for (let i = 1; i < sorted.length; i++) {
          const cur = sorted[i];
          const last = out[out.length - 1];
          if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
          else out.push(cur.slice());
        }
        return out;
      }

      function intervalUnionLength(intervals) {
        return mergeIntervals(intervals).reduce((sum, iv) => sum + (iv[1] - iv[0]), 0);
      }

      const root = document.querySelector("[data-ltf-masonry-v2]");
      const viewportEl = root.querySelector(".ltf-masonry-viewport.is-a");
      const vRect = viewportEl.getBoundingClientRect();
      const vh = vRect.height;
      const colCount = parseInt(root.getAttribute("data-ltf-masonry-cols") || "0", 10);

      const tracks = Array.from(document.querySelectorAll(".ltf-masonry-column__track.is-a"));
      const issues = [];
      const stepCoverage = [];
      const crossDupLog = [];
      let screenshotStep = Math.floor(sampleSteps / 2);

      root.setAttribute("data-ltf-masonry-paused", "1");

      for (let step = 0; step < sampleSteps; step++) {
        const progress = (step + 0.5) / sampleSteps;
        tracks.forEach((track) => {
          track.getAnimations().forEach((anim) => {
            try {
              anim.pause();
              const timing = anim.effect.getTiming();
              const dur = timing.duration;
              const delayMs =
                typeof timing.delay === "number"
                  ? timing.delay
                  : parseFloat(getComputedStyle(track).animationDelay) || 0;
              const phaseMs = delayMs <= 0 ? -delayMs : delayMs;
              anim.currentTime = (phaseMs + progress * dur) % dur;
            } catch (e) {}
          });
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const cols = Array.from(document.querySelectorAll(".ltf-masonry-column.is-a"));
        const visibleItems = [];
        const colStats = [];

        cols.forEach((col, ci) => {
          const colRect = col.getBoundingClientRect();
          const padTop = parseFloat(getComputedStyle(col).paddingTop) || 0;
          const bandTop = Math.max(vRect.top, colRect.top + padTop);
          const bandBottom = Math.min(vRect.bottom, colRect.bottom);
          const bandH = Math.max(0, bandBottom - bandTop);

          const intervals = [];
          const unloaded = [];
          col.querySelectorAll(".ltf-masonry-tile.is-a").forEach((tile) => {
            const overlap = visibleTileOverlap(tile);
            if (overlap < 8) return;
            if (!tileLoaded(tile)) {
              unloaded.push(tileKey(tile));
              return;
            }
            const r = tile.getBoundingClientRect();
            intervals.push([Math.max(r.top, bandTop), Math.min(r.bottom, bandBottom)]);
            const key = tileKey(tile);
            visibleItems.push({
              col: ci,
              key,
              top: r.top,
              bottom: r.bottom,
              centerY: (r.top + r.bottom) / 2,
            });
          });
          const covered = intervalUnionLength(intervals);
          const ratio = bandH > 0 ? covered / bandH : 0;
          colStats.push({ col: ci, ratio, covered, unloaded: unloaded.length });
          if (ratio + 0.002 < coverageMin) {
            issues.push({ step, col: ci, type: "coverage", ratio: +ratio.toFixed(3) });
          }
          if (unloaded.length) {
            issues.push({ step, col: ci, type: "unloaded", keys: unloaded });
          }
        });

        const dupIssues = duplicateIssuesFromVisible(visibleItems, vh, colCount);
        dupIssues.forEach((d) => issues.push({ step, ...d }));
        dupIssues
          .filter((d) => d.type === "adjacent-cross-dup" || d.type === "cross-dup-close")
          .forEach((d) => crossDupLog.push({ step, ...d }));

        stepCoverage.push({ step, colStats });
      }

      root.setAttribute("data-ltf-masonry-paused", "0");

      return {
        cols: root.getAttribute("data-ltf-masonry-cols"),
        issues,
        stepCoverage,
        screenshotStep,
        crossDupLog,
      };
    },
    { sampleSteps: SAMPLE_STEPS, coverageMin: COVERAGE_MIN, crossColMinSep: CROSS_COL_MIN_SEP }
  );

  widthReports.push({ label, w, ...report });

  if (report.issues.length) {
    errors.push(`${label} (${w}px): ${JSON.stringify(report.issues)}`);
  }

  if (screenshotName) {
    await page.evaluate(
      ({ step, sampleSteps }) => {
        const root = document.querySelector("[data-ltf-masonry-v2]");
        root.setAttribute("data-ltf-masonry-paused", "1");
        const progress = (step + 0.5) / sampleSteps;
        document.querySelectorAll(".ltf-masonry-column__track.is-a").forEach((track) => {
          track.getAnimations().forEach((anim) => {
            try {
              anim.pause();
              const timing = anim.effect.getTiming();
              const dur = timing.duration;
              const delayMs =
                typeof timing.delay === "number"
                  ? timing.delay
                  : parseFloat(getComputedStyle(track).animationDelay) || 0;
              const phaseMs = delayMs <= 0 ? -delayMs : delayMs;
              anim.currentTime = (phaseMs + progress * dur) % dur;
            } catch (e) {}
          });
        });
      },
      { step: report.screenshotStep, sampleSteps: SAMPLE_STEPS }
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${artifactDir}/masonry-v2-${screenshotName}.png` });
    await page.evaluate(() => {
      document.querySelector("[data-ltf-masonry-v2]").setAttribute("data-ltf-masonry-paused", "0");
    });
  }
}

function syncEmbedHtml() {
  const css = readFileSync(join(__dirname, "masonry-embed-v2.css"), "utf8");
  const js = readFileSync(join(__dirname, "masonry-embed-v2.js"), "utf8");
  const html =
    "<!-- v2.2 — generated from masonry-embed-v2.css + masonry-embed-v2.js -->\n<style>\n" +
    css +
    "\n</style>\n<script>\n" +
    js +
    "\n</script>\n";
  writeFileSync(join(__dirname, "masonry-embed-v2.html"), html);
}

async function run() {
  syncEmbedHtml();

  const browser = await chromium.launch();

  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: artifactDir, size: { width: 1440, height: 900 } },
  });
  videoContext.setDefaultTimeout(180000);
  const videoPage = await videoContext.newPage();
  await videoPage.goto(demoUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await videoPage.evaluate(() => {
    const root = document.querySelector("[data-ltf-masonry-v2]");
    if (!root) return;
    root.setAttribute("data-ltf-masonry-near", "1");
    root.setAttribute("data-ltf-masonry-paused", "0");
    if (root.rebuildLtfMasonryV2) root.rebuildLtfMasonryV2();
  });
  await videoPage.waitForTimeout(8000);
  const rawVideo = await videoPage.video().path();
  await videoContext.close();
  const outVideo = `${artifactDir}/masonry-v2-motion-1440.webm`;
  if (existsSync(rawVideo)) renameSync(rawVideo, outVideo);

  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.goto(demoUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

  const lazyBeforeBuild = await page.evaluate(() => {
    const root = document.querySelector("[data-ltf-masonry-v2]");
    if (root.rebuildLtfMasonryV2) root.rebuildLtfMasonryV2();
    const sourceLazy = Array.from(
      document.querySelectorAll(".ltf-masonry-source img.ltf-masonry-tile__img.is-a")
    ).every((img) => img.getAttribute("loading") === "lazy");
    const columnImgs = Array.from(
      document.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a")
    );
    const someLazy = columnImgs.some((img) => img.getAttribute("loading") === "lazy");
    const someEager = columnImgs.some((img) => img.getAttribute("loading") === "eager");
    return { sourceLazy, someLazy, someEager, total: columnImgs.length };
  });
  if (!lazyBeforeBuild.sourceLazy) errors.push("Source images missing loading=lazy");
  if (lazyBeforeBuild.total > 4 && !lazyBeforeBuild.someLazy) {
    errors.push("Expected lazy loading on off-screen column clones before verify eager pass");
  }

  await waitReady(page);

  for (const { name, w, h } of [
    { name: "desktop", w: 1440, h: 900 },
    { name: "tablet", w: 768, h: 1024 },
    { name: "mobile390", w: 390, h: 844 },
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await waitReady(page);

    const metrics = await page.evaluate((maxHw) => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth > doc.clientWidth + 1;
      const root = document.querySelector("[data-ltf-masonry-v2]");
      const cols = parseInt(root.getAttribute("data-ltf-masonry-cols") || "0", 10);
      const viewport = root.querySelector(".ltf-masonry-viewport.is-a");
      const vRect = viewport.getBoundingClientRect();
      const colEls = Array.from(root.querySelectorAll(".ltf-masonry-column.is-a"));
      const staggers = colEls.map((c) => parseFloat(getComputedStyle(c).paddingTop) || 0);
      const staggerSpread = staggers.length ? Math.max(...staggers) - Math.min(...staggers) : 0;

      let clipped = false;
      root.querySelectorAll(".ltf-masonry-column.is-a .ltf-masonry-tile.is-a").forEach((tile) => {
        const r = tile.getBoundingClientRect();
        if (r.bottom < vRect.top + 2 || r.top > vRect.bottom - 2) clipped = true;
      });

      const stripViolations = [];
      root.querySelectorAll(".ltf-masonry-column.is-a .ltf-masonry-tile.is-a").forEach((tile, idx) => {
        const rect = tile.getBoundingClientRect();
        if (rect.width > 0 && rect.height / rect.width > maxHw + 0.08) {
          stripViolations.push({ idx, hw: rect.height / rect.width });
        }
      });

      return { overflowX, cols, staggerSpread, clipped, stripViolations };
    }, MAX_HW);

    if (metrics.overflowX) errors.push(`${name}: horizontal overflow`);
    if (w === 390 && metrics.cols !== 2) errors.push(`${name}: expected 2 columns, got ${metrics.cols}`);
    if (w === 768 && metrics.cols !== 3) errors.push(`${name}: expected 3 columns, got ${metrics.cols}`);
    if (w === 1440 && metrics.cols !== 4) errors.push(`${name}: expected 4 columns at 1440, got ${metrics.cols}`);
    if (!metrics.clipped) errors.push(`${name}: expected top/bottom edge clipping in viewport`);
    if (metrics.staggerSpread < 20) errors.push(`${name}: column top stagger too subtle (${metrics.staggerSpread}px)`);
    if (metrics.stripViolations.length) errors.push(`${name}: skinny tiles ${JSON.stringify(metrics.stripViolations)}`);
  }

  await assertViewportSample(page, "w1440", 1440, 900, "desktop");
  await assertViewportSample(page, "w1024", 1024, 900, null);
  await assertViewportSample(page, "w768", 768, 1024, "tablet");
  await assertViewportSample(page, "w390", 390, 844, "mobile390");

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitReady(page);
  await page.evaluate(() => {
    const root = document.querySelector("[data-ltf-masonry-v2]");
    root.setAttribute("data-ltf-masonry-near", "1");
    root.setAttribute("data-ltf-masonry-paused", "0");
    document.querySelectorAll(".ltf-masonry-column__track.is-a").forEach((track) => {
      track.getAnimations().forEach((anim) => {
        try {
          anim.play();
        } catch (e) {}
      });
    });
  });

  const readTracks = () =>
    page.evaluate(() => {
      function parseTranslateY(transform) {
        if (!transform || transform === "none") return 0;
        const m = transform.match(/matrix3d\(([^)]+)\)/);
        if (m) {
          const p = m[1].split(",").map((x) => parseFloat(x.trim()));
          return p[13] || 0;
        }
        const m2 = transform.match(/matrix\(([^)]+)\)/);
        if (m2) {
          const p = m2[1].split(",").map((x) => parseFloat(x.trim()));
          return p[5] || 0;
        }
        return 0;
      }
      const tracks = Array.from(document.querySelectorAll(".ltf-masonry-column__track.is-a"));
      return tracks.map((t) => ({
        up: t.classList.contains("is-ltf-scroll-up"),
        y: parseTranslateY(getComputedStyle(t).transform),
      }));
    });

  await page.evaluate(() => {
    document.querySelectorAll(".ltf-masonry-column__track.is-a").forEach((t) => {
      const d = parseFloat(getComputedStyle(t).animationDelay) || 0;
      if (d > 0.01) {
        throw new Error(`positive animation-delay ${d}s on column track`);
      }
    });
  });

  const t0b = await readTracks();
  await page.waitForTimeout(1000);
  const t1b = await readTracks();
  const motionCols = [];
  for (let i = 0; i < t0b.length; i++) {
    const dy = t1b[i].y - t0b[i].y;
    motionCols.push({ col: i, dy, up: t0b[i].up });
    if (Math.abs(dy) <= 2) {
      errors.push(`Motion: col ${i} moved ${dy.toFixed(2)}px (need >2px in 1s)`);
    } else if (t0b[i].up && dy >= 0) {
      errors.push(`Motion: col ${i} scroll-up but dy=${dy.toFixed(2)} (expected negative)`);
    } else if (!t0b[i].up && dy <= 0) {
      errors.push(`Motion: col ${i} scroll-down but dy=${dy.toFixed(2)} (expected positive)`);
    }
  }
  const opposingDirs = t0b.length > 1 && t0b[0].up !== t0b[1].up;
  if (!opposingDirs) {
    errors.push(`Motion: columns 0/1 same scroll direction up0=${t0b[0].up} up1=${t0b[1].up}`);
  }

  const rmBrowser = await chromium.launch();
  const rmContext = await rmBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  rmContext.setDefaultTimeout(180000);
  const rmPage = await rmContext.newPage();
  await rmPage.goto(demoUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitReady(rmPage);
  const staticOk = await rmPage.evaluate(() => {
    const tracks = document.querySelectorAll(".ltf-masonry-column__track.is-a");
    return Array.from(tracks).every((t) => {
      const anim = getComputedStyle(t).animationName;
      return anim === "none" || anim === "";
    });
  });
  if (!staticOk) errors.push("prefers-reduced-motion: animations still active");
  await rmBrowser.close();

  await browser.close();

  console.log(
    `Column coverage + duplicate checks (${SAMPLE_STEPS} samples, min 85% coverage per column band):`
  );
  widthReports.forEach((r) => {
    const minRatios = [];
    for (let s = 0; s < SAMPLE_STEPS; s++) {
      const step = r.stepCoverage?.find((x) => x.step === s);
      if (!step) continue;
      step.colStats.forEach((cs) => {
        minRatios[cs.col] = Math.min(minRatios[cs.col] ?? 1, cs.ratio);
      });
    }
    const crossNote =
      r.crossDupLog && r.crossDupLog.length
        ? ` crossColDups=${JSON.stringify(r.crossDupLog)}`
        : "";
    console.log(
      `  ${r.w}px (${r.label}): cols=${r.cols} issues=${r.issues.length} minColCoverage=${minRatios.map((x) => (x ?? 0).toFixed(2)).join(",")}${crossNote}${r.issues.length ? " " + JSON.stringify(r.issues) : " OK"}`
    );
  });
  console.log("Motion delta sample (1s, all cols):", motionCols);

  if (errors.length) {
    console.error("FAILED:\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("v2 checks passed. Artifacts in " + artifactDir);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

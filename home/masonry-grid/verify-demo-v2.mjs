/**
 * v2 acceptance — node home/masonry-grid/verify-demo-v2.mjs
 */
import { chromium } from "playwright";
import { pathToFileURL } from "url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { renameSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoUrl = pathToFileURL(join(__dirname, "demo-v2.html")).href;
const artifactDir = "/opt/cursor/artifacts";
const MAX_HW = 1.25;
const errors = [];

async function waitReady(page) {
  await page.waitForFunction(
    () => {
      const root = document.querySelector("[data-ltf-masonry-v2]");
      return root && root.querySelector(".ltf-masonry-column.is-a");
    },
    { timeout: 120000 }
  );
  await page.evaluate(() => {
    const root = document.querySelector("[data-ltf-masonry-v2]");
    if (root && root.rebuildLtfMasonryV2) root.rebuildLtfMasonryV2();
  });
  await page.waitForTimeout(300);
}

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
  const ty = transform.match(/translate3d\([^,]+,\s*([^,]+)/);
  if (ty) return parseFloat(ty[1]);
  return 0;
}

async function run() {
  const browser = await chromium.launch();

  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: artifactDir, size: { width: 1440, height: 900 } },
  });
  const videoPage = await videoContext.newPage();
  await videoPage.goto(demoUrl, { waitUntil: "networkidle", timeout: 120000 });
  await waitReady(videoPage);
  await videoPage.evaluate(() => {
    document.querySelector("[data-ltf-masonry-v2]").setAttribute("data-ltf-masonry-paused", "0");
  });
  await videoPage.waitForTimeout(9000);
  const rawVideo = await videoPage.video().path();
  await videoContext.close();
  const outVideo = `${artifactDir}/masonry-v2-motion-1440.webm`;
  if (existsSync(rawVideo)) renameSync(rawVideo, outVideo);

  const page = await browser.newPage();

  await page.goto(demoUrl, { waitUntil: "networkidle", timeout: 120000 });
  await waitReady(page);

  const lazyOk = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ltf-masonry-source img.ltf-masonry-tile__img.is-a")).every(
      (img) => img.getAttribute("loading") === "lazy"
    )
  );
  if (!lazyOk) errors.push("Source images missing loading=lazy");

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
    if (w === 1440 && metrics.cols < 4) errors.push(`${name}: expected 4–5 columns, got ${metrics.cols}`);
    if (!metrics.clipped) errors.push(`${name}: expected top/bottom edge clipping in viewport`);
    if (metrics.staggerSpread < 20) errors.push(`${name}: column top stagger too subtle (${metrics.staggerSpread}px)`);
    if (metrics.stripViolations.length) errors.push(`${name}: skinny tiles ${JSON.stringify(metrics.stripViolations)}`);

    await page.screenshot({ path: `${artifactDir}/masonry-v2-${name}.png` });
  }

  await page.evaluate(() => {
    document.querySelector("[data-ltf-masonry-v2]").setAttribute("data-ltf-masonry-paused", "0");
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

  const t0 = await readTracks();
  await page.waitForTimeout(4000);
  const t1 = await readTracks();

  await page.waitForTimeout(800);
  const t0b = await readTracks();
  await page.waitForTimeout(3500);
  const t1b = await readTracks();
  let opposed = false;
  for (let i = 0; i < Math.min(2, t0b.length); i++) {
    const dy = t1b[i].y - t0b[i].y;
    if (Math.abs(dy) < 3) continue;
    if (i === 0 && t0b[i].up && dy < 0) opposed = true;
    if (i === 1 && !t0b[i].up && dy > 0) opposed = true;
  }
  const dy0 = t1b[0].y - t0b[0].y;
  const dy1 = t1b[1].y - t0b[1].y;
  if (Math.abs(dy0) < 3 || Math.abs(dy1) < 3) {
    errors.push(`Motion: insufficient movement dy0=${dy0} dy1=${dy1}`);
  } else if (dy0 * dy1 >= 0) {
    errors.push(`Motion: columns not opposing dy0=${dy0} dy1=${dy1}`);
  } else if (!opposed) {
    errors.push(`Motion: direction mismatch t0=${JSON.stringify(t0b)} t1=${JSON.stringify(t1b)}`);
  }

  await page.screenshot({ path: `${artifactDir}/masonry-v2-motion-frame-a.png` });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${artifactDir}/masonry-v2-motion-frame-b.png` });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${artifactDir}/masonry-v2-motion-frame-c.png` });

  const perf = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const longTasks = [];
        let obs;
        try {
          obs = new PerformanceObserver((list) => {
            list.getEntries().forEach((e) => {
              if (e.duration > 50) longTasks.push(e.duration);
            });
          });
          obs.observe({ entryTypes: ["longtask"] });
        } catch (e) {
          resolve({ longTasks: [], note: "longtask unsupported" });
          return;
        }
        setTimeout(() => {
          obs.disconnect();
          resolve({ longTasks, note: "ok" });
        }, 6000);
      })
  );

  if (perf.longTasks && perf.longTasks.length > 2) {
    errors.push(`Perf: ${perf.longTasks.length} long tasks >50ms during animation sample`);
  }

  const rmBrowser = await chromium.launch();
  const rmContext = await rmBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const rmPage = await rmContext.newPage();
  await rmPage.goto(demoUrl, { waitUntil: "networkidle" });
  await waitReady(rmPage);
  const staticOk = await rmPage.evaluate(() => {
    const tracks = document.querySelectorAll(".ltf-masonry-column__track.is-a");
    return Array.from(tracks).every((t) => {
      const anim = getComputedStyle(t).animationName;
      return anim === "none" || anim === "";
    });
  });
  if (!staticOk) errors.push("prefers-reduced-motion: animations still active");
  await rmPage.screenshot({ path: `${artifactDir}/masonry-v2-reduced-motion.png` });
  await rmBrowser.close();

  await browser.close();

  console.log("Perf sample (long tasks >50ms):", perf);
  console.log("Motion delta sample:", { t0, t1 });

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

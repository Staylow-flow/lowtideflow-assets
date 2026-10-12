/**
 * Acceptance checks for demo.html — run: node home/masonry-grid/verify-demo.mjs
 * Requires: playwright (chromium).
 */
import { chromium } from "playwright";
import { pathToFileURL } from "url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoUrl = pathToFileURL(join(__dirname, "demo.html")).href;
const MAX_HW = 1.35;
const BALANCE_RATIO = 0.25;
const measureWidths = [
  { name: "w1440", w: 1440, h: 900, screenshot: true },
  { name: "w1024", w: 1024, h: 900, screenshot: false },
  { name: "w768", w: 768, h: 1024, screenshot: true },
  { name: "w390", w: 390, h: 844, screenshot: true },
];
const artifactDir = "/opt/cursor/artifacts";

const errors = [];
const balanceReports = [];

async function waitForPack(page) {
  await page.waitForFunction(
    () => {
      const grid = document.querySelector(".ltf-masonry-grid.is-a");
      return grid && grid.classList.contains("is-ltf-packed");
    },
    { timeout: 120000 }
  );
  await page.evaluate(() => {
    const root = document.querySelector("[data-ltf-masonry]");
    if (root && typeof root.packLtfMasonry === "function") root.packLtfMasonry();
  });
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(demoUrl, { waitUntil: "networkidle", timeout: 120000 });

  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll(".ltf-masonry-tile__img.is-a");
    return imgs.length >= 8 && Array.from(imgs).every((i) => i.complete && i.naturalWidth > 0);
  }, { timeout: 120000 });

  await waitForPack(page);

  await page.evaluate(() => {
    document.querySelectorAll(".ltf-masonry-tile.is-a").forEach((t) => t.classList.add("is-ltf-revealed"));
  });

  const lazyOk = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img.ltf-masonry-tile__img.is-a")).every(
      (img) => img.getAttribute("loading") === "lazy"
    )
  );
  if (!lazyOk) errors.push("Not all images have loading=lazy");

  const videoMeta = await page.evaluate(() => {
    const v = document.querySelector("video.ltf-masonry-tile__video.is-a");
    if (!v) return null;
    return {
      muted: v.muted,
      loop: v.loop,
      playsInline: v.playsInline,
      preload: v.getAttribute("preload"),
      hasLazy: v.hasAttribute("data-ltf-video-lazy"),
      hasDataSrc: !!v.getAttribute("data-src"),
    };
  });
  if (!videoMeta) errors.push("Missing video tile");
  else {
    if (!videoMeta.muted || !videoMeta.loop || !videoMeta.playsInline) {
      errors.push("Video missing muted/loop/playsInline");
    }
    if (videoMeta.preload !== "none") errors.push("Video preload should be none");
    if (!videoMeta.hasLazy || !videoMeta.hasDataSrc) errors.push("Video lazy attributes missing");
  }

  for (const { name, w, h, screenshot } of measureWidths) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    await waitForPack(page);
    await page.waitForTimeout(100);

    const metrics = await page.evaluate((maxHw) => {
      function approx(a, b, tol) {
        return Math.abs(a - b) <= tol;
      }
      const doc = document.documentElement;
      const overflowX =
        doc.scrollWidth > doc.clientWidth + 1 ||
        document.body.scrollWidth > document.body.clientWidth + 1;
      const tiles = Array.from(document.querySelectorAll(".ltf-masonry-tile.is-a"));
      const stripViolations = [];
      const ratioViolations = [];
      tiles.forEach((tile, idx) => {
        const rect = tile.getBoundingClientRect();
        const hw = rect.height / rect.width;
        if (hw > maxHw + 0.06) stripViolations.push({ idx, hw });
        const media = tile.querySelector(".ltf-masonry-tile__media.is-a");
        const img = tile.querySelector("img.ltf-masonry-tile__img.is-a");
        if (img && media && !media.classList.contains("is-cap")) {
          const natural = img.naturalHeight / img.naturalWidth;
          const rendered = img.getBoundingClientRect();
          const rHw = rendered.height / rendered.width;
          if (natural <= maxHw + 0.02 && !approx(rHw, natural, 0.04)) {
            ratioViolations.push({ idx, natural, rHw });
          }
        }
      });
      return { overflowX, stripViolations, ratioViolations, tileCount: tiles.length };
    }, MAX_HW);

    const balance = await page.evaluate((balanceRatio) => {
      const grid = document.querySelector(".ltf-masonry-grid.is-a");
      const tiles = Array.from(document.querySelectorAll(".ltf-masonry-tile.is-a"));
      const cols = parseInt(grid.getAttribute("data-ltf-masonry-cols") || "1", 10);
      const colBottoms = new Array(cols).fill(0);
      let heightSum = 0;

      tiles.forEach((tile) => {
        const col = parseInt(tile.getAttribute("data-ltf-masonry-col") || "0", 10);
        const top = parseFloat(tile.style.top) || 0;
        const bottom = top + tile.offsetHeight;
        if (colBottoms[col] !== undefined) {
          colBottoms[col] = Math.max(colBottoms[col], bottom);
        }
        heightSum += tile.offsetHeight;
      });

      const avgTileHeight = heightSum / (tiles.length || 1);
      const minBottom = Math.min.apply(null, colBottoms);
      const maxBottom = Math.max.apply(null, colBottoms);
      const delta = maxBottom - minBottom;
      const root = document.querySelector("[data-ltf-masonry]");
      const gapVar = root
        ? getComputedStyle(root).getPropertyValue("--ltf-masonry-gap").trim()
        : "16px";
      let gapPx = parseFloat(gapVar) || 16;
      if (gapVar && gapVar.indexOf("px") === -1) {
        const probe = document.createElement("div");
        probe.style.width = gapVar;
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        root.appendChild(probe);
        gapPx = probe.getBoundingClientRect().width || 16;
        root.removeChild(probe);
      }
      const allowed = avgTileHeight * balanceRatio + gapPx;

      return {
        cols,
        colBottoms,
        minBottom,
        maxBottom,
        delta,
        avgTileHeight,
        allowed,
        ok: delta <= allowed + 1,
      };
    }, BALANCE_RATIO);
    balanceReports.push({ width: name, viewport: w, ...balance });

    if (metrics.overflowX) errors.push(`${name}: horizontal overflow`);
    if (metrics.stripViolations.length) {
      errors.push(`${name}: skinny strips ${JSON.stringify(metrics.stripViolations)}`);
    }
    if (metrics.ratioViolations.length) {
      errors.push(`${name}: uncropped ratio mismatch ${JSON.stringify(metrics.ratioViolations)}`);
    }
    if (!balance.ok) {
      errors.push(
        `${name}: column bottom delta ${balance.delta.toFixed(1)}px exceeds ${BALANCE_RATIO * 100}% of avg tile height (${balance.allowed.toFixed(1)}px)`
      );
    }

    if (screenshot) {
      const shotName =
        name === "w1440" ? "desktop" : name === "w768" ? "tablet" : "mobile390";
      await page.screenshot({
        path: `${artifactDir}/masonry-${shotName}.png`,
        fullPage: true,
      });
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForPack(page);
  await page.evaluate(() => {
    const tile = document.querySelector("[data-ltf-masonry-video-tile]");
    if (tile) tile.scrollIntoView({ block: "center", inline: "center" });
  });
  await page.waitForTimeout(2500);

  const videoPlaying = await page.evaluate(() => {
    const v = document.querySelector("video.ltf-masonry-tile__video.is-a");
    return v && !v.paused && v.currentTime > 0;
  });
  if (!videoPlaying) errors.push("Video did not start playing in viewport");

  await page.evaluate(() => {
    const tile = document.querySelector("[data-ltf-masonry-video-tile]");
    if (!tile) return;
    let badge = tile.querySelector(".ltf-masonry-verify-label");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ltf-masonry-verify-label";
      badge.textContent = "VIDEO TILE (1st item, DOM order)";
      badge.setAttribute(
        "style",
        "position:absolute;z-index:9;top:8px;left:8px;padding:6px 10px;font:bold 11px/1.2 sans-serif;color:#06142e;background:rgba(255,106,28,0.95);border-radius:4px;pointer-events:none;"
      );
      tile.style.position = "absolute";
      tile.appendChild(badge);
    }
  });

  const videoClip = await page.evaluate(() => {
    const tile = document.querySelector("[data-ltf-masonry-video-tile]");
    const r = tile.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.screenshot({
    path: `${artifactDir}/masonry-video-frame.png`,
    clip: videoClip,
  });

  await browser.close();

  console.log("Column bottom balance (max − min vs 25% avg tile height):");
  for (const r of balanceReports) {
    console.log(
      `  ${r.viewport}px (${r.width}): cols=${r.cols} delta=${r.delta.toFixed(1)}px allowed≤${r.allowed.toFixed(1)}px bottoms=[${r.colBottoms.map((b) => b.toFixed(0)).join(", ")}] ${r.ok ? "OK" : "FAIL"}`
    );
  }

  if (errors.length) {
    console.error("FAILED:\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("All checks passed. Screenshots in " + artifactDir);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

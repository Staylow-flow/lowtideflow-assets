/**
 * Acceptance checks for demo.html — run: node home/masonry-grid/verify-demo.mjs
 * Requires: npx playwright (chromium).
 */
import { chromium } from "playwright";
import { pathToFileURL } from "url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoUrl = pathToFileURL(join(__dirname, "demo.html")).href;
const MAX_HW = 1.35;
const widths = [
  { name: "desktop", w: 1440, h: 900 },
  { name: "tablet", w: 768, h: 1024 },
  { name: "mobile390", w: 390, h: 844 },
];
const artifactDir = "/opt/cursor/artifacts";

const errors = [];

function approx(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(demoUrl, { waitUntil: "networkidle", timeout: 120000 });

  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll(".ltf-masonry-tile__img.is-a");
    return imgs.length >= 8 && Array.from(imgs).every((i) => i.complete && i.naturalWidth > 0);
  }, { timeout: 120000 });

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
      srcEmpty: !v.getAttribute("src"),
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

  await page.evaluate(() => {
    const v = document.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) {
      v.scrollIntoView({ block: "center" });
    }
  });
  await page.waitForTimeout(2500);

  const videoPlaying = await page.evaluate(() => {
    const v = document.querySelector("video.ltf-masonry-tile__video.is-a");
    return v && !v.paused && v.currentTime > 0;
  });
  if (!videoPlaying) errors.push("Video did not start playing in viewport");

  for (const { name, w, h } of widths) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);

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

    if (metrics.overflowX) errors.push(`${name}: horizontal overflow`);
    if (metrics.stripViolations.length) {
      errors.push(`${name}: skinny strips ${JSON.stringify(metrics.stripViolations)}`);
    }
    if (metrics.ratioViolations.length) {
      errors.push(`${name}: uncropped ratio mismatch ${JSON.stringify(metrics.ratioViolations)}`);
    }

    await page.screenshot({
      path: `${artifactDir}/masonry-${name}.png`,
      fullPage: true,
    });
  }

  await page.screenshot({
    path: `${artifactDir}/masonry-video-frame.png`,
    clip: await page.evaluate(() => {
      const v = document.querySelector("video.ltf-masonry-tile__video.is-a");
      const r = v.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  });

  await browser.close();

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

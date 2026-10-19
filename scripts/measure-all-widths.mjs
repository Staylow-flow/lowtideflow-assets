import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const CSS = readFileSync('/workspace/js-dev/2-0/webflow/instant-quote-embed.css', 'utf8');
const CREW = readFileSync('/workspace/js-dev/2-0/promo/crew20-promo-sandbox.js', 'utf8');

const TABLE_WIDTHS = [
  1440, 1280, 1200, 1100,
  ...(() => {
    const a = [];
    for (let w = 1092; w >= 1008; w -= 20) a.push(w);
    if (!a.includes(1008)) a.push(1008);
    return a;
  })(),
  992,
].filter((w, i, arr) => arr.indexOf(w) === i).sort((a, b) => b - a);

async function waitForEngineReady(page) {
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await page.waitForFunction(
    function () {
      var pre = document.querySelector('.system-preloader');
      if (!pre) return true;
      var s = window.getComputedStyle(pre);
      if (s.display === 'none' || s.visibility === 'hidden') return true;
      if (parseFloat(s.opacity || '1') < 0.05) return true;
      var r = pre.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return true;
      return false;
    },
    { timeout: 90000 },
  );
  await page.waitForFunction(
    function () {
      return !document.documentElement.classList.contains('ltf-system-engine-boot');
    },
    { timeout: 30000 },
  ).catch(function () {});
  await page.waitForFunction(
    function () {
      var t = (document.body.innerText || '').toUpperCase();
      if (t.indexOf('INITIALIZING SYSTEM ENGINE') !== -1) return false;
      var price = document.querySelector('#iq-total-price');
      var calc = document.querySelector('#iq-run-quote');
      return price && calc && price.getBoundingClientRect().height > 20;
    },
    { timeout: 60000 },
  );
  await page.waitForTimeout(400);
}

async function measure(page) {
  return page.evaluate(function () {
    function n(v) { return Math.round(v * 10) / 10; }
    var left = document.querySelector('.iq-total-wrapper');
    var calc = document.querySelector('#iq-run-quote');
    var browse = document.querySelector('.iq-form-upload-btn');
    var hint = document.querySelector('.iq-form-upload-hint');
    var info = document.querySelector('.iq-total-wrapper .iq-artwork-info-link');
    var label = document.querySelector('.iq-total-label');
    var title = document.querySelector('.iq-form-upload-title');
    var price = document.querySelector('#iq-total-price');
    var lr = left.getBoundingClientRect();
    var rr = document.getElementById('iq-form-artwork-drop').getBoundingClientRect();
    var labelBottom = label.getBoundingClientRect().bottom;
    var priceTop = price.getBoundingClientRect().top;
    var crew = document.getElementById('crew20');
    var spots = document.getElementById('c20-spots');
    var crewSpotsOverflow = false;
    if (crew && !crew.hidden && spots && !spots.hidden && left.contains(crew)) {
      var wr = left.getBoundingClientRect();
      var sr = spots.getBoundingClientRect();
      crewSpotsOverflow = sr.bottom > wr.bottom + 0.5;
    }
    var hs = hint && window.getComputedStyle(hint);
    return {
      btnTopDelta: n(browse.getBoundingClientRect().top - calc.getBoundingClientRect().top),
      hintVsOtdTop: n(hint.getBoundingClientRect().top - info.getBoundingClientRect().top),
      titleVsLabel: n(title.getBoundingClientRect().top - label.getBoundingClientRect().top),
      titleVsPriceBottom: n(title.getBoundingClientRect().bottom - price.getBoundingClientRect().bottom),
      boxTopDelta: n(rr.top - lr.top),
      labelPriceOverlap: labelBottom - priceTop > 0.5,
      scrollOverflow: n(document.documentElement.scrollWidth - window.innerWidth),
      crewSpotsOverflow,
      hintVisible: !!(hint && hint.getClientRects().length && hs && hs.display !== 'none' && hs.visibility !== 'hidden'),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const table = { off: {}, crew: {} };

async function runMode(crew) {
  for (const w of TABLE_WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    const url = crew
      ? 'https://www.lowtideflow.co/spec-engine-sandbox?code=CREW20&demo=1'
      : 'https://www.lowtideflow.co/spec-engine-sandbox';
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(function () {
      document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
        if (/instant-quote-embed\.css/i.test(link.getAttribute('href') || '')) link.disabled = true;
      });
      document.querySelectorAll('script').forEach(function (script) {
        var t = script.textContent || '';
        if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1) script.remove();
      });
    });
    await page.addStyleTag({ content: CSS });
    if (crew) {
      await page.addScriptTag({ content: CREW });
      await page.waitForTimeout(800);
      await page.waitForFunction(
        function () {
          var c = document.getElementById('crew20');
          return c && !c.hidden && document.querySelector('.iq-total-wrapper')?.contains(c);
        },
        { timeout: 30000 },
      );
      await page.evaluate(function () { window.__ltfCrew20SyncPanels?.(); });
    }
    await waitForEngineReady(page);
    await page.evaluate(function () {
      var titleEl = document.querySelector('.iq-form-upload-title');
      if (titleEl) titleEl.innerHTML = 'DRAG &amp; DROP<br>ART FILES HERE';
      document.querySelector('.ltf-spec-calc-art')?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(200);
    table[crew ? 'crew' : 'off'][w] = await measure(page);
  }
}

await runMode(false);
await runMode(true);
await browser.close();

writeFileSync('/opt/cursor/artifacts/measurement-table.json', JSON.stringify(table, null, 2));
console.log(JSON.stringify(table, null, 2));

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const CSS_PATH = '/workspace/js-dev/2-0/webflow/instant-quote-embed.css';
const CREW_PATH = '/workspace/js-dev/2-0/promo/crew20-promo-sandbox.js';
const CSS = readFileSync(CSS_PATH, 'utf8');
const CREW_JS = readFileSync(CREW_PATH, 'utf8');

const JS_FILES = [CREW_PATH];
for (const f of JS_FILES) {
  const r = spawnSync('node', ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('node --check failed for', f, r.stderr || r.stdout);
    process.exit(1);
  }
}

const LIVE_WIDTHS = [1440, 1280, 1200, 1100, 1024, 992];
const FINE_WIDTHS = (() => {
  const xs = [];
  for (let w = 1092; w >= 1008; w -= 20) xs.push(w);
  return xs;
})();
const WIDTHS = [...new Set([...LIVE_WIDTHS, ...FINE_WIDTHS, ...(() => {
  const xs = [];
  for (let w = 1440; w >= 992; w -= 40) xs.push(w);
  return xs;
})()])].sort((a, b) => b - a);
const SHOT_WIDTHS = [1440, 1200, 1024];
const APPS_SCRIPT_HOST = 'script.google.com/macros/s/';

async function stripV06AndInjectCss(page) {
  await page.evaluate(function () {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (/instant-quote-embed\.css/i.test(href)) link.disabled = true;
    });
    document.querySelectorAll('script').forEach(function (script) {
      var t = script.textContent || '';
      if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1) script.remove();
    });
  });
  await page.addStyleTag({ content: CSS, id: 'iq-sandbox-css-inject' });
}

async function injectPinnedScript(page) {
  await page.addScriptTag({ content: CREW_JS, id: 'iq-sandbox-crew-inject' });
  await page.waitForTimeout(600);
}

async function prepareIdleTitle(page) {
  await page.evaluate(function () {
    var drop = document.getElementById('iq-form-artwork-drop');
    var titleEl = drop && drop.querySelector('.iq-form-upload-title');
    if (titleEl && window.matchMedia('(min-width: 992px)').matches) {
      titleEl.innerHTML = 'DRAG &amp; DROP<br>ART FILES HERE';
    }
    document.querySelector('.ltf-spec-calc-art')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
}

async function measureLayout(page) {
  return page.evaluate(function () {
    function num(n) {
      return Math.round(n * 10) / 10;
    }
    var calcArt = document.querySelector('.ltf-spec-calc-art');
    var prev = calcArt && calcArt.previousElementSibling;
    var left = document.querySelector('.iq-total-wrapper');
    var right = document.getElementById('iq-form-artwork-drop');
    var label = document.querySelector('.iq-total-label');
    var title = document.querySelector('.iq-form-upload-title');
    var calc = document.querySelector('#iq-run-quote');
    var browse = document.querySelector('label.iq-form-upload-btn, .iq-form-upload-btn');
    var price = document.querySelector('#iq-total-price');
    var hint = document.querySelector('.iq-form-upload-hint');
    var info = document.querySelector('.iq-total-wrapper .iq-artwork-info-link');
    if (!calcArt || !left || !right || !label || !title || !calc || !browse || !hint || !info) {
      return { error: 'missing nodes' };
    }
    var lr = left.getBoundingClientRect();
    var rr = right.getBoundingClientRect();
    var tr = title.getBoundingClientRect();
    var hr = hint.getBoundingClientRect();
    var br = browse.getBoundingClientRect();
    var ir = info.getBoundingClientRect();
    var titleTop = num(tr.top);
    var titleBottom = num(tr.bottom);
    var hintTop = num(hr.top);
    var hintCenterY = num((hr.top + hr.bottom) / 2);
    var infoCenterY = num((ir.top + ir.bottom) / 2);
    var infoTop = num(ir.top);
    var labelBottom = num(label.getBoundingClientRect().bottom);
    var priceTop = num(price.getBoundingClientRect().top);
    var labelPriceOverlap = labelBottom - priceTop > 0.5;
    var scrollOverflow = document.documentElement.scrollWidth - window.innerWidth;
    var crew = document.getElementById('crew20');
    var crewSpots = document.getElementById('c20-spots');
    var crewSpotsOverflow = false;
    if (crew && !crew.hidden && crewSpots && !crewSpots.hidden && left.contains(crew)) {
      var wr = left.getBoundingClientRect();
      var sr = crewSpots.getBoundingClientRect();
      crewSpotsOverflow = sr.bottom > wr.bottom + 0.5 || sr.right > wr.right + 0.5 || sr.left < wr.left - 0.5;
    }
    var hintStyle = hint && window.getComputedStyle(hint);
    var hintVisible =
      hint &&
      hint.getClientRects().length > 0 &&
      hintStyle &&
      hintStyle.visibility !== 'hidden' &&
      hintStyle.display !== 'none' &&
      parseFloat(hintStyle.opacity || '1') > 0.05 &&
      hr.height > 2;
    var browseTop = num(br.top);
    var browseBottom = num(br.bottom);
    var calcTop = num(calc.getBoundingClientRect().top);
    var labelTop = num(label.getBoundingClientRect().top);
    var priceBottom = num(price.getBoundingClientRect().bottom);
    var calcW = num(calc.getBoundingClientRect().width);
    var browseW = num(browse.getBoundingClientRect().width);
    var dropCx = num((rr.left + rr.right) / 2);
    var titleCx = num((tr.left + tr.right) / 2);
    var hintCx = num((hr.left + hr.right) / 2);
    var browseCx = num((br.left + br.right) / 2);
    return {
      rowTop: num(calcArt.getBoundingClientRect().top),
      prevGap: prev ? num(calcArt.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) : null,
      leftH: left.offsetHeight,
      rightH: right.offsetHeight,
      calcTop,
      labelTop,
      priceTop: num(price.getBoundingClientRect().top),
      boxTopDelta: num(rr.top - lr.top),
      boxBottomDelta: num(rr.bottom - lr.bottom),
      titleTop,
      titleBottom,
      hintTop,
      hintCenterY,
      infoCenterY,
      browseTop,
      browseBottom,
      titleVsLabel: num(titleTop - labelTop),
      titleVsPriceBottom: num(titleBottom - priceBottom),
      hintVsInfoCenter: num(hintCenterY - infoCenterY),
      hintVsOtdTop: num(hintTop - infoTop),
      labelPriceOverlap,
      scrollOverflow: num(scrollOverflow),
      crewSpotsOverflow,
      hintVisible,
      hintBelowBrowse: num(hr.top - br.bottom),
      titleCenterDelta: num(titleCx - dropCx),
      hintCenterDelta: num(hintCx - dropCx),
      browseCenterDelta: num(browseCx - dropCx),
      browseVsCalc: num(browseTop - calcTop),
      browseW,
      calcW,
      browseVsCalcW: num(browseW - calcW),
      labelTitleDelta: num(titleTop - labelTop),
      btnTopDelta: num(browseTop - calcTop),
      btnWidthDelta: num(browseW - calcW),
      crewInsideLeft: !!left.querySelector('#crew20'),
      receiptSiblingCrew: !!document.querySelector('.iq-receipt-right > #crew20'),
    };
  });
}

function innerPanelTable(map, label) {
  const rows = LIVE_WIDTHS.map(function (w) {
    const m = map[w];
    if (!m || m.error) return { w, error: m && m.error };
    return {
      w,
      titleVsLabel: m.titleVsLabel,
      titleVsPriceBottom: m.titleVsPriceBottom,
      hintVsInfoCenter: m.hintVsInfoCenter,
      hintBelowBrowse: m.hintBelowBrowse,
      browseVsCalc: m.browseVsCalc,
      browseVsCalcW: m.browseVsCalcW,
    };
  });
  return { label, rows };
}

function assertTolerance(map, fields, prefix) {
  const fails = [];
  for (const [k, v] of Object.entries(map)) {
    if (v.error) {
      fails.push({ key: prefix + k, field: 'error', val: v.error });
      continue;
    }
    for (const field of fields) {
      const val = v[field];
      if (val == null || Math.abs(val) > 1) fails.push({ key: prefix + k, field, val });
    }
  }
  return fails;
}

function liveDeltaTable(live, neu) {
  const table = {};
  for (const w of LIVE_WIDTHS) {
    const a = live[w];
    const b = neu[w];
    table[w] = {
      rowTop: Math.round((b.rowTop - a.rowTop) * 10) / 10,
      prevGap: Math.round((b.prevGap - a.prevGap) * 10) / 10,
      leftH: b.leftH - a.leftH,
      rightH: b.rightH - a.rightH,
      calcTop: Math.round((b.calcTop - a.calcTop) * 10) / 10,
      labelTop: Math.round((b.labelTop - a.labelTop) * 10) / 10,
      priceTop: Math.round((b.priceTop - a.priceTop) * 10) / 10,
    };
  }
  return table;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.addInitScript(function () {
  new MutationObserver(function () {
    document.querySelectorAll('script').forEach(function (script) {
      var t = script.textContent || '';
      if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1 && !script.id) {
        script.setAttribute('data-iq-removed-crew-v06', '1');
        script.textContent = '';
      }
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
});

const report = {
  live: {},
  off: {},
  crew20: {},
  liveVsNewNoCode: {},
  runtime: {},
  fails: [],
};

for (const w of LIVE_WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://www.lowtideflow.co/spec-engine', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await prepareIdleTitle(page);
  report.live[w] = await measureLayout(page);
}

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://www.lowtideflow.co/spec-engine-sandbox', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await stripV06AndInjectCss(page);
  await prepareIdleTitle(page);
  report.off[w] = await measureLayout(page);
  if (SHOT_WIDTHS.includes(w)) {
    await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-new-off-${w}.png` });
  }
}

report.liveVsNewNoCode = liveDeltaTable(report.live, report.off);

for (const w of LIVE_WIDTHS) {
  const d = report.liveVsNewNoCode[w];
  for (const [field, val] of Object.entries(d)) {
    if (Math.abs(val) > 1) {
      report.fails.push({ key: 'liveVsNew_' + w, field, val });
    }
  }
}

let checkFetchCount = 0;
await page.route('**/*', function (route) {
  const url = route.request().url();
  if (url.includes(APPS_SCRIPT_HOST) && url.includes('action=check')) {
    checkFetchCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        code: 'CREW20',
        active: true,
        open: true,
        pct: 20,
        limit: 10,
        claimed: 1,
        preview: true,
      }),
    });
  }
  return route.continue();
});

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`https://www.lowtideflow.co/spec-engine-sandbox?code=CREW20&demo=1`, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await stripV06AndInjectCss(page);
  checkFetchCount = 0;
  const checkPromise = page.waitForRequest(
    (req) => req.url().includes(APPS_SCRIPT_HOST) && req.url().includes('action=check'),
    { timeout: 15000 },
  ).then(() => {
    checkFetchCount += 1;
  }).catch(() => {});
  await injectPinnedScript(page);
  await checkPromise;
  await page.waitForFunction(
    function () {
      var c = document.getElementById('crew20');
      return c && !c.hidden && document.querySelector('.iq-total-wrapper')?.contains(c);
    },
    { timeout: 30000 },
  );
  if (typeof (await page.evaluate(() => window.__ltfCrew20SyncPanels)) === 'function') {
    await page.evaluate(() => window.__ltfCrew20SyncPanels());
  }
  await prepareIdleTitle(page);
  report.crew20[w] = await measureLayout(page);
  if (w === 1440) {
    report.runtime.crewInsideWrapper = report.crew20[w].crewInsideLeft;
    report.runtime.checkFetchCountAfterInject = checkFetchCount;
    if (!report.crew20[w].crewInsideLeft) {
      report.fails.push({ key: 'runtime', field: 'crewInsideWrapper', val: false });
    }
    if (checkFetchCount < 1) {
      report.fails.push({ key: 'runtime', field: 'checkFetchCount', val: checkFetchCount });
    }
  }
  if (SHOT_WIDTHS.includes(w)) {
    await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-new-crew20-${w}.png` });
  }
}

const INNER_ASSERT_FIELDS = [
  'boxTopDelta',
  'boxBottomDelta',
  'labelTitleDelta',
  'titleVsPriceBottom',
  'btnTopDelta',
  'btnWidthDelta',
  'hintVsOtdTop',
  'titleCenterDelta',
  'hintCenterDelta',
  'browseCenterDelta',
];

function assertLayoutHealth(m, keyPrefix, fails) {
  if (!m || m.error) return;
  if (m.labelPriceOverlap) {
    fails.push({ key: keyPrefix, field: 'labelPriceOverlap', val: true });
  }
  if (m.scrollOverflow != null && m.scrollOverflow > 1) {
    fails.push({ key: keyPrefix, field: 'scrollOverflow', val: m.scrollOverflow });
  }
  if (m.crewSpotsOverflow) {
    fails.push({ key: keyPrefix, field: 'crewSpotsOverflow', val: true });
  }
  if (m.hintVisible === false) {
    fails.push({ key: keyPrefix, field: 'hintVisible', val: false });
  }
}

for (const w of WIDTHS) {
  const m = report.off[w];
  if (!m || m.error) continue;
  for (const field of INNER_ASSERT_FIELDS) {
    const val = m[field];
    if (val == null || Math.abs(val) > 1) {
      report.fails.push({ key: 'off_' + w, field, val });
    }
  }
  if (m.hintBelowBrowse != null && m.hintBelowBrowse < 0) {
    report.fails.push({ key: 'off_' + w, field: 'hintBelowBrowse', val: m.hintBelowBrowse });
  }
  assertLayoutHealth(m, 'off_' + w, report.fails);
}

for (const w of WIDTHS) {
  const m = report.crew20[w];
  if (!m || m.error) continue;
  for (const field of INNER_ASSERT_FIELDS) {
    const val = m[field];
    if (val == null || Math.abs(val) > 1) {
      report.fails.push({ key: 'crew20_' + w, field, val });
    }
  }
  if (m.hintBelowBrowse != null && m.hintBelowBrowse < 0) {
    report.fails.push({ key: 'crew20_' + w, field: 'hintBelowBrowse', val: m.hintBelowBrowse });
  }
  assertLayoutHealth(m, 'crew20_' + w, report.fails);
}

report.innerPanelOff = innerPanelTable(report.off, 'no-code');
report.innerPanelCrew20 = innerPanelTable(report.crew20, 'CREW20');

for (const w of SHOT_WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://www.lowtideflow.co/spec-engine', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await prepareIdleTitle(page);
  await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-live-off-${w}.png` });
}

await browser.close();
writeFileSync('/opt/cursor/artifacts/sandbox-inject-report.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      liveVsNewNoCode: report.liveVsNewNoCode,
      innerPanelOff: report.innerPanelOff,
      innerPanelCrew20: report.innerPanelCrew20,
      runtime: report.runtime,
      failCount: report.fails.length,
      fails: report.fails.slice(0, 24),
    },
    null,
    2,
  ),
);
if (report.fails.length) process.exit(2);

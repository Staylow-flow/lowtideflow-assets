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

const WIDTHS = [];
for (let w = 1440; w >= 992; w -= 40) WIDTHS.push(w);
const SHOT_WIDTHS = [1440, 1200, 1024];

async function stripAndInject(page, withCrewScript) {
  await page.evaluate(function () {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (/instant-quote-embed\.css/i.test(href)) link.disabled = true;
    });
    document.querySelectorAll('script').forEach(function (script) {
      var t = script.textContent || '';
      if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1) script.remove();
    });
    if (window.__iqCrew20Injected) return;
    window.__iqCrew20Injected = true;
  });
  await page.addStyleTag({ content: CSS, id: 'iq-sandbox-css-inject' });
  if (withCrewScript) {
    await page.addScriptTag({ content: CREW_JS, id: 'iq-sandbox-crew-inject' });
    await page.waitForTimeout(400);
  }
  await page.evaluate(function () {
    var cr = document.getElementById('crew20');
    var tw = document.querySelector('.iq-total-wrapper');
    if (cr && tw && !tw.contains(cr)) {
      var otd = tw.querySelector('.iq-artwork-info-link');
      if (otd) otd.insertAdjacentElement('afterend', cr);
      else tw.appendChild(cr);
    }
    var drop = document.getElementById('iq-form-artwork-drop');
    var titleEl = drop && drop.querySelector('.iq-form-upload-title');
    if (titleEl && window.matchMedia('(min-width: 992px)').matches) {
      titleEl.innerHTML = 'DRAG &amp; DROP<br>ART FILES HERE';
    }
    document.querySelector('.ltf-spec-calc-art')?.scrollIntoView({ block: 'center' });
    if (typeof window.__ltfCrew20SyncPanels === 'function') window.__ltfCrew20SyncPanels();
  });
  await page.waitForTimeout(500);
}

async function measure(page) {
  return page.evaluate(function () {
    function num(n) {
      return Math.round(n * 10) / 10;
    }
    var left = document.querySelector('.iq-total-wrapper');
    var right = document.getElementById('iq-form-artwork-drop');
    var label = document.querySelector('.iq-total-label');
    var title = document.querySelector('.iq-form-upload-title');
    var calc = document.querySelector('#iq-run-quote');
    var browse = document.querySelector('label.iq-form-upload-btn, .iq-form-upload-btn');
    if (!left || !right || !label || !title || !calc || !browse) return { error: 'missing nodes' };
    var lr = left.getBoundingClientRect();
    var rr = right.getBoundingClientRect();
    return {
      boxTopDelta: num(rr.top - lr.top),
      boxBottomDelta: num(rr.bottom - lr.bottom),
      labelTitleDelta: num(title.getBoundingClientRect().top - label.getBoundingClientRect().top),
      btnTopDelta: num(browse.getBoundingClientRect().top - calc.getBoundingClientRect().top),
      btnWidthDelta: num(browse.getBoundingClientRect().width - calc.getBoundingClientRect().width),
      crewInsideLeft: !!left.querySelector('#crew20'),
      receiptSiblingCrew: !!document.querySelector('.iq-receipt-right > #crew20'),
    };
  });
}

function assertTolerance(report, key) {
  const fails = [];
  for (const [k, v] of Object.entries(report)) {
    for (const field of key) {
      const val = v[field];
      if (val == null || Math.abs(val) > 1) fails.push({ key: k, field, val });
    }
  }
  return fails;
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

const report = { off: {}, crew20: {}, liveCompare: {}, fails: [] };

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://www.lowtideflow.co/spec-engine-sandbox', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await stripAndInject(page, false);
  report.off[w] = await measure(page);
  if (SHOT_WIDTHS.includes(w)) {
    await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-new-off-${w}.png` });
  }
}

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`https://www.lowtideflow.co/spec-engine-sandbox?code=CREW20&demo=1`, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await page.waitForFunction(function () {
    var c = document.getElementById('crew20');
    return c && !c.hidden;
  }, { timeout: 30000 }).catch(function () {});
  await stripAndInject(page, true);
  report.crew20[w] = await measure(page);
  if (SHOT_WIDTHS.includes(w)) {
    await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-new-crew20-${w}.png` });
  }
}

for (const w of SHOT_WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('https://www.lowtideflow.co/spec-engine', { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('.ltf-spec-calc-art', { timeout: 120000 });
  await page.evaluate(function () {
    document.querySelector('.ltf-spec-calc-art')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/opt/cursor/artifacts/sandbox-live-off-${w}.png` });
  report.liveCompare[w] = await measure(page);
}

function prefixFails(map, prefix) {
  return assertTolerance(map, [
    'boxTopDelta',
    'boxBottomDelta',
    'labelTitleDelta',
    'btnTopDelta',
    'btnWidthDelta',
  ]).map(function (f) {
    return { key: prefix + f.key, field: f.field, val: f.val };
  });
}

report.fails = [...prefixFails(report.off, 'off_'), ...prefixFails(report.crew20, 'crew20_')];

await browser.close();
writeFileSync('/opt/cursor/artifacts/sandbox-inject-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ failCount: report.fails.length, fails: report.fails.slice(0, 20) }, null, 2));
if (report.fails.length) process.exit(2);

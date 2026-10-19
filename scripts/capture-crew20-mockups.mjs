/**
 * CREW20 layout mockup screenshots (Option A or B).
 * Usage: OPTION=a|b node scripts/capture-crew20-mockups.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

const OPTION = (process.env.OPTION || 'a').toLowerCase();
if (OPTION !== 'a' && OPTION !== 'b') {
  console.error('OPTION must be a or b');
  process.exit(1);
}

const SB = 'https://www.lowtideflow.co/spec-engine-sandbox';
const OUT = `/opt/cursor/artifacts/crew20-mockup-option-${OPTION}`;
mkdirSync(OUT, { recursive: true });

const CSS =
  readFileSync('/workspace/js-dev/2-0/webflow/instant-quote-embed.css', 'utf8') +
  '\n' +
  readFileSync(`/workspace/js-dev/2-0/mockups/crew20-option-${OPTION}.mock.css`, 'utf8');

const CREW_JS =
  OPTION === 'b'
    ? readFileSync('/workspace/js-dev/2-0/mockups/crew20-promo-option-b.js', 'utf8')
    : readFileSync('/workspace/js-dev/2-0/promo/crew20-promo-sandbox.js', 'utf8');

async function newPage(browser, w) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.route('**/script.google.com/**', async (route) => {
    const u = route.request().url();
    if (route.request().method() !== 'GET') return route.abort();
    if (u.includes('action=check')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          code: 'CREW20',
          claimed: 0,
          limit: 10,
          remaining: 10,
          active: true,
          open: true,
          pct: 20,
        }),
      });
    }
    return route.continue();
  });
  return page;
}

async function stripV06AndPin(page) {
  await page.evaluate(function () {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      if (/instant-quote-embed\.css/i.test(link.getAttribute('href') || '')) link.disabled = true;
    });
    document.querySelectorAll('script').forEach(function (script) {
      var t = script.textContent || '';
      if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1) script.remove();
    });
  });
  await page.addStyleTag({ content: CSS, id: 'iq-pinned-css-override' });
  await page.addScriptTag({ content: CREW_JS, id: 'iq-pinned-crew-override' });
  await page.waitForTimeout(600);
}

async function loadPinned(page) {
  await page.goto(`${SB}?code=CREW20&demo=1&cb=mock-${OPTION}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(
    () => {
      const spin = document.querySelector('.iq-loader, .iq-loading, [class*="loader"]');
      const price = document.querySelector('#iq-total-price');
      return price && price.textContent && !/INITIALIZING/i.test(price.textContent);
    },
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  await stripV06AndPin(page);
  await page.waitForTimeout(400);
  await page.waitForFunction(
    () => {
      const c = document.getElementById('crew20');
      return c && !c.hidden;
    },
    { timeout: 30000 },
  );
  await page.evaluate(() => window.__ltfCrew20SyncPanels?.());
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });
const page = await newPage(browser, 1440);
await loadPinned(page);

for (const w of [1440, 1024]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ltfCrew20SyncPanels?.());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.ltf-spec-calc-art')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const path = `${OUT}/option-${OPTION}-${w}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
}

await browser.close();

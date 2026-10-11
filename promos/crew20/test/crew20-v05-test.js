// CREW20 v05: unit + total discount display on live sandbox (inject v05 embed).
const { chromium } = require('../node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const V = '10-07-26-05';
const ART = '/opt/cursor/artifacts';
const BASE = 'https://www.lowtideflow.co/spec-engine-sandbox';
const inner = fs.readFileSync(path.join(__dirname, '../crew20-promo-sandbox-EMBED-' + V + '.html'), 'utf8')
  .split('<script>\n')[1].split('\n</script>')[0];

const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext();
  await ctx.route(/lowtideflow\.co\/spec-engine-sandbox/, async (route) => {
    const r = await route.fetch();
    let html = await r.text();
    const a = html.indexOf('<!-- CREW20 promo');
    if (a >= 0) { const z = html.indexOf('</script>', a) + 9; html = html.slice(0, a) + html.slice(z); }
    const i = html.lastIndexOf('</body>');
    html = html.slice(0, i) + '<script>\n' + inner + '\n</script>' + html.slice(i);
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  await ctx.route(/script\.google(usercontent)?\.com/, (route) => route.abort());

  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  const setQty = async (q) => {
    await page.evaluate((qty) => {
      const s = document.getElementById('iq-slider-final-quantity');
      s.value = String(qty);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }, q);
    await page.click('#iq-run-quote');
    await page.waitForTimeout(2600);
  };

  const readPrices = () => page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const parse = (el) => parseFloat((el && el.textContent || '').replace(/[^0-9.-]/g, '')) || 0;
    const t = $('iq-total-price'), u = $('iq-price-unit-1');
    const nu = $('c20-new-unit'), nt = $('c20-new');
    const rg = document.createRange();
    let oldU = null, newU = null;
    if (u) {
      rg.selectNodeContents(u);
      oldU = rg.getBoundingClientRect();
      if (nu && nu.firstChild) newU = nu.firstChild.getBoundingClientRect();
    }
    return {
      qty: parseInt(document.getElementById('iq-slider-final-quantity').value, 10),
      unit: parse(u),
      unitNew: parse(nu),
      total: parse(t),
      totalNew: parse(nt),
      unitStruck: u && u.classList.contains('c20-struck'),
      totalStruck: t && t.classList.contains('c20-struck'),
      sideBySide: !!(newU && oldU && newU.x > oldU.right && Math.abs((newU.y + newU.height / 2) - (oldU.y + oldU.height / 2)) <= 4),
      crewHidden: $('crew20') ? $('crew20').hidden : true,
      scrollW: document.documentElement.scrollWidth,
      vw: innerWidth
    };
  });

  const engineAtQty = (qty) => page.evaluate((q) => {
    const st = IQ.getState();
    st.quantity = q;
    const r = IQ.calculateQuote(st, IQ.PRICING_DATA);
    const disc = (v) => Math.round(v * 100) / 100;
    return {
      unit1: r.unit1,
      unitDisc: disc(r.unit1 * 0.8),
      total: disc(r.total),
      totalDisc: disc(r.total * 0.8)
    };
  }, qty);

  // No code: nothing changes
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  let s = await readPrices();
  ok(s.crewHidden && !s.unitStruck, 'no ?code: promo hidden, unit untouched');
  await page.screenshot({ path: path.join(ART, 'crew20-v05-no-code-desktop.png'), fullPage: false });

  // With code
  await page.goto(BASE + '?code=CREW20', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.click('#c20-btn');
  await page.waitForTimeout(800);

  const quantities = [50, 100, 150, 250];
  const table = [];
  for (const q of quantities) {
    await setQty(q);
    const eng = await engineAtQty(q);
    const p = await readPrices();
    const row = {
      qty: q,
      origUnit: eng.unit1,
      discUnit: eng.unitDisc,
      origTotal: eng.total,
      discTotal: eng.totalDisc,
      uiUnit: p.unit,
      uiUnitNew: p.unitNew,
      uiTotal: p.total,
      uiTotalNew: p.totalNew
    };
    table.push(row);
    ok(p.unitStruck && p.totalStruck && p.sideBySide, 'qty ' + q + ': unit struck + new price to the right');
    ok(Math.abs(p.unit - eng.unit1) < 0.02 && Math.abs(p.unitNew - eng.unitDisc) < 0.02, 'qty ' + q + ': unit math');
    ok(Math.abs(p.total - eng.total) < 0.02 && Math.abs(p.totalNew - eng.totalDisc) < 0.02, 'qty ' + q + ': total math');
  }
  console.log('\nQty/price table (engine + UI):');
  console.table(table.map((r) => ({
    qty: r.qty,
    origUnit: r.origUnit.toFixed(2),
    discUnit: r.discUnit.toFixed(2),
    origTotal: r.origTotal.toFixed(2),
    discTotal: r.discTotal.toFixed(2)
  })));

  s = await readPrices();
  ok(s.scrollW <= s.vw, 'desktop no horizontal overflow (' + s.scrollW + ' <= ' + s.vw + ')');
  await page.screenshot({ path: path.join(ART, 'crew20-v05-desktop-1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await setQty(100);
  s = await readPrices();
  ok(s.unitStruck && s.sideBySide && s.scrollW <= s.vw, 'mobile: unit promo layout OK');
  await page.screenshot({ path: path.join(ART, 'crew20-v05-mobile-390.png'), fullPage: false });

  ok(errs.length === 0, 'page errors: ' + JSON.stringify(errs));
  await b.close();
})();

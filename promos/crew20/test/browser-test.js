const { chromium } = require('/workspace/.tools/pw/node_modules/playwright-core');
const fs = require('fs'), load = require('./gasmock');
const PAGE = 'https://www.lowtideflow.co/spec-engine-sandbox?code=CREW10';
const FAKE = 'https://script.google.com/macros/s/TESTPROMO/exec';
const js = fs.readFileSync(__dirname + '/../crew10-promo-sandbox-10-07-26-01.js', 'utf8').replace('PASTE_PROMO_WEB_APP_EXEC_URL_HERE', FAKE);
const g = load(); g.setupPromos();
const posts = [];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  // NEVER let the real quote webhook or any Apps Script get hit
  await ctx.route(/script\.google(usercontent)?\.com/, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.includes('TESTPROMO')) {
      const p = Object.fromEntries(u.searchParams);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: g.doGet({ parameter: p }).t });
    }
    if (route.request().method() === 'POST') posts.push(JSON.parse(route.request().postData()));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"jobId":"LTF-TEST"}' });
  });
  await ctx.route(/lowtideflow\.co\/spec-engine-sandbox/, async (route) => {
    const r = await route.fetch(); let html = await r.text();
    const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + '<script>\n' + js + '\n</script>' + html.slice(i);
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const run = async (label) => {
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    return page.evaluate(() => ({ hidden: document.getElementById('crew10') && document.getElementById('crew10').hidden, badge: (document.getElementById('c10-badge')||{}).textContent, code: (document.getElementById('c10-code')||{}).value, msg: (document.getElementById('c10-msg')||{}).textContent }));
  };
  console.log('load1', await run());
  await page.click('#iq-run-quote'); await page.waitForTimeout(900);
  await page.click('#c10-btn'); await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({ total: document.getElementById('iq-total-price').textContent, struck: document.getElementById('iq-total-price').className, np: document.getElementById('c10-new').textContent, msg: document.getElementById('c10-msg').textContent, btn: document.getElementById('c10-btn').textContent }));
  console.log('after claim click', st);
  const box = await page.$('.iq-total-wrapper'); await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: __dirname + '/shot-applied.png' });
  // recalculation: change qty and Calculate again
  await page.evaluate(() => { const s = document.getElementById('iq-slider-final-quantity'); s.value = 250; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#iq-run-quote'); await page.waitForTimeout(900);
  await page.waitForTimeout(600); const rr = await page.$('.iq-receipt-right'); await rr.scrollIntoViewIfNeeded(); await rr.screenshot({ path: __dirname + '/shot-applied.png' });
  for (const w of [820, 390]) { await page.setViewportSize({ width: w, height: 1000 }); await page.waitForTimeout(400); const e = await page.$('.iq-receipt-right'); await e.scrollIntoViewIfNeeded(); await e.screenshot({ path: __dirname + '/shot-applied-' + w + '.png' }); }
  await page.setViewportSize({ width: 1400, height: 1000 });
  console.log('after recalc', await page.evaluate(() => [document.getElementById('iq-total-price').textContent, document.getElementById('c10-new').textContent]));
  const submit = async (email) => {
    await page.fill('#iq-form-full-name', 'Test Person'); await page.fill('#iq-form-email', email);
    await page.fill('#iq-form-phone', '4242476007'); await page.fill('#iq-form-company', 'Test Co');
    await page.click('#iq-form-submit'); await page.waitForTimeout(2500);
  };
  await submit('Nate+test1@example.com');
  const last = posts[posts.length - 1] || {};
  console.log('POST promo fields', { promo_code: last.promo_code, promo_discount_pct: last.promo_discount_pct, promo_base_total: last.promo_base_total, promo_price: last.promo_price, quoted_estimate: last.quoted_estimate, total_estimate: last.total_estimate, notes: last.project_notes, email: last.email });
  console.log('hidden inputs', await page.evaluate(() => [...document.querySelectorAll('#iq-order-form input[name^=promo_]')].map(i => i.name + '=' + i.value)));
  console.log('claims log', g.ss.s.Promo_Claims.d.slice(1));
  // same email again on a fresh load
  console.log('load2', await run());
  await page.evaluate(() => { const s = document.getElementById('iq-slider-final-quantity'); s.value = 100; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#iq-run-quote'); await page.waitForTimeout(700); await page.click('#c10-btn'); await page.waitForTimeout(700);
  await submit('nate+TEST1@example.com');
  const l2 = posts[posts.length - 1];
  console.log('dup POST', { promo_code: l2.promo_code, notes: l2.project_notes, quoted_estimate: l2.quoted_estimate }, 'msg:', await page.evaluate(() => document.getElementById('c10-msg').textContent));
  // fill to 10 and check 11th / full state
  for (let i = 2; i <= 10; i++) g.doGet({ parameter: { action: 'claim', code: 'CREW10', email: 'x' + i + '@ex.com', quote: 't' } });
  console.log('load full', await run());
  await (await page.$('.iq-receipt-right')).screenshot({ path: __dirname + '/shot-full.png' });
  console.log('11th via API', JSON.parse(g.doGet({ parameter: { action: 'claim', code: 'CREW10', email: 'eleven@ex.com' } }).t).reason);
  g.ss.s.Promos.d[1][3] = false;
  console.log('load inactive', await run());
  g.ss.s.Promos.d[1][3] = true;
  console.log('no ?code', await (async () => { await page.goto(PAGE.split('?')[0]); await page.waitForTimeout(3000); return page.evaluate(() => !!document.getElementById('crew10')); })());
  console.log('page errors', errs);
  await b.close();
})();

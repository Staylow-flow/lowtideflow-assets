const { chromium } = require('/workspace/.tools/pw/node_modules/playwright-core');
const fs = require('fs');
const js = fs.readFileSync(__dirname + '/../crew10-promo-sandbox-10-07-26-02.js', 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  let gcalls = 0;
  await ctx.route(/script\.google(usercontent)?\.com/, r => { gcalls++; r.abort(); });
  await ctx.route(/lowtideflow\.co\/spec-engine-sandbox/, async (route) => {
    const r = await route.fetch(); let html = await r.text();
    const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + '<script>\n' + js + '\n</script>' + html.slice(i);
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://www.lowtideflow.co/spec-engine-sandbox?code=CREW10', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const s = document.getElementById('iq-slider-final-quantity'); s.value = 100; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#iq-run-quote'); await page.waitForTimeout(2500);
  await page.click('#c10-btn'); await page.waitForTimeout(1500);
  console.log(await page.evaluate(() => ({ hidden: document.getElementById('crew10').hidden, badge: document.getElementById('c10-badge').textContent, total: document.getElementById('iq-total-price').textContent, np: document.getElementById('c10-new').textContent, btn: document.getElementById('c10-btn').textContent })));
  await page.waitForTimeout(600); const rr = await page.$('.iq-receipt-right'); await rr.scrollIntoViewIfNeeded(); await rr.screenshot({ path: __dirname + '/shot-preview.png' });
  console.log('googleCalls', gcalls, 'errors', errs);
  await b.close();
})();

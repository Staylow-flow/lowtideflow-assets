const { chromium } = require('/workspace/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const V = process.argv[2] || '10-07-26-05';
const inner = fs.readFileSync(path.join(__dirname, '../crew20-promo-sandbox-EMBED-' + V + '.html'), 'utf8')
  .split('<script>\n')[1].split('\n</script>')[0];

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext();
  await ctx.route(/script\.google/, (r) => r.abort());
  await ctx.route(/spec-engine-sandbox/, async (route) => {
    let html = await (await route.fetch()).text();
    const a = html.indexOf('<!-- CREW20 promo');
    if (a >= 0) html = html.slice(0, a) + html.slice(html.indexOf('</script>', a) + 9);
    const i = html.lastIndexOf('</body>');
    html = html.slice(0, i) + '<script>\n' + inner + '\n</script>' + html.slice(i);
    route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  const page = await ctx.newPage();
  await page.goto('https://www.lowtideflow.co/spec-engine-sandbox?code=CREW20', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.waitForSelector('#c20-btn', { timeout: 20000 });
  await page.click('#c20-btn');
  await page.waitForTimeout(1200);
  for (const vw of [390, 1024, 1440]) {
    await page.setViewportSize({ width: vw, height: 900 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const s = document.getElementById('iq-slider-final-quantity');
      s.value = '100';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('#iq-run-quote');
    await page.waitForTimeout(2600);
    const m = await page.evaluate(() => {
      const u = document.getElementById('iq-price-unit-1');
      const nu = document.getElementById('c20-new-unit');
      const rg = document.createRange();
      rg.selectNodeContents(u);
      const old = rg.getBoundingClientRect();
      const neu = nu.firstChild.getBoundingClientRect();
      const ucard = document.getElementById('iq-unit-cost-1');
      return {
        vw: innerWidth,
        gapPx: Math.round((neu.x - old.right) * 10) / 10,
        oldRight: Math.round(old.right),
        newX: Math.round(neu.x),
        fontPx: parseFloat(getComputedStyle(u).fontSize),
        boxW: u.offsetWidth,
        cardW: ucard ? ucard.offsetWidth : 0,
        overflow: ucard ? ucard.scrollWidth > ucard.clientWidth : false
      };
    });
    console.log(V, m);
  }
  await b.close();
})();

const { chromium } = require('/workspace/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const V = '10-07-26-06';
const ART = '/opt/cursor/artifacts';
const inner = fs.readFileSync(path.join(__dirname, '../crew20-promo-sandbox-EMBED-' + V + '.html'), 'utf8')
  .split('<script>\n')[1].split('\n</script>')[0];

(async () => {
  fs.mkdirSync(ART, { recursive: true });
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
  const gap = () => page.evaluate(() => {
    const u = document.getElementById('iq-price-unit-1');
    const nu = document.getElementById('c20-new-unit');
    const rg = document.createRange();
    rg.selectNodeContents(u);
    const old = rg.getBoundingClientRect();
    const neu = nu.firstChild.getBoundingClientRect();
    const card = document.getElementById('iq-unit-cost-1');
    const cr = card.getBoundingClientRect();
    return {
      gap: Math.round((neu.x - old.right) * 10) / 10,
      over: neu.right > cr.right + 0.5,
      pad: getComputedStyle(nu).paddingLeft,
      fs: u.style.fontSize
    };
  });

  for (const vw of [1440, 1024, 390]) {
    await page.setViewportSize({ width: vw, height: 900 });
    await page.goto('https://www.lowtideflow.co/spec-engine-sandbox?code=CREW20', { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    await page.click('#c20-btn');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const s = document.getElementById('iq-slider-final-quantity');
      s.value = '100';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('#iq-run-quote');
    await page.waitForTimeout(2600);
    const g = await gap();
    console.log('vw', vw, g);
    const box = await page.$('#iq-unit-cost-1');
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const clip = await box.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const pad = 10;
      return {
        x: Math.max(0, r.x - pad),
        y: Math.max(0, r.y - pad),
        width: r.width + pad * 2,
        height: r.height + pad * 2
      };
    });
    await page.screenshot({ path: path.join(ART, 'crew20-v06-unit-box-' + vw + '.png'), clip });
  }
  await b.close();
})();

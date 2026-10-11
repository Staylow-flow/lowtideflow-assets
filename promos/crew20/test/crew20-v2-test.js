// CREW20 v02 headless test: injects the real EMBED into the live sandbox page. script.google routes blocked (preview) or mocked.
const { chromium } = require('/workspace/.tools/pw/node_modules/playwright-core');
const fs = require('fs'), load = require('./gasmock');
const V = process.env.V || '10-07-26-02';
const BASE = 'https://www.lowtideflow.co/spec-engine-sandbox';
const FAKE = 'https://script.google.com/macros/s/TESTPROMO/exec';
const inner = fs.readFileSync(__dirname + '/../crew20-promo-sandbox-EMBED-' + V + '.html', 'utf8').split('<script>\n')[1].split('\n</script>')[0];
let g, posts = [], gcalls = 0, mode = 'preview', stripped = '';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route(/script\.google(usercontent)?\.com/, async (route) => {
    gcalls++;
    if (mode === 'preview') return route.abort();
    const u = new URL(route.request().url());
    if (u.pathname.includes('TESTPROMO'))
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: g.doGet({ parameter: Object.fromEntries(u.searchParams) }).t });
    if (route.request().method() === 'POST') posts.push(JSON.parse(route.request().postData()));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"jobId":"LTF-TEST"}' });
  });
  await ctx.route(/lowtideflow\.co\/spec-engine-sandbox/, async (route) => {
    const r = await route.fetch(); let html = await r.text();
    // the live page already carries the published v01 embed: strip it, as Nate will replace it with v02
    const a = html.indexOf('<!-- CREW20 promo'); if (a >= 0) { const z = html.indexOf('</script>', a) + 9; stripped = html.slice(a, a + 40); html = html.slice(0, a) + html.slice(z); }
    const js = mode === 'preview' ? inner : inner.replace('PASTE_PROMO_WEB_APP_EXEC_URL_HERE', FAKE);
    const i = html.lastIndexOf('</body>'); html = html.slice(0, i) + '<script>\n' + js + '\n</script>' + html.slice(i);
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  const go = async (q) => { await page.goto(BASE + q, { waitUntil: 'load' }); await page.waitForTimeout(3500); };
  const state = () => page.evaluate(() => {
    const $ = id => document.getElementById(id), R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2) }; };
    const t = $('iq-total-price'), card = document.querySelector('.iq-total-wrapper'), np = $('c20-new');
    const three = $('c20-three') ? [...$('c20-three').children].filter(e => !e.hidden).map(R) : [];
    // text box of the struck price (range around its text node)
    const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect();
    const sp = np && np.firstChild ? np.firstChild.getBoundingClientRect() : null;
    return { hidden: $('crew20') ? $('crew20').hidden : null, left: ($('c20-left') || {}).textContent, sq: $('c20-sq') ? $('c20-sq').children.length : 0,
      x: $('c20-sq') ? $('c20-sq').querySelectorAll('.c20-x').length : 0, badge: ($('c20-badge') || {}).textContent, btn: ($('c20-btn') || {}).textContent,
      btnDis: ($('c20-btn') || {}).disabled, msg: ($('c20-msg') || {}).textContent, total: t.textContent, struck: t.classList.contains('c20-struck'),
      np: np ? np.textContent : '', npHidden: np ? np.hidden : null, npColor: np ? getComputedStyle(np).color : '', card: R(card), box: $('crew20') ? R($('crew20')) : null, three,
      oldText: { x: Math.round(tr.x), r: Math.round(tr.right), y: Math.round(tr.y), h: Math.round(tr.height) }, newText: sp ? { x: Math.round(sp.x), r: Math.round(sp.right), y: Math.round(sp.y), h: Math.round(sp.height) } : null,
      fs: t.style.fontSize, msgBox: $('c20-msg') ? R($('c20-msg')) : null, badgeBox: $('c20-badge') && $('c20-badge').textContent ? R($('c20-badge')) : null,
      scrollW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  const qty100 = async () => {
    await page.evaluate(() => { const s = document.getElementById('iq-slider-final-quantity'); s.value = 100; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.click('#iq-run-quote'); await page.waitForTimeout(2600);
  };
  const engine = () => page.evaluate(() => { const q = IQ.calculateQuote(IQ.getState(), IQ.PRICING_DATA), t = Math.round(q.total * 100) / 100; return { total: t, fmtBase: IQ.formatMoney(t), fmtPromo: IQ.formatMoney(Math.round(t * 80) / 100) }; });
  const clip = async () => { const rr = await page.$('.iq-receipt-right'); await rr.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); const r = await rr.boundingBox(); const vw = page.viewportSize().width; return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 16), width: Math.min(vw, r.width + 32), height: r.height + 32 }; };
  const shot = async (name) => { await page.mouse.move(0, 0); await page.screenshot({ path: __dirname + '/' + name, clip: await clip() }); };
  const layout = (s, tag) => {
    const c = s.card.cx;
    ok(s.box.y >= s.card.y + s.card.h - 2 && Math.abs(s.box.cx - c) <= 2, tag + ' promo block under quote box and centered (card cx ' + c + ', block cx ' + s.box.cx + ')');
    const ws = s.three.map(t => t.w + 'x' + t.h);
    ok(s.three.length === 3 && new Set(ws).size === 1, tag + ' three boxes same size ' + ws.join(' '));
    const row = s.three.every(t => t.y === s.three[0].y);
    if (row) { const mid = (s.three[0].x + s.three[2].x + s.three[2].w) / 2; ok(Math.abs(mid - c) <= 2 && Math.abs((s.three[1].x - s.three[0].x - s.three[0].w) - (s.three[2].x - s.three[1].x - s.three[1].w)) <= 1, tag + ' row centered + even gaps'); }
    else ok(s.three.every(t => Math.abs(t.cx - c) <= 2), tag + ' stacked, each centered');
    ok(s.scrollW <= s.vw, tag + ' no horizontal overflow (' + s.scrollW + ' <= ' + s.vw + ')');
  };
  const sideBySide = (s, tag, e) => {
    ok(s.struck && s.total.indexOf(e.fmtBase) >= 0 && s.np === e.fmtPromo && s.npColor === 'rgb(255, 255, 255)', tag + ' old ' + s.total + ' struck/grey, new ' + s.np + ' white');
    ok(s.newText && s.newText.x > s.oldText.r && Math.abs((s.newText.y + s.newText.h / 2) - (s.oldText.y + s.oldText.h / 2)) <= 3 && s.oldText.x >= s.card.x && s.newText.r <= s.card.x + s.card.w,
      tag + ' side by side on one line inside the card: old ' + JSON.stringify(s.oldText) + ' new ' + JSON.stringify(s.newText) + ' font ' + s.fs);
  };

  for (const vw of [1280, 390]) {
    const D = vw === 1280 ? 'desktop' : 'mobile';
    await page.setViewportSize({ width: vw, height: 1000 });
    // PREVIEW
    mode = 'preview'; gcalls = 0;
    await go('?code=CREW20');
    let s = await state();
    ok(!s.hidden && s.left === '10 of 10 left' && s.sq === 10 && s.x === 0 && s.badge === 'PREVIEW - not connected', D + ' preview: 10 of 10 left, no X, preview badge');
    await qty100();
    if (vw === 1280) { const c = await clip(); await page.click('#c20-btn'); await page.waitForTimeout(330); await page.screenshot({ path: __dirname + '/shot-crew20-v2-midanim.png', clip: c }); }
    else await page.click('#c20-btn');
    await page.waitForTimeout(1400);
    s = await state(); let e = await engine();
    sideBySide(s, D + ' preview qty100:', e);
    layout(s, D + ' preview:');
    ok(s.msgBox && Math.abs(s.msgBox.cx - s.card.cx) <= 2 && s.msgBox.y > Math.max(...s.three.map(t => t.y + t.h)) && s.badgeBox && s.badgeBox.y > s.msgBox.y, D + ' msg centered under boxes, badge at the very bottom');
    ok(gcalls === 0, D + ' preview made no script.google calls');
    if (vw === 1280) await shot('shot-crew20-v2-preview.png');
    // PREVIEW + demo=1: visual-only 1 claimed
    await go('?code=CREW20&demo=1'); s = await state();
    ok(s.left === '9 of 10 left' && s.x === 1 && s.badge === 'PREVIEW - demo count', D + ' preview demo=1: 9 of 10 left, 1 X, demo badge');
    await qty100(); await page.click('#c20-btn'); await page.waitForTimeout(1500);
    if (vw === 1280) await shot('shot-crew20-v2-demo.png');
    ok(gcalls === 0, D + ' demo made no script.google calls');
    // total change while applied (re-render): qty 250 then Calculate
    await page.evaluate(() => { const s = document.getElementById('iq-slider-final-quantity'); s.value = 250; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.click('#iq-run-quote'); await page.waitForTimeout(2600);
    s = await state(); e = await engine();
    sideBySide(s, D + ' recalc qty250:', e);
    if (vw === 390) await shot('shot-crew20-v2-mobile-preview.png');

    // MOCK claimed=1
    mode = 'live'; g = load(); g.setupPromos(); posts = [];
    await go('?code=CREW20&demo=1'); s = await state();
    ok(s.left === '10 of 10 left' && s.x === 0, D + ' connected + demo=1 with 0 real claims: demo ignored, 10 of 10 left');
    g.doGet({ parameter: { action: 'claim', code: 'CREW20', email: 'first@ex.com', quote: 't' } });
    await go('?code=crew20'); s = await state();
    ok(!s.hidden && s.left === '9 of 10 left' && s.x === 1 && s.badge === '', D + ' mock claimed=1: 9 of 10 left, 1 X, no badge');
    await qty100(); await page.click('#c20-btn'); await page.waitForTimeout(1500);
    s = await state(); e = await engine();
    sideBySide(s, D + ' mock qty100:', e); layout(s, D + ' mock:');
    await shot(vw === 1280 ? 'shot-crew20-v2-desktop.png' : 'shot-crew20-v2-mobile.png');
    // submit payload
    await page.fill('#iq-form-full-name', 'Test Person'); await page.fill('#iq-form-email', 'nate+v2' + vw + '@example.com');
    await page.fill('#iq-form-phone', '4242476007'); await page.fill('#iq-form-company', 'Test Co');
    await page.click('#iq-form-submit'); await page.waitForTimeout(2500);
    const last = posts[posts.length - 1] || {};
    ok(last.promo_code === 'CREW20' && last.promo_discount_pct === 20 && last.promo_base_total === e.total && last.promo_price === Math.round(e.total * 80) / 100 && last.quoted_estimate === last.promo_price && last.total_estimate === last.promo_price && /^\[PROMO CREW20 -20%: /.test(last.project_notes || ''),
      D + ' submit payload unchanged: ' + JSON.stringify({ c: last.promo_code, p: last.promo_discount_pct, base: last.promo_base_total, price: last.promo_price, q: last.quoted_estimate, t: last.total_estimate, n: (last.project_notes || '').slice(0, 45) }));
    s = await state(); ok(s.left === '8 of 10 left' && s.x === 2, D + ' after real claim -> ' + s.left);
    // MOCK full
    for (let i = 3; i <= 10; i++) g.doGet({ parameter: { action: 'claim', code: 'CREW20', email: 'f' + i + '@ex.com', quote: 't' } });
    await go('?code=CREW20'); await qty100(); s = await state();
    ok(s.left === 'All 10 claimed' && s.x === 10 && s.btnDis && !s.struck && s.npHidden !== false && s.fs === '', D + ' mock full: All 10 claimed, 10 X, button disabled, no discount, engine price untouched (' + s.total + ')');
    await shot('shot-crew20-v2-full-' + D + '.png');
  }
  console.log('stripped live embed:', stripped || 'none');
  ok(errs.length === 0, 'page errors: ' + JSON.stringify(errs));
  await b.close();
})();

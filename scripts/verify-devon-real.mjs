/**
 * Devon-style sandbox verify: no v06 strip, pinned CSS appended last (real cascade order).
 * Measure object matches uploads/v_ea47.py M.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const CSS = readFileSync('/workspace/js-dev/2-0/webflow/instant-quote-embed.css', 'utf8');
const CREW_JS = readFileSync('/workspace/js-dev/2-0/promo/crew20-promo-sandbox.js', 'utf8');
const OUT = '/opt/cursor/artifacts/devon-verify';
mkdirSync(OUT, { recursive: true });

const SB = 'https://www.lowtideflow.co/spec-engine-sandbox';
const M = `(()=>{const g=s=>document.querySelector(s);const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();if(!b.height&&!b.width)return null;return {t:Math.round((b.top+scrollY)*10)/10,b:Math.round((b.bottom+scrollY)*10)/10,l:Math.round(b.left*10)/10,r:Math.round(b.right*10)/10,w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10}};
const tw=g('.iq-total-wrapper');const wr=g('.ltf-spec-calc-art');let p=wr&&wr.previousElementSibling;while(p&&p.getBoundingClientRect().height==0)p=p.previousElementSibling;
let label=null;if(tw){const w=document.createTreeWalker(tw,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(/TOTAL COST/i.test(n.textContent)){label=n.parentElement;break}}}
const drop=g('#iq-form-artwork-drop');const q=s=>drop&&drop.querySelector(s);
let acc=null;if(drop){const w=document.createTreeWalker(drop,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(/Accepted/i.test(n.textContent)&&n.parentElement.offsetParent){acc=n.parentElement;break}}}
const box=R(tw),dr=R(drop),c=g('#crew20');
return {sw:document.documentElement.scrollWidth>document.documentElement.clientWidth,box,drop:dr,wrap:R(wr),panel:R(g('.iq-artwork-panel')),
 above:(p&&box&&dr)?Math.round((Math.min(box.t,dr.t)-R(p).b)*10)/10:null,
 L:{label:R(label),labelCls:label&&label.className,price:R(g('#iq-total-price')),calc:R(g('#iq-run-quote')),otd:R(g('.iq-artwork-info-link'))},
 Rt:{title:R(q('.iq-form-upload-title')),accepted:R(acc),accCls:acc&&acc.className,hint:R(q('.iq-form-upload-hint')),browse:R(q('.iq-form-upload-btn')),inner:R(q('.iq-form-upload-inner'))},
 X:{sq:R(g('#c20-sq')),left:R(g('#c20-left')),three:R(g('#c20-three')),badge:R(g('#c20-badge')),badgeTxt:(g('#c20-badge')||{}).textContent||'',preview:/PREVIEW/i.test(document.body.innerText),previewDom:[...document.querySelectorAll('body *')].filter(e=>e.children.length==0&&/PREVIEW/i.test(e.textContent)).map(e=>[e.id||e.className,e.offsetParent!==null]).slice(0,5)},
 c20:R(c),c20InBox:!!(c&&c.closest('.iq-total-wrapper')),c20vis:[...document.querySelectorAll('#crew20')].filter(e=>e.offsetParent!==null).length,price:(g('#iq-total-price')||{}).innerText}})()`;

const OTD = `(()=>{const tw=document.querySelector('.iq-total-wrapper');const otd=document.querySelector('.iq-total-wrapper .iq-artwork-info-link');const lab=tw&&tw.querySelector('.iq-total-label');if(!tw||!otd||!lab)return null;const br=tw.getBoundingClientRect();const or=otd.getBoundingClientRect();const tr=document.createTreeWalker(otd,NodeFilter.SHOW_TEXT);let n,cx=0,c=0;while(n=tr.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();if(b.width){cx+=b.left+b.width/2;c++}}const boxCx=(br.left+br.right)/2;const otdElemCx=(or.left+or.right)/2;const textCx=c?cx/c:otdElemCx;const borderTop=parseFloat(getComputedStyle(tw).borderTopWidth)||0;return {boxCx:Math.round(boxCx*10)/10,otdElemCx:Math.round(otdElemCx*10)/10,otdTextCx:Math.round(textCx*10)/10,otdTextOffset:Math.round((textCx-boxCx)*10)/10,otdTextL:Math.round(or.left),labelTopInsideBox:Math.round(lab.getBoundingClientRect().top-br.top-borderTop),boxBorderTop:getComputedStyle(tw).borderTopWidth}})()`;

const WIDTHS = [1440, 1280, 1200, 1100, 1024, 992, 768, 390];
const FINE = [];
for (let w = 1092; w >= 1008; w -= 20) FINE.push(w);
if (!FINE.includes(1008)) FINE.push(1008);

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
    document.querySelectorAll('script').forEach(function (script) {
      var t = script.textContent || '';
      if (t.indexOf('CREW20') !== -1 && t.indexOf('c20-btn') !== -1) script.remove();
    });
  });
  await page.addStyleTag({ content: CSS, id: 'iq-pinned-css-override' });
  await page.addScriptTag({ content: CREW_JS, id: 'iq-pinned-crew-override' });
  await page.waitForTimeout(600);
}

async function loadPinned(page, promo) {
  const q = promo ? '?code=CREW20&demo=1&cb=devon' : '?cb=devon';
  await page.goto(SB + q, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(5500);
  await stripV06AndPin(page);
  await page.waitForTimeout(400);
  if (promo) {
    await page.waitForFunction(
      () => {
        const c = document.getElementById('crew20');
        return c && !c.hidden && document.querySelector('.iq-total-wrapper')?.contains(c);
      },
      { timeout: 30000 },
    );
    await page.evaluate(() => window.__ltfCrew20SyncPanels?.());
    await page.waitForTimeout(300);
  }
}

function deltas(base, promo) {
  if (!base?.L?.label || !promo?.L?.label) return null;
  return {
    titleVsLabel: Math.round((promo.Rt.title.t - promo.L.label.t) * 10) / 10,
    browseVsCalc: Math.round((promo.Rt.browse.t - promo.L.calc.t) * 10) / 10,
    accVsOtd: Math.round((promo.Rt.accepted.t - promo.L.otd.t) * 10) / 10,
    labelTopDelta: Math.round((promo.L.label.t - base.L.label.t) * 10) / 10,
  };
}

function offDeltas(m) {
  if (!m?.L?.calc || !m?.Rt?.browse) return null;
  const otdCy = m.L.otd ? (m.L.otd.t + m.L.otd.b) / 2 : null;
  const accCy = m.Rt.accepted ? (m.Rt.accepted.t + m.Rt.accepted.b) / 2 : null;
  return {
    browseVsCalc: Math.round((m.Rt.browse.t - m.L.calc.t) * 10) / 10,
    accVsOtdTop: Math.round((m.Rt.accepted.t - m.L.otd.t) * 10) / 10,
    accVsOtdCenter: otdCy != null && accCy != null ? Math.round((accCy - otdCy) * 10) / 10 : null,
    titleVsLabel: Math.round((m.Rt.title.t - m.L.label.t) * 10) / 10,
  };
}

const browser = await chromium.launch({ headless: true });
const report = { otd: {}, rows: [], sweepOffBrowse: [] };

for (const w of WIDTHS) {
  const pageB = await newPage(browser, w);
  await loadPinned(pageB, false);
  const base = await pageB.evaluate(M);
  const otdB = await pageB.evaluate(OTD);
  await pageB.close();

  const pageP = await newPage(browser, w);
  await loadPinned(pageP, true);
  const promo = await pageP.evaluate(M);
  const otdP = await pageP.evaluate(OTD);
  await pageP.close();

  report.otd[`nocode-${w}`] = otdB;
  report.otd[`code-${w}`] = otdP;
  report.rows.push({
    w,
    off: offDeltas(base),
    code: offDeltas(promo),
    codeVsBase: deltas(base, promo),
    otdOff: otdB?.otdTextOffset,
    otdCode: otdP?.otdTextOffset,
    labelTopOff: otdB?.labelTopInsideBox,
    labelTopCode: otdP?.labelTopInsideBox,
    swOff: base.sw,
    swCode: promo.sw,
    c20InBox: promo.c20InBox,
  });
}

const page = await newPage(browser, 1440);
await loadPinned(page, false);
for (let w = 1440; w >= 1112; w -= 4) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(250);
  const m = await page.evaluate(M);
  const d = offDeltas(m);
  if (d) report.sweepOffBrowse.push({ w, browseVsCalc: d.browseVsCalc });
}
await page.close();
await browser.close();

writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 2));

const fails = [];
for (const r of report.rows) {
  for (const [k, v] of Object.entries(r.off || {})) {
    if (v != null && Math.abs(v) > 1 && k !== 'accVsOtdCenter') fails.push(`off ${r.w} ${k} ${v}`);
    if (k === 'accVsOtdCenter' && v != null && Math.abs(v) > 4.5) fails.push(`off ${r.w} accVsOtdCenter ${v}`);
  }
  for (const [k, v] of Object.entries(r.code || {})) {
    if (v != null && Math.abs(v) > 1) fails.push(`code ${r.w} ${k} ${v}`);
  }
  if (r.otdCode != null && Math.abs(r.otdCode) > 1) fails.push(`code ${r.w} otdTextOffset ${r.otdCode}`);
  if (r.labelTopCode != null && r.labelTopOff != null && Math.abs(r.labelTopCode - r.labelTopOff) > 2) {
    fails.push(`code ${r.w} labelTop ${r.labelTopCode} vs off ${r.labelTopOff}`);
  }
}
for (const s of report.sweepOffBrowse) {
  if (Math.abs(s.browseVsCalc) > 1) fails.push(`sweep off ${s.w} browseVsCalc ${s.browseVsCalc}`);
}

console.log(JSON.stringify({ failCount: fails.length, fails: fails.slice(0, 40), rows: report.rows }, null, 2));
if (fails.length) process.exit(2);

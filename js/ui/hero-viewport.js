/**
 * Clean-Slate footer tag #3 — funnel copy patch only.
 *
 * Shirt + hero CTA layout: Webflow Designer only. No viewport sync, no injected
 * position/size CSS (that locked Designer and caused CTA drift on scroll).
 */

const FUNNEL_LINE1 = 'DIAL YOUR SPECS';
const FUNNEL_LINE2 = 'ON OUR LIVE BUILDER';

function patchFunnelCopy() {
  const el = document.querySelector('.ltf-funnel-cta-threshold');
  if (!el) return;
  if (el.dataset.ltfFunnelCopyPatched === '1') return;
  const normalized = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!normalized.includes('DIAL IN YOUR SPECS') && !normalized.includes('DIAL YOUR SPECS')) {
    return;
  }
  el.dataset.ltfFunnelCopyPatched = '1';
  el.textContent = '';
  el.append(FUNNEL_LINE1, document.createElement('br'), FUNNEL_LINE2);
}

function bind() {
  if (!document.querySelector('.ltf-hero')) return;
  patchFunnelCopy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}
window.addEventListener('load', patchFunnelCopy, { once: true });

window.LTFHeroViewport = { patchFunnelCopy };

/**
 * Clean-Slate — unify non-nav page CTA width to the Beyond the Gear
 * "Command the Horizon" reference (first visible upsell .ltf-section-cta wrap).
 *
 * Sets --ltf-page-cta-width on <html>; styles live in live-page-head.html.
 * Uses ResizeObserver on the reference only — no global resize listener.
 */

const TARGET_SEL =
  '.ltf-hero-bottom-bar .ltf-btn-gradient-wrap,' +
  '.ltf-section-cta .ltf-btn-gradient-wrap,' +
  '.ltf-funnel-cta .ltf-btn-gradient-wrap';

function findReferenceWrap() {
  const upsell = document.querySelector('.ltf-upsell');
  if (!upsell) return null;
  const wraps = upsell.querySelectorAll('.ltf-section-cta .ltf-btn-gradient-wrap');
  for (const el of wraps) {
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8) return el;
  }
  return null;
}

function bindTargets(ref) {
  const w = Math.round(ref.getBoundingClientRect().width);
  if (w < 8) return;
  document.documentElement.style.setProperty('--ltf-page-cta-width', w + 'px');
  document.querySelectorAll(TARGET_SEL).forEach((wrap) => {
    if (wrap.closest('.ltf-nav-actions')) return;
    const btn = wrap.querySelector('.ltf-btn-primary, .ltf-nav-btn, a');
    if (btn) {
      btn.style.width = '100%';
      btn.style.boxSizing = 'border-box';
    }
    wrap.style.width = '';
    wrap.style.maxWidth = '';
    wrap.style.removeProperty('width');
    wrap.style.removeProperty('max-width');
  });
}

export function init() {
  if (!document.querySelector('.ltf-hero')) return;
  if (document.documentElement.dataset.ltfPageCtaWidth === '1') return;
  document.documentElement.dataset.ltfPageCtaWidth = '1';

  let ref = findReferenceWrap();
  if (!ref) return;

  const run = () => {
    ref = findReferenceWrap() || ref;
    if (!ref) return;
    bindTargets(ref);
  };

  run();

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(run);
    ro.observe(ref);
    const upsell = document.querySelector('.ltf-upsell');
    if (upsell) ro.observe(upsell);
  }

  const mq = window.matchMedia('(max-width: 991px)');
  mq.addEventListener('change', () => {
    window.requestAnimationFrame(run);
  });
}

export default init;

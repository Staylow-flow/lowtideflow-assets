/**
 * Clean-Slate — unify non-nav page CTA width (widest natural label wins).
 *
 * Measures each wrap with --ltf-page-cta-width unset + nowrap so
 * "Command the Horizon" stays one line; sets --ltf-page-cta-width on <html>.
 * ResizeObserver on upsell column only — no global resize listener.
 */

const TARGET_SEL =
  '.ltf-hero-bottom-bar .ltf-btn-gradient-wrap,' +
  '.ltf-section-cta .ltf-btn-gradient-wrap,' +
  '.ltf-funnel-cta .ltf-btn-gradient-wrap';

function pageCtaWraps() {
  return Array.from(document.querySelectorAll(TARGET_SEL)).filter(
    (wrap) => !wrap.closest('.ltf-nav-actions')
  );
}

function measureWrapNatural(wrap) {
  const root = document.documentElement;
  root.style.removeProperty('--ltf-page-cta-width');

  const btn = wrap.querySelector('.ltf-btn-primary, .ltf-nav-btn, a');
  const savedBtn = btn
    ? {
        whiteSpace: btn.style.whiteSpace,
        width: btn.style.width,
        textAlign: btn.style.textAlign,
      }
    : null;
  const savedWrap = { width: wrap.style.width, maxWidth: wrap.style.maxWidth };

  wrap.style.width = 'auto';
  wrap.style.maxWidth = 'none';
  if (btn) {
    btn.style.whiteSpace = 'nowrap';
    btn.style.width = 'auto';
    btn.style.textAlign = 'center';
  }

  const w = Math.ceil(wrap.getBoundingClientRect().width);

  wrap.style.width = savedWrap.width;
  wrap.style.maxWidth = savedWrap.maxWidth;
  if (btn && savedBtn) {
    btn.style.whiteSpace = savedBtn.whiteSpace;
    btn.style.width = savedBtn.width;
    btn.style.textAlign = savedBtn.textAlign;
  }

  return w;
}

function applyUnifiedWidth() {
  const wraps = pageCtaWraps();
  if (!wraps.length) return;

  let maxW = 0;
  for (const wrap of wraps) {
    maxW = Math.max(maxW, measureWrapNatural(wrap));
  }
  if (maxW < 8) return;

  document.documentElement.style.setProperty('--ltf-page-cta-width', maxW + 'px');
  for (const wrap of wraps) {
    const btn = wrap.querySelector('.ltf-btn-primary, .ltf-nav-btn, a');
    if (btn) {
      btn.style.width = '100%';
      btn.style.boxSizing = 'border-box';
    }
  }
}

export function init() {
  if (!document.querySelector('.ltf-hero')) return;
  if (document.documentElement.dataset.ltfPageCtaWidth === '1') return;
  document.documentElement.dataset.ltfPageCtaWidth = '1';

  const run = () => {
    applyUnifiedWidth();
  };

  run();

  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(run);
    const upsell = document.querySelector('.ltf-upsell');
    if (upsell) ro.observe(upsell);
    const heroBar = document.querySelector('.ltf-hero-bottom-bar');
    if (heroBar) ro.observe(heroBar);
    const funnel = document.querySelector('.ltf-funnel-cta');
    if (funnel) ro.observe(funnel);
  }

  const mq = window.matchMedia('(max-width: 991px)');
  mq.addEventListener('change', () => {
    window.requestAnimationFrame(run);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run);
  }
  window.addEventListener('load', run, { once: true });
}

export default init;

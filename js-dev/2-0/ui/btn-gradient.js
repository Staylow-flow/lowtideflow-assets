/**
 * Lowtideflow — nebula gradient button, click pulse.
 *
 * Scope note: the hover glow is pure CSS, defined in the site <head> as a
 * ::before layer that cross-fades on opacity. This module only adds the
 * click pulse, by toggling .ltf-btn-gradient-active for 1.4s. If hover
 * styling looks wrong, the fix is in the head CSS, not here.
 *
 * Markup: .ltf-btn-gradient-wrap around .ltf-btn-primary / nav CTA links.
 */

const PULSE_MS = 1400;

export function init() {
  document.querySelectorAll('.ltf-btn-gradient-wrap').forEach((wrap) => {
    if (wrap.dataset.ltfGradientInit) return;
    wrap.dataset.ltfGradientInit = '1';

    wrap.addEventListener('click', () => {
      wrap.classList.add('ltf-btn-gradient-active');
      clearTimeout(wrap._ltfGradientTimer);
      wrap._ltfGradientTimer = setTimeout(() => {
        wrap.classList.remove('ltf-btn-gradient-active');
      }, PULSE_MS);
    });
  });
}

export default init;

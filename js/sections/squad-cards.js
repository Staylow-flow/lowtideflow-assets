/**
 * Lowtideflow — Squad cards scroll-in.
 *
 * Left-column cards start off-canvas to the left, right-column cards to the
 * right. When the grid enters the viewport they ease into place. The bottom
 * pair waits 220ms (see head CSS transition-delay) so the motion reads as
 * two beats instead of one slab arriving.
 */

export function init() {
  const grid = document.querySelector('.ltf-cards-grid');
  if (!grid || grid.dataset.ltfSquadBound === '1') return;
  grid.dataset.ltfSquadBound = '1';

  const reduce =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    grid.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  );

  io.observe(grid);
}

export default init;

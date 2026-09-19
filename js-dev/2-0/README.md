# Dev sandbox assets — rendition 2-0

Exact copies of the live-pinned scripts as of 2026-09-18 for Home Sandbox (/clean-slate) and Spec Engine Sandbox (/spec-engine-sandbox).

## Live pins (do not change for experiments)
- Home footer: `@4749e8b` → `js/hero/rock-scene.js`, `js/ltf.js`, `js/ui/hero-viewport.js`
- Site footer: `@334377c` → `js/nav.js`
- Spec Engine: separate Instant Quote CSS/JS SHAs + registered IQ* scripts

## Naming
- `hero/Boulder-2-0.js` — sandboxed twin of `js/hero/rock-scene.js` (3D hematite boulder)
- `*-2-0.*` — versioned twins for sandbox page freeform only

## Rule
Only sandbox page freeform may point at this folder. Never retarget Live page or site freeform to these paths.

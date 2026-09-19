# Archived JavaScript

Nothing in this folder is loaded by any published page. These are earlier
iterations kept for reference. They are safe to delete once you are confident
you will not want to read them again — full history also lives in git, and the
`hero-threejs-v1` tag captures the tree from before this restructure.

Verified unreferenced on 2026-08-13 by grepping every page snippet in
`webflow/` and the live HTML of `lowtideflow.co/clean-slate`.

| File | What it was | Why it is here |
|------|-------------|----------------|
| `spline-boulder.js` | Spline runtime loader for the boulder | Replaced by the Three.js boulder inside `rock-scene.js`. Dropped ~1.5 MB of runtime. |
| `nebula-scroll-engine.js` | Standalone scroll-driven nebula | Superseded by the FBM shader in `rock-scene.js`. |
| `ltf-nebula-fart.js` | Early nebula burst experiment | Superseded by the FBM shader in `rock-scene.js`. |
| `nebula-slam-gas.js` | Nebula gas for the slam section | Superseded by `nebula/specs-vault-slam.js`. |
| `flow-background.js` | Pre-nebula animated background | Never shipped on the current design. |
| `ltf-btn-wrap.js` | Wrapped buttons in a gradient `<span>` | Obsolete: the gradient is now a `::before` on the button itself. |
| `rock-scene-loader.js` | Shim that imported `rock-scene.js` | Pinned a long-dead commit; the footer imports the module directly. |

## Where the live nebula actually lives

This was a recurring source of confusion, so to be explicit: the nebula you see
on the hero is **not** any file in this folder. It is a single full-screen GLSL
shader (`NEBULA_FRAG`) defined inside `js/rock-scene.js`, drawn on one quad
behind the boulder in the same WebGL context. One canvas, one draw loop.

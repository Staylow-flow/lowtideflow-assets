# LTF Site Nav — Global Component

Component: **`LTF Site Nav`** (group `LTF`) · ID `23f19174-c22b-4e4f-bb47-275e13d3b665`  
Site ID: `6789f449bbb1a21245706751`

Site-wide navigation matching the LowTideFlow tactical navy system. **Designer-first** — same pattern as footer.

## Designer-first split

| In Webflow Designer | In site head (`#ltf-site-nav-fx`) |
|---------------------|-----------------------------------|
| Flex layout on `.ltf-nav-inner`, logo, links, actions | Hamburger morph, hide-on-scroll |
| Wrap-on-collision (10px gap, min-height 50px) | Nebula link/button hover gradients |
| Mobile panel structure | Fixed 52px mobile bar + slide-down panel |
| Desktop link size (20px on `main`) | Desktop 2-row collapse (`.is-nav-wrapped`) |
| OPEN COMMS button placement | Comms popout CSS (`.ltf-comms-*`) |

**Rule:** Layout in Designer. Head CSS for motion, gradients, and responsive overrides Designer cannot express cleanly.

## Key Designer classes

| Class | Purpose |
|-------|---------|
| `ltf-site-nav` | Root nav block |
| `ltf-nav-inner` | Flex container — logo + mobile panel |
| `ltf-nav-logo-link` / `ltf-nav-logo` | Home logo |
| `ltf-nav-links` / `ltf-nav-link` | Primary nav links |
| `ltf-nav-actions` | CTA buttons row |
| `ltf-nav-mobile-panel` | Slide-down panel (also used on desktop wrap row 2) |
| `ltf-nav-toggle` | Hamburger (hidden desktop ≥992px via head CSS) |
| `ltf-btn-gradient-wrap` / `ltf-nav-btn` | Gradient-ring CTAs |
| `ltf-comms-wrap` | OPEN COMMS button + popout anchor |

## JS boot

| Layer | Source |
|-------|--------|
| Site registered script | `ltfnavboot9136b12` @ `9136b12` |
| Module | `js/nav.js` → `nav-mobile.js`, `btn-gradient.js`, `nav-comms.js` |
| Clean-Slate exception | `ltf.js` boots nav internally; site boot guarded by `data-ltf-nav-bound` |

## Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| ≥992px | Single-row (wrap-on-collision to 2 rows via JS geometry) |
| ≤991px | Fixed top bar + hamburger + slide panel |
| All | Hide on scroll down, reveal on 20px scroll up |

## Pages (instances)

See `PAGE-MANIFEST.md` — all six active pages except legacy `/`.

## Deploy / update

1. **Copy, links, spacing** — edit component in Designer.
2. **FX changes** — edit `webflow/site-nav-fx.html`, deploy via `DEPLOY.md` site head recipe.
3. **JS behavior** — edit `js/nav.js` / `js/ui/nav-mobile.js` / `js/ui/nav-comms.js`, bump nav boot pin in `PIN-MANIFEST.md`.

## Breakpoint gotcha

Webflow **additive** breakpoints (`large` 1280+, `xl`, `xxl`) layer on `main`. Always audit these when desktop nav link size looks inconsistent. See `CLEAN-SLATE.md` breakpoint section.

## Related

- `webflow/LOCKED-BUILD.md` — master lock
- `webflow/PAUSE-STATUS.md` — nav rollout history (2026-08-26)

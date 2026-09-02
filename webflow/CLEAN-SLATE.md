# Clean Slate — Homepage Rebuild

Page slug: **`clean-slate`** · Page ID `6a5711c9136987eae97760e3`  
Site ID `6789f449bbb1a21245706751`

Native Webflow UI elements + minimal page custom code. Content migrated from **Apparel-Landing-Page** (below-hero sections), cleaned into Designer-editable `ltf-*` classes.

## Layout standard (Hero locks the pattern)

```css
:root {
  --site-max-width: 1400px;
  --fluid-h1: clamp(2.5rem, 5vw, 4.5rem);
  --fluid-padding: clamp(2rem, 4vw, 5rem);
}
```

- **Cage class:** `ltf-site-cage` (alias `.section-wrapper` in head CSS)
- **Ceiling:** `max-width: 1400px; margin: 0 auto; padding-inline: clamp(2rem, 4vw, 5rem)`
- **H1:** `.ltf-main-header` → `font-size: var(--fluid-h1)`
- Applied to Hero first, then Specs vault / Squad / Gallery / Trenches / Beyond Gear / Launch CTA (desktop + ≤991px)

## DOM

```
body
├── header.ltf-site-nav
│   └── .ltf-nav-inner (max-width 1400) → brand / links / actions / mobile panel
├── section.ltf-hero
│   ├── .hero-canvas-wrapper[data-ltf-rock][data-render-resolution-scale="1"]
│   │     └── HtmlEmbed → #canvas3d loading="eager"   ← full-bleed (100% hero), z-index 0
│   └── .ltf-site-cage                          ← 1400px relative cage
│       ├── img.ltf-hero-figure
│       ├── .ltf-hero-headline → h1.ltf-main-header
│       └── .ltf-hero-bottom-bar → logo / body / CTA
├── section.ltf-scroll-track → .ltf-track-label
├── section.ltf-specs-vault
│   └── [data-ltf-nebula-scroll][data-ltf-slam-threshold="0.88"]
│       └── .ltf-specs-vault-sticky (max-width 1400)
│           ├── .ltf-specs-vault-header
│           └── .ltf-specs-vault-cards → .ltf-spec-card-01…04
├── section.ltf-section                            ← 02 / THE SQUAD
│   └── .ltf-section-inner (max-width 1400)
├── section.ltf-gallery
├── section.ltf-section                            ← In The Trenches
├── section.ltf-upsell                             ← Beyond The Gear
└── section.ltf-funnel-cta                         ← Launch CTA → Instant Quote
```

## Layout classes (Clean-slate)

| Class | Role |
|-------|------|
| `ltf-site-cage` | **Site standard** — 1400px relative cage + fluid padding |
| `ltf-section` | Dark section + fluid padding (`clamp`) |
| `ltf-section-inner` | Max-width 1400 centered (no double side pad) |
| `ltf-split` | 2-col → **1-col** at medium/small |
| `ltf-cards-grid` | 2×2 → **1-col** at small |
| `ltf-card` | Static navy card |
| `ltf-stack` | Vertical copy stack |
| `ltf-section-head` | Combo on stack — section eyebrow + title spacing |
| `ltf-section-cta` | CTA row under a card grid |

## JS layout (fuse split — two footer tags)

**Critical:** boulder/nebula and UI effects are **separate git URLs**. Same
commit pin, two `<script type="module">` tags. A hung GLB must never stall
nav / cards / magnifier / upsell. Do **not** fold `rock-scene.js` into `ltf.js`
or into a single combined boot that only injects one module.

```
js/
  ltf.js                       UI entry — own jsDelivr URL (footer tag 2)
  hero/rock-scene.js           nebula + boulder — own jsDelivr URL (footer tag 1)
  sections/…                   imported by ltf.js (relative, same commit)
  ui/…                         imported by ltf.js
```

Registered boots: `LTFRockBoot…` (importmap + rock-scene) then `LTFUIBoot…`
(ltf.js). Bump both hashes together when shipping.

## Hero FX

- `js/hero/rock-scene.js` — FBM nebula + hematite boulder, one WebGL context
- The nebula is a GLSL shader inside that file, **not** a separate script
- **No mouse hover rotation** — idle + scroll coast only
- Rock cage: absolute inside `.ltf-site-cage`; DPR locked via `data-render-resolution-scale="1"`
- Model + texture: `boulder-hematite-optimized-v2.glb` / `boulder-texture-raw-02.avif`,
  overridable per page with `data-model-url` / `data-rock-texture-url` on the hero element

## Specs Vault

**Webflow Interactions cannot be copied via MCP.** The slam is driven by JS.

**File:** `js/sections/specs-vault-slam.js`

Binds to `.ltf-specs-vault` / `[data-ltf-specs-slam]` containing at least two
`.ltf-spec-card` elements. Progress is read from the section's scroll geometry,
so `.ltf-specs-vault` needs a sticky runway taller than the viewport or the
cards have nothing to animate across. Cards use `translate3d`; the gas bloom
and edge ring are canvases injected per card and styled inline by the script,
so no head CSS is required.

## Custom code

**Head** — `webflow/live-page-head.html` (`#ltf-clean-slate-fx` — nav lives in site head, not here)  
FX only (gradients, glow, nav link glass/hover, hamburger morph, card edges). **Hero position/padding live in Designer**
on `.ltf-hero`, `.hero-canvas-wrapper`, `.ltf-hero-headline`, `.ltf-hero-bottom-bar`, `.ltf-hero-figure`, and combo classes.
**Nav layout also lives in Designer** on `LTF Site Nav` classes (`.ltf-site-nav`, `.ltf-nav-inner`, `.ltf-nav-mobile-panel`,
`.ltf-nav-links`, `.ltf-nav-actions`, `.ltf-nav-logo-link`). Desktop = **1 row** (logo + links + buttons) with **wrap-on-collision**
(~10px gap; panel `min-width: max-content` so links/buttons drop under the logo only when they no longer fit). Min bar height **50px**.
Do not add hero or nav layout rules to head CSS.

**Breakpoint gotcha:** Webflow's *additive* desktop breakpoints (`large` = min-width 1280px, `xl` = 1440px,
`xxl` = 1920px) layer **on top of** `main` and are easy to forget when auditing styles — `query_styles` only
returns `main`/`medium`/`small`/`tiny` unless you explicitly pass `include_breakpoints: ["large","xl","xxl"]`.
A stray `large` override once knocked `.ltf-nav-link` down to 16px above 1280px while `main` stayed 20px,
which is what made the links look "bigger" whenever the nav wrapped to 2 rows at narrower widths. Always check
`large`/`xl`/`xxl` too when a style seems inconsistent across desktop widths.

**Footer** — `webflow/clean-slate-footer.html`

```html
<script type="importmap">…three…</script>
<script type="module" src="…@<commit>/js/hero/rock-scene.js"></script>
<script type="module" src="…@<commit>/js/ltf.js"></script>
```

Two tags, **same** commit. Rock first (own URL). UI second (own URL).
Never one combined injector that hides the split — and never different SHAs.

## Feeding fresh content later

1. Open **clean-slate** in Designer (reconnect MCP if needed — link below)
2. Edit text on existing headings / paragraphs / gallery tags in place
3. For a **new section:** duplicate a `ltf-section` (or `ltf-gallery` / `ltf-upsell`) block, wrap content in `ltf-site-cage` or `ltf-section-inner`, keep `ltf-*` classes
4. Specs vault: edit card copy in place; don’t rebuild as a static `ltf-cards-grid`

## Designer reconnect

If the MCP bridge times out:

[Open LowTideFlow.co Designer with MCP Bridge](https://lowtideflow-co-v2-build.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99)

Keep the Designer tab foregrounded while agents work.

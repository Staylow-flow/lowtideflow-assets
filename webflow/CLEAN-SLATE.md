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
│   └── .ltf-site-cage                          ← 1400px relative cage
│       ├── .hero-canvas-wrapper[data-ltf-rock][data-render-resolution-scale="1"]
│       │     └── HtmlEmbed → #canvas3d loading="eager"
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

## JS layout

Everything loads through one entry, `js/ltf.js`, which imports the rest by
relative path. That is what keeps the whole bundle on a single commit.

```
js/
  ltf.js                       entry — the only file Webflow points at
  core/ticker.js               shared rAF loop + once-per-frame scroll sampling
  hero/rock-scene.js           nebula shader + hematite boulder
  sections/specs-vault-slam.js specs card slam + gas/ring FX
  ui/nav-mobile.js             mobile hamburger
  ui/btn-gradient.js           button click pulse
  _archive/                    superseded, loaded by nothing
```

Each module is gated on a selector, so pages only download what they use.
To add an effect, drop the file in the right folder and add a row to `MODULES`
in `ltf.js` — no new script tag.

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

**Head** — `webflow/clean-slate-head.html`  
`:root` tokens + cage CSS + gradient button / nav FX. Button **hover** lives
here as a CSS `::before` opacity fade; the JS only handles the click pulse.

**Footer** — `webflow/clean-slate-footer.html`

```html
<script type="module" src="…@<commit>/js/ltf.js"></script>
```

One tag. Shipping a JS change means pushing the repo and swapping that commit
hash. Do not add a second tag — that is how the hero and section effects
previously drifted onto different revisions.

## Feeding fresh content later

1. Open **clean-slate** in Designer (reconnect MCP if needed — link below)
2. Edit text on existing headings / paragraphs / gallery tags in place
3. For a **new section:** duplicate a `ltf-section` (or `ltf-gallery` / `ltf-upsell`) block, wrap content in `ltf-site-cage` or `ltf-section-inner`, keep `ltf-*` classes
4. Specs vault: edit card copy in place; don’t rebuild as a static `ltf-cards-grid`

## Designer reconnect

If the MCP bridge times out:

[Open LowTideFlow.co Designer with MCP Bridge](https://lowtideflow-co-v2-build.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99)

Keep the Designer tab foregrounded while agents work.

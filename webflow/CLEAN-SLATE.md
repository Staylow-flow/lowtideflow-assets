# Clean Slate — Homepage Rebuild

Page slug: **`clean-slate`** · Page ID `6a5711c9136987eae97760e3`  
Site ID `6789f449bbb1a21245706751`

Native Webflow UI elements + minimal page custom code. Content migrated from **Apparel-Landing-Page** (below-hero sections), cleaned into Designer-editable `ltf-*` classes.

## DOM

```
body
├── header.ltf-site-nav
│   └── .ltf-nav-inner → brand / links / actions / mobile panel
├── section.ltf-hero
│   ├── .hero-canvas-wrapper → HtmlEmbed → #canvas3d  (rock-scene + nebula)
│   ├── img.ltf-hero-figure
│   ├── .ltf-hero-headline → h1.ltf-main-header
│   └── .ltf-hero-bottom-bar → logo / body / CTA
├── section.ltf-scroll-track → .ltf-track-label
├── section.ltf-section.ltf-section-light          ← Specs & Standards (grey)
│   └── [data-ltf-nebula-fart][data-ltf-fart-threshold="0.92"]
│       └── .ltf-section-inner → .ltf-split
│           ├── .ltf-stack (header copy)
│           └── .ltf-cards-grid → .ltf-card × 4
├── section.ltf-gallery                            ← apparel shots grid
├── section.ltf-section                            ← In The Trenches
│   └── .ltf-section-inner → .ltf-split (copy + image)
├── section.ltf-upsell                             ← Beyond The Gear
└── section.ltf-funnel-cta                         ← Launch CTA → Instant Quote
```

## Layout classes (Clean-slate)

| Class | Role |
|-------|------|
| `ltf-section` | Standard dark section padding |
| `ltf-section-light` | Combo — light/grey Specs background |
| `ltf-section-inner` | Max-width 1280 centered |
| `ltf-split` | 2-col → **1-col** at medium/small |
| `ltf-cards-grid` | 2×2 → **1-col** at small |
| `ltf-card` | Static navy card (no 500vh sticky vault) |
| `ltf-stack` | Vertical copy stack |

Typography / buttons reuse existing: `ltf-section-header`, `ltf-section-header-Navy`, `ltf-subheading`, `ltf-body-text`, `ltf-card-title`, `ltf-btn-primary`, gallery / upsell / funnel classes.

**Responsive:** medium + small breakpoints set in Style panel (`data_style_tool`) for section padding, splits, cards, gallery, upsell, funnel, and header font sizes.

## Hero FX (existing)

- `js/rock-scene.js` — FBM domain-warped nebula + soapstone rock
- Brand gas palette: teal `#1F7781`, purple `#4D259D` / `#7040C0`, green `#0B8050`, cyan `#2AAAB8`
- Footer: pinned `@3900fb4` rock-scene + btn-gradient

## Specs “Nebula Fart” (new)

**File:** `js/ltf-nebula-fart.js` (standalone — not bolted onto rock-scene)

Same gas color language as the hero nebula, lightweight 2D canvas burst.

**Trigger:** section scroll-progress ratio on `[data-ltf-nebula-fart]`

1. As the Specs (grey) section scrolls through the viewport, progress `0 → 1`
2. `.ltf-card` elements run a closing/stack cycle driven by that progress
3. When progress crosses `data-ltf-fart-threshold` (default **0.92**) and the close ease is ~complete, fire a one-shot nebula gas puff
4. Scrolling back above ~0.45 progress resets so it can fire again

**Wire (already on Specs section):**

- `data-ltf-nebula-fart` (empty)
- `data-ltf-fart-threshold="0.92"`

**Footer script** (after btn-gradient):

```html
<script defer src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@cursor/add-soapstone-glb-asset/js/ltf-nebula-fart.js"></script>
```

Pin a commit hash once the file is on the remote (same pattern as rock-scene `@3900fb4`).

## Custom code

**Head** — `webflow/clean-slate-head.html` (gradient button / nav FX)

**Footer** — `webflow/clean-slate-footer.html`

```html
<script type="module" src="…@3900fb4/js/rock-scene.js"></script>
<script defer src="…@3900fb4/js/ltf-btn-gradient.js"></script>
<script defer src="…/js/ltf-nebula-fart.js"></script>
<!-- + mobile nav IIFE -->
```

## Feeding fresh content later

1. Open **clean-slate** in Designer (reconnect MCP if needed — link below)
2. Edit text on existing headings / paragraphs / gallery tags in place
3. For a **new section:** duplicate a `ltf-section` (or `ltf-gallery` / `ltf-upsell`) block, swap copy + images, keep `ltf-*` classes
4. Specs cards: add/remove `.ltf-card` children inside `.ltf-cards-grid` — fart JS auto-binds `.ltf-card`
5. Do **not** reintroduce the old `ltf-specs-vault` 500vh sticky pattern unless intentional

## Designer reconnect

If the MCP bridge times out:

[Open LowTideFlow.co Designer with MCP Bridge](https://lowtideflow-co-v2-build.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99)

Keep the Designer tab foregrounded while agents work.

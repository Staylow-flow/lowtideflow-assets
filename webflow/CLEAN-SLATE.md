# Clean Slate — Hero Layout

Page slug: **`clean-slate`** · Page ID `6a5711c9136987eae97760e3`

## DOM (matches `demo/hero-preview.html`)

```
body
├── header.ltf-site-nav
│   └── .ltf-nav-inner
│       ├── .ltf-nav-brand (logo)
│       ├── nav.ltf-nav-links (4 links)
│       └── .ltf-nav-actions (Contact + Instant Quote)
├── section.ltf-hero
│   ├── .hero-canvas-wrapper → HtmlEmbed → #canvas3d
│   ├── img.ltf-hero-figure
│   ├── .ltf-hero-headline → h1.ltf-main-header
│   └── .ltf-hero-bottom-bar
│       ├── img.ltf-hero-logo
│       ├── p.ltf-body-text
│       └── .ltf-btn-gradient-wrap → a.ltf-btn-primary.is-hero-cta
└── .ltf-scroll-track → .ltf-track-label
```

## Native Webflow classes (Designer-editable)

Layout, type, colors, and spacing live in Webflow Style panel — not migration CSS.

Key width constraints from preview:
- **Bottom bar:** `500px` wide, `left: 58px`, `bottom: 48px`, column flex, `gap: 28px`
- **H1:** centred stamp, `scaleX(0.88)`, two lines via `white-space: pre-line`
- **Figure:** `clamp(200px, 33.75vw, 488px)` right-aligned
- **Hero:** `100vh`, `min-height: 640px`, `-52px` margin under nav

## Custom code (minimal)

**Head** — gradient button keyframes only (`webflow/clean-slate-head.html`)

**Footer** — paste manually (`webflow/clean-slate-footer.html`):

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@05ea94c/js/rock-scene.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@05ea94c/js/ltf-btn-gradient.js"></script>
```

## Fine-tuning in Designer

- Select any `ltf-*` class → adjust in Style panel
- Hero CTA uses combo **`ltf-btn-primary` + `is-hero-cta`** (transparent + white border)
- Nav buttons use **`ltf-nav-btn-contact`** / **`ltf-nav-btn-quote`**

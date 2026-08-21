# Instant Quote — Native Webflow Rebuild (Per Unit Cost ↓)

## What went wrong

**WHTML / raw HTML injection** was used for layout blocks below the calculator (artwork row, order form, breakdown). That bypasses Webflow’s Style panel, breaks Designer editing, and fights native Form elements.

## Correct split

| Layer | Tool | Examples |
|-------|------|----------|
| **Structure + visual design** | Webflow Designer + `iq-*` classes | Divs, grid, borders, typography, native Form |
| **Behavior only** | Page footer `<script>` | Pricing calc, Airtable submit, modal open/close, file list UI |
| **Behavior only** | Page head `<style>` (minimal) | Slider thumbs, split-row animation, modal overlay, reduced-motion |
| **Unavoidable embeds** | HtmlEmbed (3 only) | Slider `<input type="range">` in center column of each slider row |
| **Popup** | Footer HTML modal OR Designer lightbox | Artwork pricing guidelines — footer modal is OK |

**Never use:** `data_whtml_builder` for sections, forms, grids, or typography.

**Use instead:** `data_element_builder` with `Form`, `DivBlock`, `FormTextInput`, etc. — same pattern as `.mcp-iq-build-payload.json`.

---

## Keep (calculator — already native)

Everything **above** the receipt block stays:

- `iq-quality-toggle`, `iq-sliders-block` (labels + HtmlEmbed sliders + values)
- `iq-apparel-section` (label box, style grid, 50/50 split row)

Fix in Designer (not injection):

- `iq-style-grid` → **2 columns** (was 4) in Style panel
- Move `iq-unit-cost-1` **out of** `iq-apparel-row` → into `iq-receipt-left` (currently misplaced)

---

## Rebuild natively (delete injected, recreate in Designer)

### 1. `iq-receipt` (Div Block)

```
iq-receipt                    Grid: 220px | 1fr, gap 40px, padding-bottom 100px
├── iq-receipt-left           Flex column, gap 18px
│   ├── iq-unit-cost          id=iq-unit-cost-1
│   │   ├── iq-unit-cost-label  "#1 Per Unit Cost:"
│   │   └── iq-price-box        id=iq-price-unit-1
│   └── iq-unit-cost          id=iq-unit-cost-2 (hidden until split)
│       ├── iq-unit-cost-label
│       └── iq-price-box        id=iq-price-unit-2
└── iq-receipt-right
    └── iq-total-wrapper        2px solid border, radius 14px, generous padding
        ├── iq-total-label      "Total Cost Est."
        └── iq-total-price      id=iq-total-price
```

### 2. `iq-artwork-row` (inside iq-apparel-section, after split-row-wrapper)

Same grid as Apparel Style row (`168px | 1fr`):

```
iq-artwork-row / iq-apparel-row
├── iq-apparel-label-box
│   ├── iq-apparel-label-title   "Artwork Files"
│   └── (empty flex spacer — matches 50/50 label box height)
└── iq-artwork-panel
    ├── Native Form File Upload OR styled upload div + id hooks for JS
    └── Text Link / Button       id=iq-artwork-info-trigger  "How does artwork pricing work?"
```

**One upload only** — lives here, not duplicated in project brief form.

### 3. `iq-order-section` (Section)

Native **Webflow Form** (`Form` element), not WHTML:

```
iq-order-section
├── Heading H2                   iq-order-heading
├── Paragraph                    iq-order-lead
└── Form                         id=iq-order-form
    ├── Hidden inputs            quote payload fields (or JS-only hidden)
    ├── Div iq-form-grid--2      Contact 2×2
    │   ├── FormTextInput        fullName, company, email, phone
    ├── FormTextarea             projectNotes
    └── Div iq-form-actions
        └── ltf-btn-gradient-wrap > FormButton  id=iq-form-submit
            combo: ltf-btn-primary is-hero-cta
```

### 4. `iq-pricing-breakdown` (Section)

```
iq-breakdown                     Grid 3 cols
├── iq-breakdown-col × 3
    ├── Heading H3               iq-breakdown-heading
    └── Paragraph                iq-breakdown-copy
```

White rounded borders → set on `iq-breakdown-col` in Style panel.

---

## Custom code after native build

**Head:** Strip layout CSS for form/grid/breakdown/receipt — keep only:

- Slider + range styling
- `#split-row-wrapper` / `#iq-unit-cost-2` animations
- `.iq-modal` popup
- Optional upload drag-over class `.is-dragover`

**Footer:** Keep `instant-quote-pricing*.js`, `instant-quote-ui.js`, `instant-quote-form.js` — wire to **native element IDs** only.

---

## Cleanup checklist (injected → remove)

- [x] Remove WHTML `iq-artwork-row` block
- [x] Remove WHTML `iq-order-section` section + "Html Form"
- [x] Remove WHTML `iq-pricing-breakdown` section
- [x] Rebuild all three with `data_element_builder`
- [x] Fix `iq-receipt` / unit cost placement in Designer
- [ ] Apply `iq-breakdown`, `iq-breakdown-col` classes to native breakdown (classes missing in site — create in Style panel)
- [ ] Apply artwork/order form classes in Designer (`iq-artwork-panel`, `iq-form-grid--2`, etc.)
- [ ] Trim page head CSS to behavior-only once Designer styles land

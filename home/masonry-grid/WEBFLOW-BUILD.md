# Masonry product grid — Home Sandbox (dev only)

**Page:** Home Sandbox → **`/clean-slate-sandbox`** (Designer slug `clean-slate-sandbox`).

Replace the **square product tile grid** directly under the hero on that page only. Keep the **existing section wrapper**, headline, and subline copy unchanged. Do **not** add a new heading.

---

## Class rules (owner — mandatory)

| Rule | Detail |
|------|--------|
| **Dev combo** | On this page, **Dev = `is-a`**. Apply **`is-a` only** to **new** masonry elements you add (see class list below). |
| **Live combo** | **Live = `is-b`**. **Never** add, remove, or restyle **`is-b`** while building this grid. Do not duplicate live nodes that carry `is-b`. |
| **Base classes** | **Do not edit** existing base classes (typography, section shells, gallery/tile classes already on the page). **Do not** change combo definitions for `is-a` / `is-b` in the Style panel. |
| **No new combos** | Do not create **`is-c`**, **`is-d`**, or any other combo letter. Only **`is-a`** on new masonry bases. |
| **New bases only** | Every new node gets a **new** base name scoped to this feature: **`ltf-masonry-*`**. Style those bases (or their **`is-a`** combo) in Designer; do not piggyback on `ltf-gallery-*`, product tile classes, etc. |
| **Embed / JS helpers** | `is-cap` and `is-ltf-revealed` are applied by the embed script — **not** Designer combos. |

**Imagery policy:** real Low Tide Flow apparel and crew photography only — **no AI-generated models or synthetic people**.

---

## Designer class list (new bases — then combo **`is-a`** only)

| Class | Role |
|-------|------|
| `ltf-masonry-wrap` | Optional outer wrapper (holds `data-ltf-masonry` + embed sibling) |
| `ltf-masonry-grid` | Column masonry wrapper |
| `ltf-masonry-tile` | One product tile (Div Block) |
| `ltf-masonry-tile__media` | Media frame (handles aspect cap) |
| `ltf-masonry-tile__img` | Image element |
| `ltf-masonry-tile__video` | Optional video element |
| `ltf-masonry-tile__caption` | Optional caption line (hidden by default) |

Internal cap helper (added by embed JS, not a Designer combo): `is-cap` on `ltf-masonry-tile__media` when intrinsic height ÷ width &gt; **1.35**. Those tiles use **`object-fit: cover`** inside a **1 : 1.35** frame so column masonry never produces tall skinny strips.

---

## Element tree (inside existing below-hero section)

Keep your current section (e.g. product / gallery block under hero). Structure:

```
section [existing classes — DO NOT rename or restyle; no is-b edits]
  └── Div [existing inner / ltf-site-cage — keep as-is]
        ├── [EXISTING headline + subline — untouched, no new classes]
        └── Div  data-ltf-masonry          ← new wrapper; optional new base e.g. ltf-masonry-wrap + is-a
              └── Div.ltf-masonry-grid.is-a
                    ├── Div.ltf-masonry-tile.is-a
                    │     ├── Div.ltf-masonry-tile__media.is-a
                    │     │     └── Image.ltf-masonry-tile__img.is-a  (or Video)
                    │     └── Text Block.ltf-masonry-tile__caption.is-a  (optional)
                    ├── … repeat 8–12 tiles …
                    └── (one tile may use Video instead of Image)
```

**Embed placement:** add one **Embed** element as the **last child** inside the same `data-ltf-masonry` wrapper (sibling after `ltf-masonry-grid`, or inside the wrapper at the bottom). Paste the full contents of **`masonry-embed.html`** into that embed.

To **enable captions** on the section wrapper: Custom attributes → `data-ltf-masonry-captions` = `true` (or any value). Default: captions stay hidden.

---

## Swapping the old square grid (sandbox)

1. Open **`/clean-slate-sandbox`** in Designer (Home Sandbox — dev).
2. Locate the section **immediately below the hero** with the square product tiles.
3. **Do not** delete the section shell or heading stack; **do not** change **`is-b`** or live-only elements.
4. Select the **inner dev square grid** (square tiles only) → hide or delete **only** that grid subtree.
5. Insert the tree above in the same inner wrapper, below the existing copy — all **new** nodes use **`ltf-masonry-*`** bases + combo **`is-a`** only.
6. Set **`data-ltf-masonry`** on the div that wraps **only** the masonry grid (not the whole page). Optional class: `ltf-masonry-wrap` + **`is-a`**.
7. Paste **`masonry-embed.html`** into an Embed at the bottom of that wrapper.
8. Confirm **every** new masonry element has **`is-a`** and **none** of your edits touched **`is-b`** or pre-existing base styles.
9. Publish **sandbox/staging** only; live pinned commits and live **`is-b`** pages stay untouched.

---

## Images (Designer)

For each tile:

- Class: `ltf-masonry-tile__img` + combo **`is-a`**
- Set **width** and **height** in Designer from the asset (avoids CLS).
- Enable **Lazy load** (Webflow image settings) and keep `loading="lazy"` in exported HTML.
- Prefer **landscape and square** shots; limit **portrait** sources — JS caps anything taller than **1.35×** width with cover crop.

Suggested mix: mostly landscape/square product close-ups (tees, hoodies, hi-vis), a few on-body crew shots, one **video** tile.

---

## Video tile (one)

Inside `ltf-masonry-tile__media.is-a`, use a **Video** element (or HTML5 video in an embed) with classes `ltf-masonry-tile__video is-a`:

| Attribute | Value |
|-----------|--------|
| `data-ltf-video-lazy` | present |
| `data-src` | MP4 URL (not in `src` until in view) |
| `poster` | still frame (lazy-friendly poster image) |
| `preload` | `none` |
| `muted` `loop` `playsinline` | all set |
| `width` / `height` | match poster aspect |

Placeholder in repo demo: `assets/apparel-placeholder.webm` + `assets/apparel-poster.jpg` (Ken Burns still — swap for owned on-body or fabric b-roll in Webflow Assets; no print-shop footage).

---

## Brand / layout tokens (in embed)

- Background: navy `#06142e` / tile `#263350` gradient
- Copy: slate `#E5E5E5`
- Accent: subtle orange focus ring on tiles
- Radius: **8px** (aligned with card controls elsewhere)
- Gap: `clamp(12px, 1.15vw, 18px)`
- Columns: **5 (≥1500px) → 4 → 3 (≥600px) → 2 → 1**; embed JS **shortest-column-first** + light rebalance (DOM order preserved; column bottoms within ~25% avg tile height + gap)

---

## Motion & performance

- Scroll reveal: `IntersectionObserver` adds `is-ltf-revealed` per tile; **disabled** when `prefers-reduced-motion: reduce`.
- Video: loads `data-src` near viewport; **pauses** offscreen.
- No lightbox, links, or CTA tiles.

---

## Local acceptance demo

Open `home/masonry-grid/demo.html` at **1440px**, **768px**, and **390px**. Run `node home/masonry-grid/verify-demo.mjs` for overflow, aspect-cap, lazy-load, and video attribute checks.

---

## Designer reconnect (MCP)

[Open Low Tide Flow Designer with MCP Bridge](https://lowtideflow-co-v2-build.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99)

This repo folder does **not** modify Webflow via MCP automatically — build the tree above in Sandbox, then paste the embed.

---

# Masonry v2 — staggered looping columns (owner direction)

**Recover v1 anytime:** `masonry-embed.html` + `demo.html` (packed static masonry, unchanged).

**v2 files:** `masonry-embed-v2.html` (paste embed), `masonry-embed-v2.css` + `masonry-embed-v2.js` (repo source), `demo-v2.html`, `verify-demo-v2.mjs`.

**Page:** same **`/clean-slate-sandbox`**, same **class rules** (`is-a` only on new `ltf-masonry-*` bases; never touch `is-b` or existing bases).

---

## v2 Designer class list (+ combo `is-a`)

| Class | Role |
|-------|------|
| `ltf-masonry-viewport` | Fixed-height clipping window (`overflow: hidden`) |
| `ltf-masonry-columns` | Horizontal flex row of columns |
| `ltf-masonry-column` | One vertical lane (staggered `padding-top` via JS) |
| `ltf-masonry-column__track` | Column stack that animates (`translate3d`) |
| `ltf-masonry-source` | **Hidden** tile templates (Designer); JS clones into columns |
| `ltf-masonry-tile` / `__media` / `__img` / `__video` / `__caption` | Same as v1 |

**Section attribute:** `data-ltf-masonry-v2` on the wrapper (alongside optional `data-ltf-masonry-captions`).

**Viewport height:** tune one variable in the embed — `--ltf-masonry-viewport-h` (default `clamp(520px, 76vh, 820px)`).

---

## v2 element tree

```
section [existing — unchanged copy/headline]
  └── Div  data-ltf-masonry-v2
        ├── Div.ltf-masonry-viewport.is-a
        │     └── Div.ltf-masonry-columns.is-a   ← JS builds columns OR you pre-build columns+tracks
        ├── Div.ltf-masonry-source.is-a          ← 8–12 .ltf-masonry-tile.is-a templates (hidden)
        └── Embed → paste masonry-embed-v2.html
```

**Swap-in:** same as v1 — replace only the square tile grid under the hero; keep section shell + copy.

**Pre-built alternative:** skip `ltf-masonry-source` and place tiles directly in each `ltf-masonry-column__track`; JS still duplicates tracks for seamless loops.

---

## v2 behavior (embed)

- **Viewport:** locked height, top/bottom **edge cut-off** intentional (soft mask fade optional in CSS).
- **Stagger:** each column gets a different `padding-top` (~6–20% of viewport height, patterned).
- **Columns:** **5 / 4 / 3 / 2** by container width (≥1100 / ≥820 / ≥520 / else) — **2 columns at 390px**, not 1.
- **Motion:** each column loops independently; **odd columns up**, **even down**; ~**40–70s** per loop (varies per column); CSS `transform` only; pauses when **offscreen** (IO) or **tab hidden**; **`prefers-reduced-motion`** → static stagger, no animation.
- **Tiles:** ~**10% shorter** than v1 (`--ltf-masonry-height-scale: 0.9`); max aspect **1.25** (`is-cap` + cover when exceeded).
- **Video:** one lazy video tile in source; plays only when visible inside the viewport; muted/loop/playsinline.
- **Captions:** default off (`data-ltf-masonry-captions` to enable).

---

## v2 local acceptance

```bash
node home/masonry-grid/verify-demo-v2.mjs
```

Open `demo-v2.html` at **1440 / 768 / 390** — no horizontal scroll; stagger + clipping visible; motion + reduced-motion checks in script.

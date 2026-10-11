# Masonry product grid — Home Sandbox (dev only)

Replace the **square product tile grid** directly under the hero on **Home Sandbox** (`/clean-slate` or owner’s sandbox home slug). Keep the **existing section wrapper**, headline, and subline copy unchanged. Do **not** add a new heading.

**Combo classes:** use only `is-a` / `is-b` on this page. Sandbox dev variant is **`is-a`** on every masonry class below. Do not create new combo letters or edit live/production combo styles.

**Imagery policy:** real Low Tide Flow apparel and crew photography only — **no AI-generated models or synthetic people**.

---

## Designer class list (create as plain classes, then combo `is-a`)

| Class | Role |
|-------|------|
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
section [existing classes — DO NOT rename live classes]
  └── Div [existing inner / ltf-site-cage — keep]
        ├── [EXISTING headline + subline — untouched]
        └── Div  data-ltf-masonry          ← custom attribute on wrapper around grid only
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

1. Open **Home Sandbox** in Designer (dev / unpublished).
2. Locate the section **immediately below the hero** with the square product tiles.
3. **Do not** delete the section shell or heading stack.
4. Select the **inner grid** (square tiles only) → hide or delete **only** that grid subtree.
5. Insert the tree above in the same inner wrapper, below the existing copy.
6. Set **`data-ltf-masonry`** on the div that wraps **only** the masonry grid (not the whole page).
7. Paste **`masonry-embed.html`** into an Embed at the bottom of that wrapper.
8. Add combo **`is-a`** to each masonry class on every element.
9. Publish **sandbox/staging** only; live pinned commits stay untouched.

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
- Columns: **5 → 4 → 3 → 2 → 1** by breakpoint (see embed CSS)

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

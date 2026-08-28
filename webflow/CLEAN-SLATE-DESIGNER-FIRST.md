# Clean-slate mobile fixes — Designer-first execution plan

The previous approach (paste a 95-line `<style>` block at the bottom of the head)
was wrong: the page head already carries ~900 lines / 11 media queries of curated
mobile CSS, and it explicitly reserves the hero for the Designer:

```
/* Hero layout: Webflow Designer only (.ltf-hero, .hero-canvas-wrapper,
   .ltf-hero-headline, .ltf-hero-bottom-bar, .ltf-hero-figure, combo classes).
   Do not set position, padding, size, or alignment on hero elements here. */
```

A bottom-appended `@media (max-width: 991px)` block with `!important` would fight
the existing nav/specs/upsell rules and override Designer hero styling. So we do
**Designer first**, and leave only the handful of rules Designer literally cannot
express in the head.

Original requirements (recap):
1. Orange shirt PNG cut off at bottom on mobile → bleed ~10–20px past the fold toward gallery
2. Instagram / in-app browser: hero CTA sits in a different spot than Safari/Chrome
3. Boulder too pixelated on mobile → higher quality, still fast  ✅ done in body JS (`rock-scene.js`)
4. Launch/funnel cut off on mobile; match ~10px section gutter; grey threshold on one line
5. Copy: "DIAL IN YOUR SPECS IN OUR LIVE BUILDER" → "DIAL YOUR SPECS ON OUR LIVE BUILDER"

---

## Legend

- **[D]** = do in Webflow Designer (Style panel, mobile breakpoints)
- **[H]** = must live in page head CSS (Designer can't express it) — see `clean-slate-head-integration.html`
- **[B]** = already handled in body JS footer tags — no action

Mobile breakpoints in Designer: **Tablet (≤991)**, **Landscape (≤767)**, **Portrait (≤479)**.
Set rules on **Tablet (≤991)** unless noted; it cascades down.

---

## 1. Hero orange figure bleed  → **[D]**

Select `.ltf-hero-figure` on the **Tablet (≤991)** breakpoint:

| Property | Value | Why |
|----------|-------|-----|
| Position | Absolute | already is |
| Top | Auto | release the top inset that clips it |
| Bottom | `-15px` | bleed ~15px past the fold into the gallery |
| Max height | none / 100% | Webflow's 78% cap is what chops it |
| Height | Auto | |
| Object fit | Contain | |
| Object position | Bottom right | |

On `.ltf-hero` (Tablet): set **Overflow → Visible** so the figure can bleed.
Gallery keeps its 70px top pad on `.ltf-gallery-inner`, so 15px is safe.

> If Designer refuses to remove the max-height cap (inherited combo class), that
> single override can move to head — but try Designer first.

---

## 2. Hero CTA position (Instagram / in-app browsers)  → **[D]** base + **[H]** notch/viewport

Root cause: in-app browsers (Instagram, Facebook) report a wrong `100vh`, so a
CTA pinned by viewport height lands in the wrong place. Two parts:

**[D]** Base placement — select `.ltf-btn-gradient-wrap.is-hero-cta-wrap` (Tablet):
| Property | Value |
|----------|-------|
| Position | Absolute |
| Top | Auto |
| Left | 50% |
| Right | Auto |
| Bottom | `25px` |
| Transform | Translate X `-50%` |
| Margin | 0 |

**[H]** Two things Designer can't do (in `clean-slate-head-integration.html`):
- `.ltf-hero { min-height: var(--ltf-hero-h, calc(100svh + 52px)) }` — `svh` unit +
  CSS variable fed by `hero-viewport.js`. This makes the hero height track the
  *visible* viewport, so the absolutely-positioned CTA lands correctly in in-app browsers.
- `bottom: calc(25px + env(safe-area-inset-bottom))` on the CTA wrap — `env()` safe-area
  for notched phones. This refines the Designer `25px` above; keep both.

> In Designer, leave `.ltf-hero` mobile **Height = Auto** (don't set a fixed vh/px height),
> so the head `min-height` rule + JS own the hero height. This is the one documented
> exception to "hero is Designer-only."

---

## 3. Boulder mobile quality  → **[B]** (done)

`js/hero/rock-scene.js` already renders mobile at 1.5× DPR with 8× anisotropy.
Ships via the `@2047dec` footer tag. No Designer/head action.

---

## 4. Launch / funnel section  → **[D]** layout + **[H]** one-line guarantee

**[D]** `.ltf-funnel-cta` (Tablet):
| Property | Value |
|----------|-------|
| Height | Auto |
| Min height | 0 / none |
| Padding L / R | `10px` (match section gutter) |
| Padding T / B | `75px` |
| Overflow | Visible |

**[D]** `.ltf-funnel-cta-inner` (Tablet): width 100%, max-width 100%, padding `64px` T/B, `20px` L/R.

**[D]** `.ltf-funnel-cta-heading` (Tablet): font-size ≈ `clamp(2.35rem, 11.5vw, 4.2rem)`
(Designer: set a responsive/vw size or px per breakpoint), line-height `0.92`, side padding 0.

**[D]** `.ltf-funnel-cta-threshold` (Tablet): shrink font so the copy fits **one line**
(≈13px Tablet, ≈11px Portrait), letter-spacing ~0.1em, margins ~28px T/B.

**[H]** `white-space: nowrap` on `.ltf-funnel-cta-threshold` — Webflow's Style panel does
not expose `white-space`, so this one property lives in head as the hard one-line guarantee.
Font-size (the thing that makes it actually fit) stays in Designer.

---

## 5. Copy change  → **[D]**

Edit the threshold text element on the Launch section:

`DIAL IN YOUR SPECS IN OUR LIVE BUILDER`  →  **`DIAL YOUR SPECS ON OUR LIVE BUILDER`**

(If it currently uses a `<br>` to force two lines, remove the break — the one-line
rule above handles wrapping.)

---

## Head residue after Designer work

Only these survive as head CSS (see `clean-slate-head-integration.html`) — three
properties, integrated into the existing hero mobile zone, NOT appended blindly:

```css
@media (max-width: 991px) {
  .ltf-hero { min-height: var(--ltf-hero-h, calc(100svh + 52px)) !important; }
  .ltf-btn-gradient-wrap.is-hero-cta-wrap {
    bottom: calc(25px + env(safe-area-inset-bottom, 0px)) !important;
  }
  .ltf-funnel-cta-threshold { white-space: nowrap !important; }
}
```

## Body (footer) tags — no change needed beyond the pin bump

```html
<script src="…@2047dec/js/hero/rock-scene.js"></script>
<script src="…@2047dec/js/ltf.js"></script>
<script src="…@2047dec/js/ui/hero-viewport.js"></script>
```

## Order of operations

1. Do all **[D]** in Designer at the Tablet (≤991) / Portrait (≤479) breakpoints.
2. Integrate the 3 **[H]** rules into the existing head hero zone (see integration file).
3. Confirm the 3 `@2047dec` footer tags are present (dedup old `@683a890`).
4. Publish.
5. Verify: `@2047dec`, `hero-viewport.js`, and `white-space:nowrap` / `env(safe-area` in source;
   figure bleeds ~15px; funnel not clipped; threshold on one line; new copy.

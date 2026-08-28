# Deploy clean-slate mobile fixes — Designer-first

GitHub has the JS on **`main` @ `2047dec`**. Webflow must be updated to point at it;
publishing alone does not pull from GitHub.

**Do layout in Designer first**, then add the tiny head residue, then swap the footer
tags, then publish. Full per-element spec: `CLEAN-SLATE-DESIGNER-FIRST.md`.

## Why not just paste a head block

The page head already holds ~900 lines / 11 media queries of curated mobile CSS and
reserves the hero for the Designer. A bottom-appended block would conflict. So the
mobile layout is done in Designer, and only 3 Designer-impossible rules go in head.

## Step 1 — Designer (do first)

See `CLEAN-SLATE-DESIGNER-FIRST.md` for exact properties. Summary:
- Hero orange figure → bleed `-15px`, release max-height cap, hero overflow visible
- Hero CTA → absolute, bottom-center `25px`, leave hero mobile Height = Auto
- Funnel → `10px` L/R gutter, `75px` T/B, heading size, threshold font-size to fit one line
- Copy → **DIAL YOUR SPECS ON OUR LIVE BUILDER**

## Step 2 — Head integration (3 rules, not an append)

Integrate into the existing hero mobile zone — see `clean-slate-head-integration.html`:

```css
@media (max-width: 991px) {
  .ltf-hero { min-height: var(--ltf-hero-h, calc(100svh + 52px)) !important; }
  .ltf-btn-gradient-wrap.is-hero-cta-wrap {
    bottom: calc(25px + env(safe-area-inset-bottom, 0px)) !important;
  }
  .ltf-funnel-cta-threshold { white-space: nowrap !important; }
}
```

## Step 3 — Footer tags (replace old @683a890, dedup)

Keep the Acumin swap inline script; replace the jsDelivr block with:

```html
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/hero/rock-scene.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/ltf.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/ui/hero-viewport.js"></script>
```

Remove the duplicate `@683a890` tags and page-level `nav.js` (`ltf.js` loads nav).

## Step 4 — Publish + verify

View source on `https://lowtideflow.co/clean-slate`:
- `@2047dec` in script URLs (not `@683a890`); each of rock-scene/ltf loads once
- `hero-viewport.js` present
- `white-space:nowrap` on `.ltf-funnel-cta-threshold`; `env(safe-area` on hero CTA
- Figure bleeds ~15px; funnel not clipped; threshold one line; new copy

## Optional — API automation (head residue + footer only)

Layout stays in Designer; the script only manages custom code:

```bash
export WEBFLOW_API_TOKEN="your-token"
node scripts/deploy-clean-slate-webflow.mjs             # head residue + footer tags
node scripts/deploy-clean-slate-webflow.mjs --publish   # + publish
node scripts/deploy-clean-slate-webflow.mjs --footer-only --publish
```

Token: Webflow → Site settings → Apps & integrations → API access.

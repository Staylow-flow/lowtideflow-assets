# LOCKED BUILD — LowTideFlow Webflow (v1)

**Status:** DIALED IN · **Locked:** 2026-09-02  
**Site:** `6789f449bbb1a21245706751` (lowtideflow.co)  
**Repo branch:** `cursor/instant-quote-v2` · **Git HEAD:** `329bdae`

This is the **single source of truth** for the current live build. Before any Webflow, JS, or CSS change, read this file and the linked manifests. Do not paste from stale files listed in [Stale — do not use](#stale--do-not-use).

---

## Architecture (Designer-first)

| Layer | Where it lives | Repo source of truth |
|-------|----------------|----------------------|
| **Layout, spacing, typography, colors, responsive grid** | Webflow Designer classes | Component + page docs below |
| **Nav FX** (hamburger, hide-on-scroll, nebula hovers, mobile panel) | Site head `#ltf-site-nav-fx` | `webflow/site-nav-fx.html` |
| **Footer FX** (gradient border, link hovers, status dot, legal padding bleed) | Site head `#ltf-site-footer-fx` | `webflow/ltf-site-footer-fx.html` |
| **Clean-Slate page FX** (hero, cards, upsell, magnifier — **no nav**) | Page head `#ltf-clean-slate-fx` | `webflow/live-page-head.html` |
| **Site nav JS** (non–Clean-Slate pages) | Site registered script footer | `js/nav.js` @ pin in PIN-MANIFEST |
| **Clean-Slate UI JS** | Page footer (3 tags) | `webflow/clean-slate-footer.html` |
| **Instant Quote** | Registered scripts + modal HTML | `INSTANT-QUOTE-STATUS.md` |

**Golden rule:** If Designer can express it, keep it in Designer. Head CSS is for pseudo-elements, keyframes, and overrides global bleed cannot fix (e.g. legal link padding).

**Critical deploy rule:** Never move jsDelivr `<script>` tags or importmaps from **Before `</body>`** into `<head>`. See `.cursor/rules/ltf-locked-build.mdc`.

---

## Global components (edit once → all instances update)

| Component | Webflow ID | Doc |
|-----------|------------|-----|
| **LTF Site Nav** | `23f19174-c22b-4e4f-bb47-275e13d3b665` | `LTF-SITE-NAV.md` |
| **LTF Site Footer** | `8d603833-f37b-f846-7b78-eeff3059e3c6` | `LTF-SITE-FOOTER.md` |

Both components are on: `/clean-slate`, `/instant-quote`, `/production`, `/tech-specs`, `/the-crew`, `/brand-matrix`.

---

## Breakpoint contract (do not change without updating JS + all CSS)

| Token | Meaning | Used by |
|-------|---------|---------|
| **`992px` / `min-width: 992px`** | Desktop nav row, hide hamburger | `site-nav-fx.html`, Designer `main` |
| **`991px` / `max-width: 991px`** | Mobile fixed nav bar + slide panel | `site-nav-fx.html`, `nav-mobile.js` |
| **`767px` / `small`** | Single-column footer, stack utility rows, 44px touch targets | Designer `small` breakpoint |
| **`991px` / `medium`** | Footer 2×2 grid | Designer `medium` breakpoint |
| **`1280+` / `large`, `xl`, `xxl`** | Additive desktop layers — **audit these** when styles look wrong at wide widths | Webflow Designer only |

**JS scroll/nav constants:** 20px show / 24px hide scroll delta; wrap detection via live geometry (`.is-nav-wrapped`), not hard-coded width.

---

## Dialed-in footer settings (2026-09-02)

Do not revert without explicit request:

| Class | Locked value |
|-------|----------------|
| `ltf-footer-nav-list` | `gap: 1.5px` |
| `ltf-footer-nav-item` | zero margin/padding on `<li>` |
| `ltf-footer-link` | `display: inline`, zero margin/padding, `line-height: 1.2`, uppercase |
| `ltf-footer-comms-link` | email only — regular case, no uppercase |
| `ltf-footer-comms-item` | `gap: 3px` (label ↔ value) |
| `ltf-footer-territory-list` | `gap: 3px` |
| `ltf-footer-location-tag` | `margin-top: 25px` |
| `ltf-footer-legal-links` | flex row, `align-items: center` |
| `ltf-footer-legal-link` / `ltf-footer-legal-sep` | `10px` horizontal padding, `line-height: 1` |
| Schedule CTA | `ltf-btn-gradient-wrap` + `ltf-nav-btn` (inherits site nav FX) |

Head override for legal row padding bleed: `#ltf-site-footer-fx` block in `ltf-site-footer-fx.html`.

---

## Site head assembly (all pages)

```
importmap (three.js)
+ webflow/site-nav-fx.html      → #ltf-site-nav-fx
+ webflow/ltf-site-footer-fx.html → #ltf-site-footer-fx
```

**Deploy template:** `webflow/_restore_head_now.json` (MCP `set_site_freeform_code`, location `head`).  
**Do not** paste `clean-slate-head.html` to site head — it duplicates nav rules.

File checksums: `webflow/_LOCKED/CHECKSUMS.sha256`

---

## Page-specific locks

| Page | Manifest row | Detail doc |
|------|--------------|------------|
| Clean Slate | `PAGE-MANIFEST.md` | `CLEAN-SLATE.md` |
| Instant Quote | `PAGE-MANIFEST.md` | `INSTANT-QUOTE-STATUS.md` |
| Production, Tech Specs, The Crew, Brand Matrix | `PAGE-MANIFEST.md` | Nav + footer components only |

---

## JS module map

| File | Loaded on | Imports |
|------|-----------|---------|
| `js/nav.js` | Site-wide (except Clean-Slate uses internal boot) | `nav-mobile.js`, `btn-gradient.js`, `nav-comms.js` |
| `js/ltf.js` | Clean-Slate only | nav trio + `crew-cards`, `upsell-lines`, `specs-vault-slam`, `garment-magnifier` |
| `js/hero/rock-scene.js` | Clean-Slate tag 1 | Three.js nebula + boulder (separate URL — fuse split) |
| `js/ui/hero-viewport.js` | Clean-Slate tag 3 | Funnel CTA copy patch only |
| `js/instant-quote-*.js` | IQ registered scripts | See PIN-MANIFEST |

**Never shipped:** `js/flow-background.js` (archived — hero uses rock-scene nebula).

**Guards:** `data-ltf-nav-bound`, `data-ltf-gradient-init`, `document.documentElement.dataset.ltfCommsBound`.

---

## Pre-change checklist (agents + humans)

1. Read `LOCKED-BUILD.md` (this file) + `PIN-MANIFEST.md`.
2. Confirm target layer (Designer vs site head vs page head vs registered script).
3. Edit **repo canonical file first**, then deploy to Webflow.
4. Never replace site head from `clean-slate-head.html` or monolithic archives.
5. Bump commit pin + SRI together when changing CDN JS/CSS.
6. Run verification steps in `DEPLOY.md` before marking done.
7. Append a dated entry to the relevant status doc (`INSTANT-QUOTE-STATUS.md` or section below).

---

## Post-change verification

- [ ] Site head contains both `#ltf-site-nav-fx` and `#ltf-site-footer-fx`
- [ ] Clean-Slate page head is `#ltf-clean-slate-fx` only (no nav block)
- [ ] Clean-Slate footer = exactly 3 jsDelivr tags @ pinned commit
- [ ] Nav + footer components present on all 6 target pages
- [ ] Publish Webflow + hard-refresh live URLs
- [ ] Update `PIN-MANIFEST.md` and `_LOCKED/CHECKSUMS.sha256` if canonical files changed

---

## Change log (site-wide, post-lock)

| Date | Change | Doc |
|------|--------|-----|
| 2026-09-02 | Footer spacing, legal alignment, email regular case, nav-item class | `LTF-SITE-FOOTER.md` |
| 2026-09-02 | IQ Round 12 @ `329bdae` | `INSTANT-QUOTE-STATUS.md` |
| 2026-08-26 | Site-wide nav rollout | `PAUSE-STATUS.md` (historical) |

---

## Stale — do not use

| File | Why |
|------|-----|
| `webflow/clean-slate-head.html` | Includes nav — superseded by `live-page-head.html` + site head split |
| `webflow/clean-slate-head.FULL-ARCHIVE.html` | Pre-split monolith |
| `webflow/PASTE-*.html` | Ephemeral deploy snapshots — only if filename matches intended commit |
| `webflow/NEBULA-SLAM-GAS-DEPOT.md` | Superseded by `SPECS-VAULT-SLAM.md` |
| `webflow/INSTANT-QUOTE-BUILD-STATUS.html` | Superseded by `INSTANT-QUOTE-STATUS.md` |
| `webflow/_deploy*.json`, `webflow/_invoke*.json` | MCP replay payloads — not source of truth |
| `js/flow-background.js` | Never deployed |

---

## Related docs

- `webflow/PIN-MANIFEST.md` — commit SHAs, registered script IDs, SRI
- `webflow/PAGE-MANIFEST.md` — page IDs, slugs, custom code map
- `webflow/DEPLOY.md` — step-by-step deploy recipes
- `webflow/LTF-SITE-NAV.md` — nav component + classes
- `webflow/LTF-SITE-FOOTER.md` — footer component + classes
- `webflow/SPECS-VAULT-SLAM.md` — specs vault scroll slam

# Live pin bumps — pending Nate approve (Dev verified first)

**Branch:** `fix/iq-submit-hit-success-email`  
**Dev SHA (Spec sandbox pinned):** `0e2fbd0`  
**Prior IQ-only SHA:** `75fbdc6`  
**Do not apply to Live until Spec sandbox verify passes.**

## Spec Engine Instant Quote

| Asset | Live now | Proposed after approve |
|-------|----------|------------------------|
| Embed CSS | `@548a0f4` `webflow/instant-quote-embed.css` | `@0e2fbd0` same path (fat CSS with hit-area, success, slider pad) |
| Form JS | registered `iqforma06e9d5` → `@a06e9d5` | register new hosted script `@0e2fbd0` `js/instant-quote-form.js` (or bump version on new id); remove/replace `iqforma06e9d5` on Live Spec page only |
| Pricing/UI | `@aefd7a7` | unchanged |

Fixes in `0e2fbd0` / `75fbdc6`:
1. Submit hit-area — wrap `pointer-events:none`; button 70px; zero Designer margin bleed
2. Success slot locked to 70px / 2-line type
3. Email — reject typos (`gnail.com` etc.) + bare/incomplete domains in `validateForm`
4. Ink / Print / Qty `.iq-slider-row` padding restored to `25px` (was `0 !important` overwrite)

## Site-wide nav (Site Settings freeform — NOT Spec page)

| Item | Live now | Proposed |
|------|----------|----------|
| `#ltf-site-nav-fx` `.ltf-nav-mobile-panel .ltf-nav-links` | `gap: 2px` | `gap: 25px` |
| Panel open/close | `translate3d(0,-12px)` + opacity fade | `translate3d(0,-100%,0)` slide (see `js-dev/2-0/ui/ltf-site-nav-fx.css`) |
| Footer `nav.js` | `@334377c` | optional bump if shipping synced `nav-mobile.js` |

Dev-only verify (already on Spec sandbox page freeform):  
`js-dev/2-0/ui/ltf-nav-sandbox-override.css` @`0e2fbd0` — does **not** rewrite Live freeform.

## Backup

`backups/site-freeform-2026-09-18/` — Live site head+footer snapshot (read-only).

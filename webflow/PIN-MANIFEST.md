# PIN MANIFEST — CDN & Registered Scripts

**Locked:** 2026-09-16 · **Repo HEAD (IQ Round 13):** `a2e770e`

All jsDelivr URLs use: `https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@<commit>/…`

When bumping a pin: update repo file → push to GitHub → update Webflow registered script → update SRI → publish → update this table.

---

## Site-wide

| Asset | Script ID / location | Commit | SRI / notes |
|-------|----------------------|--------|-------------|
| Nav boot (injects `nav.js`) | Site Custom Code → Footer (inline injector) | `334377c` | SRI sha384 on `nav.js` in `webflow/site-custom-footer-code.html` |
| Site head FX | Site Custom Code → Head | repo | Assembled from `site-nav-fx.html` + `ltf-site-footer-fx.html` via `_restore_head_now.json` |
| `js/nav.js` | loaded by nav boot | `334377c` | sha256 `98ed9afb1f202d3cc92060abd6222c0bc0905800df897b09d6e1aa40bc150c78` |
| `js/ui/nav-mobile.js` | import | `334377c` | sha256 `8c465a7c2fb02d43c002ea653da9d46a8a26258b1def826855ef7ebf87bf17cf` |
| `js/ui/nav-comms.js` | import via `nav.js` | `334377c` | dedupes with inline Open Comms boot via `ltfCommsBound` |

> **Note:** Nav boot lives in **site footer freeform** (`site-custom-footer-code.html`), not a registered script. Bump pin + SRI there when `js/nav.js` changes. IQ may be @ a different commit than nav.

---

## Clean Slate (`/clean-slate`)

| Asset | Location | Commit | Repo file |
|-------|----------|--------|-----------|
| `js/hero/rock-scene.js` | Page footer tag 1 | `4749e8b` | specs T/B padding matches L/R in slam band |
| `js/ltf.js` | Page footer tag 2 | `4749e8b` | `clean-slate-footer.html` |
| `js/ui/hero-viewport.js` | Page footer tag 3 | `4749e8b` | MODE B logo 20px left of H1 text |
| Page head FX | Page Custom Code → Head | repo (30296 chars) | `live-page-head.html` — MCP deploy 2026-09-11 · sha256 `6ffda85f…` (shirt +40px Y, logo −10px, copy +20px) |

Importmap for Three.js lives in **site head** (not page footer).

---

## Spec Engine / Instant Quote (`/spec-engine`) — Round 13 locked

| Asset | Script ID | Commit | SRI |
|-------|-----------|--------|-----|
| CSS embed | `iqcssboota2e770e` · page header | `a2e770e` | `sha384-PeK1fg56KQzjaUAuTrgupIA68lf4wefo/81C5zSPDW61kiTmHp9+Jv6vVRjG+cLM` |
| Form JS | `iqforma2e770e` · page footer | `a2e770e` | `sha384-aSRMRR+qkTelc14+MfciwHtucd82KEwrecojnObc5rhjrHepQA9la+pAim6/8FE3` |
| UI helpers | `iquia2e770e` · page footer | `a2e770e` | `sha384-kMhWQLJhkFHoBmYahqXz2KLJn16qW3r+bIV5kvF0s6uEmvIr8IPoO7xP8JztjGH7` |
| Pricing data | `iqpricingdataaefd7a7` | `aefd7a7` | see `.iq-pin-aefd7a7-sri.txt` |
| Pricing engine | `iqpricingaefd7a7` | `aefd7a7` | see `.iq-pin-aefd7a7-sri.txt` |

**Full pin file:** `webflow/.iq-pin-a2e770e-sri.txt`  
**CSS source:** `webflow/instant-quote-embed.css`  
**Footer HTML:** `webflow/instant-quote-footer-snippet.html` (System Engine preloader + artwork modal)

| System Engine CSS | Page head freeform `<link>` | `71fd535` | `sha384-FwqJGhfQj906uyNeM4vdv87cB1+EoO2OpURwf/u7rVmWiuWrU0atGbN8JtSjpLME` |
| System Engine JS | Page footer freeform `<script>` | `a2e770e` | `sha384-fb+j+WmT04Rb116Y7bQ67umphAy/X06uF4zn7CiT6wvYMFLBYs2DNoaMh5iyzfJz` |

**SRI file:** `webflow/.iq-pin-system-engine-71fd535-sri.txt`

**Watchdogs:** `webflow/iq-style-script-watchdog.sh`, `webflow/iq-freeze-watchdog.sh`

---

## IQ pin history (reference only — do not deploy old pins)

| Commit | CSS boot | Form boot |
|--------|----------|-----------|
| `1ccb191` | `iqcssboot1ccb191` | `iqform1ccb191` |
| `5c6ffa7` | `iqcssboot5c6ffa7` | (form @ `aefd7a7`) |
| `6508ffd` | `iqcssboot6508ffd` | (form @ `aefd7a7`) |

Current = **`329bdae`** only.

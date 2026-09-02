# PIN MANIFEST — CDN & Registered Scripts

**Locked:** 2026-09-02 · **Repo HEAD:** `329bdae`

All jsDelivr URLs use: `https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@<commit>/…`

When bumping a pin: update repo file → push to GitHub → update Webflow registered script → update SRI → publish → update this table.

---

## Site-wide

| Asset | Script ID / location | Commit | SRI / notes |
|-------|----------------------|--------|-------------|
| Nav boot (injects `nav.js`) | `ltfnavboot9136b12` · site footer registered script | `9136b12` | Verify live via Webflow → Site Settings → Custom Code → Registered Scripts |
| Site head FX | Site Custom Code → Head | repo | Assembled from `site-nav-fx.html` + `ltf-site-footer-fx.html` via `_restore_head_now.json` |
| `js/nav.js` | loaded by nav boot | `9136b12` | sha256 `98ed9afb1f202d3cc92060abd6222c0bc0905800df897b09d6e1aa40bc150c78` (local @ HEAD) |
| `js/ui/nav-mobile.js` | import | `9136b12`+ | sha256 `8c465a7c2fb02d43c002ea653da9d46a8a26258b1def826855ef7ebf87bf17cf` |
| `js/ui/nav-comms.js` | import | `9136b12`+ | sha256 `10acc2e54962f9f34009c99507f5361782b791d3315b3ecf26d7d44d67f298f0` |

> **Note:** Nav boot may still be @ `9136b12` while IQ is @ `329bdae`. That is OK if `nav.js` has not changed since nav rollout. If you edit `js/nav.js`, bump nav boot to match new commit.

---

## Clean Slate (`/clean-slate`)

| Asset | Location | Commit | Repo file |
|-------|----------|--------|-----------|
| `js/hero/rock-scene.js` | Page footer tag 1 | `b20acb1` | `clean-slate-footer.html` |
| `js/ltf.js` | Page footer tag 2 | `b20acb1` | `clean-slate-footer.html` |
| `js/ui/hero-viewport.js` | Page footer tag 3 | `b20acb1` | `clean-slate-footer.html` |
| Page head FX | Page Custom Code → Head | repo | `live-page-head.html` |

Importmap for Three.js lives in **site head** (not page footer).

---

## Instant Quote (`/instant-quote`) — Round 12 locked

| Asset | Script ID | Commit | SRI |
|-------|-----------|--------|-----|
| CSS embed | `iqcssboot329bdae` · page header | `329bdae` | `sha384-9vQA/6/ITaHNmNvZh5LqvuqbcjNj8sdfjCV/k9uFu01kvvlzw+BUx06mtIrGSjkT` |
| Form JS | `iqform329bdae` · page footer | `329bdae` | `sha384-QLwkH4SoKEYQfNOxqHm0YknECO8TLvylbWJtZu7kvCLKGuFVfeTa4j71UYXMpjah` |
| Pricing data | `iqpricingdataaefd7a7` | `aefd7a7` | see `.iq-pin-aefd7a7-sri.txt` |
| Pricing engine | `iqpricingaefd7a7` | `aefd7a7` | see `.iq-pin-aefd7a7-sri.txt` |
| UI helpers | `iquiaefd7a7` | `aefd7a7` | see `.iq-pin-aefd7a7-sri.txt` |

**Full pin file:** `webflow/.iq-pin-329bdae-sri.txt`  
**CSS source:** `webflow/instant-quote-embed.css`  
**Footer HTML only:** `webflow/instant-quote-footer-snippet.html` (artwork modal — no scripts)

**Watchdogs:** `webflow/iq-style-script-watchdog.sh`, `webflow/iq-freeze-watchdog.sh`

---

## IQ pin history (reference only — do not deploy old pins)

| Commit | CSS boot | Form boot |
|--------|----------|-----------|
| `1ccb191` | `iqcssboot1ccb191` | `iqform1ccb191` |
| `5c6ffa7` | `iqcssboot5c6ffa7` | (form @ `aefd7a7`) |
| `6508ffd` | `iqcssboot6508ffd` | (form @ `aefd7a7`) |

Current = **`329bdae`** only.

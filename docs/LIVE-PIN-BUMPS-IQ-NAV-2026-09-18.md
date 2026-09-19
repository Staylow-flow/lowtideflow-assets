# Live pin bumps — pending Nate approve (Dev first)

**Do not apply until Spec sandbox verify passes.**

## Spec Engine Instant Quote (Live Spec page freeform + registered scripts)

| Asset | Live now | Proposed |
|-------|----------|----------|
| Embed CSS | `@548a0f4` `webflow/instant-quote-embed.css` | `@NEW` same path (or js-dev twin) |
| Form JS | registered `iqforma06e9d5` → `@a06e9d5` | register/replace with `@NEW` `js/instant-quote-form.js` |
| Pricing/UI | `@aefd7a7` | unchanged unless needed |

Fixes in NEW SHA: submit hit-area, success 70px/2-line, email reject typos/bare domains, Ink/Print/Qty `+25px` row padding.

## Site-wide nav (Live Site Settings freeform — NOT Spec page)

| Item | Live now | Proposed |
|------|----------|----------|
| `#ltf-site-nav-fx` mobile links gap | `gap: 2px` | `gap: 25px` |
| Panel open/close | `translateY(-12px)` + opacity fade | `translate3d(0,-100%,0)` slide (no fade-pop) |
| Footer `nav.js` pin | `@334377c` | bump if shipping js-dev-synced `nav-mobile.js` |

Dev copies: `js-dev/2-0/ui/ltf-site-nav-fx.css`, `js-dev/2-0/ui/nav-mobile.js`.
Sandbox can load `ltf-nav-sandbox-override.css` without touching Live freeform.

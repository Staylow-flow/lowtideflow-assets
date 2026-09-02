# Pause status — Clean Slate nav / hero / rock

> **Superseded for current state by [`LOCKED-BUILD.md`](LOCKED-BUILD.md)** (locked 2026-09-02).  
> This file is kept as historical record of the 2026-08-26 nav rollout.

Saved: 2026-08-26 (early morning) — nav rollout confirmed complete

## Done (live in Designer, git, and published)

### Nav — now live SITE-WIDE across all active pages ✅
- **Site freeform head** (`get_site_freeform_code` → `head`): `<style id="ltf-site-nav-fx">` —
  hamburger morph, hide-on-scroll (mobile+desktop), nav link/button hover gradient, desktop
  2-row collapse, mobile fixed bar + slide-down panel. Layout itself stays in Designer on
  `.ltf-nav-inner` et al — this block is FX + responsive behavior only.
- **Site script** (`get_site_scripts`): `ltfnavboot9136b12` (footer) — tiny bootstrapper that
  injects `<script type="module" src=".../js/nav.js">` pinned to commit `9136b12`. `js/nav.js`
  imports `js/ui/nav-mobile.js` (hamburger + scroll-hide + live wrap-detection) and
  `js/ui/btn-gradient.js` (CTA click-pulse). Both guard against double-init
  (`data-ltf-nav-bound` / `data-ltf-gradient-init`), so it's safe to also run alongside
  Clean-Slate's own full `ltf.js` bundle on that page.
- **Verified live** (fresh, cache-busted fetch) on all pages with the `.ltf-site-nav` component:
  Production, Tech Specs, The Crew, Brand Matrix, Clean-Slate, Instant Quote — all serve both
  the site CSS and the nav JS boot, and `js/nav.js` + its two imports resolve 200 and match
  the local repo exactly at commit `9136b12`.
- **Legacy "Home" page** (slug `/`, the pre-rebrand page — NOT `clean-slate`) does **not** have
  the `.ltf-site-nav` component in its DOM at all, so the site-wide CSS/JS no-op there
  harmlessly. Clean-Slate is the homepage *rebuild* but hasn't been promoted to serve `/` yet —
  that's a separate decision (swapping which page is home), not part of this nav push. Leave
  as-is until explicitly requested.

### Designer styles (site `6789f449bbb1a21245706751`)
- Desktop nav links `.ltf-nav-link` → `font-size: 20px`
- Desktop nav wrap-on-collision: flex wrap, `row-gap: 10px`, logo/panel hug content, links
  centered in cluster, min bar height 50px
- Hero body mobile `.ltf-body-text.is-hero-body`: centered container, `text-align: left` kept
- Expanded mobile nav white buttons: medium/small `width/max-width: 100%`, `min-width: 0`

### Git / CDN (branch `cursor/instant-quote-v2`, HEAD `9136b12`)
- `js/hero/rock-scene.js` — `MOBILE_ROCK_LIFT_PX = 259`
- `js/ui/nav-mobile.js` — hide on scroll down (mobile **and** desktop); show after cumulative
  20px scroll up; live geometry-based wrap-detection (no hard-coded breakpoint)
- `js/nav.js` — lean site-wide nav-only boot for non-Clean-Slate pages
- `webflow/clean-slate-head.html` — restored from the earlier corruption; live and verified

### Clean-Slate page (`6a5711c9136987eae97760e3`)
- Page head freeform: restored, contains full FX CSS (nav + hero + cards + upsell + magnifier)
- Page scripts: `ltfrockboot0af6fcc` + `ltfuiboot30a7a2f` (footer) — full `ltf.js` bundle
- Published and QA'd: 20px nav links, mobile body centered, boulder position, scroll-hide nav,
  full-width expanded menu buttons

## Resume checklist — all items complete
- [x] Restore page head from `webflow/clean-slate-head.html`
- [x] Verify page scripts still on latest boots
- [x] Publish Clean-Slate
- [x] Push nav CSS + JS to all other active pages (site-wide, not per-page duplication)
- [x] Verify live on Production / Tech Specs / The Crew / Brand Matrix / Instant Quote

## Nothing currently blocked. Nav rollout is done — no further action needed unless new bugs are reported.

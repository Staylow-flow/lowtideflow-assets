# LTF Site Footer — Global Component

> **Locked build reference:** [`LOCKED-BUILD.md`](LOCKED-BUILD.md) · Footer settings locked 2026-09-02

Component: **`LTF Site Footer`** (group `LTF`) · ID `8d603833-f37b-f846-7b78-eeff3059e3c6`  
Site ID: `6789f449bbb1a21245706751`

Universal 4-column footer matching the LowTideFlow tactical navy system. Follows the same **Designer-first** pattern as **`LTF Site Nav`**.

## Designer-first philosophy

| In Webflow Designer | In site head (`#ltf-site-footer-fx`) |
|---------------------|--------------------------------------|
| Grid layout (4 → 2×2 → 1 col) | Gradient top border (`::before`) |
| Padding, gaps (10px line spacing) | Nebula link hover (reuses nav keyframes) |
| Typography (Acumin Condensed, weight 400 links) | Status dot hue-cycle animation |
| Colors (`#0d121d` bg, text colors) | Logo link hover suppression |
| Logo image + link to `/clean-slate` | — |
| Schedule CTA via `ltf-btn-gradient-wrap` + `ltf-nav-btn` | — (inherits global nav button FX) |
| 44px touch targets (mobile breakpoint) | — |
| Responsive utility row stacking | — |

**Rule:** If Designer can express it, keep it in Designer. Head CSS is only for effects Designer cannot do (animated gradients, pseudo-elements, keyframe animations).

## Architecture

| Layer | Source |
|-------|--------|
| **Structure** | Webflow component `LTF Site Footer` |
| **Layout / responsive** | Designer classes `ltf-footer-*` |
| **FX** | Site head `#ltf-site-footer-fx` → `webflow/ltf-site-footer-fx.html` |

## Key Designer classes

| Class | Purpose |
|-------|---------|
| `ltf-site-footer` | Root footer block (`position: relative` for gradient border) |
| `ltf-footer-inner` | Max-width container, vertical stack |
| `ltf-footer-grid` | 4-column CSS grid (2×2 tablet, 1 col mobile) |
| `ltf-footer-col` | Column stack, 10px gap |
| `ltf-footer-logo-link` / `ltf-footer-logo` | Home logo link (no hover FX) |
| `ltf-footer-tagline` | Two-line tagline |
| `ltf-footer-link` | Nav/comms links (weight 400) |
| `ltf-footer-schedule-wrap` | Optional spacing wrapper on CTA |
| `ltf-footer-status-dot` | Dot element (color via head CSS animation) |

Schedule button reuses global **`ltf-btn-gradient-wrap`** + **`ltf-nav-btn`** — same as site nav.

## Pages (instances placed)

| Page | Slug |
|------|------|
| clean slate | `/clean-slate` |
| Instant Quote | `/instant-quote` |
| Production | `/production` |
| Tech Specs | `/tech-specs` |
| The Crew | `/the-crew` |
| Brand Matrix | `/brand-matrix` |

## Responsive breakpoints (Webflow)

| Breakpoint | Grid |
|------------|------|
| Desktop | 4 × `1fr` |
| Tablet (≤991px) | 2 × 2 |
| Mobile (≤767px) | 1 column; utility rows stack; 44px min touch targets |

## Contact data (live)

- Phone: `(424) 634-2715` → `tel:+14246342715`
- Email: `Nate@lowtideflow.co`
- Schedule: [Calendly Discovery Chat](https://calendly.com/lowtideflow/15-min-quick-connect)

## Deploy / update

1. **Edit copy, links, spacing, colors** — open component in Designer (one edit updates all 6 instances).
2. **FX changes** — edit `webflow/ltf-site-footer-fx.html`, rebuild combined head (`site-nav-fx.html` + footer FX + importmap), deploy via Site Settings → Custom Code → Head. Payload template: `webflow/_restore_head_now.json`.
3. **New page** — insert **LTF Site Footer** component at bottom of `<body>`.

Scaffold reference (not for paste if component exists): `webflow/ltf-site-footer.html`

## TODO (optional)

- Create `/privacy-policy`, `/terms-of-service`, `/art-dept-guidelines` pages (footer links are stubbed).
- Replace Instagram/Facebook text links with SVG icons if desired.
- Publish site after verifying footer in Designer preview.

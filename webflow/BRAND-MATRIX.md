# Brand Matrix — Editorial page

Page: **Brand Matrix** · slug `brand-matrix` · ID `6a84a57c668753f0618be30e`  
Draft until Nate publishes. Site `6789f449bbb1a21245706751`.

## Type stack (locked)

1. Eyebrow — `ltf-label-teal` (Paragraph)
2. H2 — `ltf-section-header` (Heading h2)
3. Meta — `ltf-meta` (Paragraph, Courier New typewriter, no border)
4. Body — `ltf-body-text` (Paragraph)
5. Lists — `ltf-list` + `ltf-list-item`
6. Nested retainer tiers — `ltf-list is-nested` + parent `ltf-list-item is-stage`

Page H1 uses `ltf-main-header is-page` (smaller, left-aligned).

## Layout kit

Same rhythm as Clean-slate homepage / Production:

1. Section side pad **0**
2. `ltf-site-cage` — 1400 max + **80px** side pad (24px ≤991)
3. Full-width `is-measure` also gets **40px** side inset

| Block | Classes |
|-------|---------|
| Section | `ltf-section is-page` (hero: `is-page-hero`) |
| Cage | `ltf-site-cage` |
| Full-width | `ltf-stack is-measure` (~780px + 40px inset) |
| Meta | `ltf-meta` — typewriter, **no border / no pill** |
| CTA wrap | `ltf-btn-gradient-wrap` → TextLink `ltf-nav-btn` |

## Sections (Navigator)

1. LTF Site Nav — Symbol instance (`23f19174-c22b-4e4f-bb47-275e13d3b665`)
2. 00 Page Hero — full-width measure (eyebrow + H1)
3. 01 Beyond the Gear — full-width measure + flat list (5 offerings)
4. 02 Retainer Tiers — full-width measure + nested tier lists (Focus / Deliverables / Deployment)
5. 03 Digital Tech Stack — full-width measure + flat list (4 pipeline items)
6. 04 Private Retainer Access — full-width measure + steps list + CTA

## Nav Symbol

Component `23f19174-c22b-4e4f-bb47-275e13d3b665`:

- Label updated: **Brand Identity** → **Brand Matrix** (Title Case, matching Production / Tech Spec / Crew)
- Link confirmed via settings: `mode: page` → Brand Matrix (`6a84a57c668753f0618be30e`)
- No remaining “Brand Identity” strings in the Symbol

## CTA

Button label: **REQUEST RETAINER MATRIX & PRICING**  
Current href: `#request-retainer` (placeholder — wire to intake form / mailto when ready).  
Not Instant Quote (apparel quoting), unless Nate decides that page is temporary intake.

## Still for Nate

- Wire CTA destination (form page, mailto, or CRM intake URL)
- Optional photo placeholders (`ltf-photo-ph` / `is-wide`) if visual splits are desired later
- Optional: Adobe Fonts typewriter (Special Elite) on `ltf-meta` instead of Courier New
- Publish when ready (`draft: true` now)
- Confirm mobile nav also shows **Brand Matrix** (same Symbol; should sync)

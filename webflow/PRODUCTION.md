# Production — Editorial page

Page: **Production** · slug `production` · ID `6a8491e5daf288d38d19811b`  
Draft until Nate publishes. Site `6789f449bbb1a21245706751`.

## Type stack (locked)

1. Eyebrow — `ltf-label-teal` (Paragraph)
2. H2 — `ltf-section-header` (Heading h2)
3. Meta — `ltf-meta` (Paragraph, Courier New typewriter, no border)
4. Body — `ltf-body-text` (Paragraph)
5. Lists — `ltf-list` + `ltf-list-item`
6. Nested journey stages — `ltf-list is-nested` + `ltf-list-item is-stage`

Page H1 uses `ltf-main-header is-page` (smaller, left-aligned).

## Layout kit

Same rhythm as Clean-slate homepage:

1. Section side pad **0**
2. `ltf-site-cage` — 1400 max + **80px** side pad (24px ≤991)
3. Split columns add **40px outer / 50px inner**
4. Full-width `is-measure` also gets **40px** side inset

| Block | Classes |
|-------|---------|
| Section | `ltf-section is-page` (hero: `is-page-hero`) |
| Cage | `ltf-site-cage` |
| Split | `ltf-split-2` (+ `is-reversed` for image-left) |
| Copy col | `ltf-stack ltf-split-copy` (+ `is-ltr` when reversed) |
| Photo col | `ltf-matrix-asset` (+ `is-ltr` when reversed) |
| Photo ph | `ltf-photo-ph` (4:5) or `ltf-photo-ph is-wide` (16:9) |
| Full-width | `ltf-stack is-measure` (~780px + 40px inset) |

## Sections (Navigator)

1. 00 Page Hero — full-width measure
2. 01 Client Journey — full-width measure + nested stage list
3. 02 Behind the Hatch — text | 4:5 Press Bay
4. 03 Turnaround & Scheduling — 4:5 Schedule Board | text (reversed)
5. 04 Art Preparation Guidelines — full-width measure + 16:9 Art Specs Desk

## Still for Nate

- Copy site nav onto this page (not duplicated from Clean-slate)
- Swap photo placeholders for real assets (Press Bay, Schedule Board, Art Specs Desk)
- Optional: Adobe Fonts typewriter (Special Elite) on `ltf-meta` instead of Courier New
- Publish when ready (`draft: true` now)
- Medium breakpoint stacks `ltf-split-2` to 1 col

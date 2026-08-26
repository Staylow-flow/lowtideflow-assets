# The Crew — Editorial page

Page: **The Crew** · slug `the-crew` · ID `6a848792fcc6aca1efc5952b`  
Draft until Nate publishes. Site `6789f449bbb1a21245706751`.

## Type stack (locked)

1. Eyebrow — `ltf-label-teal` (Paragraph)
2. H2 — `ltf-section-header` (Heading h2)
3. Meta pill — `ltf-meta` (Paragraph, Courier New typewriter)
4. Body — `ltf-body-text` (Paragraph)
5. Lists — `ltf-list` + `ltf-list-item`

Page H1 uses `ltf-main-header is-page` (smaller, left-aligned).

## Layout kit

Same rhythm as Clean-slate homepage:

1. Section side pad **0**
2. `ltf-site-cage` — 1400 max + **80px** side pad (24px ≤991)
3. Split columns add **40px outer / 50px inner** (`ltf-split-copy` / `ltf-matrix-asset`)
4. Full-width `is-measure` also gets **40px** side inset so type lines up with split copy

| Block | Classes |
|-------|---------|
| Section | `ltf-section is-page` (hero: `is-page-hero`) |
| Cage | `ltf-site-cage` |
| Split | `ltf-split-2` (+ `is-reversed` for image-left) |
| Copy col | `ltf-stack ltf-split-copy` (+ `is-ltr` when reversed) |
| Photo col | `ltf-matrix-asset` (+ `is-ltr` when reversed) |
| Photo ph | `ltf-photo-ph` (4:5) or `ltf-photo-ph is-wide` (16:9) |
| Full-width | `ltf-stack is-measure` (~780px + 40px inset) |
| Meta | `ltf-meta` — typewriter, **no border / no pill** |

## Sections (Navigator)

1. 00 Page Hero
2. 01 Nate Taylor — text | 4:5
3. 02 Senior Design Unit — 4:5 | text (reversed)
4. 02 Visuals & Composition — text | 4:5
5. 02 SoCal Production Hub — 4:5 | text + list (reversed)
6. 02 Press Line Mechanics — text | 4:5
7. 03 Supply Chain — full-width + 16:9
8. 04 Retainer Proposition — full-width

## Still for Nate

- Copy site nav onto this page (not duplicated from Clean-slate)
- Swap photo placeholders for real assets
- Optional: Adobe Fonts typewriter (Special Elite) on `ltf-meta` instead of Courier New
- Publish when ready (`draft: true` now)
- Medium breakpoint stacks `ltf-split-2` to 1 col

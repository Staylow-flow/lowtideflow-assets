# Instant Quote status — Spec Run page

> **Locked build reference:** [`LOCKED-BUILD.md`](LOCKED-BUILD.md) · [`PIN-MANIFEST.md`](PIN-MANIFEST.md) · Current pin: **`329bdae`** (Round 12)

Purpose: running log of what's shipped on the Instant Quote page (`/instant-quote`,
page id `6a59f0368e92a3bd60940ad9`, site id `6789f449bbb1a21245706751`) so any other
concurrent/future agent (or the user) can see current state without re-deriving it.
Keep this concise — link to commits, don't restate every line of diff.

Branch: `cursor/instant-quote-v2`

## Done

### Round 3 — mobile/desktop CSS polish + artwork upload overhaul (commit `9136b12`)
- **A1** Quality toggle mobile overflow fixed — Designer `.iq-toggle-track` `min-width: 0px`
  at the `small` breakpoint (was `440px`, forcing it off-screen).
- **A2** Ink Colors / Print Locations / Final Quantity slider pills made symmetric on mobile
  (equal-width halves, centered number, thicker border, larger size/font) — custom CSS.
- **A3** "Apparel Style" heading shrunk 20% (~54px) on mobile via a new scoped Designer combo
  class `iq-apparel-label-title.apparel-title-mobile-lg` (the base class is shared with
  "Artwork Pricing?", so it was NOT edited directly).
- **B1** Total Cost Est. card border: replaced always-on mobile gradient ring with idle solid
  white border + a ~2s click-triggered gradient-wrap-then-fade sequence
  (`.iq-total-wrapper.is-calculating`, wired in `js/instant-quote-ui.js`).
- **B2/B3** Calculate Production Run button moved (via Designer `move_element`) to be a real
  child of `.iq-total-wrapper` on both breakpoints; white fill / dark-navy text; 15px bottom
  padding; centered via parent flex.
- **B4** Submit Project Brief button padding increased +50px top/bottom (later reverted in
  round 4 — see below, it made the button too tall).
- **C1–C6** Artwork upload JS rewrite in `js/instant-quote-form.js`: 5–8s minimum per-file
  animation, cumulative file selection (`artworkFiles` array, additive not replacing),
  independent staggered per-file progress lanes, persistent file list with name/ext/size,
  prominent "# files ready" counter moved to top of panel.

### Round 4 — bug fix + visual tweaks (commit `8237a53`)
- **Bug — upload bar not appearing:** Root cause found: a legacy static
  `<ul id="iq-form-artwork-list" hidden>` was left over inside the artwork file input's
  HTML embed (`iq-artwork-file-embed`), sitting as a sibling of `.iq-form-upload-inner`.
  Round 3's JS creates a *second* element with the same id inside the new shell/queue
  structure — `getElementById('iq-form-artwork-list')` always resolved to the first
  (stale, permanently-hidden) one, so every uploaded file's lane/progress-bar was appended
  into an invisible, disconnected list. Fixed by removing the stale `<ul>` from the embed's
  raw HTML (Designer `data_element_settings_tool`) and hardening
  `ensureArtworkUploadShell()` in `js/instant-quote-form.js` to sweep and remove any stale
  `#iq-form-artwork-list` / `#iq-form-artwork-queue` / `#iq-form-artwork-active` /
  `#iq-form-artwork-idle` from the whole drop zone (not just inside `.iq-form-upload-inner`)
  before building the real shell, as defense-in-depth.
- **Total Cost Est. card:** idle border + gradient-ring thickness both +2px (2px → 4px,
  Designer border-width + `::after` mask padding). Added a separate soft ambient glow layer
  (blurred `box-shadow`, nebula palette) on `:hover`, which also stays lit during
  `.is-calculating` so it layers with the click-gradient ring instead of competing with it.
- **Desktop artwork drop container:** was rendering two stacked ~420–780px boxes (idle +
  a permanently-visible "active" panel — see next bullet) on desktop, hence "way too tall."
  Shrunk `.iq-form-upload-inner` / `.iq-form-upload-active` min-height to a fixed 500px on
  desktop (mobile already forced `min-height: 0` separately, untouched) with sensible
  ~40px internal padding via `box-sizing: border-box`.
- **CSS bug found + fixed while investigating the above:** `.iq-form-upload-active` had an
  unconditional `display: flex`, which — because author CSS always beats the browser's
  default `[hidden] { display: none }` rule at equal specificity — meant it rendered even
  when its `hidden` attribute was set to hide it (i.e. always, even in the idle/empty state).
  Now `display: none` by default, only switched to `flex` when `#iq-form-artwork-drop` has
  `.is-loading`/`.is-queue`.
- **Submit Project Brief button:** the round-3 `padding: 66px 24px` custom-CSS override was
  removed entirely (Designer's own base `16px/24px` + mobile `18px/22px` + `min-height: 70px`
  already give a normal ~70px button — no need to re-fight it in custom CSS, same lesson as
  the round-3 border bug). External spacing above the button increased to `margin-top: 50px`
  (desktop custom CSS + Designer mobile breakpoint) to separate it from the field above,
  per the user's "50px of padding outside the button" ask.
- **Assumptions made (flagged for user correction if wrong):**
  - "500px of vertical padding around" the artwork drop container → interpreted as a typo;
    implemented as a modest ~40px internal padding (`box-sizing: border-box`) within a
    ~500px-tall box, NOT literally 500px of padding (which would recreate the "too tall" bug).
  - "500px of Padding outside the [Submit] button" → interpreted as a typo for ~50px;
    implemented as `margin-top: 50px` separating the button from the field above it.

### Round 4 follow-up — desktop drop container still too tall (commit `b89b700`)
User did live QA on `8237a53` with real DevTools measurements. Items 1, 2, and 4 confirmed
fully correct live (upload lane renders + animates with name/ext/size; card border measured
4px with the hover glow layering over `.is-calculating`; submit button measured 64px tall,
`16px 24px` padding, 50px margin-top). Item 3 was still broken — round 4's fix only touched
the *inner* panels (`.iq-form-upload-inner` / `.iq-form-upload-active`, correctly measured at
500px), but missed a separate, older rule on the *outer* drop-zone container itself:

```css
#iq-form-artwork-drop.iq-form-upload,
.iq-form-upload#iq-form-artwork-drop {
  min-height: clamp(520px, 82vh, 920px);   /* ≈ 886px at a 1080px-tall viewport */
}
```

This rule predates the round-3/4 shrink work (comment literally said "full viewport drop
zone") and was never reconciled with it. Since `.iq-form-upload-shell` sets
`min-height: inherit`, it was inheriting this ~886px value from its parent and centering the
correctly-sized 500px inner content inside it — hence persistent dead space / oversized
container even though the inner panels themselves measured right. Fixed by changing that
outer rule to `min-height: 500px` (desktop only — the mobile media-query override further
down, `min-height: 220px !important`, was already correct and untouched). Verified no
competing Designer-side min-height (`.iq-form-upload` Designer style only sets `140px`,
harmless/overridden by the more specific custom-CSS selector).

**Before/after (desktop, 1920×1080 viewport, `#iq-form-artwork-drop` total rendered height):**
- Before: ~886px (idle) — matches `82vh` at 1080px viewport height (user's live measurement).
- After (calculated from the CSS box model, NOT a live DOM measurement — `cursor-ide-browser`
  tools were unavailable again this session, same as round 4; confirmed via ~8 attempts across
  both sessions, consistently "No browser tab available"): outer container is now
  `min-height: 500px` `box-sizing: border-box` with `padding: clamp(28px, 4vw, 48px)` → at
  1920px viewport width, `4vw` = 76.8px, clamped down to `48px` each side. `.iq-form-upload-
  shell` (`min-height: inherit`) and `.iq-form-upload-inner` (`min-height: 500px`) both now
  match the outer's 500px floor exactly (no more double-stacking against the old 886px
  value), so total ≈ 48px + 500px + 48px = **~596px** — down from ~886px, in the right
  ballpark of "roughly 500px" (the extra ~96px is the container's own intentional outer
  padding/breathing room, not dead space).

**Live-verified (via `cursor-ide-browser`, working in the parent session):** actual
`#iq-form-artwork-drop.getBoundingClientRect().height` on a real 1920×1080 load = **600px**
(inner shell = 500px), matching the calculated estimate almost exactly. Confirms fixed.

### Round 5 — Total Cost Est. gradient ring didn't actually cover the border (commit `0c7680a`)
User: click-gradient ring still showed white behind it; asked to thicken it +2px. Root cause:
the `::after` ring has used a **negative `inset`** since it was first built (`-3px` → `-5px`
across rounds 3–4, each time "keeping pace" with the border getting thicker), which put the
entire ring band *outside* the card's own border-box with a ~1px gap to spare — it never
overlapped the 4px white border at all, so the border was always fully visible no matter how
thick the ring was. Fixed by making the ring flush with the card: `inset: 0`, `border-radius:
14px` (matches the card's own radius exactly, queried live via `data_style_tool`), `padding:
6px` (4px border coverage + 2px thicker per the ask). Ring now fully overlaps and hides the
border during the `.is-calculating` click sequence. Verified live: fetched the deployed CSS
from jsDelivr post-publish and confirmed `inset: 0; border-radius: 14px; padding: 6px;` present
in the shipped file, and confirmed the live page's boot-script loader points at this commit.
Not yet re-verified with an actual on-screen click screenshot (browser tooling was unavailable
in this sub-session) — worth a quick visual spot-check next time someone has working browser
access.

**Independent follow-up check (second agent, same request dispatched twice):** found this fix
already fully shipped (committed, pushed, re-pinned, published — confirmed live boot-script
`hostedLocation` already points at `0c7680a` before starting any work) and did NOT duplicate
it. `cursor-ide-browser` was also unavailable in this sub-session (same persistent issue, now
~12+ failed attempts across every round this session) so no screenshot could be captured
here either. Instead, independently re-derived and confirmed the coverage math is sound:
Designer's current border is `4px` / `14px` radius (re-queried live, unchanged). The ring's
`inset: 0` makes its own border-box **exactly identical** (not just offset-approximated) to
`.iq-total-wrapper`'s own border-box — same outer boundary, same 14px radius, zero geometric
mismatch possible at any point including corners. Its content-box (inner mask boundary) radius
is `max(0, 14 − 6) = 8px`, versus the border's own inner-edge radius of `max(0, 14 − 4) = 10px`
— since 8 < 10, the ring's inner boundary sits strictly inside the border's inner boundary
*everywhere around the shape, corners included*, guaranteeing full coverage with a uniform 2px
margin. This is a stronger guarantee than the round 3/4 approach (negative-inset + separately
incremented radius), which relied on offset approximation and is what caused the original gap.
**Still recommend an actual visual click-state screenshot once browser tooling is available**,
but the fix should be provably correct.

### Round 6 — gradient ring was activating INSIDE the white border, not on it (commit `495901d`)
User: click-gradient ring showed up in the wrong location — "activating inside the white
outline" instead of covering it. **Root cause (user pre-diagnosed this correctly, confirmed by
re-derivation):** `inset`/`top`/`right`/`bottom`/`left` on an absolutely-positioned element
resolve against the **padding edge** of the containing block, not the border edge / the
element's true outer visual boundary. `.iq-total-wrapper` has a real `border: 4px solid white`,
so its padding edge sits 4px *inside* its visible outer boundary. Round 5's `inset: 0` therefore
placed the ring's box flush with the INSIDE of the white border — i.e. the ring rendered
entirely within the padding/content area, nowhere near the border at all (band `[-6, 0]` vs. the
border's actual band `[0, 4]`, using 0 = padding edge — literally zero overlap). This is a
*different, worse* bug than round 5 thought it was fixing (round 5's own math, while internally
consistent, was built on the wrong premise that `inset: 0` aligns with the border's outer edge —
it doesn't).

**Fix:** changed `inset: 0` → `inset: calc(-1 * var(--iq-total-border-width))` with a new
`--iq-total-border-width: 4px` custom property defined on `.iq-total-wrapper` (used by nothing
else yet, since Designer's actual border-width can't be bound to a CSS var through the Designer
API — but this at least gives the `::after` rule a single named source to update, and a loud
comment, instead of a bare magic number that can silently drift from Designer's real value
again like it just did across rounds 3→4→5). Padding (`6px`, ring thickness) and `border-radius`
(`14px`, matches Designer exactly) were left untouched per the diagnosis — only the position was
wrong.

**On-paper verification (padding-edge = 0 coordinate space):**
- Before (`inset: 0`): ring band `[-6, 0]`, border band `[0, 4]` → **zero overlap**, ring
  entirely inside the border, border fully exposed the whole click sequence.
- After (`inset: -4px`): ring band `[-2, 4]`, border band `[0, 4]` → ring's outer edge lands
  **exactly** on the border's outer edge (both derive from the same padding-box + border-width
  arithmetic, so this is an exact match, not an approximation), with a 2px margin past the
  border's inner edge. Corners are provably covered too, since the ring's pseudo-element
  border-box is now geometrically identical (same position AND size) to `.iq-total-wrapper`'s
  own border-box, not just "same radius value" — see full derivation in the round-5 write-up
  above for why radius-matching alone isn't sufficient but exact-box-matching is.
- **Not visually screenshot-verified** — `cursor-ide-browser` was unavailable in this
  sub-session too (same persistent issue as every round this session, now ~15+ failed attempts
  total). Flagging this explicitly per instructions rather than claiming visual confirmation:
  **someone with working browser access should still hold `.is-calculating` active
  (`document.querySelector('.iq-total-wrapper').classList.add('is-calculating')` via console/CDP)
  and screenshot all four corners to be certain**, especially since this exact "verified only by
  math, turned out wrong" failure mode is precisely what happened in round 5.

**Lesson for future rounds:** `inset`/positioning offsets on a pseudo-element always resolve
against the *padding* edge of the containing block, never the border edge. When building a
border-hugging ring/glow effect like this one, either (a) offset by the border-width explicitly
(this round's fix), or (b) put the ring on a separate element that isn't a child of the bordered
box at all. Don't assume `inset: 0` means "flush with the visible edge" if the element has a
border.

## Files touched (round 4 + 5 + 6)
- `webflow/instant-quote-embed.css`
- `js/instant-quote-form.js`
- Designer: `.iq-total-wrapper` border-width (2px→4px), artwork file input HTML embed
  (stale `<ul>` removed), `.iq-form-submit` mobile `margin-top` (16px→50px)

## Nothing currently blocked.

---

## Round 7 — IQ polish batch + Drive upload restore (commit `aefd7a7`, 2026-09-02)

### Section A — Spec Engine H1
- Desktop: `.iq-intro` / `.iq-intro-title` left-justified, sized to match `.ltf-main-header.is-page`
  (`clamp(48px, 6vw, 88px)`, weight 900, acumin-pro-extra-condensed).
- Mobile: replaced 67px section-header sizing with Production hero mobile sizing
  (`clamp(3.078rem, 14.25vw, 3.99rem)`).

### Section B — Art upload → Sheets/Drive (CRITICAL)
- **Root cause:** `@8237a53` form.js used multipart FormData; Apps Script prefers base64 in
  `payload.sheet.art_files` (`collectArtworkBlobs_` in `LTF-Instant-Quote-Apps-Script.gs`).
- **Fix:** Restored base64 path from `@6c20553`, wired to cumulative `artworkFiles[]` array
  (keeps upload shell UI, lanes, marching ants). Submits as `text/plain` JSON body.
- Pin: `iqformaefd7a7` @ `aefd7a7`, SRI `sha384-1i7ogHc1QdZUCjuSxF/TJgl59Bbr5ARsNqzbC3Si5GZa6q8sTUxdL5aZhtAMB+1E`.

### Section C — Calculate Production Run
- `#iq-run-quote` / `.iq-run-quote` → `font-weight: 900` in embed.css.

### Section D — Submit button
- Desktop width capped at 920px (matches art upload panel).
- Mobile: gradient ring `inset` top clamped (no hover extension above button).
- Submit-in-progress: `.is-submitting` keeps L→R gradient cycling until request completes.
- Success: `.w-form-done` styled dark navy `#00001c`, enlarged, same padding footprint.
- Success copy: "Thank you! Your submission has been received!"

### Section E — Modal
- `.iq-modal-title` → light grey `rgba(255,255,255,0.62)`.

### Deploy
- Registered scripts: `iqcssbootaefd7a7`, `iqpricingdataaefd7a7`, `iqpricingaefd7a7`,
  `iqformaefd7a7`, `iquiaefd7a7` (page `6a59f0368e92a3bd60940ad9`).
- Site publish: subdomain + custom domains (`www.lowtideflow.co`, `lowtideflow.co`) @ 05:28 UTC.
- **Style/Script Watchdog PASSED** live @ `aefd7a7` (62KB CSS, 4-script stack, FX markers).

### Watchdogs
- `webflow/iq-style-script-watchdog.sh` — checks 4-script stack, full embed.css, FX markers.
- `webflow/iq-freeze-watchdog.sh` — 15-min stale terminal / live-page ping.
- SRI pin file: `webflow/.iq-pin-aefd7a7-sri.txt`

### Files touched
- `js/instant-quote-form.js`
- `webflow/instant-quote-embed.css`
- `webflow/instant-quote-head-snippet.html`
- `webflow/instant-quote-footer-snippet.html`
- `webflow/iq-style-script-watchdog.sh` (new)
- `webflow/iq-freeze-watchdog.sh` (new)

---

## Round 8 — Spacing + 2px total card + mobile submit balance (commit `17a1c06`, 2026-09-02)

### Desktop
- 50px padding below `.iq-intro-lead` ("Your settings automatically lock…")
- 50px padding below `.iq-order-lead` ("We'll confirm artwork…")
- `.iq-total-wrapper` outline halved to **2px** (`--iq-total-border-width: 2px`)

### Mobile
- 50px top padding on `.iq-intro` (Spec Engine H1 block)
- `.iq-intro-lead` right inset **30%** (body copy pulled in)
- 25px padding below `.iq-order-lead`
- Submit orbit-wrap: symmetric gradient ring (`inset: -2px`), Y-centered label, no top-heavy halo
- Calculate container: same **2px** outline as desktop

### Deploy
- CSS pin: `iqcssboot6508ffd` @ `6508ffd` (JS stack unchanged @ `aefd7a7`)
- Published: `www.lowtideflow.co` + `lowtideflow.co`
- SRI: `webflow/.iq-pin-6508ffd-sri.txt`

---

## Round 10 — Revert Round 9 + style-grid-only center (commit `5c6ffa7`, 2026-09-02)

### Reverted (Round 9)
- Section-level apparel centering (`fit-content` rows) — restored flush label/unit-price alignment
- Desktop submit +50px vertical padding bump

### Kept
- `#iq-order-form { margin-top: 50px }` — intro copy → form gap (desktop + mobile)

### Fixed
- Desktop: center **only** `.iq-style-grid` (radio options), not label box or unit price columns
- Mobile: `.iq-intro-lead` right padding **35%** (+5% from 30%)

### Deploy
- CSS pin: `iqcssboot5c6ffa7` @ `5c6ffa7`

---

## Round 11 — Submit in-place + price center + radio nudge (commit `1ccb191`, 2026-09-02)

### Radio options (desktop)
- `.iq-style-grid` nudged **+15px** right (`margin-left: 15px`)

### Price calculator values
- `#iq-total-price`, `.iq-price-box`, slider value boxes — centered **X & Y**

### Submit button
- **External** `margin-top: 50px` on orbit wrap only (no internal button padding changes)
- On success: `.w-form-done` moves **into the orbit wrap** (same grid slot as pre-submit)
- Success text: navy `#00001c`, white button footprint, **20px** (matches pre-submit, not enlarged)
- Width unchanged @ 920px desktop cap

### Deploy
- CSS: `iqcssboot1ccb191` @ `1ccb191`
- Form JS: `iqform1ccb191` @ `1ccb191` (success-in-place logic)
- Published: `www.lowtideflow.co` + `lowtideflow.co` @ 2026-09-02

---

## Round 12 — Radio 30px, form stays visible, email typo restore (commit `329bdae`, 2026-09-02)

### Radio options (desktop)
- `.iq-style-grid` nudged **+30px** right (was 15px) — includes 50/50 split row

### Total Cost price numbers
- `#iq-total-price` `padding-top: 15px` — numbers sit 15px lower

### Submit success — form no longer disappears
- Removed loop that hid all form children on success
- Removed `form.reset()` after submit — entered data stays visible
- Only hides submit button; success message shows in orbit wrap slot

### Email spell-check restored
- `initEmailTypoCatcher()` creates `#iq-email-typo-hint` after email field
- Checks on blur/change + debounced input (450ms)
- Red underlined "Did you mean …? (Click to fix)" styling in CSS (not inline JS)

### Deploy
- CSS: `iqcssboot329bdae` @ `329bdae`
- Form JS: `iqform329bdae` @ `329bdae`
- SRI: `webflow/.iq-pin-329bdae-sri.txt`
- Published: `www.lowtideflow.co` + `lowtideflow.co` @ 2026-09-02


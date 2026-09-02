# Specs Vault Slam (JS — no Webflow IX)

## Why Gemini failed

The snippet looked for `#sliding-section-2`. That id **does not exist** on Clean-slate, so the script exited immediately. Cards live under `section.ltf-specs-vault` → `.ltf-spec-card-01…04`.

## What we use instead

**File:** `js/sections/specs-vault-slam.js`

No longer pinned on its own. It loads through the single bundle entry
(`js/ltf.js`) along with every other effect — see `CLEAN-SLATE.md`. `ltf.js`
imports it only when `.ltf-specs-vault` or `[data-ltf-specs-slam]` is on the
page, so other pages never download it.

Use jsDelivr for the bundle pin, never raw.githubusercontent — its MIME type
blocks module execution.

### Behavior
- Progress 0→1 from Specs vault sticky scroll (`500vh` track)

  **This track height is load-bearing.** Progress is measured from the
  section's own scroll geometry. If `.ltf-specs-vault` collapses to roughly one
  viewport, progress never advances past 0 and the cards sit still with no
  console error — the effect looks "lost" while the script is running fine.
  Check the section height first when the slam appears dead.

- Card 01 stays as base
- Card 02 slams in **0–35%**
- Card 03 slams in **35–66%**
- Card 04 slams in **66–100%**
- Edge nebula leak behind the slamming card; fades ~1.7s; resets at vault top
- Passive scroll + `requestAnimationFrame` + lerp (no per-pixel thrash)

### Vault attrs (already set)
- `data-ltf-specs-slam`
- `data-ltf-slam-threshold="0.88"`

## Tablet band — Option A (proportional fan scaling)

**Problem (768–1280px, worst ~992–1100):** `.ltf-specs-vault-cards` uses `overflow: hidden`. JS shrinks card width to the column, but Designer fan offsets (12 / 24 / 36px) stayed fixed → card 04 clipped.

**Fix (JS only — no Designer change):** `js/sections/specs-vault-slam.js` scales fan offsets with card width (`scale = w / 480`) and reserves gutter when sizing cards (`colW / 1.075`).

| Viewport | Behavior |
|----------|----------|
| **≤991px** | Static stack — Designer + head CSS; slam JS **off** |
| **992–1280px** | Fan scales + **content-height grows** with copy; slam FX on |
| **≥1280px / wide column** | Full 480×340 cards, 0/12/24/36px fan — matches pre-fix desktop |

**Revert:** copy `webflow/_LOCKED/specs-vault-slam.js.pre-option-a-6f08be9` → `js/sections/specs-vault-slam.js`, or `git checkout 6f08be9 -- js/sections/specs-vault-slam.js`.

## You must do in Designer

1. Open Interactions on `ltf-specs-vault`
2. **Delete** (or disable) **Specs Card Reveal** — IX and JS will fight if both run
3. Preview Clean-slate and scroll the grey Specs vault

Do not keep the Gemini `#sliding-section-2` inline script in the footer.

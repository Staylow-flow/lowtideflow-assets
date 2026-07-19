# Specs Vault Slam (JS — no Webflow IX)

## Why Gemini failed

The snippet looked for `#sliding-section-2`. That id **does not exist** on Clean-slate, so the script exited immediately. Cards live under `section.ltf-specs-vault` → `.ltf-spec-card-01…04`.

## What we use instead

**File:** `js/nebula/specs-vault-slam.js`  
**Pinned footer:**

```html
<script defer src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@1b8e05c/js/nebula/specs-vault-slam.js"></script>
```

Pinned: `1b8e05c` (jsDelivr — do not use raw.githubusercontent; MIME blocks execution).

### Behavior
- Progress 0→1 from Specs vault sticky scroll (`500vh` track)
- Card 01 stays as base
- Card 02 slams in **0–35%**
- Card 03 slams in **35–66%**
- Card 04 slams in **66–100%**
- Edge nebula leak behind the slamming card; fades ~1.7s; resets at vault top
- Passive scroll + `requestAnimationFrame` + lerp (no per-pixel thrash)

### Vault attrs (already set)
- `data-ltf-specs-slam`
- `data-ltf-slam-threshold="0.88"`

## You must do in Designer

1. Open Interactions on `ltf-specs-vault`
2. **Delete** (or disable) **Specs Card Reveal** — IX and JS will fight if both run
3. Preview Clean-slate and scroll the grey Specs vault

Do not keep the Gemini `#sliding-section-2` inline script in the footer.

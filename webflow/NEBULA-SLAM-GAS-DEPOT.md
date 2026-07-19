# Nebula Slam Gas — Depot drop-in (Clean-slate Specs Vault)

## What this is

`js/nebula/nebula-slam-gas.js` is a **new folder** script that only paints nebula gas when Specs cards slam.

- Webflow IX (`Specs Card Reveal`) owns **card Move** timing on `.ltf-spec-card`
- This script owns **gas bloom + particle burst** only (rAF + lerp)
- It does **not** rewrite card transforms (so it will not fight IX)

## Why cards were not sliding

Your Interactions panel shows yellow ⚠ on every Move action. After copy/paste from Apparel-Landing-Page, IX **lost its target element IDs**. Until you retarget each Move (0% / 33% / 65% / 100%) to the four `.ltf-spec-card` nodes on Clean-slate, the stack will not animate.

MCP cannot retarget Webflow Interactions.

## Why gas was invisible

1. Old agent vault was `visibility: false` but still held `data-ltf-nebula-scroll`
2. Your pasted visible vault had **no** gas attribute
3. Previous `nebula-scroll-engine.js` also tried to **move cards** (fights IX)

## Manual steps (you)

### 1) Fix IX targets (Designer)

1. Select `ltf-specs-vault` → Interactions → **Specs Card Reveal**
2. Open each Move action with ⚠
3. Re-select target: `ltf-spec-card-01` … `ltf-spec-card-04` (or the matching cards)
4. Confirm Live Preview scrolls the stack again

### 2) Confirm custom attribute on the vault

On the **visible** Specs vault section:

- `data-ltf-nebula-gas` (empty)
- `data-ltf-slam-threshold` = `0.88`

### 3) Paste depot script in Page Footer

Replace the old `nebula-scroll-engine.js` line with:

```html
<script defer src="https://raw.githubusercontent.com/Staylow-flow/lowtideflow-assets/d1b2b99069d02a37a968e4e411db0df4c508ca47/js/nebula/nebula-slam-gas.js"></script>
```

Pinned commit: `d1b2b99` (also mirrored in `webflow/clean-slate-footer.html`).

### 4) Dead space under Hero

Usually leftover **extra** `ltf-specs-vault` sections (agent rebuild + your paste). Keep one vault only. Delete hidden/duplicate vaults in Navigator. Specs vault itself is intentionally tall (`~500vh`) so sticky scroll has room — that is not Hero padding.

## Migration note

Treat Clean-slate as the master page. Prefer **paste one section at a time** from Apparel, then immediately retarget IX, rather than bulk agent rebuilds of sticky/IX sections.

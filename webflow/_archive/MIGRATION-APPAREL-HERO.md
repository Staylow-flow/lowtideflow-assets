# Webflow Migration — Apparel Landing Hero

Deploy the local hero preview to **Apparel Landing Page** (`/apparel-landing-page`) only.  
Nav stays **page-level** — not a global component.

---

## 1. Upload assets (your end)

Upload these to **Webflow → Assets** (or push to `lowtideflow-assets` GitHub and use raw URLs):

| File | Size | Purpose |
|------|------|---------|
| `soapstone.glb` | ~7.2 MB | 3D rock model |
| `js/rock-scene.js` | ~49 KB | Nebula + rock WebGL (ES module) |
| `js/ltf-btn-gradient.js` | ~1 KB | Button gradient click effect |

After upload, copy each **CDN URL** from Webflow Assets. Example pattern:

```
https://cdn.prod.website-files.com/6789f449bbb1a21245706751/<asset-id>_soapstone.glb
https://cdn.prod.website-files.com/6789f449bbb1a21245706751/<asset-id>_rock-scene.js
https://cdn.prod.website-files.com/6789f449bbb1a21245706751/<asset-id>_ltf-btn-gradient.js
```

**Alternative:** Push to `Staylow-flow/lowtideflow-assets` on branch `cursor/add-soapstone-glb-asset` and use jsDelivr:

```
https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@cursor/add-soapstone-glb-asset/js/rock-scene.js
```

---

## 2. Page custom code — Apparel Landing Page only

**Project Settings → Custom Code → do NOT add site-wide.**  
Use **Pages → Apparel Landing Page → Page Settings → Custom Code**.

### Inside `<head>` — add AFTER existing `<style>` block

Paste contents of `webflow/ltf-apparel-hero-migration.css` wrapped in `<style>...</style>`.

Also add Three.js import map + rock scene loader (replace `YOUR_*` URLs):

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/"
  }
}
</script>
```

### Before `</body>` — footer custom code

```html
<script type="module" src="YOUR_ROCK_SCENE_CDN_URL?v=1"></script>
<script defer src="YOUR_BTN_GRADIENT_CDN_URL?v=1"></script>
```

---

## 3. Hero DOM (`ltf-hero` section)

### Rock canvas container

Use the existing `ltf-3d-canvas-wrapper` div (or add a Div Block):

- **Class:** `ltf-rock-stage` (keep or add alongside `ltf-3d-canvas-wrapper`)
- **Custom attributes:**
  - `data-ltf-rock` = (empty value)
  - `data-model-url` = `YOUR_SOAPSTONE_GLB_CDN_URL`
- **Position:** absolute, inset 0, z-index 0
- **Visible:** yes

`rock-scene.js` auto-inits on any `[data-ltf-rock]` element.

### Orange shirt figure

- Class: `ltf-hero-figure-img` (already on page)
- CSS from migration file sets `width: clamp(200px, 33.75vw, 488px)`

### Headline (update copy)

```
TOUGH APPAREL
TO WITHSTAND THE WORLD
```

### Paragraph (update copy)

```
Built on a foundation of Art, Culture, and Technology. LowTideFlow.co has spent over a decade developing cutting-edge apparel designs and brand identities for operations within SoCal, and across the country.
```

### CTA button — gradient wrap

Webflow cannot use `<span>` wrappers natively in all cases. Options:

**A (Designer):** Embed a small HTML embed before the link:

```html
<div class="ltf-btn-gradient-wrap"><a href="#" class="ltf-btn-primary w-button">Equip Your Crew</a></div>
```

**B (MCP / Embed):** Add Html Embed block with the wrapper + link.

Button text: **Equip Your Crew**

---

## 4. Page nav (NOT global)

Add a **Section or Div Block** at the **top of the page** (above `ltf-hero`):

```html
<header class="ltf-site-nav" role="banner">
  <div class="ltf-nav-inner">
    <a class="ltf-nav-brand" href="/">
      <img src="https://cdn.prod.website-files.com/6789f449bbb1a21245706751/6789f4edaae5c8cfcfd404bd_LTF%20-%20URL%20Logo%20-%20White.png" alt="Low Tide Flow Co." />
    </a>
    <nav class="ltf-nav-links" aria-label="Primary">
      <a class="ltf-nav-link" href="#">Production</a>
      <a class="ltf-nav-link" href="#">Tech Spec</a>
      <a class="ltf-nav-link" href="#">Squad</a>
      <a class="ltf-nav-link" href="#">Brand Identity</a>
    </nav>
    <div class="ltf-nav-actions">
      <span class="ltf-btn-gradient-wrap">
        <a class="ltf-nav-btn-contact" href="#">Contact</a>
      </span>
      <span class="ltf-btn-gradient-wrap">
        <a class="ltf-nav-btn-quote" href="#">Instant Quote</a>
      </span>
    </div>
  </div>
</header>
```

Use an **Embed element** at page top, or build with native Webflow elements + combo classes.

---

## 5. MCP bridge — what Cursor can push for you

With Webflow MCP connected, ask Cursor to:

1. **Append** `ltf-apparel-hero-migration.css` to page head freeform code
2. **Update text** on H1, paragraph, CTA via `data_element_tool`
3. **Set attributes** on rock div: `data-ltf-rock`, `data-model-url`
4. **Register hosted scripts** via `data_scripts_tool` once CDN URLs exist
5. **Update styles** on `ltf-hero-figure-img` if native style panel preferred over CSS

**You must still:**

- Upload `soapstone.glb` + JS files to Webflow Assets (or GitHub CDN)
- Paste the final CDN URLs into custom code / `data-model-url`
- Publish **Apparel Landing Page** when ready (not whole site unless intended)

---

## 6. Verify checklist

- [ ] Rock + nebula render in hero
- [ ] Scroll rotates rock
- [ ] Mouse hover on rock area tilts subtly
- [ ] Orange figure scales with viewport width
- [ ] Nav sticky, frosted, page-only
- [ ] CTA + nav buttons show nebula gradient on hover/click
- [ ] Hero CTA has white border at rest
- [ ] Other site pages unchanged (no global nav/scripts)

---

## 7. Rollback

- Remove page footer scripts
- Remove appended CSS from page head
- Hide `ltf-rock-stage` div, re-show static boulder image if needed
- Delete page-top nav embed

Rock motion fallback constants live in `rock-scene.js` → `ROCK_MOTION_BASELINE` and `GAS_LOCKED_BOUNDS`.

# Clean Slate — Classic HTML Embed Workflow

Page slug: **`clean-slate`**

## Structure

```
hero-canvas-wrapper (native div, fixed full-viewport)
  └── HTML Embed
        <canvas id="canvas3d" style="width:100%;height:100%;display:block;"></canvas>
```

No `data-ltf-rock` or `data-model-url` attributes.

## Footer custom code (Before `</body>`)

See `webflow/clean-slate-footer.html`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@main/js/rock-scene.js"></script>
```

Update JS: push to `main` on GitHub — CDN reflects within minutes.

Swap rock GLB later: edit `DEFAULT_MODEL_URL` in `js/rock-scene.js` or add `data-model-url` back optionally.

## No registered scripts

Do not use `ltfrockloader` — scripts live in page footer custom code only.

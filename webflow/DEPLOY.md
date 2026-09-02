# DEPLOY GUIDE — Without breaking the locked build

Read **`LOCKED-BUILD.md`** first. This file is the how-to for each deploy surface.

---

## 1. Site head (nav + footer FX — all pages)

**When:** Nav FX, footer FX, or Three.js importmap changes.

**Source files:**
1. `webflow/site-nav-fx.html`
2. `webflow/ltf-site-footer-fx.html`

**Assemble:**
```bash
python3 - <<'PY'
from pathlib import Path
import json
nav = Path('webflow/site-nav-fx.html').read_text()
footer = Path('webflow/ltf-site-footer-fx.html').read_text()
importmap = '''<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/"
  }
}
</script>

'''
combined = importmap + nav + '\n' + footer
Path('webflow/_restore_head_now.json').write_text(json.dumps({
  'actions': [{
    'label': 'deploy site head',
    'set_site_freeform_code': {
      'site_id': '6789f449bbb1a21245706751',
      'location': 'head',
      'content': combined
    }
  }],
  'context': 'Deploying locked site head from repo canonical nav + footer FX files.'
}))
print(len(combined), 'chars')
PY
```

**Deploy:** Webflow MCP `data_scripts_tool` → `set_site_freeform_code` using `_restore_head_now.json`.

**Verify:**
- `get_site_freeform_code` head contains `#ltf-site-nav-fx` and `#ltf-site-footer-fx`
- No duplicate nav block inside Clean-Slate page head

---

## 2. Clean-Slate page head

**When:** Hero, cards, upsell, magnifier FX only.

**Source:** `webflow/live-page-head.html` → `#ltf-clean-slate-fx`

**Target:** Page Settings → Custom Code → Head on `/clean-slate` only.

**Never** include nav rules here — they live in site head.

---

## 3. Clean-Slate page footer

**When:** `ltf.js`, rock-scene, or hero-viewport changes.

**Source:** `webflow/clean-slate-footer.html` (3 tags @ pinned commit)

**Target:** Page Settings → Custom Code → Before `</body>` on `/clean-slate`.

**Rules:**
- Exactly 3 script tags, same commit SHA
- Rock-scene **first**, ltf.js **second**, hero-viewport **third**
- Never merge into one boot script

---

## 4. Site nav JS boot (all pages except Clean-Slate internal boot)

**When:** `js/nav.js`, `nav-mobile.js`, `nav-comms.js`, or `btn-gradient.js` changes.

1. Push to `Staylow-flow/lowtideflow-assets` at new commit
2. Update site registered script `ltfnavboot*` footer injector URL
3. Update `PIN-MANIFEST.md`

---

## 5. Instant Quote

**When:** IQ CSS or form logic changes.

1. Edit `webflow/instant-quote-embed.css` and/or `js/instant-quote-*.js`
2. Push to GitHub → new commit
3. Update registered scripts on `/instant-quote`:
   - Header: CSS boot (`iqcssboot<commit>`)
   - Footer: form + pricing + UI boots
4. Write SRI to `webflow/.iq-pin-<commit>-sri.txt`
5. Append round to `INSTANT-QUOTE-STATUS.md`
6. Run `webflow/iq-style-script-watchdog.sh` if available

**Footer custom code:** HTML modal only — `instant-quote-footer-snippet.html`. No `<script>` tags when registered scripts are active.

---

## 6. Footer / Nav Designer changes

**When:** Copy, spacing, links, layout.

1. Open component in Webflow Designer (LTF Site Nav or LTF Site Footer)
2. Edit classes — one change updates all 6 pages
3. Document dialed values in `LTF-SITE-FOOTER.md` or `LTF-SITE-NAV.md`
4. Publish

No head deploy needed unless FX (hover, animation) changes.

---

## 7. Publish + QA

1. **Publish** site in Webflow (Designer changes require publish; site head MCP deploy is live immediately)
2. Hard-refresh (cache-bust) these URLs:
   - `https://www.lowtideflow.co/clean-slate`
   - `https://www.lowtideflow.co/instant-quote`
   - `https://www.lowtideflow.co/production`
3. Check: nav hide-on-scroll, OPEN COMMS popout, footer legal bars aligned, IQ form submit

---

## Conflict prevention

| Mistake | Prevention |
|---------|------------|
| Pasting `clean-slate-head.html` to site head | Use `live-page-head.html` (page) + `site-nav-fx.html` (site) |
| Moving JS to `<head>` | `.cursor/rules/ltf-locked-build.mdc` |
| Old IQ pin | Check `PIN-MANIFEST.md` — current CSS/form = `329bdae` |
| Duplicate footer in component | One `ltf-site-footer` root only |
| Forgetting `large`/`xl`/`xxl` breakpoints | Audit additive desktop overrides in Designer |

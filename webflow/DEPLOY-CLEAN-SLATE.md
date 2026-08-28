# Deploy clean-slate mobile fixes to Webflow

GitHub has the fixes on **`main` @ `2047dec`**. Webflow must be updated manually or via API — publish alone does not pull from GitHub.

## What changes

| Layer | File | Action |
|-------|------|--------|
| **Head (append)** | `webflow/clean-slate-head-mobile-append.html` | Paste at **bottom** of page Head custom code |
| **Footer (replace jsDelivr block)** | `webflow/clean-slate-page-footer-deploy.html` | Replace old `@683a890` tags + remove duplicates |
| **Designer copy** | Launch funnel `.ltf-funnel-cta-threshold` | Change to **DIAL YOUR SPECS ON OUR LIVE BUILDER** |

## Option A — Webflow Designer (paste)

1. Open [clean-slate in Designer](https://lowtideflow-co-v2-build.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99)
2. **Page settings (gear) → Custom Code**
3. **Inside `<head>`** — scroll to the bottom, paste all of `clean-slate-head-mobile-append.html`
4. **Before `</body>`** — delete every `cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@683a890` script (including duplicates and page-level `nav.js`). Paste `clean-slate-page-footer-deploy.html` in place of the old jsDelivr block (keeps Acumin swap script).
5. **Designer** — edit funnel threshold text (see above)
6. **Publish** to production

## Option B — Webflow API (automated)

```bash
export WEBFLOW_API_TOKEN="your-token"
node scripts/deploy-clean-slate-webflow.mjs          # update custom code only
node scripts/deploy-clean-slate-webflow.mjs --publish  # update + publish
```

Token: Webflow → Site settings → Apps & integrations → API access.

## Verify after publish

View source on `https://lowtideflow.co/clean-slate`:

- `@2047dec` in script URLs (not `@683a890`)
- `hero-viewport.js` present
- `bottom: -15px` in head `<style>`
- Each of `rock-scene.js` and `ltf.js` loads **once**

## Footer tag reference (maintenance)

Dual core + optional third tag (see `webflow/clean-slate-footer.html`):

```html
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/hero/rock-scene.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/ltf.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@2047dec/js/ui/hero-viewport.js"></script>
```

Site-wide nav-only pages: `webflow/clean-slate-footer-site.html` (`nav.js` only).

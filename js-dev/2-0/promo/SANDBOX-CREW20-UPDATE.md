# Sandbox CREW20 (step 2 — CSS + pinned script)

Step 2 **must** ship `instant-quote-embed.css` and `crew20-promo-sandbox.js` from the **same commit**. The CSS rule `.iq-receipt-right > #crew20 { display: none !important; }` hides the Webflow sibling promo row; only the copy of `#crew20` moved **inside** `.iq-total-wrapper` (below `.iq-artwork-info-link`) stays visible.

## Remove inline v06 entirely (do not run alongside the pin)

In Webflow **Spec Engine Sandbox** → **Custom Code** → **Before `</body>`**, delete **both** of the following in one edit:

1. The HTML comment line that starts with:
   `<!-- CREW20 promo 10-07-26-06 SANDBOX ONLY`
2. The **very next** `<script>...</script>` block — the minified IIFE that defines `#crew20`, `#c20-btn`, fetches the same Apps Script URL, and references `CREW20` / `c20-btn` in source.

After removal, **no** inline script on that page should contain both `CREW20` and `c20-btn`. If v06 remains, you can get duplicate handlers, a hidden sibling `#crew20`, or a promo that never appears inside the total card.

## Add the pinned script (single tag)

Replace the removed block with **one** script tag (update `COMMIT_SHA` to the step 2 git SHA):

```html
<script src="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@COMMIT_SHA/js-dev/2-0/promo/crew20-promo-sandbox.js"></script>
```

The pinned file keeps the same Apps Script web app URL and claim/check behavior as v06. It only:

- Ensures `#crew20` lives in `.iq-total-wrapper` after `.iq-artwork-info-link` (relocates an existing node or builds one when `?code=CREW20` is present).
- Calls `S()` to set `#iq-form-artwork-drop` height to match `.iq-total-wrapper` when the promo is visible (`window.__ltfCrew20SyncPanels`).

## CSS pin (same commit as the script)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@COMMIT_SHA/js-dev/2-0/webflow/instant-quote-embed.css">
```

Use the **step 1 SHA** for CSS-only Live drift fixes; use the **step 2 SHA** when enabling in-sandbox CREW20 layout (equal column heights + in-card promo).

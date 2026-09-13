# Clean-Slate — manual custom code (preferred)

MCP `set_page_freeform_code` often **times out** on the full page head (~30k chars). **Paste in Webflow Designer** instead, then **Publish**.

## Before you paste

```bash
python3 webflow/watchdogs/hero-compliance-watchdog.py
```

Must exit **0**. Never paste partial head, `PLACEHOLDER`, or `@file:` paths.

## Page head

1. Open **Clean-Slate** → **Page settings** → **Custom Code** → **Head**.
2. Select all → delete → paste **entire** contents of:
   - `webflow/live-page-head.html`
3. **Save** (not Publish yet).
4. Confirm the pasted block includes:
   - `id="ltf-clean-slate-fx"`
   - `id="ltf-mobile-fixes"`
   - `id="ltf-hero-mode-b"` (tablet / landscape Inside bar)
5. **Publish** site (both domains).

## Page footer (Before `</body>`)

Paste **only** the three `<script>` lines from `webflow/clean-slate-footer.html` (no HTML comments required).

**Golden pin:** see `webflow/watchdogs/hero-golden.json` → `rock_scene_pin` (currently `3ad011d`).

## After publish

```bash
python3 webflow/watchdogs/live-drift-watchdog.py
```

Live HTML must show the golden pin and **must not** contain `@file:` or `PLACEHOLDER`.

## Designer checklist (Inside bar — tablet 768–991 + phone landscape)

Primary hero bar stays as-is for **desktop ≥992** and **phone portrait ≤767**.

For middle modes, duplicate elements need these combo classes (see `CLEAN-SLATE.md`):

| Element | Class |
|---------|--------|
| Inside copy stack | `is-hero-copy-inside-breakpoints` |
| Inside body | `is-hero-body-inside` |
| Inside CTA wrap | `is-hero-cta-wrap-inside` |
| Inside logo | `is-hero-logo-inside` |
| Inside shirt | `is-hero-figure-inside` |

Tune shirt size/position in Designer on **inside** figure; head `#ltf-hero-mode-b` only toggles visibility + grid shell.

## Do not use

- `PASTE-*.html`, `clean-slate-head.html`, or stub JSON from `webflow/.mcp_*` / `webflow/.deploy_*`
- MCP deploy of head unless you have verified full `content` string in a local JSON file first

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

## Site footer bar FX (global — all pages) — **required for mobile footer layout**

**Site settings → Custom Code → Head:** deploy assembled site head (`site-nav-fx.html` + `ltf-site-footer-fx.html`).  
Clean-Slate **page** head/footer tags do **not** include `#ltf-site-footer-fx` — if you only paste page code, footer grid/pill changes never go live.

```bash
python3 webflow/verify_head_payload.py site   # after assemble in DEPLOY.md §1
```

Then MCP site head or manual paste full assembled string from `webflow/_restore_head_now.json` → `content`. Live check: `#ltf-site-footer-fx` should contain `nth-child(3)` grid rules (~6k chars in that block).

## Site global footer code (nav boot)

**Site settings → Custom Code → Footer:** paste `webflow/site-custom-footer-code.html` (scripts only — no hero CSS).

## Clean-Slate page footer (this page only)

Paste the three `<script>` lines from `webflow/clean-slate-footer.html` @ golden pin.

**Golden pin:** see `webflow/watchdogs/hero-golden.json` → `rock_scene_pin` (currently `94203c3`).

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

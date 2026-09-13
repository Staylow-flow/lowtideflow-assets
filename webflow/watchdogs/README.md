# LTF watchdogs (Clean-Slate + architecture)

**Primary gate:** `architecture-freeze-watchdog.py` — LOCKED-BUILD constraints, checksums, hero compliance, live pin freeze.  
**Hero + drift:** compliance and live HTML checks (also invoked by the architecture gate).

## Golden source

`hero-golden.json` — live footer pin (`rock_scene_pin`), required head markers, forbidden placeholder strings, mode policy.

**Current repo golden pin:** `94203c3`

## Manual paste (preferred for page head)

MCP head deploy often times out (~30k chars). Use **`webflow/MANUAL-PASTE-clean-slate.md`** — paste full `live-page-head.html` in Page settings → Head, footer scripts from `clean-slate-footer.html`, then Publish. Run drift watchdog after.

## 0 — Architecture & freeze (run before every deploy)

```bash
python3 webflow/watchdogs/architecture-freeze-watchdog.py
```

Config: `architecture-golden.json`. Enforces:

- `webflow/_LOCKED/CHECKSUMS.sha256` vs canonical files
- Clean-Slate page footer: **3 scripts**, single pin; no hero CSS in footer slots
- Site footer **bar** FX: `ltf-site-footer-fx.html` (site head); hero logo size: `#ltf-mobile-fixes` in page head
- Page head must not include site nav FX or jsDelivr script tags
- Middle-mode CSS stays in `#ltf-hero-mode-b` (not `#ltf-mobile-fixes` only)
- Site head sources (`site-nav-fx.html`, `ltf-site-footer-fx.html`) — no placeholders
- Delegates to `hero-compliance-watchdog.py` + optional `verify_head_payload.py site`
- Live `/clean-slate` pin vs `hero-golden.json` — **FAIL after 3 consecutive mismatches** (`.architecture-freeze-state.json`)

Automation prompt: `AUTOMATION-architecture-freeze.md`.

**Exit 0 = safe to deploy.** Exit 1 = do not call Webflow MCP `set_*_freeform_code`.

## 1 — Compliance (quick check; included in architecture gate)

```bash
python3 webflow/watchdogs/hero-compliance-watchdog.py
```

Runs:

- `verify_head_payload.py page`
- `verify_hero_portrait_css.py`
- Repo vs golden footer pin (warn if mismatch)
- Page head length + forbidden tokens
- Hero layout sprawl checks (primary bar / canvas offsets in `#ltf-mobile-fixes`)
- JS boundary checks (`hero-viewport.js`, `hero-mobile-portrait.js`)

**Exit 0 = safe to deploy.** Exit 1 = do not call Webflow MCP `set_*_freeform_code`.

## 2 — Live drift (schedule every 5 minutes)

```bash
python3 webflow/watchdogs/live-drift-watchdog.py
```

Fetches published `/clean-slate` HTML and verifies:

- Footer `rock-scene.js` @ `hero-golden.json` pin
- No `PLACEHOLDER`, `@file:`, etc.
- Required `#ltf-clean-slate-fx` / `#ltf-mobile-fixes` markers in HTML

State file: `.live-drift-state.json` (gitignored) — detects stuck wrong pin across runs.

```bash
./webflow/watchdogs/run-all.sh
```

Runs architecture-freeze (includes compliance) then live drift.

## Cursor Automation (5m drift)

Create a **scheduled** automation in Cursor (Agents Window → Automations):

| Field | Value |
|-------|--------|
| Trigger | Cron `*/5 * * * *` (every 5 minutes) |
| Repo | `Staylow-flow/lowtideflow-assets` (this repo) |
| Instructions | See `AUTOMATION-live-drift.md` |

## Cursor Automation (compliance on push)

Optional: git push trigger running `hero-compliance-watchdog.py` only (no Webflow deploy).

See `AUTOMATION-compliance-on-change.md`.

## Tablet Inside bar (next build)

- **768–991 portrait + landscape:** Designer **Inside** stack only.
- Head toggles belong in `<style id="ltf-hero-mode-b">` — not `#ltf-mobile-fixes`.
- Compliance warns if `is-hero-copy-inside-breakpoints` appears without `#ltf-hero-mode-b`.

## Screenshot audit (manual / agent)

```bash
python3 demo/hero-audit-breakpoints/_verify-full-audit.py
```

Golden PNGs: `demo/hero-audit-breakpoints/` — re-capture after any hero change; desktop + phone portrait must not regress.

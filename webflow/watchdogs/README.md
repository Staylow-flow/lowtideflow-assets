# Hero watchdogs (Clean-Slate)

Two gates protect **locked** mobile portrait + desktop hero layouts while tablet **Inside bar** work proceeds.

## Golden source

`hero-golden.json` — live footer pin (`rock_scene_pin`), required head markers, forbidden placeholder strings, mode policy.

**Current live pin (user-approved):** `46af839`

## Manual paste (preferred for page head)

MCP head deploy often times out (~30k chars). Use **`webflow/MANUAL-PASTE-clean-slate.md`** — paste full `live-page-head.html` in Page settings → Head, footer scripts from `clean-slate-footer.html`, then Publish. Run drift watchdog after.

## 1 — Compliance (run before every head/footer deploy)

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

Runs compliance then live drift.

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

# Automation prompt — Architecture & freeze gate

Use for **pre-deploy** (manual run, git push hook, or agent before any Webflow MCP deploy).

---

You enforce **Project Architecture & Constraints** (`webflow/LOCKED-BUILD.md`, `webflow/DEPLOY.md`, `.cursor/rules/ltf-locked-build.mdc`, `.cursor/rules/ltf-no-placeholder-head-deploy.mdc`).

1. Repo root:
   ```bash
   python3 webflow/watchdogs/architecture-freeze-watchdog.py
   ```
2. Exit **0** → reply `ARCHITECTURE OK` (include pin from output).
3. Exit **1** → reply **`ARCHITECTURE / FREEZE ALERT`** with stderr. Do **not** call `set_site_freeform_code` or `set_page_freeform_code` until fixed.

Common fixes:

| Failure | Action |
|---------|--------|
| Checksum drift | Intentional edit → update `webflow/_LOCKED/CHECKSUMS.sha256` + `PIN-MANIFEST.md` |
| Footer pin mismatch | Align `clean-slate-footer.html`, `hero-golden.json`, live paste |
| Live pin frozen wrong (3+ checks) | Paste footer @ golden pin → **Publish** |
| Site head payload | Run assemble in `DEPLOY.md` → `verify_head_payload.py site` |
| Page head placeholder | Full `live-page-head.html` only — manual paste default |

Optional full stack:

```bash
./webflow/watchdogs/run-all.sh
```

**Never** deploy with `PLACEHOLDER`, `@file:`, or truncated head content.

---

**Trigger ideas:** Before deploy (user message), cron `*/5 * * * *` combined with `AUTOMATION-live-drift.md`, or push to `cursor/instant-quote-v2`.

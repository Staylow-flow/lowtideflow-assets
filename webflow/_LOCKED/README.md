# Stale deploy artifacts

These files are **not** source of truth. Use `LOCKED-BUILD.md` and `DEPLOY.md` instead.

| Pattern | Purpose |
|---------|---------|
| `PASTE-*.html` | One-off deploy snapshots — use only if filename commit matches intended pin |
| `_deploy*.json`, `_invoke*.json`, `_mcp*.json` | MCP replay payloads |
| `clean-slate-head.html` | Pre-split page head (includes nav) — use `live-page-head.html` |
| `clean-slate-head.FULL-ARCHIVE.html` | Monolith archive |

**Canonical deploy template for site head:** `_restore_head_now.json`

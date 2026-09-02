#!/usr/bin/env bash
# Instant Quote — Freeze Watchdog (15-minute interval)
# Checks that Cursor agent terminals aren't stuck with no recent output.
# Usage (background): ./webflow/iq-freeze-watchdog.sh &
# Or via loop skill: while true; do ./webflow/iq-freeze-watchdog.sh; sleep 900; done

set -euo pipefail

TERMINALS_DIR="${HOME}/.cursor/projects/Users-natetaylor-Lowtideflow-Apparel-V1/terminals"
STALE_SEC=900  # 15 minutes
NOW=$(date +%s)
FAIL=0

log() { printf '[iq-freeze] %s\n' "$*"; }

if [[ ! -d "$TERMINALS_DIR" ]]; then
  log "No terminals dir — nothing to watch"
  exit 0
fi

for f in "$TERMINALS_DIR"/*.txt; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f")"
  # Skip if no active command in metadata
  if ! head -n 8 "$f" | rg -q 'active_command:'; then
    continue
  fi
  active=$(head -n 8 "$f" | rg 'active_command:' | sed 's/active_command: //')
  [[ -z "$active" || "$active" == "null" ]] && continue
  mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null)
  age=$((NOW - mtime))
  if [[ "$age" -gt "$STALE_SEC" ]]; then
    log "STALE terminal ${name}: '${active}' — no output for ${age}s"
    FAIL=1
  else
    log "Active terminal ${name}: '${active}' (${age}s since last write)"
  fi
done

# Also ping live IQ page (quick sanity — not a full style watchdog)
if curl -fsSL -o /dev/null -w '' --max-time 20 "https://www.lowtideflow.co/instant-quote" 2>/dev/null; then
  log "Live page reachable"
else
  log "WARN: live page unreachable"
fi

exit "$FAIL"

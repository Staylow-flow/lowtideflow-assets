#!/usr/bin/env bash
# Instant Quote — Style/Script Watchdog
# Verifies live /instant-quote loads full embed.css + 4-script stack @ expected pin.
# Usage: ./webflow/iq-style-script-watchdog.sh [commit-pin]
# Exit 0 = pass, 1 = fail

set -euo pipefail

PIN="${1:-8b55a89}"
URL="https://www.lowtideflow.co/instant-quote"
FAIL=0

log() { printf '[iq-watchdog] %s\n' "$*"; }
fail() { log "FAIL: $*"; FAIL=1; }
pass() { log "OK:   $*"; }

HTML="$(curl -fsSL "$URL" 2>/dev/null || true)"
if [[ -z "$HTML" ]]; then
  fail "Could not fetch $URL"
  exit 1
fi

# Reject stale single-bundle pin
if echo "$HTML" | rg -q "instant-quote-bundle\.js"; then
  fail "Stale instant-quote-bundle.js detected (use 4-script stack)"
else
  pass "No stale bundle script"
fi

# Required 4-script stack
for script in instant-quote-pricing-data instant-quote-pricing instant-quote-form instant-quote-ui; do
  if echo "$HTML" | rg -q "lowtideflow-assets@${PIN}/js/${script}\.js"; then
    pass "${script}.js @${PIN}"
  else
    fail "Missing or wrong pin for ${script}.js (expected @${PIN})"
  fi
done

# Full embed.css (~60KB, not stripped 29KB bundle)
CSS_URL="https://cdn.jsdelivr.net/gh/Staylow-flow/lowtideflow-assets@${PIN}/webflow/instant-quote-embed.css"
CSS_BYTES="$(curl -fsSL "$CSS_URL" 2>/dev/null | wc -c | tr -d ' ')"
if [[ "${CSS_BYTES:-0}" -lt 50000 ]]; then
  fail "embed.css too small (${CSS_BYTES} bytes) — likely stripped pin"
else
  pass "embed.css size ${CSS_BYTES} bytes (full FX CSS)"
fi

# FX class markers in CSS
CSS_BODY="$(curl -fsSL "$CSS_URL" 2>/dev/null || true)"
for marker in iq-form-upload-ants iq-orbit-drift is-submitting; do
  if echo "$CSS_BODY" | rg -q "$marker"; then
    pass "CSS marker: ${marker}"
  else
    fail "CSS missing marker: ${marker}"
  fi
done

if [[ "$FAIL" -eq 0 ]]; then
  log "Style/Script Watchdog PASSED (@${PIN})"
else
  log "Style/Script Watchdog FAILED (@${PIN})"
fi
exit "$FAIL"

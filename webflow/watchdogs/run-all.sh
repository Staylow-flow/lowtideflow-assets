#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "=== architecture + freeze (LOCKED-BUILD, compliance, live pin) ==="
python3 webflow/watchdogs/architecture-freeze-watchdog.py
echo "=== live drift (detailed markers) ==="
python3 webflow/watchdogs/live-drift-watchdog.py
echo "=== all watchdogs PASS ==="

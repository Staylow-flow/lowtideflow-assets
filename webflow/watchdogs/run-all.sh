#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "=== hero compliance ==="
python3 webflow/watchdogs/hero-compliance-watchdog.py
echo "=== live drift ==="
python3 webflow/watchdogs/live-drift-watchdog.py
echo "=== all watchdogs PASS ==="

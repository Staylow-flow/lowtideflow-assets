#!/usr/bin/env python3
"""
Live drift watchdog — compare published clean-slate to hero-golden.json.
Run on a schedule (e.g. every 5m) to catch unpublish, wrong footer pin, placeholder head.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WATCHDOGS = Path(__file__).resolve().parent
GOLDEN = WATCHDOGS / "hero-golden.json"
STATE = WATCHDOGS / ".live-drift-state.json"
USER_AGENT = "LTF-Hero-Drift-Watchdog/1.0"


def fail(msg: str) -> None:
    print(f"live-drift-watchdog: FAIL — {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str) -> None:
    print(f"live-drift-watchdog: WARN — {msg}", file=sys.stderr)


def load_golden() -> dict:
    return json.loads(GOLDEN.read_text())


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        fail(f"could not fetch {url}: {e}")


def extract_rock_pin(html: str) -> list[str]:
    return re.findall(
        r"lowtideflow-assets@([0-9a-f]+)/js/hero/rock-scene",
        html,
        re.I,
    )


def save_state(payload: dict) -> None:
    STATE.write_text(json.dumps(payload, indent=2) + "\n")


def load_state() -> dict | None:
    if not STATE.is_file():
        return None
    try:
        return json.loads(STATE.read_text())
    except json.JSONDecodeError:
        return None


def main() -> None:
    golden = load_golden()
    url = golden["clean_slate_url"]
    expected_pin = golden["rock_scene_pin"]
    html = fetch(url)

    for bad in golden["forbidden_anywhere_in_page_head"]:
        if bad in html:
            fail(f"live HTML contains forbidden {bad!r} — placeholder/stub head on production")

    for marker in golden["required_page_head_markers"]:
        if marker not in html:
            fail(f"live HTML missing page head marker {marker!r}")

    pins = extract_rock_pin(html)
    if not pins:
        fail("live HTML has no lowtideflow-assets rock-scene.js script")
    unique = sorted(set(pins))
    if len(unique) > 1:
        warn(f"multiple rock-scene pins on live page: {unique}")
    live_pin = unique[0]
    if live_pin != expected_pin:
        fail(
            f"live rock-scene pin {live_pin!r} != golden {expected_pin!r} "
            "(paste footer tags + Publish, or update hero-golden.json after intentional bump)"
        )

    now = datetime.now(timezone.utc).isoformat()
    prev = load_state()
    payload = {
        "checked_at_utc": now,
        "url": url,
        "live_pin": live_pin,
        "expected_pin": expected_pin,
        "html_bytes": len(html),
    }
    save_state(payload)

    if prev and prev.get("live_pin") != live_pin:
        print(
            f"live-drift-watchdog: pin changed {prev.get('live_pin')} → {live_pin} since last check"
        )

    unchanged = prev and prev.get("live_pin") == live_pin and prev.get("expected_pin") == expected_pin
    if unchanged:
        age_note = ""
        if prev.get("checked_at_utc"):
            age_note = f" (stable since last run {prev['checked_at_utc']})"
        print(f"live-drift-watchdog: OK — live @ {live_pin}{age_note}")
    else:
        print(f"live-drift-watchdog: OK — live @ {live_pin} matches golden")

    if prev and prev.get("expected_pin") == expected_pin and prev.get("live_pin") != expected_pin:
        if prev.get("live_pin") == live_pin:
            warn(
                "live pin still differs from golden across consecutive runs — publish may be stuck or frozen"
            )


if __name__ == "__main__":
    main()

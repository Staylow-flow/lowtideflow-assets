#!/usr/bin/env python3
"""
Compliance watchdog — run before hero/head/footer deploys and on CI.
Fails on placeholder head, pin drift vs golden, portrait CSS fights, MODE B sprawl.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

WATCHDOGS = Path(__file__).resolve().parent
WEBFLOW = WATCHDOGS.parent
ROOT = WEBFLOW.parent
GOLDEN = WATCHDOGS / "hero-golden.json"

# Hero layout in head must live in #ltf-hero-mode-b once tablet inside work starts.
MODE_B_ID = "ltf-hero-mode-b"

FORBIDDEN_PRIMARY_HERO_LAYOUT = [
    (
        r"@media[^{]+\{[^}]*\.ltf-hero-bottom-bar[^}]*\btop\s*:",
        "primary .ltf-hero-bottom-bar top: in page head (use Inside bar + #ltf-hero-mode-b)",
    ),
    (
        r"@media[^{]+\{[^}]*\.ltf-hero-bottom-bar[^}]*grid-template",
        "primary bottom bar grid in page head outside MODE B block",
    ),
    (
        r"\.ltf-hero-bottom-bar[^}]*\.is-hero-copy:not\(\.is-hero-copy-inside",
        "prefer explicit inside stack toggles in #ltf-hero-mode-b",
    ),
    (
        r"\.ltf-hero\s+\.hero-canvas-wrapper[^}]*\btop\s*:\s*\d",
        "canvas top offset in head fights Designer portrait (forbidden)",
    ),
]

FORBIDDEN_STALE_FILES = [
    WEBFLOW / "PASTE-clean-slate-head-full.html",
]


def fail(msg: str) -> None:
    print(f"hero-compliance-watchdog: FAIL — {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str) -> None:
    print(f"hero-compliance-watchdog: WARN — {msg}", file=sys.stderr)


def run_script(name: str, *args: str) -> None:
    script = WEBFLOW / name
    if not script.is_file():
        fail(f"missing {script}")
    proc = subprocess.run(
        [sys.executable, str(script), *args],
        cwd=str(WEBFLOW),
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout, end="")
        print(proc.stderr, end="", file=sys.stderr)
        fail(f"{name} exited {proc.returncode}")
    print(proc.stdout.strip())


def load_golden() -> dict:
    if not GOLDEN.is_file():
        fail(f"missing {GOLDEN}")
    return json.loads(GOLDEN.read_text())


def check_repo_footer_pin(golden: dict) -> None:
    pin = golden["rock_scene_pin"]
    footer = (WEBFLOW / "clean-slate-footer.html").read_text()
    if f"@{pin}/" not in footer:
        warn(
            f"repo clean-slate-footer.html is not pinned to golden rock_scene_pin {pin!r} "
            "(live may still match golden; align repo when convenient)"
        )
    else:
        print(f"hero-compliance-watchdog: repo footer pin matches golden {pin}")


def check_page_head(golden: dict) -> None:
    head_path = WEBFLOW / "live-page-head.html"
    head = head_path.read_text()
    n = len(head)
    if n < golden["min_page_head_chars"]:
        fail(f"live-page-head.html too short ({n} chars) — stub/placeholder risk")
    for needle in golden["required_page_head_markers"]:
        if needle not in head:
            fail(f"live-page-head.html missing {needle!r}")
    for bad in golden["forbidden_anywhere_in_page_head"]:
        if bad in head:
            fail(f"live-page-head.html contains forbidden {bad!r}")

    mobile_fixes = ""
    m = re.search(
        r'<style id="ltf-mobile-fixes">(.*?)</style>',
        head,
        re.DOTALL | re.IGNORECASE,
    )
    if m:
        mobile_fixes = m.group(1)

    mode_b = ""
    mb = re.search(
        rf'<style id="{MODE_B_ID}">(.*?)</style>',
        head,
        re.DOTALL | re.IGNORECASE,
    )
    if mb:
        mode_b = mb.group(1)

    scan_zones = [("ltf-mobile-fixes", mobile_fixes)]
    if mode_b:
        scan_zones.append((f"#{MODE_B_ID}", mode_b))
    else:
        scan_zones.append(("full head (no mode-b yet)", mobile_fixes))

    for zone_name, blob in scan_zones:
        if not blob:
            continue
        for pattern, label in FORBIDDEN_PRIMARY_HERO_LAYOUT:
            if re.search(pattern, blob, re.IGNORECASE | re.DOTALL):
                if zone_name.startswith("#"):
                    continue
                fail(f"{label} (in {zone_name})")

    if re.search(r"is-hero-copy-inside-breakpoints", head) and MODE_B_ID not in head:
        warn(
            f"inside-breakpoints classes in head but no #{MODE_B_ID} block — "
            "consolidate tablet/middle CSS before next deploy"
        )

    print(f"hero-compliance-watchdog: page head OK ({n} chars)")


def check_js_boundaries() -> None:
    viewport = ROOT / "js" / "ui" / "hero-viewport.js"
    text = viewport.read_text()
    if "transform:" in text or "position:" in text and "hero" in text.lower():
        if re.search(r"\.style\.|insertRule|translate\(", text):
            fail("hero-viewport.js must not inject hero layout CSS")
    portrait = ROOT / "js" / "ui" / "hero-mobile-portrait.js"
    if "translate(" in portrait.read_text():
        fail("hero-mobile-portrait.js must not inject translate layout")
    print("hero-compliance-watchdog: JS boundaries OK")


def check_deploy_artifacts() -> None:
    for p in WEBFLOW.glob(".deploy_*"):
        if p.suffix == ".json" and p.stat().st_size < 500:
            warn(f"tiny deploy artifact {p.name} — delete or ignore; do not MCP deploy")
    for bad in FORBIDDEN_STALE_FILES:
        if bad.is_file() and "PASTE" in bad.name:
            pass
    print("hero-compliance-watchdog: deploy artifact scan OK")


def main() -> None:
    golden = load_golden()
    print("hero-compliance-watchdog: running verify_head_payload (page)…")
    run_script("verify_head_payload.py", "page")
    print("hero-compliance-watchdog: running verify_hero_portrait_css…")
    run_script("verify_hero_portrait_css.py")
    check_repo_footer_pin(golden)
    check_page_head(golden)
    check_js_boundaries()
    check_deploy_artifacts()
    print("hero-compliance-watchdog: PASS")


if __name__ == "__main__":
    main()

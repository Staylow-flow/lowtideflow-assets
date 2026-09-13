#!/usr/bin/env python3
"""
Architecture & freeze watchdog — LOCKED-BUILD + deploy constraints + stuck-live detection.

Run before deploy and on schedule (with live-drift). Exit 1 blocks MCP placeholder deploys
and signals a frozen/wrong live pin when consecutive drift failures exceed threshold.

Procedure map: webflow/LOCKED-BUILD.md pre-change checklist + DEPLOY.md + cursor rules.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WATCHDOGS = Path(__file__).resolve().parent
WEBFLOW = WATCHDOGS.parent
ROOT = WEBFLOW.parent
ARCH_GOLDEN = WATCHDOGS / "architecture-golden.json"
HERO_GOLDEN = WATCHDOGS / "hero-golden.json"
USER_AGENT = "LTF-Architecture-Freeze-Watchdog/1.0"


def fail(msg: str) -> None:
    print(f"architecture-freeze-watchdog: FAIL — {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str) -> None:
    print(f"architecture-freeze-watchdog: WARN — {msg}", file=sys.stderr)


def load_json(path: Path) -> dict:
    if not path.is_file():
        fail(f"missing {path}")
    return json.loads(path.read_text())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def check_checksums(arch: dict) -> None:
    rel = arch["checksums_file"]
    manifest = WEBFLOW / rel
    if not manifest.is_file():
        warn(f"checksums manifest missing ({rel}) — skip")
        return
    bad = []
    for line in manifest.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        expected, relpath = parts[0], parts[1].strip()
        if relpath.startswith("webflow/"):
            fp = ROOT / relpath
        elif relpath.startswith("js/"):
            fp = ROOT / relpath
        else:
            fp = WEBFLOW / relpath
        if not fp.is_file():
            bad.append(f"{relpath} (missing)")
            continue
        if sha256_file(fp) != expected:
            bad.append(relpath)
    if bad:
        fail(
            "canonical checksum drift — update webflow/_LOCKED/CHECKSUMS.sha256 after "
            f"intentional edits: {', '.join(bad)}"
        )
    print("architecture-freeze-watchdog: CHECKSUMS.sha256 OK")


def check_clean_slate_footer(arch: dict, hero_pin: str) -> None:
    cfg = arch["clean_slate_footer"]
    footer_path = WATCHDOGS / cfg["file"]
    text = footer_path.read_text()
    scripts = re.findall(
        r'<script\s+[^>]*src="([^"]+)"',
        text,
        re.I,
    )
    if len(scripts) != cfg["script_count"]:
        fail(
            f"clean-slate-footer.html must have exactly {cfg['script_count']} script tags "
            f"(found {len(scripts)}) — see LOCKED-BUILD.md"
        )
    pins = set()
    for i, expected_suffix in enumerate(cfg["script_paths_in_order"]):
        src = scripts[i]
        if expected_suffix not in src:
            fail(f"footer tag {i + 1} must load {expected_suffix!r}, got {src!r}")
        m = re.search(r"lowtideflow-assets@([0-9a-f]+)/", src, re.I)
        if not m:
            fail(f"footer tag {i + 1} missing jsDelivr pin: {src!r}")
        pins.add(m.group(1).lower())
    if len(pins) != 1:
        fail(f"footer tags must share one commit pin (got {sorted(pins)})")
    pin = pins.pop()
    if pin != hero_pin.lower():
        fail(
            f"footer pin {pin!r} != hero-golden rock_scene_pin {hero_pin!r} "
            "(align clean-slate-footer.html + hero-golden.json + PIN-MANIFEST.md)"
        )
    for forbidden in cfg["forbidden_footer_scripts"]:
        if forbidden in text:
            fail(f"forbidden script in footer: {forbidden!r}")
    for needle in cfg.get("forbidden_markers", []):
        if needle in text:
            fail(
                f"clean-slate-footer.html must not contain {needle!r} — "
                "use site-custom-footer-code.html (global site footer slot)"
            )
    print(f"architecture-freeze-watchdog: Clean-Slate footer 3-tag @ {pin} OK")


def check_site_global_footer_code(arch: dict) -> None:
    cfg = arch.get("site_global_footer_code")
    if not cfg:
        return
    path = WATCHDOGS / cfg["file"]
    if not path.is_file():
        fail(f"missing site global footer source {cfg['file']}")
    text = path.read_text()
    for needle in cfg.get("forbidden_markers", []):
        if needle in text:
            fail(
                f"site-custom-footer-code.html must not contain {needle!r} — "
                "hero CSS → live-page-head #ltf-mobile-fixes; site footer bar FX → ltf-site-footer-fx.html"
            )
    print("architecture-freeze-watchdog: site global footer code OK")


def check_page_head_architecture(arch: dict) -> None:
    cfg = arch["page_head"]
    path = WATCHDOGS / cfg["canonical"]
    head = path.read_text()
    for bad in cfg["forbidden_markers"]:
        if bad in head:
            fail(f"live-page-head.html must not contain {bad!r} (architecture violation)")
    if cfg["forbidden_page_script_src"] in head:
        if re.search(r"<script[^>]+src=[^>]+" + re.escape(cfg["forbidden_page_script_src"]), head, re.I):
            fail(
                "Clean-Slate page head must not load jsDelivr scripts — "
                "use Before </body> footer only (LOCKED-BUILD)"
            )
    if 'id="ltf-hero-mode-b"' in head:
        mode_b = re.search(r'<style id="ltf-hero-mode-b">(.*?)</style>', head, re.S | re.I)
        mobile = re.search(r'<style id="ltf-mobile-fixes">(.*?)</style>', head, re.S | re.I)
        if mode_b and mobile:
            for pat in (r"is-hero-copy-inside-breakpoints", r"is-hero-logo-inside"):
                if re.search(pat, mobile.group(1)) and not re.search(pat, mode_b.group(1)):
                    fail(
                        "middle-mode Inside classes must not live only in #ltf-mobile-fixes — "
                        "use #ltf-hero-mode-b"
                    )
    print("architecture-freeze-watchdog: page head architecture OK")


def check_site_head_sources(arch: dict) -> None:
    for rel in arch["site_head_sources"]:
        p = WATCHDOGS / rel
        if not p.is_file():
            fail(f"missing site head source {rel}")
        t = p.read_text()
        if "PLACEHOLDER" in t or "@file:" in t:
            fail(f"{rel} contains placeholder deploy token")
    nav = (WATCHDOGS / arch["site_head_sources"][0]).read_text()
    foot = (WATCHDOGS / arch["site_head_sources"][1]).read_text()
    if 'id="ltf-site-nav-fx"' not in nav:
        fail("site-nav-fx.html missing #ltf-site-nav-fx")
    if 'id="ltf-site-footer-fx"' not in foot:
        fail("ltf-site-footer-fx.html missing #ltf-site-footer-fx")
    print("architecture-freeze-watchdog: site head source files OK")


def check_pin_manifest(hero_pin: str) -> None:
    manifest = (WATCHDOGS / "../PIN-MANIFEST.md").resolve().read_text()
    if f"`{hero_pin}`" not in manifest and f"@{hero_pin}/" not in manifest:
        warn(f"PIN-MANIFEST.md may not mention pin {hero_pin!r}")
    else:
        print(f"architecture-freeze-watchdog: PIN-MANIFEST references {hero_pin}")


def fetch_live_pin(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        warn(f"live fetch skipped ({e})")
        return None
    pins = re.findall(r"lowtideflow-assets@([0-9a-f]+)/js/hero/rock-scene", html, re.I)
    if not pins:
        return None
    return sorted(set(pins))[0].lower()


def update_freeze_state(arch: dict, hero: dict, live_pin: str | None) -> None:
    cfg = arch["freeze"]
    state_path = WATCHDOGS / cfg["state_file"]
    expected = hero["rock_scene_pin"].lower()
    prev = {}
    if state_path.is_file():
        try:
            prev = json.loads(state_path.read_text())
        except json.JSONDecodeError:
            prev = {}

    mismatch = live_pin is not None and live_pin != expected
    streak = prev.get("consecutive_pin_mismatch", 0)
    if mismatch:
        streak += 1
    else:
        streak = 0

    payload = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "expected_pin": expected,
        "live_pin": live_pin,
        "consecutive_pin_mismatch": streak,
        "last_compliance_pass_utc": prev.get("last_compliance_pass_utc"),
    }
    if not mismatch and live_pin:
        payload["last_live_ok_utc"] = payload["checked_at_utc"]
    state_path.write_text(json.dumps(payload, indent=2) + "\n")

    max_bad = int(cfg["max_consecutive_live_pin_mismatch"])
    if streak >= max_bad:
        fail(
            f"live pin frozen wrong {streak} checks in a row "
            f"(live {live_pin!r} vs golden {expected!r}) — paste footer + Publish or bump golden"
        )
    if mismatch:
        warn(
            f"live pin {live_pin!r} != golden {expected!r} "
            f"({streak}/{max_bad} toward freeze FAIL)"
        )
    elif live_pin:
        print(f"architecture-freeze-watchdog: live pin {live_pin} matches golden")


def run_child(script: str, *args: str) -> None:
    proc = subprocess.run(
        [sys.executable, str(WATCHDOGS / script), *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout, end="")
        print(proc.stderr, end="", file=sys.stderr)
        fail(f"{script} exited {proc.returncode}")
    print(proc.stdout.strip())


def main() -> None:
    arch = load_json(ARCH_GOLDEN)
    hero = load_json(HERO_GOLDEN)
    pin = hero["rock_scene_pin"]

    print("architecture-freeze-watchdog: running hero-compliance-watchdog…")
    run_child("hero-compliance-watchdog.py")

    restore = WEBFLOW / "_restore_head_now.json"
    if restore.is_file():
        print("architecture-freeze-watchdog: running verify_head_payload (site)…")
        proc = subprocess.run(
            [sys.executable, str(WEBFLOW / "verify_head_payload.py"), "site"],
            cwd=str(WEBFLOW),
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0:
            print(proc.stdout.strip())
        else:
            warn("site head payload not verified (assemble _restore_head_now.json before site deploy)")

    check_checksums(arch)
    check_clean_slate_footer(arch, pin)
    check_site_global_footer_code(arch)
    check_page_head_architecture(arch)
    check_site_head_sources(arch)
    check_pin_manifest(pin)

    live_pin = fetch_live_pin(hero["clean_slate_url"])
    update_freeze_state(arch, hero, live_pin)

    state_path = WATCHDOGS / arch["freeze"]["state_file"]
    state = json.loads(state_path.read_text())
    state["last_compliance_pass_utc"] = datetime.now(timezone.utc).isoformat()
    state_path.write_text(json.dumps(state, indent=2) + "\n")

    print("architecture-freeze-watchdog: PASS")


if __name__ == "__main__":
    main()

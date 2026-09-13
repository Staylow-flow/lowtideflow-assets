#!/usr/bin/env python3
"""Preflight gate before Webflow set_*_freeform_code deploy. Exit 1 on any violation."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FORBIDDEN = re.compile(
    r"PLACEHOLDER|@file:|<!--\s*placeholder|TODO deploy|FIXME deploy",
    re.IGNORECASE,
)


def fail(msg: str) -> None:
    print(f"verify_head_payload: FAIL — {msg}", file=sys.stderr)
    sys.exit(1)


def check_content(label: str, content: str, min_len: int, required: list[str]) -> None:
    if not content or not content.strip():
        fail(f"{label}: empty content")
    if len(content) < min_len:
        fail(f"{label}: content too short ({len(content)} < {min_len})")
    if FORBIDDEN.search(content):
        fail(f"{label}: forbidden placeholder/stub pattern in content")
    for needle in required:
        if needle not in content:
            fail(f"{label}: missing required marker {needle!r}")


def site_head() -> str:
    p = ROOT / "_restore_head_now.json"
    if not p.is_file():
        fail("missing webflow/_restore_head_now.json — run DEPLOY.md assemble first")
    data = json.loads(p.read_text())
    actions = data.get("actions") or []
    for a in actions:
        block = a.get("set_site_freeform_code") or {}
        if block.get("location") == "head" and block.get("content"):
            return block["content"]
    fail("_restore_head_now.json has no set_site_freeform_code head action")


def page_head() -> str:
    p = ROOT / "live-page-head.html"
    if not p.is_file():
        fail("missing webflow/live-page-head.html")
    return p.read_text()


def main() -> None:
    target = (sys.argv[1] if len(sys.argv) > 1 else "site").lower()
    if target == "site":
        content = site_head()
        check_content(
            "site head",
            content,
            min_len=15_000,
            required=[
                '<script type="importmap">',
                'id="ltf-site-nav-fx"',
                'id="ltf-site-footer-fx"',
                "ltf-nebula-gradient-shift",
            ],
        )
    elif target == "page":
        content = page_head()
        check_content(
            "clean-slate page head",
            content,
            min_len=5_000,
            required=['id="ltf-clean-slate-fx"'],
        )
    else:
        fail("usage: verify_head_payload.py [site|page]")

    print(f"verify_head_payload: OK ({target}, {len(content)} chars)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Preflight: mobile hero layout in Designer only — head must not fight combo classes."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEAD = ROOT / "live-page-head.html"
FOOTER = ROOT / "clean-slate-footer.html"
JS = ROOT.parent / "js" / "ui" / "hero-mobile-portrait.js"

FORBIDDEN_HEAD = [
    (r"\.ltf-hero-figure[^\{]*\{[^}]*transform:", "shirt transform in page head"),
    (r"is-hero-cta-wrap[^\n]*transform:", "CTA transform override in page head"),
    (r"is-hero-body[^\n]*margin-top:", "copy margin in page head"),
    (r"ltf-main-header[^\n]*line-height:", "H1 line-height override in page head"),
    (r"translate\(40px,\s*\d+px\)", "portrait shirt translate in page head"),
]


def fail(msg: str) -> None:
    print(f"verify_hero_portrait_css: FAIL — {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    head = HEAD.read_text()
    footer = FOOTER.read_text()
    js = JS.read_text()

    for pattern, label in FORBIDDEN_HEAD:
        if re.search(pattern, head, re.IGNORECASE | re.DOTALL):
            fail(label)

    if "ltf-hero-mobile-portrait-lock" in footer or "translate(" in footer:
        fail("footer must not inject hero portrait CSS")

    if "SHIRT_LOCK" in js or "translate(" in js:
        fail("hero-mobile-portrait.js must not inject shirt/H1 CSS")

    if 'id="ltf-hero-shirt-lock"' in head:
        fail("remove ltf-hero-shirt-lock block — layout is Designer-only")

    print("verify_hero_portrait_css: OK (hero layout Designer-only; head overflow/CTA widths only)")


if __name__ == "__main__":
    main()

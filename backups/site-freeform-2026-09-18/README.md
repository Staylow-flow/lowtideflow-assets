# Live site freeform backup — 2026-09-18 (PT)

Captured during Spec IQ + nav Dev work. **Read-only. Live freeform was not edited.**

| File | Source |
|------|--------|
| `head.html` | Published Live HTML extract of importmap + `#ltf-site-nav-fx` + `#ltf-site-footer-fx` (matches MCP site head read: `gap: 2px`, panel `translate3d(0,-12px)`) |
| `footer.html` | Exact MCP `get_site_freeform_code` footer (Acumin swap + `nav.js` @334377c + Open Comms) |

Notable Live values for Nate pin bump later:
- `.ltf-nav-mobile-panel .ltf-nav-links { gap: 2px }` → should become `25px`
- Panel closed state uses `-12px` + opacity fade → Dev wants full `-100%` slide

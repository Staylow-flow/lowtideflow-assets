# PAGE MANIFEST

**Site ID:** `6789f449bbb1a21245706751` · **Locked:** 2026-09-02

---

## Active pages (nav + footer component)

| Page | Slug | Page ID | Nav | Footer | Page-specific code |
|------|------|---------|-----|--------|-------------------|
| Clean Slate | `/clean-slate` | `6a5711c9136987eae97760e3` | ✅ | ✅ | Head: `live-page-head.html` · Footer: `clean-slate-footer.html` (3 JS tags) |
| Instant Quote | `/instant-quote` | `6a59f0368e92a3bd60940ad9` | ✅ | ✅ | Registered scripts @ `329bdae` · Footer HTML: `instant-quote-footer-snippet.html` |
| Production | `/production` | `6a8491e5daf288d38d19811b` | ✅ | ✅ | Site head + nav boot only |
| Tech Specs | `/tech-specs` | `6a849b23830be1b62860e838` | ✅ | ✅ | Site head + nav boot only |
| The Crew | `/the-crew` | `6a848792fcc6aca1efc5952b` | ✅ | ✅ | Site head + nav boot only |
| Brand Matrix | `/brand-matrix` | `6a84a57c668753f0618be30e` | ✅ | ✅ | Site head + nav boot only |

**All six pages** inherit:
- Site head: `#ltf-site-nav-fx` + `#ltf-site-footer-fx` + Three.js importmap
- Site footer script: `ltfnavboot9136b12` → `js/nav.js` (Clean-Slate skips duplicate via `ltf.js` internal boot)

---

## Legacy / not promoted

| Page | Slug | Notes |
|------|------|-------|
| Home (pre-rebrand) | `/` | No `.ltf-site-nav` component — site-wide CSS/JS no-ops harmlessly |
| Clean Slate | `/clean-slate` | Homepage **rebuild** — not yet promoted to serve `/` |

---

## Component instances

| Component | Definition ID | Group |
|-----------|---------------|-------|
| LTF Site Nav | `23f19174-c22b-4e4f-bb47-275e13d3b665` | LTF |
| LTF Site Footer | `8d603833-f37b-f846-7b78-eeff3059e3c6` | LTF |

Edit component definition once in Designer → updates all six page instances.

---

## New page checklist

1. Insert **LTF Site Nav** at top of `<body>`.
2. Insert **LTF Site Footer** at bottom of `<body>`.
3. Do **not** duplicate site head CSS — it is already global.
4. Add row to this manifest.
5. Publish and verify nav scroll-hide + footer on live URL.

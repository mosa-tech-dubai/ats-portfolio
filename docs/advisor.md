# ATS Appraisal tool — working notes

**Internal. Not published, not linked from `index.html`, `noindex` on the page.**
Nothing in this tool quotes a fee: Sell-Ready pricing is unset and the broking line is
not live (`ats-ops/data/car-sales-desk.md` gate 1).

Where to pick this up on another machine. No build step, no dependencies —
but it must be **served**, not opened off the disk:

```
npx http-server .        # then open http://127.0.0.1:8080/advisor.html
```

Double-clicking `advisor.html` shows a message instead of the tools. Browsers
block local data files over `file://`, and service workers need a real origin.

## Files

| File | What's in it |
|---|---|
| `advisor.html` | Markup only. Section order, copy, form fields. |
| `assets/advisor.css` | Styling. Same design tokens as `index.html`, kept separate so the advisor can move without touching the portfolio page. |
| `assets/advisor.js` | `CONFIG` (valuation assumptions only — no fees), then the logic. |
| `data/models.json` | The vehicle database. Single source of truth. |
| `manifest.webmanifest` | Web app manifest — name, icons, standalone display. |
| `sw.js` | Service worker: offline shell. |
| `assets/icons/` | PNG icons for install and home screen, downscaled from the official avatar. |
| `assets/brand/` | The official ATS marks, copied verbatim from the `ats-ops` brand kit. |

`index.html` is untouched apart from one nav link.

## The two edit points

**`CONFIG`** — top of `advisor.js`. Valuation assumptions only: the kilometre
baseline, the condition and history factors, the year curve, and the two seller
routes (trade band, listing uplift, drop step and interval). **There are no fee
fields and none should be added** — see the gate above.

**`data/models.json`** — the reference database, one object per platform. It is
plain JSON with no code in it, so a wrapped mobile app, a print sheet or any
other front end reads the same file rather than a second copy.

- `price: [low, high]` — AED span across the listed year range. **Placeholders.**
  Calibrate these against live Dubizzle / YallaMotor asking prices before the
  page goes public; every valuation is derived from them.
- `rel: 1–5` — durability *in UAE heat*, not a global reliability score.
  Cooling, A/C, rubber and gearbox thermal load are what's being rated.
- `faults` — commonly documented failures. This is the part that earns trust;
  keep it to what you'd actually stand behind on the bench.
- `check` — what ATS puts on the lift and the scanner for that platform.
- `recon: [low, high]` — realistic first-12-months spend on a clean example.
- `tags` — drives the buyer filter: `city, family, offroad, highway, tow,
  economy, fun`. The selected use is a **hard filter** (a saloon never gets
  recommended for dune work); it relaxes only if fewer than 3 cars match.

Adding a car = appending one object to `data/models.json`. Nothing else needs
touching — the seller dropdown, the buyer ranking and the year slider bounds all
read from it. **Bump `CACHE` in `sw.js` after editing it**, or people who
already installed the app keep the old data until their cache is evicted.

## How the numbers are produced

**Buyer ranking** — `scoreModel()`. Weighted on heat durability, use-case match,
budget position, ownership horizon, maintenance appetite, class fit (a large
budget spent on a small car is the wrong answer) and recon exposure as a share
of budget. Cars whose *floor* price exceeds the budget are excluded outright.

**Seller valuation** — `estimateValue()`. Year is interpolated across the band
with `CONFIG.val.yearCurve` (>1 pushes mid-age cars toward the floor — errs
low, which is the safe direction for a seller estimate), then adjusted for
kilometres against a 20,000 km/year local baseline, condition, accident
history, service history and GCC-spec vs import. Output is a ±7% range.

**Seller routes** — mirrors the Jetour T2 precedent in
`ats-ops/data/sell-ready-test-jetour-t2.md`: a Fast Sell trade band, a Proper
Listing start above the expected sale price, and a drop schedule agreed with the
owner *before* listing. The Fast Sell band is labelled **subject to dealer quote**
on the page and stays that way until `T-052` closes.

## Installable app (PWA)

The advisor installs to a phone home screen and runs offline — the whole thing
is static, so once cached it works in a basement car park with no signal.

- **Android / Chrome** — an "Install app" button appears in the hero when the
  browser offers installation. It stays hidden otherwise, which is correct.
- **iOS / Safari** — Share → Add to Home Screen. Apple gives no API to trigger
  this, so there is no button to show.
- **Offline** — `sw.js` precaches the page, CSS, JS, `models.json` and the
  icons, then serves everything stale-while-revalidate. Page loads are
  network-first with a cached fallback.
- **Cache versioning** — `CACHE = 'ats-advisor-v1'` in `sw.js`. Bump it whenever
  a precached file changes. This is the one piece of maintenance the PWA adds.
- **Fonts** — Google Fonts are cross-origin. They get cached after the first
  online visit, but a first run with no connection falls back to system fonts.
  Self-host the three families if that matters.
- **Icons** — downscaled from the official ATS avatar, vendored at
  `assets/brand/ats-avatar-1024x1024.png` (source of truth: the `ats-ops`
  repo, `brand/assets/`). Its badge sits at ~62% of the width, inside the
  maskable safe zone, and the background bleeds to every edge, so the same
  render serves both the plain and the maskable icon. Regenerate by
  downscaling that PNG to 512, 192 and 180 — do not redraw the mark.

### If it ever needs to be in the app stores

Wrap the same files with Capacitor. Google Play is straightforward. Apple
rejects thin web wrappers under guideline 4.2, so it needs native capability
first — VIN camera scan and share-sheet intake of a listing URL are the two
that would both clear review and actually be useful in the field. An iOS build
requires a Mac with Xcode.

## Brand

The marks in `assets/brand/` come from `ats-ops` → `brand/assets/`, which is
the source of truth. Per the brand spec the **badge** is the avatar / favicon /
watermark mark — which is what the nav, the footer and the app icon use here.
The wordmark lockup is for video opens and lower-thirds; the stacked lockup is
for square placements.

The advisor is set to the spec:

| Token | Value | Job |
|---|---|---|
| `--ink` | `#0C0F12` | Charcoal-Ink, the base. Never pure black. |
| `--panel` | `#171B1F` | Ash Panel — cards |
| `--panel-2` | `#1E2328` | inputs and insets |
| `--line` | `#2A3037` | hairlines |
| `--steel` | `#4A535C` | Steel — **borders and dividers only** |
| `--muted` | `#A9A49A` | secondary text and labels |
| `--bone` | `#ECE8E0` | Bone — primary reading |
| `--amber` | `#F2A93B` | Scan Amber — accent, links, every active state |
| `--alert` | `#D6453D` | Caliper Red — alerts, rare by design |

Type: **Oswald 700** headings (signage), **IBM Plex Sans** body
(documentation), **JetBrains Mono** for every number — the spec is explicit
that all data lives in the mono face.

One deliberate departure: the spec describes Steel as also doing secondary
text, but `#4A535C` on `#0C0F12` is 2.3:1, which is unreadable at label sizes.
Steel does borders here and all text sits on `--muted` (9:1). If you want the
spec followed literally instead, that is the line to change.

`index.html` was left on its original burnt-orange palette by decision, so the
two pages differ while sharing a nav link.

## Open items

- [ ] Calibrate `price` bands against live listings (biggest accuracy gap).
- [ ] Confirm the fee numbers in `CONFIG.fees` — currently sensible placeholders.
- [ ] `T-052` — two dealer calls. Until they happen the Fast Sell band is derived
      from comparables, not quotes.
- [ ] Arabic version of the page (RTL — the manifest has `"dir": "ltr"` to change).
- [ ] Self-host the fonts if a cold offline first-run needs to look right.
- [ ] `index.html` is still on the old burnt-orange palette and the improvised
      "A" mark. Aligning it to the spec would make the site consistent.
- [ ] Optional: RTA transfer cost calculator (plates, insurance, Tasjeel test).

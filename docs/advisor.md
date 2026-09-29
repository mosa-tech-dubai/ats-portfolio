# UAE Used Cars Advisor — working notes

Where to pick this up on another machine. No build step, no dependencies:
open `advisor.html` directly, or `npx http-server .` from the repo root.

## Files

| File | What's in it |
|---|---|
| `advisor.html` | Markup only. Section order, copy, form fields. |
| `assets/advisor.css` | Styling. Same design tokens as `index.html`, kept separate so the advisor can move without touching the portfolio page. |
| `assets/advisor.js` | `CONFIG` (all money), `MODELS` (all vehicle data), then the logic. |

`index.html` is untouched apart from one nav link.

## The two edit points

**`CONFIG`** — top of `advisor.js`. Every dirham on the page comes from here:
inspection fees, buyer's-agent fee, the seller fixed fee, the commission
percentage and its floor, plus the valuation assumptions. Change a number here
and the plan cards, the fee comparator and the net-proceeds maths all follow.

**`MODELS`** — the reference database. One object per platform:

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

Adding a car = appending one object. Nothing else needs touching — the seller
dropdown, the buyer ranking and the year slider bounds all read from the array.

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

**Fee comparator** — break-even is `sellerFixed ÷ (commissionPct/100)`. Below
it the commission plan is cheaper for the customer; above it the fixed fee is.
At the current numbers that crossover is AED 100,000.

## Open items

- [ ] Calibrate `price` bands against live listings (biggest accuracy gap).
- [ ] Confirm the fee numbers in `CONFIG.fees` — currently sensible placeholders.
- [ ] Decide whether leads should hit the backend (`/api/…`, as the booking form
      on `index.html` does) instead of, or alongside, the WhatsApp handoff.
- [ ] Arabic version of the page.
- [ ] Optional: RTA transfer cost calculator (plates, insurance, Tasjeel test).

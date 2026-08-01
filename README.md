# BangBuck

**Which AI coding model gives you the most work per dollar?**

Leaderboards rank models by raw capability, so the most expensive model always wins. BangBuck ranks
them by how much real work you get per dollar — using *measured benchmark cost*, not list price.

Currently: **gpt-5.6-luna [max]** — 67.2% of DeepSWE tasks at $0.61 each. Per $100 of spend that's
~111 tasks solved, against ~6 for the top-scoring model.

---

## The formula

Two stages. The capability floor is the whole idea — it's what stops cheap-but-useless models from
winning on price.

```
1. Capability floor       qualified = configs where pass@1 >= floor
2. Efficiency, over qualified configs only
                          BangBuck = pass@1 / (cost × tokens^beta × steps^gamma)
```

Defaults: `floor 0.65`, `beta 0.20`, `gamma 0.20`. All three are sliders in the UI and live in one
place, `DEFAULT_SETTINGS` in `lib/score.ts`.

**Why a floor rather than plain score ÷ cost.** Plain `score/cost` crowns gpt-5.6-luna [high] — 44%
pass rate at $0.16. A model that fails 9 tasks in 10 is not a bargain. The floor says "I need work
that actually completes"; among what clears that bar, price decides.

**Why tokens and steps barely matter (exponent 0.20).** Dollars are already fully captured by cost.
Tokens and steps are proxies for wall-clock time and context-overflow risk — real, but secondary.
At 0.20 they act as a tiebreaker between configs of similar score and price.

Two named tiers ship as presets: **Everyday (65%)** and **High power (72.5%)**. The high-power tier
admits only four configurations and is won by `claude-opus-5 [high]` — 0.8 points below the absolute
frontier at 51% of its price.

The chart has **metric tabs** (Cost / Output tokens / Agent steps) which are not decoration: those
are exactly the three inputs the formula consumes, so switching tabs shows *which* of them is
carrying a given model's rank. All three axes run better-to-the-right, so a tab change never flips
the reader's sense of which direction is good.

---

## ⚠️ The one trap in this codebase

**Do not "simplify" the DeepSWE scraper to fetch `/artifacts/v1.1/leaderboard-live.json`.**

That endpoint returns HTTP 200 and looks authoritative, but it is CDN-cached with outdated pricing.
It reports `gpt-5.6-luna [max]` at **$3.028** when the live price is **$0.6056** — a 5× difference
that changes the winner. Cache-busting does not help. Only two models currently differ between the
two sources, so the bug is easy to miss and silently produces a wrong answer.

`lib/sources/deepswe.ts` scrapes the live page and **throws** if luna [max] comes back above $2.
Leave that guard in.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 28 golden tests
npm run build        # production build; all routes prerender static
```

The site is **fully static** — no database, no cron, no network calls at request time. Everything
comes from `data/snapshot.json`, which is committed.

### Refreshing the data

```bash
npm run refresh -- --dry-run   # scrape both sources, print a diff, write nothing
npm run refresh                # same, then rewrite data/snapshot.json
```

Scraping only ever runs from the CLI, so a broken scrape shows up in your terminal rather than in
front of a visitor. `refresh` prints every config added, removed, or moved more than 2% before it
writes, and refuses to write a partial scrape over good data.

This is deliberate, not laziness: benchmark results only change when a new model is evaluated, so
polling on a timer is wasted work. The plan is event-driven instead — see *Not built yet*.

---

## Layout

```
lib/score.ts            The formula. PURE — no I/O. This is the piece that encodes the judgment call.
lib/score.test.ts       28 golden tests. The numbers here were verified by hand before any code existed.
lib/sources/deepswe.ts  Scrapes the live SSR page (seroval-serialised TanStack payload). Read the trap above.
lib/sources/arena.ts    Scrapes arena.ai's RSC flight payload. Second opinion only.
lib/diff.ts             Snapshot-to-snapshot comparison. Also the engine for the planned release watcher.
lib/normalize.ts        Joins DeepSWE and Arena naming at the model-family level.
lib/metrics.ts          The three chart axes + readable tick generation.
lib/vendors.ts          Canonical vendor names + aliases. Asserted against the data by a test.
components/             UI. ScatterChart.tsx is the dense one; read its module comment first.
                        Hero.tsx is the oversized wordmark and meta strip.
                        VendorMark.tsx draws the company marks — see the note below.
data/snapshot.json      The source of truth. Committed.
scripts/                refresh.ts plus three throwaway analysis scripts (hindsight, sensitivity, tiers).
```

**If you change the formula, expect `score.test.ts` to fail.** That is the point — those numbers are
a contract, not a snapshot of current behaviour. Re-agree them consciously rather than updating them
to match whatever the code now does.

Two tests are worth understanding before you touch anything:

- **`hindsight check`** — rewinding the field to before the gpt-5.6 generation shipped must
  reproduce `claude-opus-5 [medium]` as the winner. That was the pick made by hand, and DeepSWE's own
  2026-06-20 snapshot confirms none of luna/sol/terra existed then. If this breaks, the formula has
  drifted away from the judgment it was built to encode.
- **`valueFrontier`** — every config excluded from the frontier must be genuinely dominated by
  something on it.

---

## Chart constraints that are not cosmetic

`components/ScatterChart.tsx` has three rules that look like style but are load-bearing:

1. **The cost axis must stay logarithmic.** Costs span $0.014–$26.40; a linear axis crushes everything
   interesting into the left edge.
2. **Ranks 2 and 3 must carry labels in their own colour.** Orange vs aqua clears colourblind
   separation only marginally; the coloured label is the secondary encoding that makes it safe. The
   three podium hues are the only trio that passes all-pairs CVD separation on this surface — don't
   substitute them, and don't give all 18 models their own hue.
3. **The grey field never renders at full opacity.** Aqua collides with raw `--text-muted`; it only
   separates once that grey is composited down.

Hover uses nearest-point detection rather than per-mark hit targets, so no mark can occlude another.
Marks have `pointerEvents: none` on purpose.

### Vendor marks

`lib/brand-logos.ts` holds the official marks, generated by `npx tsx scripts/fetch-logos.ts` from
the Iconify API and **committed** — the site is static and must not depend on a CDN at runtime.
Re-run that script only when a vendor rebrands.

No single icon set carries all seven: simple-icons has no OpenAI and no xAI, so those come from the
`logos` set. Moonshot uses the **Kimi** mark, because the models are named `kimi-*` and that is the
brand a reader recognises. Google is the one `multicolour: true` entry — its identity *is* the
four-colour G, so tinting it would be wrong rather than restrained. The other six inherit
`currentColor`, for the same reason ranks 4-18 stay grey. Two of them (OpenAI, Grok) ship with no
`fill` attribute, so `VendorMark` sets `fill="currentColor"` on the wrapping `<svg>` — without it
they default to black and disappear.

These are third-party trademarks, used to identify each company's models in a comparison. They are
not covered by this project's licence.

Vendor names come from Arena and two are not guessable from the model prefix: grok ships under
**"SpaceXAI"** and muse-spark under **"Meta"**. `lib/vendors.ts` holds the canonical list, and a test
asserts every organization in the data resolves to a mark — a missing one degrades to a generic
circle, which reads as a design choice rather than a gap.

---

## Data & attribution

BangBuck does not run benchmarks. It reads published results and applies a cost-efficiency formula.

- **[DeepSWE](https://deepswe.datacurve.ai/)** by Datacurve — 50 configurations across 113
  long-horizon software engineering tasks. Every measured figure in the ranking comes from here.
  Benchmark harness is [Apache-2.0](https://github.com/datacurve-ai/deep-swe).
- **[arena.ai](https://arena.ai/leaderboard)** — human-preference Elo and list pricing. Used as a
  second opinion only; it has no measured cost, tokens, or steps, so it does not affect the score.

Both are scraped from public pages. Model names, scores, and pricing belong to their respective
projects and vendors.

---

## Not built yet

- **Release watcher.** Mark an expected model release, poll both sources daily *until* its score and
  cost appear, then notify and stop. `lib/sources/*` and `lib/diff.ts` are the whole engine already;
  v2 adds scheduling and a notification channel.
- Price-change history (would have caught luna's 5× cut automatically — needs storage).
- More sources behind the same `lib/sources/*` interface.
- Personal-budget mode: "I spend $200/month — here's what to switch to and what you'd save."

---

## A note on the formula

It's a judgment call, not a law. The site says so, shows the knobs, and keeps every excluded config
visible in the table so you can see what the floor threw out. If you disagree, move a slider — and
if you think the defaults are wrong, open an issue with the numbers.
